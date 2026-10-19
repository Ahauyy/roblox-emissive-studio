# Architecture Plan & Technical Specification
## Roblox EmissiveMask Studio (PBR Texture Workstation)

---

### 1. Arsitektur Komponen & Teknologi

```
+-----------------------------------------------------------------------------------+
|                            Roblox EmissiveMask Studio                             |
|                                                                                   |
|  +---------------------------+   +---------------------------------------------+  |
|  |       Control Panel       |   |             Viewport & Inspector            |  |
|  | - Diffuse / UV Dropzone   |   | - 2D Canvas Inspector                       |  |
|  | - Prompt Bar & Presets    |   |   (Emissive | Glow | Diffuse | UV Overlay)   |  |
|  | - Real-time Sliders       |   | - Three.js 3D PBR Viewport                  |  |
|  | - Export & Lua Generator  |   |   (OrbitControls, Bloom, Roblox Shader)     |  |
|  +-------------+-------------+   +----------------------+----------------------+  |
|                |                                        ^                         |
|                v                                        |                         |
|  +------------------------------------------------------+----------------------+  |
|  |                           Emissive Processing Core                          |  |
|  |  +---------------------+   +---------------------+   +-------------------+  |  |
|  |  |  UV Island Parser   |   |   Semantic Parser   |   | Color Segmentor   |  |  |
|  |  | (Connected Comp /   |   | (NLP Entity / Regex |   | (HSV / LAB DeltaE |  |  |
|  |  |  Alpha Threshold)   |   |  & Intent Matcher)  |   |  Spatial Scorer)  |  |  |
|  |  +----------+----------+   +----------+----------+   +---------+---------+  |  |
|  |             |                         |                        |            |  |
|  |             +-------------------------+------------------------+            |  |
|  |                                       v                                     |  |
|  |               +-----------------------------------------------+             |  |
|  |               |       Luminance & Detail Shading Engine       |             |  |
|  |               |  Mask = (Island_Active * Pixel_Affinity)      |             |  |
|  |               |         * (Luminance^gamma * Boost)           |             |  |
|  |               +-----------------------+-----------------------+             |  |
|  |                                       v                                     |  |
|  |               +-----------------------------------------------+             |  |
|  |               |      Roblox Mipmap Seam Dilation Engine       |             |  |
|  |               |  (Morphological 2-4px edge padding expander)  |             |  |
|  |               +-----------------------------------------------+             |  |
+-----------------------------------------------------------------------------------+
```

---

### 2. Algoritma & Pipeline Detail

#### Tahap 1: Ekstraksi UV Island (Topology Analysis)
1. Baca piksel gambar UV Layout (1024×1024).
2. Jika memiliki channel Alpha ($A > 10$), tandai sebagai area poligon mesh. Jika berupa wireframe garis hitam di atas latar belakang putih/transparan, terapkan inversi dan thresholding.
3. Jalankan algoritma **Two-Pass Connected Component Labeling (CCL)** untuk memisahkan setiap poligon/pulau UV secara mandiri.
4. Simpan indeks setiap island:
   $$\text{Island}_k = \{ \text{Area}, \text{BoundingBox}, \text{Centroid}, \text{PixelIndices} \}$$

#### Tahap 2: Semantic Intent & Color Target Parsing
1. Prompt pengguna diparsing untuk mengekstrak:
   - Target Warna: Merah (`#FF0000`), Biru (`#0088FF`), Emas/Kuning, Ungu/Magenta, Cyan, Hijau, dll.
   - Target Wilayah: Seluruh kristal, bagian sayap/shard tertentu, aksen luar.
2. Setiap target warna dipetakan ke rentang sudut HSV (Hue $0^\circ–360^\circ$) dan Saturation ($S > 0.25$).
   - Contoh: Merah ($H \in [0^\circ, 25^\circ] \cup [335^\circ, 360^\circ]$), Biru ($H \in [190^\circ, 260^\circ]$).

#### Tahap 3: Pemetaan Warna ke UV Island
1. Untuk setiap piksel pada gambar Diffuse, hitung skor kedekatan warna terhadap target prompt.
2. Untuk setiap UV Island $k$:
   $$\text{IslandScore}_k = \frac{\sum_{p \in \text{Island}_k} \text{TargetColorMatch}(p)}{\text{Area}_k}$$
3. Jika $\text{IslandScore}_k > \text{Threshold}$, maka seluruh pulau tersebut diaktifkan untuk emisi, atau difilter secara selektif per-subregion kristal.

#### Tahap 4: Shading & Crevice Preservation (Menghasilkan Gambar 3)
1. Menghitung Luminansi Perseptual dari piksel Diffuse:
   $$L = 0.299R + 0.587G + 0.114B$$
2. Normalisasi dan terapkan kurva kontras adaptif (*Gamma & Highlight Boost*):
   $$\text{EmissiveRaw} = \min\left(255, \; 255 \times \left(\frac{L}{255}\right)^\gamma \times \text{Boost}\right)$$
3. Gabungkan dengan masker seleksi:
   $$\text{MaskFinal}(x,y) = \text{IslandActive}(x,y) \times \text{PixelAffinity}(x,y) \times \text{EmissiveRaw}(x,y)$$
4. Hasil: Celah gelap/ambient occlusion tetap gelap, sedangkan punggung kristal (*specular ridge*) memancarkan warna putih solid (255), persis seperti Gambar 3.

#### Tahap 5: Roblox Anti-Bleed Seam Padding (Dilation)
1. Untuk mencegah garis hitam akibat mipmapping LOD di Roblox:
2. Terapkan morphological dilation sebesar $N$ piksel ($N=2..4$ px) di sekeliling batas luar UV Island yang aktif:
   $$\text{MaskPadded} = \text{Dilation}(\text{MaskFinal}, \; \text{Kernel}(N))$$

---

### 3. Struktur Direktori Proyek

```
roblox-emissive-studio/
├── docs/
│   ├── PRD.md
│   └── architecture-plan.md
├── public/
│   ├── favicon.svg
│   └── samples/
│       ├── sample_diffuse.jpg
│       ├── sample_uv.png
│       └── sample_reference_mask.png
├── src/
│   ├── index.html
│   ├── main.js
│   ├── style.css
│   ├── core/
│   │   ├── uvIslandParser.js     # Connected component labeling & UV geometry
│   │   ├── semanticParser.js     # Natural language prompt & color intent parser
│   │   ├── emissiveGenerator.js  # Shading, gamma curve & luminance synthesizer
│   │   └── seamDilation.js       # Roblox mipmap anti-bleed padding engine
│   ├── components/
│   │   ├── dropZone.js           # Drag & Drop file handler & preset loader
│   │   ├── canvasViewer.js       # 2D Split/Tab viewer (Mask, Glow, Diffuse, UV)
│   │   ├── viewport3D.js         # Three.js 3D PBR preview with Roblox bloom
│   │   ├── controlPanel.js       # Real-time sliders & quick action buttons
│   │   └── codeExporter.js       # 1-Click PNG download & Roblox Lua code helper
├── package.json
└── vite.config.js
```
