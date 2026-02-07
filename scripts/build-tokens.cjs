#!/usr/bin/env node
/**
 * Design Token Build Pipeline
 *
 * Reads Figma-exported token JSON files and generates CSS custom properties.
 *
 * Architecture:
 *   tokens/foundation/light.json  →  src/styles/foundation.css   (raw palette)
 *   tokens/semantic/light.json    →  src/styles/semantic.css      (references foundation)
 *   tokens/Sizing/Default.json    →  src/styles/sizing.css        (height, radius, spacing)
 *
 * Foundation layer: --palette-{group}-{shade}
 * Semantic layer:   --color-{role}  → var(--palette-...)
 * Sizing layer:     --height-*, --radius-*, --spacing-*
 *
 * Run:  node scripts/build-tokens.js
 */

const fs = require('fs');
const path = require('path');

const TOKENS_DIR = path.resolve(__dirname, '..', 'tokens');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'src', 'styles');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/* ═══════════════════════════════════════════════════
 * 1. FOUNDATION — raw palette values
 * ═══════════════════════════════════════════════════ */
function buildFoundation() {
  const data = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'foundation', 'light.json'), 'utf8'));
  const lines = [];

  lines.push('/* ══ Foundation Tokens (auto-generated — do NOT edit) ══ */');
  lines.push('/* Source: tokens/foundation/light.json */');
  lines.push(':root {');

  // Pallete_HCT — primary palette used by semantic layer
  const hct = data.Pallete_HCT;
  if (hct) {
    for (const [group, shades] of Object.entries(hct)) {
      const name = group.replace(/_hct$/, '').replace(/\s+/g, '-').toLowerCase();
      lines.push(`  /* ${group} */`);
      for (const [shade, token] of Object.entries(shades)) {
        if (token.$value) {
          lines.push(`  --palette-${name}-${shade}: ${token.$value};`);
        }
      }
      lines.push('');
    }
  }

  // Pallete_HSL — extended palette (optional, for direct use)
  const hsl = data.Pallete_HSL;
  if (hsl) {
    for (const [group, shades] of Object.entries(hsl)) {
      const name = group.toLowerCase();
      lines.push(`  /* hsl/${group} */`);
      for (const [shade, token] of Object.entries(shades)) {
        if (token.$value) {
          lines.push(`  --palette-hsl-${name}-${shade}: ${token.$value};`);
        }
      }
      lines.push('');
    }
  }

  // Shadow tokens (array of boxShadow layers)
  const shadow = data.Shadow;
  if (shadow) {
    lines.push('  /* Shadows */');
    for (const [name, token] of Object.entries(shadow)) {
      if (token.$value) {
        const varName = name.toLowerCase().replace(/\s+/g, '-');
        const layers = Array.isArray(token.$value) ? token.$value : [token.$value];
        const val = layers.map(s => {
          const x = s.x || 0;
          const y = s.y || 0;
          const blur = s.blur || 0;
          const spread = s.spread || 0;
          const color = s.color || 'rgba(0,0,0,0.15)';
          return `${x}px ${y}px ${blur}px ${spread}px ${color}`;
        }).join(', ');
        lines.push(`  --shadow-${varName}: ${val};`);
      }
    }
    lines.push('');
  }

  // Typography foundation tokens
  const typoSections = ['fontFamilies', 'fontWeights', 'fontSize', 'lineHeights', 'letterSpacing'];
  for (const section of typoSections) {
    const sectionData = data[section];
    if (sectionData) {
      const prefix = section.replace(/([A-Z])/g, '-$1').toLowerCase();
      lines.push(`  /* ${section} */`);
      for (const [key, token] of Object.entries(sectionData)) {
        if (token.$value !== undefined) {
          const val = typeof token.$value === 'number' ? `${token.$value}px` : token.$value;
          lines.push(`  --${prefix}-${key}: ${val};`);
        }
      }
      lines.push('');
    }
  }

  lines.push('}');
  const output = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(OUTPUT_DIR, 'foundation.css'), output);
  console.log('✓ foundation.css generated');
}

/* ═══════════════════════════════════════════════════
 * 2. SEMANTIC — references foundation palette
 * ═══════════════════════════════════════════════════ */
