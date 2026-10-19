/**
 * semanticParser.js
 * Natural Language Prompt & Color Entity Intent Parser for Texture Assets
 * Supports both Bahasa Indonesia and English semantics.
 */

export class SemanticParser {
  static COLOR_DEFINITIONS = {
    red: {
      name: 'Merah (Red)',
      aliases: ['merah', 'red', 'crimson', 'ruby', 'scarlet', 'maroon', 'fire'],
      hueRanges: [
        { min: 0, max: 22 },
        { min: 335, max: 360 }
      ],
      minSaturation: 0.22,
      minValue: 0.15,
      previewHex: '#FF2A4B'
    },
    blue: {
      name: 'Biru (Blue)',
      aliases: ['biru', 'blue', 'sapphire', 'azure', 'cobalt', 'navy', 'ice'],
      hueRanges: [
        { min: 185, max: 260 }
      ],
      minSaturation: 0.22,
      minValue: 0.15,
      previewHex: '#0088FF'
    },
    green: {
      name: 'Hijau (Green)',
      aliases: ['hijau', 'green', 'emerald', 'lime', 'toxic', 'nature', 'jade'],
      hueRanges: [
        { min: 75, max: 165 }
      ],
      minSaturation: 0.25,
      minValue: 0.15,
      previewHex: '#10B981'
    },
    yellow: {
      name: 'Kuning / Emas (Yellow / Gold)',
      aliases: ['kuning', 'emas', 'gold', 'yellow', 'amber', 'golden'],
      hueRanges: [
        { min: 38, max: 70 }
      ],
      minSaturation: 0.35,
      minValue: 0.30,
      previewHex: '#FBBF24'
    },
    orange: {
      name: 'Oranye (Orange)',
      aliases: ['oranye', 'orange', 'jingga', 'lava', 'magma'],
      hueRanges: [
        { min: 20, max: 40 }
      ],
      minSaturation: 0.40,
      minValue: 0.30,
      previewHex: '#F97316'
    },
    purple: {
      name: 'Ungu / Magenta (Purple)',
      aliases: ['ungu', 'purple', 'violet', 'magenta', 'amethyst', 'void', 'dark magic'],
      hueRanges: [
        { min: 265, max: 335 }
      ],
      minSaturation: 0.25,
      minValue: 0.15,
      previewHex: '#A855F7'
    },
    cyan: {
      name: 'Cyan / Biru Langit (Cyan / Aqua)',
      aliases: ['cyan', 'aqua', 'tosca', 'turqoise', 'biru muda', 'sky blue'],
      hueRanges: [
        { min: 165, max: 195 }
      ],
      minSaturation: 0.25,
      minValue: 0.20,
      previewHex: '#06B6D4'
    },
    white: {
      name: 'Putih / Terang (White / Highlights)',
      aliases: ['putih', 'white', 'terang murni', 'pure white', 'kilau'],
      hueRanges: [
        { min: 0, max: 360 }
      ],
      minSaturation: 0,
      maxSaturation: 0.18,
      minValue: 0.70,
      previewHex: '#FFFFFF'
    }
  };

  /**
   * Parse prompt into structured color filters, target features, and modifiers
   * @param {string} promptText
   * @returns {Object} Structured intent
   */
  static parsePrompt(promptText = '') {
    const raw = promptText.toLowerCase().trim();
    const matchedColors = [];

    // Detect targeted colors
    for (const [colorKey, def] of Object.entries(this.COLOR_DEFINITIONS)) {
      for (const alias of def.aliases) {
        // Regex word boundary match
        const regex = new RegExp(`\\b${alias}\\b`, 'i');
        if (regex.test(raw)) {
          if (!matchedColors.some(c => c.key === colorKey)) {
            matchedColors.push({
              key: colorKey,
              ...def
            });
          }
          break;
        }
      }
    }

    // Fallback: If user wrote "semua yang berwarna" or "all saturated" or prompt has no specific color
    const matchAllSaturated = /\b(semua|all|warna|colored|saturated|berwarna|glowing|accents?)\b/i.test(raw);
    const selectAllColors = matchedColors.length === 0 && matchAllSaturated;

    // Detect intensity modifiers
    let intensity = 1.35; // Default boost
    if (/\b(sangat terang|ultra|super|neon|maksimal|maximum|blinding|very bright)\b/i.test(raw)) {
      intensity = 1.8;
    } else if (/\b(redup|halus|soft|dim|subtle|lembut)\b/i.test(raw)) {
      intensity = 1.05;
    }

    // Detect contrast / crevice treatment
    let creviceGamma = 0.75; // Default good balance
    if (/\b(kontras tinggi|high contrast|deep crevice|tajam|sharp)\b/i.test(raw)) {
      creviceGamma = 0.60; // Darkens low values, punches peaks
    } else if (/\b(halus|smooth|merata|even)\b/i.test(raw)) {
      creviceGamma = 0.90;
    }

    // Detect padding preference
    let bleedPadding = 3;
    const padMatch = raw.match(/padding\s*(\d+)|bleed\s*(\d+)|(\d+)\s*px/i);
    if (padMatch) {
      const val = parseInt(padMatch[1] || padMatch[2] || padMatch[3]);
      if (val >= 0 && val <= 10) bleedPadding = val;
    }

    // Detect invert
    const invert = /\b(invert|kebalikan|balikan|reverse)\b/i.test(raw);

    return {
      rawPrompt: promptText,
      matchedColors,
      selectAllColors,
      intensity,
      creviceGamma,
      bleedPadding,
      invert,
      isDefaultSampleMatch: matchedColors.some(c => c.key === 'red') && matchedColors.some(c => c.key === 'blue')
    };
  }
}
