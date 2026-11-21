import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCw,
  Undo2,
  AlertCircle,
  ArrowRight,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { wordDiff, formatTime, pct } from '../utils/diff';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/core/accordion';

export default function ConflictsView({
  conflicts = [],
  onToggle,
  busy,
  onGotoIngest,
}) {
  const filtered = conflicts.filter((a) => a.event === 'CONFLICT_HEALED');

  const [activeValues, setActiveValues] = useState(() => {
    // Default open the first conflict for immediate visibility
    return filtered.length > 0 ? [filtered[0].id.toString()] : [];
  });

  const [filterState, setFilterState] = useState('all'); // 'all' | 'healed' | 'reverted'

  const displayedConflicts = filtered.filter((rec) => {
    if (filterState === 'healed') return !rec.reverted;
    if (filterState === 'reverted') return rec.reverted;
    return true;
  });

  const handleExpandAll = () => {
    setActiveValues(displayedConflicts.map((c) => c.id.toString()));
  };

  const handleCollapseAll = () => {
    setActiveValues([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Stats */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blush text-ink">
              <ShieldCheck className="h-4 w-4 text-ice" />
            </span>
            <h2 className="text-base font-bold text-ink sm:text-lg">
              Conflict Resolution &amp; Knowledge Audit
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted leading-relaxed">
            When contradictory statements are identified during ingestion, ContextDrift automatically
            supersedes the older chunk. Expand any conflict below to inspect the word-level diff, review
            evaluator verdicts, and toggle human overrides.
          </p>
        </div>

        {/* Quick Actions & Filters */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center rounded-xl border border-line bg-panel p-1 shadow-soft text-xs">
              <button
                onClick={() => setFilterState('all')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  filterState === 'all'
                    ? 'bg-blush text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                All ({filtered.length})
              </button>
              <button
                onClick={() => setFilterState('healed')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  filterState === 'healed'
                    ? 'bg-fresh/15 text-fresh shadow-sm font-bold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Active Healed ({filtered.filter((c) => !c.reverted).length})
              </button>
              <button
                onClick={() => setFilterState('reverted')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  filterState === 'reverted'
                    ? 'bg-caution/15 text-caution shadow-sm font-bold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Reverted ({filtered.filter((c) => c.reverted).length})
              </button>
            </div>

            {/* Expand / Collapse All */}
            <button
              onClick={activeValues.length === displayedConflicts.length ? handleCollapseAll : handleExpandAll}
              className="rounded-xl border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-muted shadow-soft hover:bg-raised hover:text-ink transition"
            >
              {activeValues.length === displayedConflicts.length ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {displayedConflicts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center shadow-soft"
        >
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blush text-ink">
            <AlertCircle className="h-5 w-5 text-ice" />
          </div>
          <p className="text-sm font-bold text-ink">
            {filtered.length === 0
              ? 'No knowledge conflicts detected yet'
              : 'No conflicts matching the current filter'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            {filtered.length === 0
              ? 'Ingest Leave Policy 2024, then Leave Policy 2026 on the Ingest tab to generate an automated contradiction diff.'
              : 'Try selecting "All" to review all recorded conflict events.'}
          </p>
          {filtered.length === 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onGotoIngest}
              className="mt-4 rounded-xl bg-ice px-4 py-2 text-xs font-semibold text-ink shadow-soft hover:bg-[#CB8F85] hover:text-white transition"
            >
              Go to Ingestion
            </motion.button>
          )}
        </motion.div>
      ) : (
        /* Motion-Primitives Accordion with Interactive Dropdowns */
        <Accordion
          expandedValue={activeValues}
          onValueChange={setActiveValues}
          multiple={true}
          className="space-y-3.5"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {displayedConflicts.map((rec, index) => {
            const diff = wordDiff(rec.old_text || '', rec.new_text || '');
            const reverted = rec.reverted;
            const conflictNum = index + 1;
            const itemKey = rec.id.toString();

            return (
              <AccordionItem
                key={rec.id}
                value={itemKey}
                className="overflow-hidden rounded-2xl border border-line bg-panel shadow-soft transition-all duration-200 hover:border-ice/60 data-[expanded=true]:border-ice/80 data-[expanded=true]:shadow-card"
              >
                {/* Accordion Trigger (Dropdown Header) */}
                <AccordionTrigger className="w-full px-5 py-4 text-left transition hover:bg-raised/20">
                  <div className="flex w-full flex-wrap items-center justify-between gap-3 pr-2">
                    {/* Left: Conflict Number & Document Path */}
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 items-center justify-center rounded-lg bg-blush px-2.5 text-xs font-black tracking-wide text-ink border border-line/60">
                        Conflict #{conflictNum}
                      </span>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <span>{rec.old_doc}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted" />
                        <span>{rec.new_doc}</span>
                      </div>
                    </div>

                    {/* Middle: Status & Match Metrics */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-bold border ${
                          reverted
                            ? 'bg-caution/15 border-caution/30 text-caution'
                            : 'bg-fresh/15 border-fresh/30 text-fresh'
                        }`}
                      >
                        {reverted ? '↺ Human Reverted' : '✓ Auto-Healed (Active)'}
                      </span>

                      <span className="rounded-full bg-raised px-2.5 py-0.5 font-mono text-muted border border-line/60">
                        Similarity {pct(rec.similarity)}
                      </span>

                      <span className="rounded-full bg-raised px-2.5 py-0.5 font-mono text-muted border border-line/60">
                        Confidence {pct(rec.confidence)}
                      </span>
                    </div>

                    {/* Right: Timestamp & Animated Chevron */}
                    <div className="flex items-center gap-3 ml-auto">
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Clock className="h-3 w-3" />
                        {formatTime(rec.created_at)}
                      </span>

                      {/* Rotating Chevron Icon using group-data-expanded */}
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-raised/70 border border-line/50">
                        <ChevronUp className="h-4 w-4 text-ink transition-transform duration-200 group-data-expanded:-rotate-180" />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                {/* Accordion Content (Revealed on click) */}
                <AccordionContent>
                  <div className="border-t border-line/70 bg-base/30">
                    {/* Action Bar & Verdict Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 bg-raised/40 px-5 py-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">Evaluator verdict:</span>
                        <span className="text-muted">
                          {rec.summary || 'The evaluator detected contradictory factual claims and deprecated the prior statement.'}
                        </span>
                        <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] text-muted border border-line/60">
                          {rec.engine}
                        </span>
                      </div>

                      {/* Revert / Re-Apply Action Button */}
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle(rec.id);
                        }}
                        className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition shadow-soft disabled:opacity-50 ${
                          reverted
                            ? 'border-fresh/50 bg-fresh/10 text-fresh hover:bg-fresh/20'
                            : 'border-caution/50 bg-caution/10 text-caution hover:bg-caution/20'
                        }`}
                      >
                        {reverted ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" /> Re-apply automated healing
                          </>
                        ) : (
                          <>
                            <Undo2 className="h-3.5 w-3.5" /> Revert decision (reinstate older chunk)
                          </>
                        )}
                      </motion.button>
                    </div>

                    {/* Side-by-Side Word Diff Grid */}
                    <div className="grid gap-px bg-line/60 md:grid-cols-2">
                      {/* Older Chunk (Left) */}
                      <div className="bg-panel p-5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold border ${
                              reverted
                                ? 'bg-fresh/15 border-fresh/30 text-fresh'
                                : 'bg-stale/15 border-stale/30 text-stale'
                            }`}
                          >
                            {reverted ? 'Reinstated (Now Active)' : 'Deprecated: stale chunk'}
                          </span>
                          <span className="font-mono text-[11px] text-muted">{rec.old_chunk_id}</span>
                        </div>
                        <p
                          className={`mt-3 whitespace-pre-line font-mono text-xs leading-relaxed ${
                            reverted ? 'text-ink' : 'stale-text'
                          }`}
                        >
                          {diff.left.map((tok, i) => (
                            <span
                              key={i}
                              className={tok.k === 'del' ? 'd-del' : tok.k === 'add' ? 'd-add' : ''}
                            >
                              {tok.t}{' '}
                            </span>
                          ))}
                        </p>
                      </div>

                      {/* Newer Chunk (Right) */}
                      <div className="bg-panel p-5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold border ${
                              reverted
                                ? 'bg-caution/15 border-caution/30 text-caution'
                                : 'bg-fresh/15 border-fresh/30 text-fresh'
                            }`}
                          >
                            {reverted ? 'Rejected (Reverted by Human)' : 'Active: latest chunk'}
                          </span>
                          <span className="font-mono text-[11px] text-muted">{rec.new_chunk_id}</span>
                        </div>
                        <p
                          className={`mt-3 whitespace-pre-line font-mono text-xs leading-relaxed ${
                            reverted ? 'stale-text' : 'text-ink'
                          }`}
                        >
                          {diff.right.map((tok, i) => (
                            <span
                              key={i}
                              className={tok.k === 'del' ? 'd-del' : tok.k === 'add' ? 'd-add' : ''}
                            >
                              {tok.t}{' '}
                            </span>
                          ))}
                        </p>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
