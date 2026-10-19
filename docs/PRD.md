# Product Requirements Document (PRD)
## Roblox EmissiveMask Studio for Accessories & UGC

- **Versi**: 1.0.0
- **Status**: Disetujui (Ready for Execution)
- **Target Platform**: Modern Web Browser (Vite + Canvas 2D / Three.js PBR Engine)
- **Author**: Antigravity AI & Axell Satria Elarie

---

### 1. Ringkasan Eksekutif (Executive Summary)
**Roblox EmissiveMask Studio** adalah workstation web profesional yang dirancang khusus bagi para 3D Modeler dan UGC Creator Roblox. Aplikasi ini mengotomatiskan pembuatan peta tekstur **EmissiveMask (1024×1024 PBR)** dari pasangan gambar **Diffuse Texture (ColorMap)** dan **UV Layout (Wireframe/Alpha)** menggunakan input prompt bahasa alami (Bahasa Indonesia / English).

Dengan pendekatan **Hybrid Multimodal Semantic AI & Deterministic Computer Vision**, aplikasi ini menjamin **100% akurasi piksel UV**, mempertahankan kedalaman pencahayaan permukaan (*luminance shading & crevice retention*), serta secara otomatis menambahkan *anti-bleed dilation (padding)* agar tekstur tidak mengalami garis hitam (*dark seams*) saat di-render oleh sistem mipmapping Roblox Studio.

---

### 2. Latar Belakang & Analisis Masalah
Pada ekosistem Roblox modern, material realistis pada `MeshPart` diatur melalui instance `SurfaceAppearance` yang mendukung properti `EmissiveMaskContent`, `EmissiveStrength`, dan `EmissiveTint`.

**Masalah yang Dihadapi Creator UGC**:
1. **Pengerjaan Manual Memakan Waktu**: Memisahkan bagian kristal, neon, atau ornamen bersinar di Photoshop/Substance Painter membutuhkan masking manual satu per satu pada ratusan UV island.
2. **Kegagalan Model AI Generatif Murni**: Model difusi (seperti Stable Diffusion/DALL-E) menggeser koordinat piksel dan mengaburkan batas poligon UV, sehingga tekstur yang dihasilkan meleset dari model 3D di Roblox Studio.
3. **Hasil Mask Datar (Flat Silhouette)**: Generator sederhana berbasis threshold warna menghasilkan siluet putih solid kaku (255 flat), yang menghilangkan detail retakan, bevel, dan lekukan kristal 3D.
4. **Masalah Mipmapping Roblox (Dark Seams)**: Jika mask terpotong kaku persis di tepi poligon UV tanpa *seam padding (bleed)*, Roblox Studio akan merender garis hitam di sambungan mesh saat kamera menjauh.

---

### 3. Visi & Target Pengguna
- **Visi Produk**: Menjadi standar tool tercepat, paling presisi, dan paling memukau bagi Roblox Creator dalam menghasilkan tekstur Emissive PBR tanpa friksi software 3D yang berat.
- **Target Persona**:
  - Roblox UGC Item Creators (aksesoris sayap, pedang kristal, helm neon, armor sci-fi).
  - 3D Texture Artists & Game Developers Roblox Studio.
  - Creator pemula yang ingin langsung mendapatkan peta glow profesional hanya dengan mengetikkan prompt.

---

### 4. Ruang Lingkup Produk (Scope)

#### MoSCoW Prioritization
- **Must-Have (MVP)**:
  - Drag-and-drop dual input: Diffuse Map & UV Layout (dengan auto-load contoh user bawaan).
  - Prompt Bar: Pemrosesan prompt bahasa alami (e.g. *"buatkan emissivemask pada bagian yang berwarna Biru dan Merah sesuai UV layout"*).
  - Hybrid Processing Engine: Segmentasi warna HSV/LAB presisi + ekstraksi UV island deterministik.
  - Shading & Crevice Preservation: Mempertahankan detail luminansi tekstur asli (Gambar 3).
  - Roblox Seam Bleed (Adaptive Padding): Dilation 1px–8px di sekeliling UV border.
  - Multi-view Canvas Inspector: Emissive Mask, Simulated Roblox Glow, Diffuse, dan UV Overlay.
  - 1-Click Export 1024×1024 PNG siap pakai di Roblox Studio.
- **Should-Have**:
  - Slider parameter realtime: Glow Boost, Crevice Gamma, Color Tolerance, Bleed Padding, Invert Mask.
  - Preset cepat: *"Blue & Red Crystal"*, *"All Saturated Accents"*, *"High Contrast Bloom"*.
  - Generator Roblox Lua Script siap copy untuk pasang `SurfaceAppearance` otomatis di Studio.
