/**
 * canvasViewer.js
 * Multi-mode 2D Canvas Inspector with Split-View, Zoom/Pan, and Interactive Island Inspection.
 */

export class CanvasViewer {
  constructor(canvasElement, overlayCanvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.overlayCanvas = overlayCanvasElement;
    this.overlayCtx = overlayCanvasElement.getContext('2d');

    this.activeTab = 'emissive'; // 'emissive', 'glow', 'diffuse', 'uv', 'split'
    this.splitRatio = 0.5; // for split mode

    // Textures storage
    this.diffuseCanvas = document.createElement('canvas');
    this.uvCanvas = document.createElement('canvas');
    this.maskCanvas = document.createElement('canvas');
    this.glowCanvas = document.createElement('canvas');

    // Pan & Zoom
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isPanning = false;
    this.startPan = { x: 0, y: 0 };

    // Island info
    this.islands = [];
    this.labelMap = null;
    this.hoveredIsland = null;
    this.onIslandClickCallback = null;

    this.setupEvents();
  }

  setupEvents() {
    const el = this.overlayCanvas;

    // Pan & Drag
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        if (this.activeTab === 'split') {
          // Check if clicking near split divider
          const rect = el.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const dividerX = rect.width * this.splitRatio;
          if (Math.abs(mouseX - dividerX) < 15) {
            this.isDraggingSplit = true;
            return;
          }
        }

        this.isPanning = true;
        this.startPan = { x: e.clientX - this.offsetX, y: e.clientY - this.offsetY };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.isDraggingSplit = false;
    });

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDraggingSplit) {
        this.splitRatio = Math.max(0.05, Math.min(0.95, mouseX / rect.width));
        this.render();
        return;
      }

      if (this.isPanning) {
        this.offsetX = e.clientX - this.startPan.x;
        this.offsetY = e.clientY - this.startPan.y;
        this.render();
        return;
      }

      // Check hovered island
      this.checkHoveredIsland(mouseX, mouseY, rect.width, rect.height);
    });

    // Zoom
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.max(0.2, Math.min(6.0, this.scale * zoomFactor));

      // Zoom towards mouse
      this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
      this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
      this.scale = newScale;

      this.render();
    }, { passive: false });

    // Click on island
    el.addEventListener('click', (e) => {
      if (this.isPanning || this.isDraggingSplit) return;
      if (this.hoveredIsland && this.onIslandClickCallback) {
        this.onIslandClickCallback(this.hoveredIsland);
      }
    });
  }

  checkHoveredIsland(mouseX, mouseY, viewWidth, viewHeight) {
    if (!this.labelMap || this.maskCanvas.width === 0) return;

    // Convert mouse view coords to texture coords (0-1024)
    const texX = Math.floor((mouseX - this.offsetX) / this.scale);
    const texY = Math.floor((mouseY - this.offsetY) / this.scale);

    const w = this.maskCanvas.width;
    const h = this.maskCanvas.height;

    let foundIsland = null;
    if (texX >= 0 && texX < w && texY >= 0 && texY < h) {
      const idx = texY * w + texX;
      const id = this.labelMap[idx];
      if (id > 0) {
        foundIsland = this.islands.find(i => i.id === id) || null;
      }
    }

    if (foundIsland !== this.hoveredIsland) {
      this.hoveredIsland = foundIsland;
      this.renderOverlay();
    }
  }

  setImageData(targetName, imageData) {
    let target;
    if (targetName === 'diffuse') target = this.diffuseCanvas;
    else if (targetName === 'uv') target = this.uvCanvas;
    else if (targetName === 'mask') target = this.maskCanvas;
    else if (targetName === 'glow') target = this.glowCanvas;

    if (!target) return;
    target.width = imageData.width;
    target.height = imageData.height;
    const ctx = target.getContext('2d');
    ctx.putImageData(imageData, 0, 0);

    this.render();
  }

  setIslandData(islands, labelMap) {
    this.islands = islands;
    this.labelMap = labelMap;
  }

  setTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  resetTransform() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth || 512;
    const h = parent.clientHeight || 512;

    this.scale = Math.min((w - 40) / 1024, (h - 40) / 1024);
    this.offsetX = (w - 1024 * this.scale) / 2;
    this.offsetY = (h - 1024 * this.scale) / 2;

    this.resizeCanvas(w, h);
    this.render();
  }

  resizeCanvas(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.overlayCanvas.width = w;
    this.overlayCanvas.height = h;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark grid background
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.imageSmoothingEnabled = false; // Crisp pixel inspection

    const texW = this.maskCanvas.width || 1024;
    const texH = this.maskCanvas.height || 1024;

    // Draw checkerboard for transparent areas
    this.drawCheckerboard(ctx, texW, texH);

    if (this.activeTab === 'split') {
      // Split view: Left = Diffuse, Right = Emissive Mask
      const splitX = texW * this.splitRatio;

      // Draw left (Diffuse)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, texH);
      ctx.clip();
      if (this.diffuseCanvas.width > 0) ctx.drawImage(this.diffuseCanvas, 0, 0);
      ctx.restore();

      // Draw right (Emissive Mask)
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, texW - splitX, texH);
      ctx.clip();
      if (this.maskCanvas.width > 0) ctx.drawImage(this.maskCanvas, 0, 0);
      ctx.restore();

      // Split line
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2 / this.scale;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, texH);
      ctx.stroke();

    } else {
      let sourceCanvas = this.maskCanvas;
      if (this.activeTab === 'glow') sourceCanvas = this.glowCanvas;
      else if (this.activeTab === 'diffuse') sourceCanvas = this.diffuseCanvas;
      else if (this.activeTab === 'uv') sourceCanvas = this.uvCanvas;

      if (sourceCanvas.width > 0) {
        ctx.drawImage(sourceCanvas, 0, 0);
      }
    }

    ctx.restore();
    this.renderOverlay();
  }

  renderOverlay() {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    if (this.hoveredIsland) {
      ctx.save();
      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.scale, this.scale);

      const isl = this.hoveredIsland;
      // Draw highlighted bounding box
      ctx.strokeStyle = '#00FF66';
      ctx.lineWidth = 2 / this.scale;
      ctx.fillStyle = 'rgba(0, 255, 102, 0.15)';
      ctx.fillRect(isl.minX, isl.minY, isl.width, isl.height);
      ctx.strokeRect(isl.minX, isl.minY, isl.width, isl.height);

      ctx.restore();

      // Draw Tooltip
      ctx.fillStyle = 'rgba(10, 14, 22, 0.9)';
      ctx.strokeStyle = '#00FF66';
      ctx.lineWidth = 1;
      const tipX = 20;
      const tipY = 20;
      ctx.fillRect(tipX, tipY, 180, 54);
      ctx.strokeRect(tipX, tipY, 180, 54);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px sans-serif';
      ctx.fillText(`UV Island #${isl.id}`, tipX + 12, tipY + 22);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`Area: ${isl.area.toLocaleString()} px`, tipX + 12, tipY + 40);
    }
  }

  drawCheckerboard(ctx, w, h) {
    const size = 16;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#181b24' : '#12141c';
        ctx.fillRect(x, y, Math.min(size, w - x), Math.min(size, h - y));
      }
    }
  }

  getMaskCanvas() {
    return this.maskCanvas;
  }

  getDiffuseCanvas() {
    return this.diffuseCanvas;
  }
}
