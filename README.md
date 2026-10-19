# ⚡ Roblox EmissiveMask Studio

> **AI & Deterministic PBR Texture Generator for Roblox UGC Accessories**  
> Generate pixel-perfect 1024×1024 PBR `EmissiveMaskContent` maps for Roblox `SurfaceAppearance` using natural language prompts while preserving organic 3D surface shading.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Roblox PBR](https://img.shields.io/badge/Roblox-SurfaceAppearance-00F0FF?logo=roblox&logoColor=white)](https://create.roblox.com/docs)
[![Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/3D%20Preview-Three.js-black?logo=three.js)](https://threejs.org/)

---

## 📖 Overview

In modern Roblox development, avatar accessories and weapons utilize **`SurfaceAppearance`** to achieve realistic PBR lighting. However, authoring **Emissive Masks** (`EmissiveMaskContent`) has historically required hours of tedious manual UV shell isolation in 2D image editors.

Pure generative AI (e.g., Stable Diffusion / Inpainting) fails because it distorts sub-pixel UV coordinates, blurring polygon boundaries and misaligning textures on 3D meshes.

**Roblox EmissiveMask Studio** solves this with a **Hybrid Multimodal Semantic AI + Deterministic Computer Vision Pipeline**:
- 📐 **100% Pixel-Perfect UV Alignment**: Connected component labeling isolates UV islands with zero spatial drift.
- 🤖 **Semantic Natural Language Prompting**: Understands Indonesian and English prompts (e.g. *"buatkan emmisivemask pada bagian yang berwarna Biru dan Merah sesuai UV layout"*).
- 💎 **Organic Shading & Crevice Preservation**: Extracts perceptual luminance ($L^*$) and applies adaptive gamma curves so crystal ridges glow brightly (255) while crevices and ambient occlusion cracks retain dark depth.
- 🛡️ **Roblox Seam Bleed (Anti-Black Seam Padding)**: Applies morphological dilation (2–4px) to prevent dark outline artifacts caused by Roblox Studio's mipmap LOD generation.
- 🧊 **Real-time 3D Roblox PBR Viewport**: Three.js viewport simulating Roblox lighting and bloom glow.

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **Dual Dropzone** | Drag & drop Diffuse Map (ColorMap) and UV Layout (Alpha/Wireframe). |
| **NLP Prompt Engine** | Direct natural language parsing for colors, intensities, and features. |
| **Quick Presets** | One-click chips for Red & Blue crystals, Saturated Accents, High Contrast Bloom. |
| **Realtime PBR Sliders** | Live adjustment for Emissive Boost, Crevice Gamma, Color Sensitivity, and Seam Padding. |
| **Multi-Mode 2D Inspector** | Tabs for Emissive Mask, Simulated Roblox Glow, Split Before/After wipe slider, Diffuse, and UV Overlay. |
| **Interactive UV Island Tool** | Hover over UV shells to inspect area/ID; click to manually toggle include/exclude. |
| **1-Click 1024×1024 Export** | Downloads an 8-bit grayscale PNG ready to drop into Roblox Studio. |
| **Roblox Luau Script Helper** | Ready-to-paste Command Bar script to attach `SurfaceAppearance` automatically. |

---

## 🛠️ Technology Stack

- **Frontend & Core**: HTML5 Canvas, Vanilla JavaScript (ES Modules), Plus Jakarta Sans & JetBrains Mono typography.
- **3D Graphics**: [Three.js](https://threejs.org/) with `MeshStandardMaterial` PBR shader & bloom post-processing.
- **Build System**: [Vite](https://vitejs.dev/) for instant HMR and optimized production bundling.
- **Processing Engine**: Client-side typed arrays (`Uint8Array`, `Int32Array`) for 60 FPS sub-100ms mask generation without external servers.

---

## 📦 Installation & Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm or pnpm / yarn

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ahauyy/roblox-emissive-studio.git
   cd roblox-emissive-studio
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🎮 Roblox Studio Integration Guide

1. Generate your Emissive Mask in the studio and click **Download EmissiveMask (PNG)**.
2. In Roblox Studio, upload the image via **Asset Manager** or the Creator Dashboard as an Image/Decal.
3. Select your accessory `MeshPart` in the Explorer.
4. Run the following Luau script in the **Command Bar**:

```lua
local Selection = game:GetService("Selection")
local selectedObjects = Selection:Get()

for _, obj in ipairs(selectedObjects) do
    local meshPart = obj:IsA("MeshPart") and obj or obj:FindFirstChildWhichIsA("MeshPart", true)
    if meshPart then
        local existing = meshPart:FindFirstChildWhichIsA("SurfaceAppearance")
        if existing then existing:Destroy() end

        local sa = Instance.new("SurfaceAppearance")
        sa.Name = "EmissivePBR"
        sa.AlphaMode = Enum.AlphaMode.Transparency
        
        -- Insert your uploaded asset IDs:
        sa.EmissiveMaskContent = "rbxassetid://YOUR_UPLOADED_EMISSIVE_ID"
        sa.EmissiveStrength = 1.5
        sa.EmissiveTint = Color3.fromRGB(255, 255, 255)
        
        sa.Parent = meshPart
        print("[EmissiveStudio] SurfaceAppearance applied to " .. meshPart.Name)
    end
end
```

---

## 📁 Project Structure

```
roblox-emissive-studio/
├── docs/
│   ├── PRD.md                  # Comprehensive Product Requirements Document
│   └── architecture-plan.md    # Architecture & Mathematical Pipeline Specification
├── public/
│   └── samples/                # Sample Diffuse, UV Wireframe & Reference Mask
├── src/
│   ├── index.html              # Main workstation layout
│   ├── main.js                 # App controller & reactivity
│   ├── style.css               # Futuristic glassmorphism styling
│   ├── core/
│   │   ├── uvIslandParser.js   # Two-Pass Connected Component Labeling
│   │   ├── semanticParser.js   # NLP prompt intent & color matcher
│   │   ├── emissiveGenerator.js# Luminance shading & crevice contrast engine
│   │   └── seamDilation.js     # Morphological edge padding for mipmapping
│   └── components/
│       ├── canvasViewer.js     # 2D Canvas inspector with Split-View & Zoom/Pan
│       ├── viewport3D.js       # Realtime Three.js 3D PBR Viewport
│       └── codeExporter.js     # 1-Click PNG & Roblox Luau script generator
├── package.json
└── vite.config.js
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).

---

### Author
Created with ❤️ by **[Axell Satria Elarie (Ahauyy)](https://github.com/Ahauyy)**
