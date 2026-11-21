import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Layers, RefreshCw } from 'lucide-react';
import GradientASCII from './GradientASCII';

const PRESETS = {
  ui: {
    label: 'Ivory Horizon',
    backgroundColor: '#FEFCF3',
    colors: ['#FEFCF3', '#F0DBDB', '#DBA39A', '#786864', '#2C2220'],
    isDark: false,
  },
  sand: {
    label: 'Warm Sand',
    backgroundColor: '#F5EBE0',
    colors: ['#F5EBE0', '#F0DBDB', '#DBA39A', '#786864', '#2C2220'],
    isDark: false,
  },
  espresso: {
    label: 'Espresso Noir',
    backgroundColor: '#2C2220',
    colors: ['#2C2220', '#786864', '#DBA39A', '#F0DBDB', '#FEFCF3'],
    isDark: true,
  },
  cobalt: {
    label: 'Cobalt Blue',
    backgroundColor: '#0a0d14',
    colors: ['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8'],
    isDark: true,
  },
};

export default function HeroBanner({ onNavigate }) {
  const [themeKey, setThemeKey] = useState('ui');
  const [collapsed, setCollapsed] = useState(false);

  const activePreset = PRESETS[themeKey] || PRESETS.ui;
  const isDark = activePreset.isDark;

  return (
    <div className="relative mb-8 w-full">
      {/* 580px High GradientASCII Container */}
      <div
        style={{ width: '100%', height: collapsed ? '110px' : '560px', position: 'relative' }}
        className={`group relative overflow-hidden rounded-3xl border transition-all duration-500 ${
          isDark
            ? 'border-white/10 bg-[#0a0d14] shadow-2xl'
            : 'border-line bg-base shadow-card'
        }`}
      >
        {/* Animated ASCII Canvas Background with initiated UI palette */}
        <GradientASCII
          colors={activePreset.colors}
          backgroundColor={activePreset.backgroundColor}
          shape="horizon"
          characters=" =+xX0S8#@"
          cellSize={18}
          density={0.8}
        />

        {/* Dynamic Vignette Overlay to ensure text readability */}
        <div
          className={`pointer-events-none absolute inset-0 backdrop-blur-[0.5px] transition-colors duration-500 ${
            isDark
              ? 'bg-gradient-to-t from-[#0a0d14]/90 via-[#0a0d14]/30 to-[#0a0d14]/80'
              : 'bg-gradient-to-t from-base/90 via-base/30 to-base/75'
          }`}
        />

        {/* Top Controls Bar */}
        <div className="absolute top-4 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-3">
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1 shadow-soft backdrop-blur-md transition ${
              isDark
                ? 'border-white/15 bg-black/40 text-white/90'
                : 'border-line bg-panel/85 text-ink'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ice opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ice" />
            </span>
            <span className="text-[11px] font-mono font-medium uppercase tracking-wider">
              {activePreset.label} · ASCII Horizon
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Pill */}
            <div
              className={`flex items-center rounded-full border p-1 shadow-soft backdrop-blur-md ${
                isDark ? 'border-white/15 bg-black/40' : 'border-line bg-panel/90'
              }`}
            >
              {Object.entries(PRESETS).map(([key, val]) => {
                const isSelected = themeKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setThemeKey(key)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      isSelected
                        ? isDark
                          ? 'bg-white text-ink shadow font-bold'
                          : 'bg-ice text-ink shadow font-bold'
                        : isDark
                        ? 'text-white/60 hover:text-white'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {val.label}
                  </button>
                );
              })}
            </div>

            {/* Collapse / Expand Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition backdrop-blur-md shadow-soft ${
                isDark
                  ? 'border-white/15 bg-black/40 text-white/70 hover:bg-white/10 hover:text-white'
                  : 'border-line bg-panel/90 text-muted hover:text-ink hover:bg-raised'
              }`}
            >
              {collapsed ? 'Expand Hero' : 'Minimize'}
            </button>
          </div>
        </div>

        {/* Foreground Hero Content */}
        {!collapsed && (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
            {/* Top Pill Badge */}
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={`mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 shadow-soft backdrop-blur-md ${
                isDark
                  ? 'border-white/15 bg-white/5 text-white/90'
                  : 'border-line bg-blush/70 text-ink'
              }`}
            >
              <Sparkles className="h-4 w-4 text-ice" />
              <span className="text-xs font-semibold tracking-wide">
                Self-Healing Knowledge Auditor &amp; RAG Contradiction Healer
              </span>
            </motion.div>

            {/* Bold Hero Title */}
            <motion.h1
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="select-none font-black tracking-tight text-5xl sm:text-7xl md:text-8xl"
              style={{
                fontFamily: '"Geist", "Inter", -apple-system, system-ui, sans-serif',
                letterSpacing: '-0.045em',
              }}
            >
              {isDark ? (
                <>
                  <span className="bg-gradient-to-r from-white via-white/95 to-white/80 bg-clip-text text-transparent drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]">
                    CONTEXT
                  </span>{' '}
                  <span className="bg-gradient-to-r from-ice via-[#F0DBDB] to-[#F5EBE0] bg-clip-text text-transparent drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]">
                    DRIFT
                  </span>
                </>
              ) : (
                <>
                  <span className="text-ink drop-shadow-sm">
                    CONTEXT
                  </span>{' '}
                  <span className="bg-gradient-to-r from-ice via-[#C7877D] to-ink bg-clip-text text-transparent drop-shadow-sm">
                    DRIFT
                  </span>
                </>
              )}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`mt-4 max-w-2xl text-sm sm:text-base leading-relaxed ${
                isDark ? 'text-slate-200/90' : 'text-muted'
              }`}
            >
              Intercept out-of-date documentation, eliminate hallucinations from contradictory policies,
              and maintain verifiable lineage across evolving enterprise knowledge bases.
            </motion.p>

            {/* Feature Pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs"
            >
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 shadow-soft backdrop-blur-md ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-200'
                    : 'border-line bg-panel/90 text-ink'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-fresh" />
                <span className="font-medium">Zero Stale Inferences</span>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 shadow-soft backdrop-blur-md ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-200'
                    : 'border-line bg-panel/90 text-ink'
                }`}
              >
                <Zap className="h-3.5 w-3.5 text-caution" />
                <span className="font-medium">Automated Chunk Supersession</span>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 shadow-soft backdrop-blur-md ${
                  isDark
                    ? 'border-white/10 bg-white/5 text-slate-200'
                    : 'border-line bg-panel/90 text-ink'
                }`}
              >
                <RefreshCw className="h-3.5 w-3.5 text-ice" />
                <span className="font-medium">Human Reversal Guarantee</span>
              </div>
            </motion.div>

            {/* Interactive Action Buttons */}
            {onNavigate && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
              >
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onNavigate('ingest')}
                  className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold shadow-soft transition ${
                    isDark
                      ? 'bg-white text-ink hover:bg-slate-100'
                      : 'bg-ice text-ink hover:bg-[#CB8F85] hover:text-white'
                  }`}
                >
                  <Layers className="h-4 w-4" /> Ingest Knowledge &amp; Test Drift
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onNavigate('conflicts')}
                  className={`flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-xs font-bold shadow-soft transition backdrop-blur-md ${
                    isDark
                      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                      : 'border-line bg-panel text-ink hover:bg-raised'
                  }`}
                >
                  Inspect Conflict Diffs <ArrowRight className="h-4 w-4 text-ice" />
                </motion.button>
              </motion.div>
            )}
          </div>
        )}

        {/* Collapsed Compact State */}
        {collapsed && (
          <div className="relative z-10 flex h-full items-center justify-between px-8">
            <div className="flex items-center gap-4">
              <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-ink'}`}>
                CONTEXT DRIFT
              </h2>
              <span className={`text-xs ${isDark ? 'text-white/60' : 'text-muted'}`}>
                Self-Healing Knowledge Auditor
              </span>
            </div>
            <button
              onClick={() => setCollapsed(false)}
              className="text-xs font-semibold text-ice hover:underline"
            >
              Expand Banner &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
