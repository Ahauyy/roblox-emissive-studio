/**
 * main.js
 * Application Controller for Roblox EmissiveMask Studio
 */

import { EmissiveGenerator } from './core/emissiveGenerator.js';
import { CanvasViewer } from './components/canvasViewer.js';
import { Viewport3D } from './components/viewport3D.js';
import { CodeExporter } from './components/codeExporter.js';

class AppController {
  constructor() {
    this.diffuseImage = null;
    this.uvImage = null;
    this.diffuseImageData = null;
    this.uvImageData = null;
    this.currentMaskResult = null;

    this.manualIncludedIslands = new Set();
    this.manualExcludedIslands = new Set();

    this.initDOM();
    this.initCanvasAnd3D();
    this.setupEventListeners();
    this.loadSampleData(); // Pre-load user's sample files on launch!
  }

  initDOM() {
    this.dom = {
      // Inputs & Dropzones
      dropDiffuse: document.getElementById('drop-diffuse'),
      dropUv: document.getElementById('drop-uv'),
      fileDiffuse: document.getElementById('file-diffuse'),
      fileUv: document.getElementById('file-uv'),
      previewDiffuse: document.getElementById('preview-diffuse'),
      previewUv: document.getElementById('preview-uv'),
      promptInput: document.getElementById('prompt-input'),
      btnGenerate: document.getElementById('btn-generate'),
      presetChips: document.querySelectorAll('.chip'),

      // Sliders
      sliderBoost: document.getElementById('slider-boost'),
      sliderGamma: document.getElementById('slider-gamma'),
      sliderTolerance: document.getElementById('slider-tolerance'),
      sliderPadding: document.getElementById('slider-padding'),
      checkInvert: document.getElementById('check-invert'),

      valBoost: document.getElementById('val-boost'),
      valGamma: document.getElementById('val-gamma'),
      valTolerance: document.getElementById('val-tolerance'),
      valPadding: document.getElementById('val-padding'),

      // 2D Viewer Elements
      mainCanvas: document.getElementById('main-canvas'),
      overlayCanvas: document.getElementById('overlay-canvas'),
      canvasTabs: document.querySelectorAll('.tab-btn'),
      btnZoomFit: document.getElementById('btn-zoom-fit'),
      btnZoom100: document.getElementById('btn-zoom-100'),

      // Stats
      statStatus: document.getElementById('stat-status'),
      statTime: document.getElementById('stat-time'),
      statIslands: document.getElementById('stat-islands'),
      statActiveIslands: document.getElementById('stat-active-islands'),
      statRes: document.getElementById('stat-res'),

      // 3D Viewport Elements
      viewport3dBox: document.getElementById('viewport-3d-box'),
      btnToggleLight: document.getElementById('btn-toggle-light'),
      selectMeshType: document.getElementById('select-mesh-type'),

      // Island Inspector
      islandInfoCard: document.getElementById('island-info-card'),
      overrideTagsList: document.getElementById('override-tags-list'),
      btnClearOverrides: document.getElementById('btn-clear-overrides'),

      // Header Actions & Modal
      btnLoadSample: document.getElementById('btn-load-sample'),
      btnExportPng: document.getElementById('btn-export-png'),
      btnViewLua: document.getElementById('btn-view-lua'),
      modalLua: document.getElementById('modal-lua'),
      btnCloseModal: document.getElementById('btn-close-modal'),
      codeLuaContent: document.getElementById('code-lua-content'),
      btnCopyLua: document.getElementById('btn-copy-lua')
    };
  }

  initCanvasAnd3D() {
    this.canvasViewer = new CanvasViewer(this.dom.mainCanvas, this.dom.overlayCanvas);
    this.viewport3d = new Viewport3D(this.dom.viewport3dBox);

    // Initial resize
    setTimeout(() => {
      this.canvasViewer.resetTransform();
    }, 100);

    // Island click callback
    this.canvasViewer.onIslandClickCallback = (island) => {
      this.toggleIslandOverride(island);
    };
  }

