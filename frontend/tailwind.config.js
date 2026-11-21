/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        playfair: ['"Playfair Display"', 'Georgia', 'serif'],
        display: ['Geist', 'Inter', '-apple-system', 'sans-serif'],
      },
      colors: {
        base: "#FEFCF3",      // Warm Canvas (FEFCF3)
        panel: "#FFFFFF",     // White Surface
        raised: "#F5EBE0",    // Warm Sand / Linen (F5EBE0)
        blush: "#F0DBDB",     // Soft Blush Mist (F0DBDB)
        ice: "#DBA39A",       // Terracotta Brand Accent (DBA39A)
        line: "#EADBCE",      // Warm Border
        ink: "#2C2220",       // Deep Espresso Text
        muted: "#786864",     // Warm Taupe Text
        stale: "#C04840",     // Deprecated / Contradiction (Crimson)
        fresh: "#2D7751",     // Active / Healthy (Forest Sage)
        caution: "#B26615",   // Reverted / Duplicate (Amber)
      },
      letterSpacing: {
        'tightest': '-0.04em',
        'tighter': '-0.03em',
        'tight': '-0.02em',
        'normal': '-0.011em',
        'wide': '0.025em',
        'wider': '0.05em',
      },
      boxShadow: {
        'soft': '0 2px 10px -2px rgba(44, 34, 32, 0.04), 0 1px 3px -1px rgba(44, 34, 32, 0.02)',
        'card': '0 8px 24px -4px rgba(44, 34, 32, 0.05), 0 4px 8px -3px rgba(44, 34, 32, 0.03)',
        'float': '0 16px 32px -8px rgba(44, 34, 32, 0.08), 0 6px 12px -4px rgba(44, 34, 32, 0.04)',
      }
    },
  },
  plugins: [],
}
