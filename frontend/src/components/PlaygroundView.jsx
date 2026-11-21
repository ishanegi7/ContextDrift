import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, ShieldCheck, ShieldAlert, Sparkles, Network, ExternalLink } from 'lucide-react';
import { formatTime, pct } from '../utils/diff';

export default function PlaygroundView({
  chat = [],
  stats,
  audit = [],
  lineage,
  onAsk,
  busy,
}) {
  const [prompt, setPrompt] = useState('');

  const suggestions = [
    'How many paid annual leaves do employees get?',
    'What is the refund window?',
    'Can I work remotely?',
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = prompt.trim();
    if (!q || busy) return;
    onAsk(q);
    setPrompt('');
  };

  const handleSuggestion = (q) => {
    if (busy) return;
    onAsk(q);
  };

  // Lineage helpers
  const nodes = lineage ? Object.fromEntries(lineage.nodes.map((n) => [n.id, n])) : {};
  const chains = lineage ? lineage.edges.filter((e) => e.relation === 'SUPERSEDED_BY') : [];
  const counts = lineage?.stats?.node_counts || {};

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Left Column: Interactive Chat & Retrieval Breakdown */}
      <div className="space-y-4 lg:col-span-3">
        {/* Pre-Query Highlight Callout with Playfair Display */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-line bg-panel p-6 shadow-card"
        >
          {/* Subtle warm glow background accent */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blush/40 blur-3xl" />

          {/* Top Label */}
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blush text-xs font-bold text-ink">
              <Sparkles className="h-3 w-3 text-ice" />
            </span>
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
              Pre-Query Knowledge Pre-Flight
            </span>
          </div>

          {/* Highlighted Heading in Playfair Display */}
          <h2 className="font-playfair text-xl sm:text-2xl font-normal tracking-tight text-ink leading-snug">
            Before proceeding with any query:{' '}
            <span className="font-semibold italic text-ink underline decoration-ice/60 underline-offset-4">
              ContextDrift guarantees zero silent hallucinations.
            </span>
          </h2>

          <p className="mt-2.5 text-xs leading-relaxed text-muted font-sans">
            Standard RAG systems blindly retrieve outdated information when policies evolve. Here, all queries are dynamically evaluated against the self-healing lineage plane—only active, superseded truths are supplied to generation while deprecated statements are intercepted.
          </p>

          {/* Pre-flight badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-line/60">
            <div className="flex items-center gap-1.5 rounded-full bg-fresh/10 border border-fresh/25 px-2.5 py-1 text-[11px] font-medium text-fresh">
              <span className="h-1.5 w-1.5 rounded-full bg-fresh" />
              <span>Only <code className="font-mono font-bold">&#123;&quot;active&quot;: true&#125;</code> retrieved</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-stale/10 border border-stale/25 px-2.5 py-1 text-[11px] font-medium text-stale">
              <span className="h-1.5 w-1.5 rounded-full bg-stale" />
              <span>Outdated facts intercepted &amp; blocked</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-raised border border-line px-2.5 py-1 text-[11px] font-medium text-muted">
              <span>Cosine threshold: 0.70</span>
            </div>
          </div>

          {/* One-Click Query Suggestions */}
          <div className="mt-4">
            <span className="mb-2 block text-[11px] font-semibold text-ink/80">Try asking a question:</span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((q, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.02, borderColor: '#DBA39A' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSuggestion(q)}
                  disabled={busy}
                  className="rounded-xl border border-line bg-raised/50 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ice/60 hover:bg-raised active:scale-[0.98] disabled:opacity-50 shadow-2xs"
                >
                  &ldquo;{q}&rdquo;
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Chat Stream */}
        <div className="space-y-4 min-h-[16rem]">
          {chat.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-line bg-panel/60 px-5 py-14 text-center text-xs text-muted shadow-soft"
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blush text-ink mb-2">
                <MessageSquare className="w-5 h-5 text-ink" />
              </div>
              <p className="text-sm font-semibold text-ink">No conversation yet</p>
              <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                Ask a policy question above to see which chunks are cited and which stale facts were prevented from hallucinating.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {chat.map((m, idx) => {
                if (m.role === 'user') {
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[85%] rounded-2xl bg-raised border border-line px-4 py-2.5 text-xs text-ink shadow-soft font-medium">
                        {m.text}
                      </div>
                    </motion.div>
                  );
                }

                if (m.pending) {
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-2xl border border-line bg-panel p-5 text-xs text-muted shadow-card flex items-center gap-2.5"
                    >
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="text-ice inline-block"
                      >
                        ⏳
                      </motion.span>
                      Auditing active knowledge & generating response…
                    </motion.div>
                  );
                }

                if (m.error) {
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-2xl border border-stale/40 bg-stale/5 p-5 text-xs text-stale shadow-card"
                    >
                      {m.error}
                    </motion.div>
                  );
                }

                const r = m.data;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-line bg-panel p-5 shadow-card"
                  >
                    {/* Interception Banner */}
                    {r.stale_context_prevented && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-3.5 rounded-xl border border-caution/40 bg-caution/10 px-3.5 py-2 text-xs font-semibold text-caution flex items-center gap-2"
                      >
                        <ShieldAlert className="w-4 h-4 text-caution shrink-0" />
                        <span>
                          Self-healing in action: {r.blocked_chunks.length} stale chunk
                          {r.blocked_chunks.length === 1 ? '' : 's'} matched this query and{' '}
                          {r.blocked_chunks.length === 1 ? 'was' : 'were'} safely intercepted before generation.
                        </span>
                      </motion.div>
                    )}

                    {/* Final Answer */}
                    <div className="text-xs font-medium leading-relaxed text-ink">{r.answer}</div>
                    <p className="mt-2 text-[11px] text-muted">
                      Engine:{' '}
                      <span className="font-mono font-medium text-ink">{r.answer_engine}</span>
                    </p>

                    {/* Split Context Breakdown */}
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {/* Active Chunks Used */}
                      <div>
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-fresh flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-fresh" />
                          <span>Context Used ({r.used_chunks.length})</span>
                        </h3>
                        <div className="space-y-2">
                          {r.used_chunks.length ? (
                            r.used_chunks.map((c) => (
                              <div
                                key={c.chunk_id}
                                className="rounded-xl border border-fresh/30 bg-fresh/5 p-3 shadow-soft text-xs"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-md bg-fresh/15 px-2 py-0.5 text-[11px] font-bold text-fresh">
                                    Used
                                  </span>
                                  <span className="font-semibold text-ink">{c.doc_name}</span>
                                  <span className="font-mono text-muted text-[11px]">{c.chunk_id}</span>
                                  <span className="ml-auto font-medium text-muted">
                                    match {pct(c.similarity)}
                                  </span>
                                </div>
                                <p className="mt-2 whitespace-pre-line leading-relaxed text-ink text-[11px]">
                                  {c.text}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted">No active chunks matched.</p>
                          )}
                        </div>
                      </div>

                      {/* Stale Chunks Blocked */}
                      <div>
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-stale flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-stale" />
                          <span>Blocked as Stale ({r.blocked_chunks.length})</span>
                        </h3>
                        <div className="space-y-2">
                          {r.blocked_chunks.length ? (
                            r.blocked_chunks.map((c) => (
                              <div
                                key={c.chunk_id}
                                className="rounded-xl border border-stale/30 bg-stale/5 p-3 shadow-soft text-xs"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-md bg-stale/15 px-2 py-0.5 text-[11px] font-bold text-stale">
                                    Blocked
                                  </span>
                                  <span className="font-semibold text-ink">{c.doc_name}</span>
                                  <span className="font-mono text-muted text-[11px]">{c.chunk_id}</span>
                                  <span className="ml-auto font-medium text-muted">
                                    match {pct(c.similarity)}
                                  </span>
                                </div>
                                <p className="mt-2 whitespace-pre-line leading-relaxed stale-text line-through decoration-stale/40 text-[11px]">
                                  {c.text}
                                </p>
                                {c.block_reason && (
                                  <p className="mt-2 text-[11px] font-medium text-stale">{c.block_reason}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted">No conflicting or stale chunks detected.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Sticky Input Form */}
        <form
          onSubmit={handleSubmit}
          className="sticky bottom-3 flex gap-2 rounded-2xl border border-line bg-panel p-2 shadow-float backdrop-blur-md"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about your policies, products or documentation…"
            className="min-w-0 flex-1 rounded-xl bg-raised/40 px-4 py-2.5 text-xs text-ink placeholder:text-muted/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ice transition"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={busy || !prompt.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-ice px-4.5 py-2.5 text-xs font-semibold text-ink shadow-soft transition hover:bg-[#CB8F85] hover:text-white disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> Ask
          </motion.button>
        </form>
      </div>

      {/* Right Column: Telemetry & Lineage Sidebar */}
      <aside className="space-y-6 lg:col-span-2">
        {/* Index Status Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-line bg-panel p-5 shadow-card"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Vector Store Index</h2>
          <dl className="mt-3.5 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-line bg-raised/40 px-3.5 py-2.5 shadow-soft">
              <dd className="text-base font-bold text-fresh">{stats?.active_chunks ?? 0}</dd>
              <dt className="text-[11px] font-medium text-muted">Active chunks</dt>
            </div>
            <div className="rounded-xl border border-line bg-raised/40 px-3.5 py-2.5 shadow-soft">
              <dd
                className={`text-base font-bold ${
                  stats?.deprecated_chunks ? 'text-stale' : 'text-ink'
                }`}
              >
                {stats?.deprecated_chunks ?? 0}
              </dd>
              <dt className="text-[11px] font-medium text-muted">Deprecated chunks</dt>
            </div>
            <div className="rounded-xl border border-line bg-raised/40 px-3.5 py-2.5 shadow-soft">
              <dd className="text-base font-bold text-ink">{stats?.conflicts_healed ?? 0}</dd>
              <dt className="text-[11px] font-medium text-muted">Conflicts healed</dt>
            </div>
            <div className="rounded-xl border border-line bg-raised/40 px-3.5 py-2.5 shadow-soft">
              <dd
                className={`text-base font-bold ${
                  stats?.conflicts_reverted ? 'text-caution' : 'text-ink'
                }`}
              >
                {stats?.conflicts_reverted ?? 0}
              </dd>
              <dt className="text-[11px] font-medium text-muted">Auditor reversals</dt>
            </div>
          </dl>
        </motion.div>

        {/* Audit Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-line bg-panel p-5 shadow-card"
        >
          <div className="flex items-center justify-between pb-2 border-b border-line/60">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Audit Timeline</h2>
            <span className="text-[11px] text-muted">Real-time</span>
          </div>
          <div className="mt-4 max-h-[24rem] overflow-y-auto pr-1 scroll-thin">
            {audit.length === 0 ? (
              <p className="text-xs text-muted">No self-healing events recorded yet.</p>
            ) : (
              <ol className="timeline-line space-y-4">
                {audit.map((a) => {
                  const healed = a.event === 'CONFLICT_HEALED';
                  const dot = !healed
                    ? 'bg-caution ring-panel'
                    : a.reverted
                    ? 'bg-muted ring-panel'
                    : 'bg-stale ring-panel';
                  const title = healed
                    ? a.reverted
                      ? 'Healing reverted'
                      : 'Conflict healed'
                    : 'Duplicate skipped';

                  return (
                    <li key={a.id} className="relative pl-7">
                      <span className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full ring-4 shadow-sm ${dot}`} />
                      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="font-bold text-ink">{title}</span>
                        <span className="text-[11px] text-muted">{formatTime(a.created_at)}</span>
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-muted">
                        {a.old_doc || ''}
                        {a.new_doc ? ` → ${a.new_doc}` : ''}
                      </div>
                      <div className="mt-1 text-xs text-ink leading-relaxed">{a.summary || ''}</div>
                      <div className="mt-1 font-mono text-[11px] text-muted">
                        {a.old_chunk_id || ''}
                        {a.new_chunk_id ? ` → ${a.new_chunk_id}` : ''}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </motion.div>

        {/* Lineage Graph */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-line bg-panel p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-muted" /> Lineage Graph
            </h2>
            <a
              href="/api/lineage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-muted hover:text-ink underline underline-offset-4 transition flex items-center gap-1"
            >
              Open JSON <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="mt-3 text-xs text-muted">
            <p className="font-medium text-ink">
              {counts.Document || 0} documents · {counts.Chunk || 0} chunks · {counts.Entity || 0} entities ·{' '}
              {lineage?.stats?.edge_count || 0} edges
            </p>

            <ul className="mt-3 space-y-2.5 max-h-[16rem] overflow-y-auto overflow-x-hidden pr-1 scroll-thin">
              {chains.length === 0 ? (
                <p className="text-xs text-muted">No SUPERSEDED_BY relationships yet.</p>
              ) : (
                chains.map((e, idx) => {
                  const a = nodes[e.source];
                  const b = nodes[e.target];
                  const srcName = a?.props?.doc_name || a?.label || e.source;
                  const dstName = b?.props?.doc_name || b?.label || e.target;

                  return (
                    <li
                      key={idx}
                      className="rounded-xl border border-line bg-panel p-3 text-xs shadow-soft transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                          <span className="h-1.5 w-1.5 rounded-full bg-ice" />
                          SUPERSEDED_BY
                        </span>

                        {e.reverted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-caution/15 border border-caution/30 px-2.5 py-0.5 text-[10px] font-bold text-caution shadow-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-caution" />
                            (reverted)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-fresh/15 border border-fresh/30 px-2.5 py-0.5 text-[10px] font-bold text-fresh shadow-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-fresh" />
                            (active)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink min-w-0">
                        <span
                          className={`truncate flex-1 min-w-0 ${
                            e.reverted
                              ? 'text-muted'
                              : 'text-stale line-through decoration-stale/60'
                          }`}
                          title={srcName}
                        >
                          {srcName}
                        </span>
                        <span className="text-muted/60 shrink-0 font-sans">→</span>
                        <span
                          className={`truncate flex-1 min-w-0 font-semibold ${
                            e.reverted ? 'text-muted' : 'text-fresh'
                          }`}
                          title={dstName}
                        >
                          {dstName}
                        </span>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </motion.div>
      </aside>
    </div>
  );
}
