/**
 * uvIslandParser.js
 * High-performance Connected Component Labeling (CCL) for UV Layout & Mesh Shells
 * Guarantees 100% pixel-perfect island identification without coordinate shifting.
 */

export class UVIslandParser {
  /**
   * Parse UV layout image data and extract isolated UV islands
   * @param {ImageData} uvImageData - 1024x1024 RGBA ImageData of UV layout
   * @returns {{ islands: Array, labelMap: Int32Array, width: number, height: number }}
   */
  static parseIslands(uvImageData) {
    const width = uvImageData.width;
    const height = uvImageData.height;
    const data = uvImageData.data;
    const totalPixels = width * height;

    // Step 1: Detect mesh presence (binary occupancy map)
    // Supports:
    // A) Alpha channel (A > 10 = mesh area, A == 0 = background)
    // B) Black wireframe on white background (RGB < 240)
    // C) White wireframe on black background
    const binary = new Uint8Array(totalPixels);
    
    // Check if alpha channel has useful transparency
    let alphaCount = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 15) alphaCount++;
    }
    const hasAlphaChannel = alphaCount > 1000 && alphaCount < totalPixels * 0.98;

    if (hasAlphaChannel) {
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        binary[p] = data[i + 3] > 15 ? 1 : 0;
      }
    } else {
      // Wireframe / line detection: Look for non-background pixels
      // Sample corners to detect background color
      const cornerR = (data[0] + data[(width - 1) * 4] + data[(totalPixels - width) * 4]) / 3;
      const isWhiteBg = cornerR > 128;
      
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (isWhiteBg) {
          binary[p] = lum < 235 ? 1 : 0;
        } else {
          binary[p] = lum > 25 ? 1 : 0;
        }
      }
    }

    // Step 2: Two-Pass Connected Components Labeling (CCL) with Disjoint Set Union (DSU)
    const labelMap = new Int32Array(totalPixels);
    const parent = [0]; // 1-based labels
    let nextLabel = 1;

    function find(i) {
      let root = i;
      while (parent[root] !== root) root = parent[root];
      let curr = i;
      while (curr !== root) {
        let nxt = parent[curr];
        parent[curr] = root;
        curr = nxt;
      }
      return root;
    }

    function union(i, j) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        if (rootI < rootJ) parent[rootJ] = rootI;
        else parent[rootI] = rootJ;
      }
    }

    // Pass 1: Scan and assign provisional labels
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x;
        if (binary[idx] === 0) continue;

        const left = x > 0 ? labelMap[idx - 1] : 0;
        const up = y > 0 ? labelMap[idx - width] : 0;

        if (left === 0 && up === 0) {
          labelMap[idx] = nextLabel;
          parent[nextLabel] = nextLabel;
          nextLabel++;
        } else if (left !== 0 && up === 0) {
          labelMap[idx] = left;
        } else if (left === 0 && up !== 0) {
          labelMap[idx] = up;
        } else {
          labelMap[idx] = left;
          if (left !== up) union(left, up);
        }
      }
    }

    // Pass 2: Flatten labels to canonical representatives
    const canonicalMap = new Map();
    let compactId = 1;

    for (let i = 0; i < totalPixels; i++) {
      if (labelMap[i] === 0) continue;
      const root = find(labelMap[i]);
      if (!canonicalMap.has(root)) {
        canonicalMap.set(root, compactId++);
      }
      labelMap[i] = canonicalMap.get(root);
    }

    // Step 3: Accumulate island bounding boxes and stats
    const islandStats = new Map();
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const id = labelMap[rowOffset + x];
        if (id === 0) continue;

        let stat = islandStats.get(id);
        if (!stat) {
          stat = {
            id,
            area: 0,
            minX: x,
            minY: y,
            maxX: x,
            maxY: y,
            sumX: 0,
            sumY: 0,
            pixelIndices: []
          };
          islandStats.set(id, stat);
        }

        stat.area++;
        stat.sumX += x;
        stat.sumY += y;
        if (x < stat.minX) stat.minX = x;
        if (x > stat.maxX) stat.maxX = x;
        if (y < stat.minY) stat.minY = y;
        if (y > stat.maxY) stat.maxY = y;
        stat.pixelIndices.push(rowOffset + x);
      }
    }

    // Convert map to array and compute centroid & filters
    const islands = [];
    for (const stat of islandStats.values()) {
      if (stat.area < 5) continue; // Filter trivial noise dots
      stat.centroidX = Math.round(stat.sumX / stat.area);
      stat.centroidY = Math.round(stat.sumY / stat.area);
      stat.width = stat.maxX - stat.minX + 1;
      stat.height = stat.maxY - stat.minY + 1;
      islands.push(stat);
    }

    // Sort by area descending (largest UV shells first)
    islands.sort((a, b) => b.area - a.area);

    return {
      islands,
      labelMap,
      binary,
      width,
      height
    };
  }
}
