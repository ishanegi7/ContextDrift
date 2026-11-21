import { motion } from 'motion/react';

export default function Header({
  health,
  stats,
  activeTab,
  onTabChange,
  conflictCount = 0,
}) {
  const score = stats?.health_score ?? 100;
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);
  const ringColor = score >= 80 ? '#2D7751' : score >= 55 ? '#A2581A' : '#C04840';

  const embedderLabel =
    health?.embedder === 'fastembed' ? 'MiniLM-L6-v2' : 'hashing';

  const evaluatorLabel =
    health?.llm_mode === 'live'
      ? `${health?.llm_provider}:${health?.llm_model}`
      : 'offline heuristic';

  const healedCount = stats?.conflicts_healed ?? 0;
  const revertedCount = stats?.conflicts_reverted ?? 0;

  const tabs = [
    { id: 'ingest', label: 'Ingest & Test' },
    {
      id: 'conflicts',
      label: 'Conflict Resolution',
      badge: conflictCount > 0 ? conflictCount : null,
    },
    { id: 'playground', label: 'RAG Playground' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-base/95 backdrop-blur-md transition-all">
      {/* Top Header Row: Logo, Title & Telemetry Chips (Matches Image Exactly) */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        {/* Left: Blush Squircle Logo + Wordmark & Subtitle */}
        <div
          onClick={() => onTabChange('ingest')}
          className="flex cursor-pointer items-center gap-3 select-none"
        >
          {/* Logo Squircle with Terracotta Wave and Green Dot */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <svg
              width="36"
              height="36"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect width="32" height="32" rx="9" fill="#F0DBDB" />
              <path
                d="M 7 20.5 C 9.5 14, 13.5 14, 16 18.5 C 18 22.5, 21.5 22.5, 24.5 16.5"
                stroke="#DEABA4"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="25" cy="14" r="2.5" fill="#2D7751" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-bold tracking-tight text-ink">
                ContextDrift
              </h1>
              <span className="rounded-full bg-[#F5E8E5] px-2.5 py-0.5 text-[11px] font-medium text-ink/90">
                Self-Healing RAG
              </span>
            </div>
            <p className="text-xs text-[#786864]">
              Continuous knowledge auditor &amp; contradiction resolver
            </p>
          </div>
        </div>

        {/* Right: Telemetry Chips & System Health Gauge */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Chip 1: Embeddings MiniLM-L6-v2 */}
          <div
            className="flex items-center gap-2 rounded-full border border-[#EFE4D9] bg-white px-3.5 py-1.5 shadow-xs"
            title={health?.embedder_model || 'Local sentence-transformers embeddings'}
          >
            <span className="h-2 w-2 rounded-full bg-[#2D7751]" />
            <span className="text-[#786864] font-normal">Embeddings</span>
            <span className="font-mono font-medium text-ink">
              {embedderLabel}
            </span>
          </div>

          {/* Chip 2: Evaluator offline heuristic */}
          <div
            className="flex items-center gap-2 rounded-full border border-[#EFE4D9] bg-white px-3.5 py-1.5 shadow-xs"
            title={health?.last_llm_error || 'Offline rule-based contradiction evaluator'}
          >
            <span className="h-2 w-2 rounded-full bg-[#B26615]" />
            <span className="text-[#786864] font-normal">Evaluator</span>
            <span className="font-mono font-medium text-ink">
              {evaluatorLabel}
            </span>
          </div>

          {/* Card 3: System Health Ring Gauge */}
          <div
            className="flex items-center gap-3 rounded-2xl border border-[#EFE4D9] bg-white px-3.5 py-1.5 shadow-xs"
            title="System healing trust score based on contradiction resolutions and reversals."
          >
            <div className="relative flex items-center justify-center shrink-0">
              <svg width="38" height="38" viewBox="0 0 42 42">
                <circle
                  cx="21"
                  cy="21"
                  r={radius}
                  fill="none"
                  stroke="#EADBCE"
                  strokeWidth="4"
                />
                <circle
                  cx="21"
                  cy="21"
                  r={radius}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 21 21)"
                />
                <text
                  x="21"
                  y="25"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#2C2220"
                >
                  {score}
                </text>
              </svg>
            </div>
            <div className="text-xs leading-tight pr-1">
              <div className="font-semibold text-ink">System health</div>
              <div className="text-[11px] text-[#786864]">
                {healedCount > 0 || revertedCount > 0
                  ? `${healedCount} healed, ${revertedCount} reverted`
                  : 'Zero drift detected'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Row */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <nav className="flex gap-1.5 overflow-x-auto pb-2.5 pt-1 scroll-thin">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors duration-200 sm:text-sm ${
                  isSelected ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {/* Active Sliding Tab Pill */}
                {isSelected && (
                  <motion.div
                    layoutId="activeTabPill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute inset-0 rounded-xl border border-line bg-panel shadow-soft"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab.label}
                  {tab.badge && (
                    <span className="rounded-full bg-stale/15 px-2 py-0.5 text-xs font-bold text-stale">
                      {tab.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
