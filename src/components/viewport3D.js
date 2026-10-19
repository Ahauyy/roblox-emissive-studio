/**
 * viewport3D.js
 * Realtime 3D Roblox PBR Viewport with Three.js
 * Visualizes Diffuse + EmissiveMask + Lighting Bloom in real-time.
 */

import * as THREE from 'three';

export class Viewport3D {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mesh = null;
    this.material = null;
    this.diffuseTexture = null;
    this.emissiveTexture = null;
    this.animId = null;
    this.isDarkEnvironment = true;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 400;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.updateBackground();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 3.5);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(5, 8, 5);
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.PointLight(0x0088ff, 2.0, 10);
    this.rimLight.position.set(-3, -2, -2);
    this.scene.add(this.rimLight);

    // 5. Geometry: Beautiful Faceted Crystal / Gem Accessory
    const geometry = new THREE.IcosahedronGeometry(1.2, 2);
    
    // 6. Roblox PBR SurfaceAppearance Simulation Material
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.15,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.5
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    // 7. Mouse Orbit interaction
    this.setupOrbitControls();

    // 8. Resize observer
    const ro = new ResizeObserver(() => this.onResize());
    ro.observe(this.container);

    // 9. Animation loop
    this.animate();
  }

  updateBackground() {
    if (this.isDarkEnvironment) {
      this.scene.background = new THREE.Color(0x0a0c10); // Roblox Studio Dark Viewport
    } else {
      this.scene.background = new THREE.Color(0x222630);
    }
  }

  setupOrbitControls() {
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;

      if (this.mesh) {
        this.mesh.rotation.y += deltaX * 0.008;
        this.mesh.rotation.x += deltaY * 0.008;
      }

      prevMousePos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.position.z += e.deltaY * 0.002;
      this.camera.position.z = Math.max(1.8, Math.min(6.0, this.camera.position.z));
    }, { passive: false });
  }

  updateTextures(diffuseCanvas, emissiveCanvas) {
    if (diffuseCanvas) {
      if (this.diffuseTexture) this.diffuseTexture.dispose();
      this.diffuseTexture = new THREE.CanvasTexture(diffuseCanvas);
      this.diffuseTexture.colorSpace = THREE.SRGBColorSpace;
      this.material.map = this.diffuseTexture;
    }

    if (emissiveCanvas) {
      if (this.emissiveTexture) this.emissiveTexture.dispose();
      this.emissiveTexture = new THREE.CanvasTexture(emissiveCanvas);
      this.emissiveTexture.colorSpace = THREE.SRGBColorSpace;
      this.material.emissiveMap = this.emissiveTexture;
    }

    this.material.needsUpdate = true;
  }

  setEmissiveIntensity(val) {
    if (this.material) {
      this.material.emissiveIntensity = val;
    }
  }

  toggleLighting() {
    this.isDarkEnvironment = !this.isDarkEnvironment;
    this.updateBackground();
    this.ambientLight.intensity = this.isDarkEnvironment ? 0.25 : 0.8;
    this.dirLight.intensity = this.isDarkEnvironment ? 0.8 : 1.5;
  }

  setMeshType(type) {
    let newGeo;
    if (type === 'crystal') {
      newGeo = new THREE.IcosahedronGeometry(1.2, 1);
    } else if (type === 'torus') {
      newGeo = new THREE.TorusKnotGeometry(0.8, 0.28, 100, 16);
    } else {
      newGeo = new THREE.SphereGeometry(1.2, 32, 32);
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeo;
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());
    if (this.mesh) {
      this.mesh.rotation.y += 0.003; // Gentle ambient rotation
    }
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.renderer) this.renderer.dispose();
  }
}
