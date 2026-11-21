import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Upload, FileText, RotateCcw, ChevronDown, Check, ArrowRight, ShieldAlert } from 'lucide-react';
import { formatTime, pct } from '../utils/diff';

const DEMOS = {
  leave2024: {
    doc_name: 'leave_policy_2024.md',
    text:
      '# Leave Policy 2024\n\n' +
      'Employees get 24 paid annual leaves per year. Unused leaves can be carried forward to the next year. ' +
      'Employees must apply for leave at least 3 days in advance through the HR portal.',
  },
  leave2026: {
    doc_name: 'leave_policy_2026.md',
    text:
      '# Leave Policy 2026\n\n' +
      'Employees get 15 paid annual leaves per year. Unused leaves can be carried forward to the next year. ' +
      'Employees must apply for leave at least 3 days in advance through the HR portal.',
  },
  refund1: {
    doc_name: 'refund_policy_v1.md',
    text:
      '# Refund Policy v1\n\n' +
      'The refund window is 30 days from the date of purchase. ' +
      'Refunds are issued to the original payment method within 5 business days.',
  },
  refund2: {
    doc_name: 'refund_policy_v2.md',
    text:
      '# Refund Policy v2\n\n' +
      'The refund window is 14 days from the date of purchase. ' +
      'Refunds are issued to the original payment method within 5 business days.',
  },
  remote: {
    doc_name: 'remote_work_policy.md',
    text:
      '# Remote Work Policy\n\n' +
      'Staff may work remotely up to 2 days per week with manager approval. ' +
      'Remote days must be logged in the team calendar by Friday of the previous week.',
  },
};