- **Could-Have**:
  - Realtime 3D Viewport (Three.js) dengan shader Roblox PBR + Bloom Glow.
  - Manual Island Click-to-Toggle (klik langsung pulau UV untuk menambah/menghapus glow).
- **Won't-Have (Out of Scope)**:
  - Generasi Diffuse texture dari nol.
  - Baking normal map / high-poly geometry baking.

#### Rabbit Holes & No-Gos
- **Rabbit Hole**: Menggunakan AI Diffusion Server eksternal yang lambat dan merusak UV coordinate.
  - *Solusi/Bypass*: Gunakan Canvas Pixel Pipeline deterministik di sisi browser + Semantic NLP Parser lokal berkecepatan instan (<100ms) dengan opsi Gemini Multimodal API.
- **No-Go**: Tidak boleh menghasilkan mask selain format grayscale 8-bit beresolusi identik dengan input (standar Roblox 1024×1024).

---

### 5. Persyaratan Fungsional (Functional Requirements)

| ID | Modul | Deskripsi Kebutuhan |
| :--- | :--- | :--- |
| **FR-001** | Asset Ingestion | Sistem menerima file gambar Diffuse (PNG/JPG) dan UV Layout (PNG Alpha/Wireframe) via Drag & Drop atau File Picker. Tersedia tombol 1-klik untuk memuat sampel bawaan user. |
| **FR-002** | UV Island Extraction | Sistem membedah layout UV menjadi segmen individual *connected components* dengan akurasi 100% piksel tanpa distorsi spasial. |
| **FR-003** | Semantic Prompt Engine | Sistem menganalisis prompt teks pengguna (Bahasa Indonesia & Inggris) untuk mengekstrak entitas warna (Merah, Biru, Emas, dll.), intensitas, dan target semantik. |
| **FR-004** | Feature Segmentation | Sistem mencocokkan distribusi warna tiap piksel dan tiap UV island dengan entitas warna yang diminta oleh prompt. |
| **FR-005** | Luminance Shading | Sistem menghitung luminansi relatif ($L^*$) dari Diffuse map dan menerapkan kurva kontras adaptif sehingga puncak kristal menyala putih (255) dan celah tetap bergradasi gelap. |
| **FR-006** | Seam Bleed Engine | Sistem menerapkan morphological dilation (1–8 piksel) pada batas luar UV island untuk mencegah artefak garis hitam pada mipmapping Roblox. |
| **FR-007** | Realtime Multi-View | Pengguna dapat berpindah tampilan antara: Peta Emissive Grayscale, Simulasi Glow Roblox (Bloom), Tekstur Diffuse, dan Overlay Wireframe UV. |
| **FR-008** | Export & Code Helper | Pengguna dapat mengunduh file PNG 1024×1024 berstandar Roblox dan menyalin skrip Lua `SurfaceAppearance` untuk Roblox Studio. |

---

### 6. Persyaratan Non-Fungsional (Non-Functional Requirements)
- **NFR-001 (Performance)**: Proses generasi mask untuk tekstur 1024×1024 harus selesai dalam waktu kurang dari 500 milidetik pada komputer pengguna.
- **NFR-002 (Privacy & Offline)**: Pemrosesan gambar utama berjalan 100% di browser pengguna (*client-side*), tidak mengunggah aset tekstur privat ke server eksternal tanpa izin.
- **NFR-003 (Pixel Precision)**: Tidak boleh ada pergeseran sub-piksel ($\Delta x = 0, \Delta y = 0$) antara UV layout asli dengan EmissiveMask yang dihasilkan.
- **NFR-004 (Visual Design Excellence)**: Antarmuka mengusung estetika premium Roblox Creator Studio (Dark Theme, Glassmorphism, aksen Cyan & Purple Neon, micro-animations).

---

### 7. Kriteria Penerimaan (Acceptance Criteria)

```gherkin
Scenario: Generasi EmissiveMask dari Contoh User (Kristal Merah & Biru)
  Given Pengguna membuka aplikasi dan memuat Diffuse Map serta UV Layout kristal
  When Pengguna memasukkan prompt "buatkan emmisivemask pada bagian yang berwarna Biru dan Merah sesuai UV layout"
  And Pengguna menekan tombol "Generate EmissiveMask"
  Then Sistem menghasilkan EmissiveMask grayscale 1024x1024 dalam waktu < 500ms
  And Bagian UV island kristal merah dan biru memiliki nilai intensitas tinggi (hingga 255) dengan gradasi celah
  And Bagian batuan hitam/non-kristal bernilai 0 (hitam pekat)
  And Tepi luar UV island memiliki seam padding sebesar 2-4px
  And Gambar hasil mask identik dengan pola pencahayaan pada Gambar 3 yang dilampirkan user.
```