  setupEventListeners() {
    // Dropzone 1: Diffuse
    this.setupDropzone(this.dom.dropDiffuse, this.dom.fileDiffuse, (file) => {
      this.loadImageFile(file, 'diffuse');
    });

    // Dropzone 2: UV
    this.setupDropzone(this.dom.dropUv, this.dom.fileUv, (file) => {
      this.loadImageFile(file, 'uv');
    });

    // Generate Button & Prompt Enter
    this.dom.btnGenerate.addEventListener('click', () => this.generateMask());
    this.dom.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        this.generateMask();
      }
    });

    // Preset Chips
    this.dom.presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const preset = chip.getAttribute('data-preset');
        this.dom.promptInput.value = preset;
        this.generateMask();
      });
    });

    // Sliders Live Updates
    const updateSlider = () => {
      this.dom.valBoost.textContent = `${this.dom.sliderBoost.value}x`;
      this.dom.valGamma.textContent = this.dom.sliderGamma.value;
      this.dom.valTolerance.textContent = `${this.dom.sliderTolerance.value}x`;
      this.dom.valPadding.textContent = `${this.dom.sliderPadding.value} px`;

      this.viewport3d.setEmissiveIntensity(parseFloat(this.dom.sliderBoost.value));
      this.generateMask();
    };

    [
      this.dom.sliderBoost,
      this.dom.sliderGamma,
      this.dom.sliderTolerance,
      this.dom.sliderPadding,
      this.dom.checkInvert
    ].forEach(slider => slider.addEventListener('input', updateSlider));

    // Tabs
    this.dom.canvasTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.dom.canvasTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabKey = tab.getAttribute('data-tab');
        this.canvasViewer.setTab(tabKey);
      });
    });

    // Zoom Buttons
    this.dom.btnZoomFit.addEventListener('click', () => this.canvasViewer.resetTransform());
    this.dom.btnZoom100.addEventListener('click', () => {
      this.canvasViewer.scale = 1.0;
      this.canvasViewer.render();
    });

    // 3D Controls
    this.dom.btnToggleLight.addEventListener('click', () => this.viewport3d.toggleLighting());
    this.dom.selectMeshType.addEventListener('change', (e) => this.viewport3d.setMeshType(e.target.value));

    // Reset Overrides
    this.dom.btnClearOverrides.addEventListener('click', () => {
      this.manualIncludedIslands.clear();
      this.manualExcludedIslands.clear();
      this.updateOverrideTags();
      this.generateMask();
    });

    // Export PNG
    this.dom.btnExportPng.addEventListener('click', () => {
      CodeExporter.downloadPNG(this.canvasViewer.getMaskCanvas(), 'Roblox_Accessory_EmissiveMask.png');
    });

    // Header Load Sample Button
    this.dom.btnLoadSample.addEventListener('click', () => {
      this.loadSampleData();
    });

    // Modal Lua Script
    this.dom.btnViewLua.addEventListener('click', () => {
      const code = CodeExporter.generateRobloxLua({
        emissiveStrength: parseFloat(this.dom.sliderBoost.value)
      });
      this.dom.codeLuaContent.textContent = code;
      this.dom.modalLua.style.display = 'flex';
    });

    this.dom.btnCloseModal.addEventListener('click', () => {
      this.dom.modalLua.style.display = 'none';
    });

    this.dom.btnCopyLua.addEventListener('click', () => {
      navigator.clipboard.writeText(this.dom.codeLuaContent.textContent).then(() => {
        this.dom.btnCopyLua.textContent = '✅ Berhasil Disalin!';
        setTimeout(() => {
          this.dom.btnCopyLua.textContent = '📋 Salin ke Clipboard';
        }, 2000);
      });
    });
  }

  setupDropzone(dropEl, inputEl, onFileSelected) {
    dropEl.addEventListener('click', () => inputEl.click());

    inputEl.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        onFileSelected(e.target.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropEl.addEventListener(name, (e) => {
        e.preventDefault();
        dropEl.classList.add('active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropEl.addEventListener(name, (e) => {
        e.preventDefault();
        dropEl.classList.remove('active');
      });
    });

    dropEl.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  loadImageFile(file, type) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (type === 'diffuse') {
        this.diffuseImage = img;
        this.diffuseImageData = this.extractImageData(img);
        this.dom.previewDiffuse.style.backgroundImage = `url(${url})`;
        this.canvasViewer.setImageData('diffuse', this.diffuseImageData);
      } else {
        this.uvImage = img;
        this.uvImageData = this.extractImageData(img);
        this.dom.previewUv.style.backgroundImage = `url(${url})`;
        this.canvasViewer.setImageData('uv', this.uvImageData);
      }

      if (this.diffuseImageData && this.uvImageData) {
        this.generateMask();
      }
    };
    img.src = url;
  }

  extractImageData(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1024;
    canvas.height = img.naturalHeight || 1024;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  async loadSampleData() {
    this.dom.statStatus.textContent = 'Memuat Sampel...';
    try {
      const loadImg = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

      const [diffImg, uvImg] = await Promise.all([
        loadImg('/samples/sample_diffuse.jpg'),
        loadImg('/samples/sample_uv.png')
      ]);

      this.diffuseImage = diffImg;
      this.uvImage = uvImg;

      this.diffuseImageData = this.extractImageData(diffImg);
      this.uvImageData = this.extractImageData(uvImg);

      this.dom.previewDiffuse.style.backgroundImage = 'url(/samples/sample_diffuse.jpg)';
      this.dom.previewUv.style.backgroundImage = 'url(/samples/sample_uv.png)';

      this.canvasViewer.setImageData('diffuse', this.diffuseImageData);
      this.canvasViewer.setImageData('uv', this.uvImageData);

      // Set user's prompt example
      this.dom.promptInput.value = 'buatkan emmisivemask pada bagian yang berwarna Biru dan Merah sesuai UV layout';

      this.generateMask();
    } catch (err) {
      console.error('Failed to load sample assets:', err);
      this.dom.statStatus.textContent = 'Gagal Memuat Sampel';
    }
  }

  generateMask() {
    if (!this.diffuseImageData || !this.uvImageData) {
      this.dom.statStatus.textContent = 'Menunggu Input Tekstur';
      return;
    }

    this.dom.statStatus.textContent = 'Memproses...';

    // Parameters
    const promptText = this.dom.promptInput.value.trim() || 'buatkan emmisivemask pada bagian yang berwarna Biru dan Merah sesuai UV layout';
    const intensityBoost = parseFloat(this.dom.sliderBoost.value);
    const creviceGamma = parseFloat(this.dom.sliderGamma.value);
    const colorTolerance = parseFloat(this.dom.sliderTolerance.value);
    const bleedPadding = parseInt(this.dom.sliderPadding.value);
    const invert = this.dom.checkInvert.checked;

    const result = EmissiveGenerator.generate({
      diffuseImageData: this.diffuseImageData,
      uvImageData: this.uvImageData,
      promptText,
      intensityBoost,
      creviceGamma,
      colorTolerance,
      bleedPadding,
      invert,
      manualIncludedIslands: this.manualIncludedIslands,
      manualExcludedIslands: this.manualExcludedIslands
    });

    this.currentMaskResult = result;

    // Send to 2D Canvas Inspector
    this.canvasViewer.setImageData('mask', result.maskImageData);
    this.canvasViewer.setImageData('glow', result.glowImageData);
    this.canvasViewer.setIslandData(result.islands, result.islands ? this.buildLabelMap(result.islands) : null);

    // Update 3D Viewport Textures
    this.viewport3d.updateTextures(
      this.canvasViewer.getDiffuseCanvas(),
      this.canvasViewer.getMaskCanvas()
    );

    // Update Live Statistics Bar
    this.dom.statStatus.textContent = 'Selesai';
    this.dom.statTime.textContent = `${result.stats.durationMs} ms`;
    this.dom.statIslands.textContent = result.stats.totalIslands;
    this.dom.statActiveIslands.textContent = `${result.stats.activeIslandsCount} (${Math.round(result.stats.activePixelsCount / 1000)}k px)`;
    this.dom.statRes.textContent = `${result.stats.width} × ${result.stats.height}`;
  }

  buildLabelMap(islands) {
    const map = new Int32Array(1024 * 1024);
    for (const isl of islands) {
      for (const idx of isl.pixelIndices) {
        map[idx] = isl.id;
      }
    }
    return map;
  }

  toggleIslandOverride(island) {
    if (!this.currentMaskResult) return;
    const isActive = this.currentMaskResult.activeIslandIds.includes(island.id);

    if (isActive) {
      // Toggle off -> exclude
      if (this.manualIncludedIslands.has(island.id)) {
        this.manualIncludedIslands.delete(island.id);
      } else {
        this.manualExcludedIslands.add(island.id);
      }
    } else {
      // Toggle on -> include
      if (this.manualExcludedIslands.has(island.id)) {
        this.manualExcludedIslands.delete(island.id);
      } else {
        this.manualIncludedIslands.add(island.id);
      }
    }

    this.updateOverrideTags();
    this.generateMask();
  }

  updateOverrideTags() {
    const total = this.manualIncludedIslands.size + this.manualExcludedIslands.size;
    this.dom.btnClearOverrides.style.display = total > 0 ? 'inline-block' : 'none';

    if (total === 0) {
      this.dom.overrideTagsList.innerHTML = '<span class="tag-empty">Belum ada pulau yang di-override manual.</span>';
      return;
    }

    let html = '';
    for (const id of this.manualIncludedIslands) {
      html += `<span class="override-chip included">+ Island #${id}</span>`;
    }
    for (const id of this.manualExcludedIslands) {
      html += `<span class="override-chip excluded">- Island #${id}</span>`;
    }
    this.dom.overrideTagsList.innerHTML = html;
  }
}

// Launch on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