function _buildSemanticLines(theme, selector) {
  const data = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'semantic', `${theme}.json`), 'utf8'));
  const lines = [];

  lines.push(`/* ══ Semantic Tokens [${theme}] (auto-generated — do NOT edit) ══ */`);
  lines.push(`/* Source: tokens/semantic/${theme}.json */`);
  lines.push('/* Semantic tokens reference Foundation palette via var() */');
  lines.push(`${selector} {`);

  // Resolve Figma reference "{Pallete_HCT.blue_hct.60}" → "var(--palette-blue-60)"
  function resolveRef(value) {
    if (typeof value !== 'string') return value;
    const match = value.match(/^\{Pallete_HCT\.(\w+)\.(\d+)\}$/);
    if (match) {
      const group = match[1].replace(/_hct$/, '').replace(/\s+/g, '-').toLowerCase();
      const shade = match[2];
      return `var(--palette-${group}-${shade})`;
    }
    // If it's a direct hex or other value, return as-is
    return value;
  }

  // Convert token name to CSS variable name
  function toVarName(group, name) {
    const g = group.toLowerCase().replace(/\s+/g, '-');
    const n = name.toLowerCase().replace(/\s+/g, '-');

    // Map semantic groups to CSS convention
    const groupMap = {
      'primary': 'primary',
      'secondary': 'secondary',
      'tertiary': 'tertiary',
      'warning': 'warning',
      'error': 'error',
      'success': 'success',
      'info': 'info',
      'neutral': '',  // neutral properties don't have "neutral" prefix
    };

    const prefix = groupMap[g] !== undefined ? groupMap[g] : g;

    // Name mappings for the "neutral" group which maps to surface/outline tokens
    const neutralMap = {
      'surface': 'surface',
      'on-surface': 'on-surface',
      'on-surface-variant': 'on-surface-variant',
      'on-surface-variant-2': 'on-surface-variant2',
      'surface-dim': 'surface-dim',
      'surface-bright': 'surface-bright',
      'surface-container-lowest': 'surface-container-lowest',
      'surface-container-low': 'surface-container-low',
      'surface-container': 'surface-container',
      'surface-container-high': 'surface-container-high',
      'surface-container-highest': 'surface-container-highest',
      'outline': 'outline',
      'outline-variant': 'outline-variant',
      'surface-variant': 'surface-variant',
      'inverse-surface': 'inverse-surface',
      'on-inverse-surface': 'on-inverse-surface',
      'scrim': 'scrim',
      'shadow': 'shadow',
      'on-surface-fixed': 'on-surface-fixed',
      'on-surface-fixed-inverse': 'on-surface-fixed-inverse',
    };

    if (g === 'neutral') {
      const mapped = neutralMap[n];
      return mapped ? `--color-${mapped}` : `--color-${n}`;
    }

    // For colored groups: --color-{prefix}-{property} or --color-{prefix}
    if (n === g) {
      return `--color-${prefix}`;
    }
    // Handle "on primary" → "on-primary", "primary container" → "primary-container"
    return `--color-${n.replace(new RegExp(`^${g}-?`), `${prefix}-`).replace(new RegExp(`^on-${g}`), `on-${prefix}`)}`;
  }

  // Process Scheme (color tokens)
  const scheme = data.Scheme;
  if (scheme) {
    for (const [group, tokens] of Object.entries(scheme)) {
      lines.push(`  /* ${group} */`);
      for (const [name, token] of Object.entries(tokens)) {
        if (token.$value) {
          const varName = toVarName(group, name);
          const resolved = resolveRef(token.$value);
          lines.push(`  ${varName}: ${resolved};`);
        }
      }
      lines.push('');
    }
  }

  // Process State layer (hover/pressed/disabled overlays)
  const state = data.State;
  if (state) {
    lines.push('  /* ── State Layers ── */');
    for (const [group, categories] of Object.entries(state)) {
      for (const [category, states] of Object.entries(categories)) {
        for (const [stateName, token] of Object.entries(states)) {
          if (token.$value) {
            const baseVar = toVarName(group, category);
            const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
            lines.push(`  ${baseVar}-${stateSlug}: ${token.$value};`);
          }
        }
      }
    }
    lines.push('');
  }

  lines.push('}');
  return lines;
}

function buildSemantic() {
  // Light theme
  const lightLines = _buildSemanticLines('light', ':root');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'semantic.css'), lightLines.join('\n') + '\n');
  console.log('✓ semantic.css (light) generated');

  // Dark theme
  try {
    const darkLines = _buildSemanticLines('dark', ':root[data-theme="dark"]');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'semantic-dark.css'), darkLines.join('\n') + '\n');
    console.log('✓ semantic-dark.css (dark) generated');
  } catch (e) {
    console.log('⚠ semantic-dark.css skipped: ' + e.message);
  }
}

/* ═══════════════════════════════════════════════════
 * 3. SIZING — height, radius, spacing, breakpoints
 * ═══════════════════════════════════════════════════ */
function buildSizing() {
  const data = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'Sizing', 'Default.json'), 'utf8'));
  const lines = [];

  lines.push('/* ══ Sizing Tokens (auto-generated — do NOT edit) ══ */');
  lines.push('/* Source: tokens/Sizing/Default.json */');
  lines.push(':root {');

  for (const [category, tokens] of Object.entries(data)) {
    lines.push(`  /* ${category} */`);
    for (const [name, token] of Object.entries(tokens)) {
      if (token.$value !== undefined) {
        const unit = category === 'breakpoint' ? 'px' : 'px';
        lines.push(`  --${category}-${name}: ${token.$value}${unit};`);
      }
    }
    lines.push('');
  }

  lines.push('}');
  const output = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sizing.css'), output);
  console.log('✓ sizing.css generated');
}

/* ═══════════════════════════════════════════════════
 * 4. TYPOGRAPHY — semantic type scale referencing foundation
 * ═══════════════════════════════════════════════════ */
