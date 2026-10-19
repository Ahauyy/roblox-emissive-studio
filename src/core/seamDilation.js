/**
 * seamDilation.js
 * Morphological dilation engine to apply edge padding (bleed) around active UV islands.
 * Crucial for Roblox Studio: Prevents dark borders/black seam artifacts during mipmapping.
 */

export class SeamDilation {
  /**
   * Apply morphological dilation to a grayscale mask
   * @param {Uint8Array} maskArray - 1D array of mask values (0-255)
   * @param {number} width - Texture width (1024)
   * @param {number} height - Texture height (1024)
   * @param {number} paddingPx - Dilation radius in pixels (1 to 8)
   * @returns {Uint8Array} Dilated mask array
   */
  static dilate(maskArray, width, height, paddingPx = 3) {
    if (paddingPx <= 0) return maskArray;

    let current = new Uint8Array(maskArray);
    let buffer = new Uint8Array(width * height);

    // Iterative 1-pixel dilation for N passes with cross/box kernel
    for (let pass = 0; pass < paddingPx; pass++) {
      buffer.set(current);

      for (let y = 0; y < height; y++) {
        const row = y * width;
        const up = y > 0 ? (y - 1) * width : row;
        const down = y < height - 1 ? (y + 1) * width : row;

        for (let x = 0; x < width; x++) {
          const idx = row + x;
          const left = x > 0 ? row + (x - 1) : idx;
          const right = x < width - 1 ? row + (x + 1) : idx;

          // If current pixel is low/zero, take maximum from neighbors
          if (current[idx] < 10) {
            const maxVal = Math.max(
              current[idx],
              current[left],
              current[right],
              current[up + x],
              current[down + x]
            );

            // Apply slight falloff for smooth padding
            if (maxVal > 0) {
              buffer[idx] = Math.max(buffer[idx], Math.round(maxVal * 0.95));
            }
          }
        }
      }

      // Swap buffers
      const temp = current;
      current = buffer;
      buffer = temp;
    }

    return current;
  }
}
