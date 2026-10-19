/**
 * emissiveGenerator.js
 * Core engine combining UV topology, semantic color affinity, and luminance detail synthesis.
 * Produces pixel-perfect 1024x1024 Roblox SurfaceAppearance Emissive Masks.
 */

import { UVIslandParser } from './uvIslandParser.js';
import { SemanticParser } from './semanticParser.js';
import { SeamDilation } from './seamDilation.js';

export class EmissiveGenerator {
  /**
   * RGB to HSV converter
   * @param {number} r 0-255
   * @param {number} g 0-255
   * @param {number} b 0-255
   * @returns {{ h: number, s: number, v: number }}
   */
  static rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    let h = 0;
    const s = max === 0 ? 0 : diff / max;
    const v = max;

    if (diff !== 0) {
      if (max === r) {
        h = ((g - b) / diff) % 6;
      } else if (max === g) {
        h = (b - r) / diff + 2;
      } else {
        h = (r - g) / diff + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    return { h, s, v };
  }

  /**
   * Check if a pixel matches the targeted color definitions
   * @param {number} h Hue (0-360)
   * @param {number} s Saturation (0-1)
   * @param {number} v Value (0-1)
   * @param {Array} colorDefs Matched color definitions
   * @param {number} toleranceMultiplier Sensitivity multiplier (0.5 - 2.0)
   * @returns {number} Match weight (0.0 to 1.0)
   */
  static evaluatePixelColorMatch(h, s, v, colorDefs, toleranceMultiplier = 1.0) {
    if (!colorDefs || colorDefs.length === 0) return 0;

    let bestScore = 0;

    for (const def of colorDefs) {
      // Saturation & Value check
      const minSat = (def.minSaturation || 0.20) / toleranceMultiplier;
      const minVal = (def.minValue || 0.15) / toleranceMultiplier;

      if (s < minSat || v < minVal) continue;

      // Special case: White highlights
      if (def.key === 'white') {
        const maxSat = (def.maxSaturation || 0.18) * toleranceMultiplier;
        if (s <= maxSat && v >= minVal) {
          const score = (v - 0.5) * 2;
          if (score > bestScore) bestScore = Math.min(1.0, score);
        }
        continue;
      }

      // Check Hue ranges
      for (const range of def.hueRanges) {
        let inRange = false;
        let dist = 0;

        if (range.min <= range.max) {
          if (h >= range.min && h <= range.max) {
            inRange = true;
          } else {
            dist = Math.min(Math.abs(h - range.min), Math.abs(h - range.max));
          }
        } else {
          // Wrapped across 0 / 360 (e.g. red [335..360] and [0..22])
          if (h >= range.min || h <= range.max) {
            inRange = true;
          } else {
            dist = Math.min(Math.abs(h - range.min), Math.abs(h - range.max));
          }
        }

        if (inRange) {
          const matchConfidence = Math.min(1.0, s * 1.2) * Math.min(1.0, v * 1.1);
          if (matchConfidence > bestScore) bestScore = matchConfidence;
        } else if (dist < 15 * toleranceMultiplier) {
          // Soft edge falloff
          const soft = (1 - dist / (15 * toleranceMultiplier)) * s;
          if (soft > bestScore) bestScore = soft;
        }
      }
    }

    return bestScore;
  }

  /**
   * Main Generation Pipeline
   * @param {Object} options
   * @returns {Object} Result masks and metadata
   */
  static generate({
    diffuseImageData,
    uvImageData,
    promptText,
    intensityBoost = 1.35,
    creviceGamma = 0.75,
    colorTolerance = 1.0,
    bleedPadding = 3,
    invert = false,
    manualIncludedIslands = new Set(),
    manualExcludedIslands = new Set()
  }) {
    const startTime = performance.now();
    const width = diffuseImageData.width;
    const height = diffuseImageData.height;
    const totalPixels = width * height;

    const diffData = diffuseImageData.data;

    // Step 1: Parse Semantic Prompt
    const parsedIntent = SemanticParser.parsePrompt(promptText);
    const targetColors = parsedIntent.matchedColors;
    const selectAllColors = parsedIntent.selectAllColors;

    // Step 2: Parse UV Islands
    const { islands, labelMap, binary } = UVIslandParser.parseIslands(uvImageData);

    // Step 3: Per-pixel color match and per-island statistics
    const pixelAffinity = new Float32Array(totalPixels);
    const islandColorVotes = new Map();

    for (let p = 0; p < totalPixels; p++) {
      const idx = p * 4;
      const r = diffData[idx];
      const g = diffData[idx + 1];
      const b = diffData[idx + 2];

      const { h, s, v } = this.rgbToHsv(r, g, b);

      let match = 0;
      if (selectAllColors) {
        match = s > 0.25 && v > 0.20 ? s : 0;
      } else {
        match = this.evaluatePixelColorMatch(h, s, v, targetColors, colorTolerance);
      }

      pixelAffinity[p] = match;

      const islandId = labelMap[p];
      if (islandId > 0 && match > 0.15) {
        islandColorVotes.set(islandId, (islandColorVotes.get(islandId) || 0) + 1);
      }
    }

    // Step 4: Determine Active UV Islands
    const activeIslandIds = new Set();
    const islandThresholdRatio = 0.04; // Island is activated if >4% of its pixels match target color

    for (const island of islands) {
      if (manualExcludedIslands.has(island.id)) continue;
      if (manualIncludedIslands.has(island.id)) {
        activeIslandIds.add(island.id);
        continue;
      }

      const votes = islandColorVotes.get(island.id) || 0;
      const ratio = votes / island.area;

      if (ratio >= islandThresholdRatio) {
        activeIslandIds.add(island.id);
      }
    }

    // Step 5: Detail Shading Synthesis (Luminance + Highlight Boost + Crevice Preservation)
    const rawMask = new Uint8Array(totalPixels);
    let activePixelsCount = 0;

    for (let p = 0; p < totalPixels; p++) {
      const islandId = labelMap[p];
      const isIslandActive = activeIslandIds.has(islandId);

      if (!isIslandActive) {
        rawMask[p] = 0;
        continue;
      }

      const affinity = pixelAffinity[p];
      // If inside an active island, give weight to both the island and the local color affinity
      // When inside an active colored crystal island, allow both high color pixels and their surrounding facet shading to emit light
      const blendWeight = Math.max(0.35, affinity);

      const idx = p * 4;
      const r = diffData[idx];
      const g = diffData[idx + 1];
      const b = diffData[idx + 2];

      // Relative Perceptual Luminance
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

      // Apply Gamma curve and Boost
      // High values (ridges) go to 255, dark values (crevices) stay deep
      const shaped = Math.pow(lum, creviceGamma) * intensityBoost * blendWeight;
      const clamped = Math.min(255, Math.max(0, Math.round(shaped * 255.0)));

      rawMask[p] = clamped;
      if (clamped > 5) activePixelsCount++;
    }

    // Step 6: Roblox Anti-Bleed Seam Padding (Dilation)
    const finalMaskArray = SeamDilation.dilate(rawMask, width, height, bleedPadding);

    // Apply Invert if requested
    if (invert) {
      for (let p = 0; p < totalPixels; p++) {
        finalMaskArray[p] = 255 - finalMaskArray[p];
      }
    }

    // Step 7: Create ImageData outputs (Grayscale Mask & Simulated Roblox Bloom Preview)
    const maskImageData = new ImageData(width, height);
    const glowImageData = new ImageData(width, height);

    const mData = maskImageData.data;
    const gData = glowImageData.data;

    for (let p = 0; p < totalPixels; p++) {
      const idx = p * 4;
      const mVal = finalMaskArray[p];

      // 1. Emissive Mask: Pure Grayscale R=G=B=mVal, Alpha=255
      mData[idx] = mVal;
      mData[idx + 1] = mVal;
      mData[idx + 2] = mVal;
      mData[idx + 3] = 255;

      // 2. Simulated Roblox Glow (ColorMap * EmissiveMask + Bloom)
      const baseR = diffData[idx];
      const baseG = diffData[idx + 1];
      const baseB = diffData[idx + 2];

      const glowFactor = mVal / 255.0;
      // Ambient dark background + intense bloom on emissive areas
      const bloomR = Math.min(255, baseR * (0.35 + glowFactor * 1.4));
      const bloomG = Math.min(255, baseG * (0.35 + glowFactor * 1.4));
      const bloomB = Math.min(255, baseB * (0.35 + glowFactor * 1.4));

      gData[idx] = Math.round(bloomR);
      gData[idx + 1] = Math.round(bloomG);
      gData[idx + 2] = Math.round(bloomB);
      gData[idx + 3] = 255;
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      maskImageData,
      glowImageData,
      maskArray: finalMaskArray,
      islands,
      activeIslandIds: Array.from(activeIslandIds),
      parsedIntent,
      stats: {
        durationMs,
        totalIslands: islands.length,
        activeIslandsCount: activeIslandIds.size,
        activePixelsCount,
        width,
        height
      }
    };
  }
}