function buildTypography() {
  const data = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'foundation', 'light.json'), 'utf8'));
  const semantic = data.semantic;
  if (!semantic) { console.log('⚠ No semantic typography found'); return; }

  // Build lookup tables from foundation primitives
  const fontFamilies = {};
  for (const [k, v] of Object.entries(data.fontFamilies || {})) { fontFamilies[`fontFamilies.${k}`] = v.$value; }

  const fontWeightsRaw = {};
  for (const [k, v] of Object.entries(data.fontWeights || {})) { fontWeightsRaw[`fontWeights.${k}`] = v.$value; }
  // Map weight names → numeric
  const weightNum = { 'Regular': 400, 'Medium': 500, 'SemiBold': 600, 'Bold': 700 };

  const fontSizes = {};
  for (const [k, v] of Object.entries(data.fontSize || {})) { fontSizes[`fontSize.${k}`] = v.$value; }

  const lineHeights = {};
  for (const [k, v] of Object.entries(data.lineHeights || {})) { lineHeights[`lineHeights.${k}`] = v.$value; }

  const letterSpacings = {};
  for (const [k, v] of Object.entries(data.letterSpacing || {})) { letterSpacings[`letterSpacing.${k}`] = v.$value; }

  function resolve(ref) {
    if (typeof ref !== 'string') return ref;
    const key = ref.replace(/^\{/, '').replace(/\}$/, '');
    if (fontFamilies[key] !== undefined) return fontFamilies[key];
    if (fontWeightsRaw[key] !== undefined) return weightNum[fontWeightsRaw[key]] || fontWeightsRaw[key];
    if (fontSizes[key] !== undefined) return fontSizes[key];
    if (lineHeights[key] !== undefined) return lineHeights[key];
    if (letterSpacings[key] !== undefined) return letterSpacings[key];
    return ref;
  }

  const lines = [];
  lines.push('/* ══ Typography Tokens (auto-generated — do NOT edit) ══ */');
  lines.push('/* Source: tokens/foundation/light.json → semantic typography */');
  lines.push('');

  // 1) CSS custom properties for each style
  lines.push(':root {');
  lines.push('  /* Font Family */');
  lines.push('  --font-family-base: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
  lines.push('');

  for (const [styleName, variants] of Object.entries(semantic)) {
    const slug = styleName.toLowerCase().replace(/\s+/g, '-');
    lines.push(`  /* ${styleName} */`);

    for (const [variantName, token] of Object.entries(variants)) {
      if (!token.$value) continue;
      const v = token.$value;
      const vSlug = variantName.toLowerCase().replace(/\s+/g, '-').replace(/^normal-/, 'n-').replace(/^reading-/, 'r-');
      const prefix = `--typo-${slug}-${vSlug}`;

      const fontSize = resolve(v.fontSize);
      const lineHeight = resolve(v.lineHeight);
      const fontWeight = resolve(v.fontWeight);
      const letterSpacing = resolve(v.letterSpacing);

      // Convert letter-spacing from % to em (e.g., "2.52%" → "0.0252em")
      let lsValue = letterSpacing;
      if (typeof lsValue === 'string' && lsValue.endsWith('%')) {
        const pct = parseFloat(lsValue);
        lsValue = `${(pct / 100).toFixed(4)}em`;
      } else if (typeof lsValue === 'number') {
        lsValue = `${(lsValue / 100).toFixed(4)}em`;
      }

      lines.push(`  ${prefix}-size: ${fontSize}px;`);
      lines.push(`  ${prefix}-line-height: ${lineHeight};`);
      lines.push(`  ${prefix}-weight: ${fontWeight};`);
      lines.push(`  ${prefix}-letter-spacing: ${lsValue};`);
    }
    lines.push('');
  }
  lines.push('}');
  lines.push('');

  // 2) Utility CSS classes for each style
  for (const [styleName, variants] of Object.entries(semantic)) {
    const slug = styleName.toLowerCase().replace(/\s+/g, '-');

    for (const [variantName, token] of Object.entries(variants)) {
      if (!token.$value) continue;
      const vSlug = variantName.toLowerCase().replace(/\s+/g, '-').replace(/^normal-/, 'n-').replace(/^reading-/, 'r-');
      const prefix = `--typo-${slug}-${vSlug}`;
      const className = `.typo-${slug}-${vSlug}`;

      lines.push(`${className} {`);
      lines.push(`  font-family: var(--font-family-base);`);
      lines.push(`  font-size: var(${prefix}-size);`);
      lines.push(`  line-height: var(${prefix}-line-height);`);
      lines.push(`  font-weight: var(${prefix}-weight);`);
      lines.push(`  letter-spacing: var(${prefix}-letter-spacing);`);
      lines.push('}');
      lines.push('');
    }
  }

  const output = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(OUTPUT_DIR, 'typography.css'), output);
  console.log('✓ typography.css generated');
}

/* ═══════════════════════════════════════════════════
 * RUN
 * ═══════════════════════════════════════════════════ */
console.log('Building design tokens...\n');
buildFoundation();
buildSemantic();
buildSizing();
buildTypography();
console.log('\nDone! Output → src/styles/');