export default function IngestView({
  chunks = [],
  stats,
  lastIngest,
  onIngest,
  onReset,
  busy,
  onGotoConflicts,
}) {
  const [docName, setDocName] = useState('');
  const [docText, setDocText] = useState('');
  const [file, setFile] = useState(null);
  const [showMoreDemos, setShowMoreDemos] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!docText.trim() && !file) return;
    const fd = new FormData();
    fd.append('doc_name', docName.trim());
    fd.append('text', docText);
    if (file) fd.append('file', file);
    onIngest(fd, docName || (file ? file.name : 'Document'));
    setDocText('');
    setFile(null);
  };

  const runDemo = (key) => {
    const demo = DEMOS[key];
    if (!demo || busy) return;
    const fd = new FormData();
    fd.append('doc_name', demo.doc_name);
    fd.append('text', demo.text);
    onIngest(fd, demo.doc_name);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Left Column: Demo & Ingest Form */}
      <div className="space-y-6 lg:col-span-2">
        {/* Interactive Demo Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-line bg-panel p-5 shadow-card"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blush text-xs font-bold text-ink">
              <Zap className="w-3 h-3 text-ink" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Quick Demo</h2>
          </div>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Ingest <strong>Policy 2024</strong> (24 days leave) first, then ingest <strong>Policy 2026</strong> (15 days leave). ContextDrift automatically flags the contradiction, supersedes the old rule, and updates your vector store.
          </p>

          <div className="mt-4 space-y-2.5">
            <motion.button
              whileHover={{ scale: 1.01, borderColor: '#DBA39A' }}
              whileTap={{ scale: 0.99 }}
              onClick={() => runDemo('leave2024')}
              disabled={busy}
              className="group flex w-full items-start gap-3 rounded-xl border border-line bg-raised/60 p-3.5 text-left transition hover:bg-raised hover:shadow-soft disabled:opacity-50"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blush text-xs font-bold text-ink group-hover:bg-ice group-hover:text-white transition">
                A
              </span>
              <div>
                <span className="block text-xs font-semibold text-ink">Ingest Leave Policy 2024</span>
                <span className="block text-[11px] text-muted">“Employees get 24 paid annual leaves”</span>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.01, borderColor: '#DBA39A' }}
              whileTap={{ scale: 0.99 }}
              onClick={() => runDemo('leave2026')}
              disabled={busy}
              className="group flex w-full items-start gap-3 rounded-xl border border-line bg-raised/60 p-3.5 text-left transition hover:bg-raised hover:shadow-soft disabled:opacity-50"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blush text-xs font-bold text-ink group-hover:bg-ice group-hover:text-white transition">
                B
              </span>
              <div>
                <span className="block text-xs font-semibold text-ink">Ingest Leave Policy 2026</span>
                <span className="block text-[11px] text-muted">“Employees get 15 paid annual leaves”</span>
              </div>
            </motion.button>
          </div>

          {/* Collapsible Scenarios */}
          <div className="mt-4 border-t border-line/60 pt-3">
            <button
              onClick={() => setShowMoreDemos(!showMoreDemos)}
              className="flex w-full items-center justify-between text-xs font-semibold text-muted hover:text-ink transition"
            >
              <span>More test scenarios</span>
              <motion.div animate={{ rotate: showMoreDemos ? 180 : 0 }}>
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showMoreDemos && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  <button
                    onClick={() => runDemo('refund1')}
                    disabled={busy}
                    className="w-full rounded-xl border border-line bg-raised/40 px-3 py-2 text-left text-xs transition hover:border-ice hover:bg-raised"
                  >
                    <span className="font-semibold text-ink">Refund policy v1</span>{' '}
                    <span className="text-muted">(30-day window)</span>
                  </button>
                  <button
                    onClick={() => runDemo('refund2')}
                    disabled={busy}
                    className="w-full rounded-xl border border-line bg-raised/40 px-3 py-2 text-left text-xs transition hover:border-ice hover:bg-raised"
                  >
                    <span className="font-semibold text-ink">Refund policy v2</span>{' '}
                    <span className="text-muted">(14-day window)</span>
                  </button>
                  <button
                    onClick={() => runDemo('remote')}
                    disabled={busy}
                    className="w-full rounded-xl border border-line bg-raised/40 px-3 py-2 text-left text-xs transition hover:border-ice hover:bg-raised"
                  >
                    <span className="font-semibold text-ink">Remote work policy</span>{' '}
                    <span className="text-muted">(additive, no conflict)</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
            <button
              onClick={onReset}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-stale underline decoration-line/80 underline-offset-4 transition disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" /> Reset database
            </button>
            <span className="text-[11px] text-muted">Self-healing enabled</span>
          </div>
        </motion.div>

        {/* Custom Ingestion Form */}
        <motion.form
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-panel p-5 shadow-card"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blush text-xs font-bold text-ink">
              <FileText className="w-3 h-3 text-ink" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Ingest Document</h2>
          </div>

          <label className="mt-3.5 block text-xs font-semibold text-ink">Document name</label>
          <input
            type="text"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="hr-policy-2026.md"
            className="mt-1 w-full rounded-xl border border-line bg-raised/40 px-3.5 py-2 text-xs text-ink placeholder:text-muted/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ice transition"
          />

          <label className="mt-3 block text-xs font-semibold text-ink">Text or Markdown Content</label>
          <textarea
            rows="5"
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            placeholder="Paste your updated policy, procedure or rules. Paragraphs will be parsed into chunks."
            className="mt-1 w-full rounded-xl border border-line bg-raised/40 px-3.5 py-2 font-mono text-xs leading-relaxed text-ink placeholder:text-muted/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ice transition scroll-thin"
          />

          <label className="mt-3 block text-xs font-semibold text-ink">Or upload file (.md, .txt)</label>
          <input
            type="file"
            accept=".md,.markdown,.txt,.text"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-ice hover:file:text-white transition"
          />

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={busy || (!docText.trim() && !file)}
            className="mt-4.5 flex w-full items-center justify-center gap-2 rounded-xl bg-ice py-2.5 text-xs font-semibold text-ink shadow-soft transition hover:bg-[#CB8F85] hover:text-white disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> Ingest Document
          </motion.button>
        </motion.form>
      </div>

      {/* Right Column: Ingestion Traces & Knowledge Base */}
      <div className="space-y-6 lg:col-span-3">
        {/* Latest Ingestion Result */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-line bg-panel p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">Ingestion Audit Trace</h2>
            <span className="text-[11px] text-muted">Cosine threshold: 0.70</span>
          </div>

          {lastIngest ? (
            <div className="mt-3.5 text-xs">
              <p className="text-muted">
                Ingested <span className="font-semibold text-ink">{lastIngest.doc_name}</span> with{' '}
                <span className="font-mono font-medium text-ink">{lastIngest.engine}</span>.
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-line bg-raised/40 px-3.5 py-2.5 shadow-soft">
                  <div className="text-base font-bold text-ink">{lastIngest.chunks.length}</div>
                  <div className="text-[11px] text-muted">Chunks stored</div>
                </div>
                <div className="rounded-xl border border-line bg-raised/40 px-3.5 py-2.5 shadow-soft">
                  <div
                    className={`text-base font-bold ${
                      lastIngest.conflicts.length ? 'text-stale' : 'text-ink'
                    }`}
                  >
                    {lastIngest.conflicts.length}
                  </div>
                  <div className="text-[11px] text-muted">Conflicts healed</div>
                </div>
                <div className="rounded-xl border border-line bg-raised/40 px-3.5 py-2.5 shadow-soft">
                  <div
                    className={`text-base font-bold ${
                      lastIngest.duplicates_skipped ? 'text-caution' : 'text-ink'
                    }`}
                  >
                    {lastIngest.duplicates_skipped}
                  </div>
                  <div className="text-[11px] text-muted">Duplicates skipped</div>
                </div>
              </div>

              {/* Evaluations table */}
              {lastIngest.evaluations?.length > 0 ? (
                <div className="mt-4 overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[32rem] text-left text-xs">
                    <thead className="border-b border-line text-muted">
                      <tr>
                        <th className="pb-2 pr-3 font-semibold">Compared with</th>
                        <th className="pb-2 pr-3 font-semibold">Similarity</th>
                        <th className="pb-2 pr-3 font-semibold">Verdict</th>
                        <th className="pb-2 pr-3 font-semibold">Confidence</th>
                        <th className="pb-2 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {lastIngest.evaluations.map((t, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 pr-3">
                            <span className="font-mono font-medium text-ink">{t.old_chunk_id}</span>
                            <span className="block text-[11px] text-muted">{t.old_doc}</span>
                          </td>
                          <td className="py-2.5 pr-3 font-medium">{pct(t.similarity)}</td>
                          <td
                            className={`py-2.5 pr-3 font-bold ${
                              t.verdict === 'CONTRADICTORY'
                                ? 'text-stale'
                                : t.verdict === 'DUPLICATE'
                                ? 'text-caution'
                                : 'text-muted'
                            }`}
                          >
                            {t.verdict}
                          </td>
                          <td className="py-2.5 pr-3 font-medium">{pct(t.confidence)}</td>
                          <td className="py-2.5 text-muted">{t.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted">
                  No existing chunks exceeded similarity threshold (0.70), so no conflict comparison was required.
                </p>
              )}

              {lastIngest.conflicts?.length > 0 && (
                <button
                  onClick={onGotoConflicts}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-ice underline underline-offset-4 transition"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-stale" />
                  <span>Review {lastIngest.conflicts.length} healed conflict(s) in resolution view →</span>
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 py-6 text-center text-xs text-muted">
              Nothing ingested in this session yet. Click one of the demo buttons on the left to test self-healing.
            </div>
          )}
        </motion.div>

        {/* Live Knowledge Base */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-line bg-panel p-5 shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Active Knowledge Base</h2>
              <div className="text-[11px] text-muted">
                {stats
                  ? `${stats.active_chunks} active · ${stats.deprecated_chunks} deprecated · ${stats.documents} documents`
                  : ''}
              </div>
            </div>
          </div>

          <div className="mt-3.5 max-h-[30rem] space-y-2.5 overflow-y-auto pr-1 scroll-thin">
            {chunks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-raised/20 px-4 py-8 text-center text-xs text-muted">
                Knowledge base is currently empty.
              </div>
            ) : (
              chunks.map((c) => (
                <motion.article
                  key={c.chunk_id}
                  layout
                  className={`rounded-xl border border-line bg-panel p-3.5 shadow-soft transition hover:border-ice/60 ${
                    c.active ? '' : 'opacity-75 bg-raised/30'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                        c.status === 'latest'
                          ? 'bg-fresh/10 text-fresh border border-fresh/25'
                          : c.status === 'deprecated'
                          ? 'bg-stale/10 text-stale border border-stale/25'
                          : 'bg-caution/10 text-caution border border-caution/25'
                      }`}
                    >
                      {c.status === 'latest' ? 'Active' : c.status === 'deprecated' ? 'Deprecated' : 'Rejected'}
                    </span>
                    <span className="text-xs font-semibold text-ink">{c.doc_name}</span>
                    <span className="font-mono text-[11px] text-muted">{c.chunk_id}</span>
                    <span className="ml-auto text-[11px] text-muted">{formatTime(c.created_at)}</span>
                  </div>
                  <p
                    className={`mt-2 whitespace-pre-line text-xs leading-relaxed ${
                      c.active ? 'text-ink' : 'stale-text line-through decoration-stale/40'
                    }`}
                  >
                    {c.text}
                  </p>
                  {c.superseded_by && (
                    <p className="mt-2 text-[11px] font-medium text-muted">
                      Superseded by <span className="font-mono font-semibold text-stale">{c.superseded_by}</span>
                    </p>
                  )}
                  {c.supersedes && (
                    <p className="mt-2 text-[11px] font-medium text-muted">
                      Supersedes <span className="font-mono font-semibold text-fresh">{c.supersedes}</span>
                    </p>
                  )}
                </motion.article>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
