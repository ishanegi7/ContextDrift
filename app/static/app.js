/* ContextDrift dashboard: vanilla JS, no build step. */
(() => {
  "use strict";

  // ------------------------------------------------------------------ demo documents
  const DEMOS = {
    leave2024: {
      doc_name: "leave_policy_2024.md",
      text:
        "# Leave Policy 2024\n\n" +
        "Employees get 24 paid annual leaves per year. Unused leaves can be carried forward to the next year. " +
        "Employees must apply for leave at least 3 days in advance through the HR portal.",
    },
    leave2026: {
      doc_name: "leave_policy_2026.md",
      text:
        "# Leave Policy 2026\n\n" +
        "Employees get 15 paid annual leaves per year. Unused leaves can be carried forward to the next year. " +
        "Employees must apply for leave at least 3 days in advance through the HR portal.",
    },
    refund1: {
      doc_name: "refund_policy_v1.md",
      text:
        "# Refund Policy v1\n\n" +
        "The refund window is 30 days from the date of purchase. " +
        "Refunds are issued to the original payment method within 5 business days.",
    },
    refund2: {
      doc_name: "refund_policy_v2.md",
      text:
        "# Refund Policy v2\n\n" +
        "The refund window is 14 days from the date of purchase. " +
        "Refunds are issued to the original payment method within 5 business days.",
    },
    remote: {
      doc_name: "remote_work_policy.md",
      text:
        "# Remote Work Policy\n\n" +
        "Staff may work remotely up to 2 days per week with manager approval. " +
        "Remote days must be logged in the team calendar by Friday of the previous week.",
    },
  };

  // ------------------------------------------------------------------ state + helpers
  const state = {
    tab: "ingest",
    health: null,
    stats: null,
    chunks: [],
    audit: [],
    lineage: null,
    lastIngest: null,
    chat: [],
    justHealed: new Set(),
    busy: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  const pct = (n) => (n == null ? "n/a" : `${Math.round(n * 100)}%`);

  async function api(path, options = {}) {
    const res = await fetch(path, options);
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail || body);
      } catch (_) { /* keep statusText */ }
      throw new Error(detail);
    }
    return res.json();
  }

  function toast(message, kind = "info") {
    const palette = {
      info: "border-line text-ink",
      ok: "border-fresh/50 text-fresh",
      warn: "border-caution/50 text-caution",
      error: "border-stale/50 text-stale",
    };
    const el = document.createElement("div");
    el.className = `pointer-events-auto rounded-lg border bg-panel px-4 py-3 text-sm shadow-lg shadow-black/40 ${palette[kind] || palette.info}`;
    el.textContent = message;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 5200);
  }

  function setBusy(flag) {
    state.busy = flag;
    $$(".demo-btn, #btn-ingest, #btn-ask, #btn-reset").forEach((b) => (b.disabled = flag));
  }

  // ------------------------------------------------------------------ word-level diff
  function wordDiff(a, b) {
    const A = a.split(/\s+/).filter(Boolean);
    const B = b.split(/\s+/).filter(Boolean);
    const n = A.length, m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const left = [], right = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { left.push({ t: A[i], k: "same" }); right.push({ t: B[j], k: "same" }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { left.push({ t: A[i], k: "del" }); i++; }
      else { right.push({ t: B[j], k: "add" }); j++; }
    }
    while (i < n) left.push({ t: A[i++], k: "del" });
    while (j < m) right.push({ t: B[j++], k: "add" });
    return { left, right };
  }

  function renderTokens(tokens) {
    return tokens
      .map((tok) => (tok.k === "del" ? `<span class="d-del">${esc(tok.t)}</span>` : tok.k === "add" ? `<span class="d-add">${esc(tok.t)}</span>` : esc(tok.t)))
      .join(" ");
  }

  // ------------------------------------------------------------------ renderers
  function renderHeader() {
    const chips = $("#engine-chips");
    const h = state.health;
    if (!h) return;
    const live = h.llm_mode === "live";
    const dot = (color) => `<span class="inline-block h-2 w-2 rounded-full ${color}"></span>`;
    chips.innerHTML = `
      <span class="flex items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1" title="${esc(h.embedder_note || h.embedder_model)}">
        ${dot(h.embedder === "fastembed" ? "bg-fresh" : "bg-caution")}
        <span class="text-muted">Embeddings</span> <span class="font-mono">${esc(h.embedder === "fastembed" ? "MiniLM-L6-v2" : "hashing (offline)")}</span>
      </span>
      <span class="flex items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1" title="${esc(h.last_llm_error || "")}">
        ${dot(live ? "bg-fresh" : "bg-caution")}
        <span class="text-muted">Evaluator</span> <span class="font-mono">${esc(live ? `${h.llm_provider}:${h.llm_model}` : "offline heuristic")}</span>
      </span>`;
  }

  function renderHealth() {
    const s = state.stats;
    if (!s) return;
    const score = s.health_score;
    const circumference = 2 * Math.PI * 19;
    const ring = $("#health-ring");
    ring.setAttribute("stroke-dasharray", circumference.toFixed(2));
    ring.setAttribute("stroke-dashoffset", (circumference * (1 - score / 100)).toFixed(2));
    ring.setAttribute("stroke", score >= 80 ? "#52d09a" : score >= 55 ? "#f2b866" : "#f0707a");
    $("#health-num").textContent = String(score);
    $("#health-sub").textContent = s.conflicts_healed + s.conflicts_reverted === 0
      ? "No drift detected"
      : `${s.conflicts_healed} healed, ${s.conflicts_reverted} reverted`;

    const badge = $("#conflict-count");
    const open = state.audit.filter((a) => a.event === "CONFLICT_HEALED").length;
    badge.textContent = String(open);
    badge.classList.toggle("hidden", open === 0);
  }

  function statusBadge(status) {
    const map = {
      latest: ["bg-fresh/15 text-fresh", "Active"],
      deprecated: ["bg-stale/15 text-stale", "Deprecated"],
      rejected: ["bg-caution/15 text-caution", "Rejected"],
    };
    const [cls, label] = map[status] || ["bg-line text-muted", status];
    return `<span class="rounded-md px-2 py-0.5 text-xs font-medium ${cls}">${esc(label)}</span>`;
  }

  function renderKnowledgeBase() {
    const table = $("#kb-table");
    const s = state.stats;
    $("#kb-summary").textContent = s ? `${s.active_chunks} active, ${s.deprecated_chunks} deprecated, ${s.documents} documents` : "";
    if (!state.chunks.length) {
      table.innerHTML = `<div class="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">The knowledge base is empty. Ingest a document to begin.</div>`;
      return;
    }
    table.innerHTML = state.chunks
      .map((c) => `
        <article class="rounded-lg border border-line bg-raised p-3 ${c.active ? "" : "opacity-70"}">
          <div class="flex flex-wrap items-center gap-2">
            ${statusBadge(c.status)}
            <span class="text-sm font-medium">${esc(c.doc_name)}</span>
            <span class="font-mono text-xs text-muted">${esc(c.chunk_id)}</span>
            <span class="ml-auto text-xs text-muted">${esc(fmtTime(c.created_at))}</span>
          </div>
          <p class="mt-2 whitespace-pre-line text-sm leading-relaxed ${c.active ? "" : "stale-text line-through decoration-stale/40"}">${esc(c.text)}</p>
          ${c.superseded_by ? `<p class="mt-2 text-xs text-muted">Superseded by <span class="font-mono text-stale">${esc(c.superseded_by)}</span></p>` : ""}
          ${c.supersedes ? `<p class="mt-2 text-xs text-muted">Supersedes <span class="font-mono text-fresh">${esc(c.supersedes)}</span></p>` : ""}
        </article>`)
      .join("");
  }

  function conflictCard(rec, opts = {}) {
    const diff = wordDiff(rec.old_text || "", rec.new_text || "");
    const reverted = rec.reverted;
    const oldBadge = reverted
      ? `<span class="rounded-md bg-fresh/15 px-2 py-0.5 text-xs font-medium text-fresh">Reinstated (reverted)</span>`
      : `<span class="rounded-md bg-stale/15 px-2 py-0.5 text-xs font-medium text-stale">Deprecated: stale chunk</span>`;
    const newBadge = reverted
      ? `<span class="rounded-md bg-caution/15 px-2 py-0.5 text-xs font-medium text-caution">Rejected (reverted)</span>`
      : `<span class="rounded-md bg-fresh/15 px-2 py-0.5 text-xs font-medium text-fresh">Active: latest chunk</span>`;
    const fresh = state.justHealed.has(rec.id) ? "just-healed" : "";
    return `
      <article class="rounded-xl border border-line bg-panel ${fresh}" data-conflict="${rec.id}">
        <header class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
          <div class="text-sm font-medium">${esc(rec.old_doc)} <span class="px-1 text-muted">replaced by</span> ${esc(rec.new_doc)}</div>
          <div class="text-xs text-muted">Similarity ${pct(rec.similarity)} · Confidence ${pct(rec.confidence)} · ${esc(rec.engine || "")}</div>
          <div class="ml-auto flex items-center gap-3">
            <span class="text-xs text-muted">${esc(fmtTime(rec.created_at))}</span>
            <button data-toggle="${rec.id}" class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              reverted ? "border-fresh/50 text-fresh hover:bg-fresh/10" : "border-caution/50 text-caution hover:bg-caution/10"
            }">${reverted ? "Re-apply healing" : "Revert / undo"}</button>
          </div>
        </header>
        <div class="grid gap-px bg-line md:grid-cols-2">
          <div class="bg-panel p-5">
            <div class="flex items-center gap-2">${oldBadge}<span class="font-mono text-xs text-muted">${esc(rec.old_chunk_id)}</span></div>
            <p class="mt-3 whitespace-pre-line font-mono text-[13px] leading-7 ${reverted ? "" : "stale-text"}">${renderTokens(diff.left)}</p>
          </div>
          <div class="bg-panel p-5">
            <div class="flex items-center gap-2">${newBadge}<span class="font-mono text-xs text-muted">${esc(rec.new_chunk_id)}</span></div>
            <p class="mt-3 whitespace-pre-line font-mono text-[13px] leading-7 ${reverted ? "stale-text" : ""}">${renderTokens(diff.right)}</p>
          </div>
        </div>
        <footer class="border-t border-line px-5 py-3 text-sm">
          <span class="font-medium">Why it was flagged: </span>
          <span class="text-muted">${esc(rec.summary || "The evaluator judged the new chunk to replace facts in the older one.")}</span>
        </footer>
      </article>`;
  }

  function renderConflicts() {
    const list = $("#conflict-list");
    const conflicts = state.audit.filter((a) => a.event === "CONFLICT_HEALED");
    if (!conflicts.length) {
      list.innerHTML = `
        <div class="rounded-xl border border-dashed border-line px-6 py-12 text-center">
          <p class="text-sm text-ink">No conflicts yet.</p>
          <p class="mt-1 text-sm text-muted">Ingest Leave Policy 2024, then Leave Policy 2026, and the diff appears here.</p>
          <button data-goto="ingest" class="mt-4 rounded-lg bg-ice px-4 py-2 text-sm font-semibold text-base hover:brightness-110">Go to ingestion</button>
        </div>`;
      return;
    }
    list.innerHTML = conflicts.map((c) => conflictCard(c)).join("");
  }

  function renderLastIngest() {
    const box = $("#ingest-result");
    const r = state.lastIngest;
    if (!r) return;
    const stat = (label, value, tone = "") => `
      <div class="rounded-lg border border-line bg-raised px-3 py-2">
        <div class="text-lg font-semibold ${tone}">${value}</div>
        <div class="text-xs text-muted">${label}</div>
      </div>`;
    const traces = r.evaluations.length
      ? `<div class="mt-4 overflow-x-auto scroll-thin"><table class="w-full min-w-[34rem] text-left text-xs">
          <thead class="text-muted"><tr><th class="pb-2 pr-3 font-medium">Compared with</th><th class="pb-2 pr-3 font-medium">Similarity</th><th class="pb-2 pr-3 font-medium">Verdict</th><th class="pb-2 pr-3 font-medium">Confidence</th><th class="pb-2 font-medium">Action</th></tr></thead>
          <tbody>${r.evaluations.map((t) => {
            const tone = t.verdict === "CONTRADICTORY" ? "text-stale" : t.verdict === "DUPLICATE" ? "text-caution" : "text-muted";
            return `<tr class="border-t border-line"><td class="py-2 pr-3"><span class="font-mono">${esc(t.old_chunk_id)}</span><span class="block text-muted">${esc(t.old_doc)}</span></td>
              <td class="py-2 pr-3">${pct(t.similarity)}</td><td class="py-2 pr-3 font-medium ${tone}">${esc(t.verdict)}</td>
              <td class="py-2 pr-3">${pct(t.confidence)}</td><td class="py-2">${esc(t.action)}</td></tr>`;
          }).join("")}</tbody></table></div>`
      : `<p class="mt-4 text-sm text-muted">No existing chunk was similar enough (cosine 0.70 or higher) to compare, so nothing needed healing.</p>`;
    const conflicts = r.conflicts.length
      ? `<div class="mt-5 space-y-4">${r.conflicts.map((c) => conflictCard(state.audit.find((a) => a.id === c.id) || c)).join("")}</div>`
      : "";
    box.className = "mt-3 text-sm";
    box.innerHTML = `
      <p class="text-muted">Ingested <span class="font-medium text-ink">${esc(r.doc_name)}</span> with <span class="font-mono">${esc(r.engine)}</span>.</p>
      <div class="mt-3 grid grid-cols-3 gap-2">
        ${stat("Chunks stored", r.chunks.length)}
        ${stat("Conflicts healed", r.conflicts.length, r.conflicts.length ? "text-stale" : "")}
        ${stat("Duplicates skipped", r.duplicates_skipped, r.duplicates_skipped ? "text-caution" : "")}
      </div>
      ${traces}
      ${conflicts}
      ${r.conflicts.length ? `<button data-goto="conflicts" class="mt-4 text-xs text-ice underline underline-offset-4">Open full conflict view</button>` : ""}`;
  }

  function chunkRow(c, kind) {
    const used = kind === "used";
    return `
      <div class="rounded-lg border ${used ? "border-fresh/30 bg-fresh/5" : "border-stale/30 bg-stale/5"} p-3">
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="rounded-md px-2 py-0.5 font-medium ${used ? "bg-fresh/15 text-fresh" : "bg-stale/15 text-stale"}">${used ? "Used" : "Blocked"}</span>
          <span class="font-medium">${esc(c.doc_name)}</span>
          <span class="font-mono text-muted">${esc(c.chunk_id)}</span>
          <span class="ml-auto text-muted">match ${pct(c.similarity)}</span>
        </div>
        <p class="mt-2 whitespace-pre-line text-sm leading-relaxed ${used ? "" : "stale-text line-through decoration-stale/40"}">${esc(c.text)}</p>
        ${!used && c.block_reason ? `<p class="mt-2 text-xs text-stale">${esc(c.block_reason)}</p>` : ""}
      </div>`;
  }

  function renderChat() {
    const log = $("#chat-log");
    if (!state.chat.length) return;
    log.innerHTML = state.chat
      .map((m) => {
        if (m.role === "user") {
          return `<div class="flex justify-end"><div class="max-w-[85%] rounded-xl bg-raised px-4 py-2.5 text-sm">${esc(m.text)}</div></div>`;
        }
        if (m.pending) {
          return `<div class="rounded-xl border border-line bg-panel px-5 py-4 text-sm text-muted">Searching active chunks…</div>`;
        }
        if (m.error) {
          return `<div class="rounded-xl border border-stale/40 bg-panel px-5 py-4 text-sm text-stale">${esc(m.error)}</div>`;
        }
        const r = m.data;
        const banner = r.stale_context_prevented
          ? `<div class="mb-3 rounded-lg border border-caution/40 bg-caution/10 px-3 py-2 text-xs text-caution">Self-healing in action: ${r.blocked_chunks.length} stale chunk${r.blocked_chunks.length === 1 ? "" : "s"} matched this question and ${r.blocked_chunks.length === 1 ? "was" : "were"} filtered out before generation.</div>`
          : "";
        return `
          <div class="rounded-xl border border-line bg-panel p-5">
            ${banner}
            <p class="text-[15px] leading-relaxed">${esc(r.answer)}</p>
            <p class="mt-2 text-xs text-muted">Answer engine: <span class="font-mono">${esc(r.answer_engine)}</span></p>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 class="mb-2 text-sm font-medium">Context used (${r.used_chunks.length})</h3>
                <div class="space-y-2">${r.used_chunks.length ? r.used_chunks.map((c) => chunkRow(c, "used")).join("") : `<p class="text-xs text-muted">No active chunk matched.</p>`}</div>
              </div>
              <div>
                <h3 class="mb-2 text-sm font-medium">Blocked as stale (${r.blocked_chunks.length})</h3>
                <div class="space-y-2">${r.blocked_chunks.length ? r.blocked_chunks.map((c) => chunkRow(c, "blocked")).join("") : `<p class="text-xs text-muted">Nothing relevant was deprecated.</p>`}</div>
              </div>
            </div>
          </div>`;
      })
      .join("");
    log.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderStatsGrid() {
    const s = state.stats;
    if (!s) return;
    const cell = (label, value, tone = "") => `<div class="rounded-lg border border-line bg-raised px-3 py-2"><dd class="text-lg font-semibold ${tone}">${value}</dd><dt class="text-xs text-muted">${label}</dt></div>`;
    $("#stat-grid").innerHTML =
      cell("Active chunks", s.active_chunks, "text-fresh") +
      cell("Deprecated chunks", s.deprecated_chunks, s.deprecated_chunks ? "text-stale" : "") +
      cell("Conflicts healed", s.conflicts_healed) +
      cell("Reverted by auditors", s.conflicts_reverted, s.conflicts_reverted ? "text-caution" : "");
  }

  function renderTimeline() {
    const box = $("#audit-timeline");
    if (!state.audit.length) {
      box.innerHTML = `<p class="text-sm text-muted">No self-healing events yet.</p>`;
      return;
    }
    box.innerHTML = `<ol class="timeline-line space-y-4">${state.audit
      .map((a) => {
        const healed = a.event === "CONFLICT_HEALED";
        const dot = !healed ? "bg-caution" : a.reverted ? "bg-muted" : "bg-stale";
        const title = healed
          ? a.reverted ? "Healing reverted" : "Conflict healed"
          : "Duplicate skipped";
        return `<li class="relative pl-7">
          <span class="absolute left-0 top-1 h-3 w-3 rounded-full ring-4 ring-panel ${dot}"></span>
          <div class="flex flex-wrap items-baseline gap-x-2 text-sm"><span class="font-medium">${title}</span><span class="text-xs text-muted">${esc(fmtTime(a.created_at))}</span></div>
          <div class="mt-0.5 text-xs text-muted">${esc(a.old_doc || "")}${a.new_doc ? ` → ${esc(a.new_doc)}` : ""}</div>
          <div class="mt-1 text-xs leading-relaxed">${esc(a.summary || "")}</div>
          <div class="mt-1 font-mono text-[11px] text-muted">${esc(a.old_chunk_id || "")}${a.new_chunk_id ? ` → ${esc(a.new_chunk_id)}` : ""}</div>
        </li>`;
      })
      .join("")}</ol>`;
  }

  function renderLineage() {
    const box = $("#lineage-panel");
    const g = state.lineage;
    if (!g) return;
    const nodes = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    const chains = g.edges.filter((e) => e.relation === "SUPERSEDED_BY");
    const counts = g.stats.node_counts || {};
    const summary = `${counts.Document || 0} documents · ${counts.Chunk || 0} chunks · ${counts.Entity || 0} entities · ${g.stats.edge_count} edges`;
    if (!chains.length) {
      box.innerHTML = `<p>${esc(summary)}</p><p class="mt-2">No SUPERSEDED_BY edges yet.</p>`;
      return;
    }
    box.innerHTML = `<p class="text-xs">${esc(summary)}</p><ul class="mt-3 space-y-2">${chains
      .map((e) => {
        const a = nodes[e.source], b = nodes[e.target];
        const label = (n, id) => (n ? `${esc(n.props.doc_name || "")} <span class="font-mono text-[11px]">${esc(n.label)}</span>` : esc(id));
        return `<li class="rounded-lg border border-line bg-raised px-3 py-2 text-xs ${e.reverted ? "opacity-50" : ""}">
          <span class="${e.reverted ? "" : "text-stale line-through decoration-stale/50"}">${label(a, e.source)}</span>
          <span class="mx-1 text-muted">SUPERSEDED_BY</span>
          <span class="${e.reverted ? "" : "text-fresh"}">${label(b, e.target)}</span>
          ${e.reverted ? `<span class="ml-1 text-caution">(reverted)</span>` : ""}
        </li>`;
      })
      .join("")}</ul>`;
  }

  function renderAll() {
    renderHeader();
    renderHealth();
    renderKnowledgeBase();
    renderLastIngest();
    renderConflicts();
    renderStatsGrid();
    renderTimeline();
    renderLineage();
  }

  // ------------------------------------------------------------------ data refresh
  async function refresh() {
    try {
      const [health, stats, chunks, audit, lineage] = await Promise.all([
        api("/api/health"),
        api("/api/stats"),
        api("/api/chunks"),
        api("/api/audit-logs?limit=200"),
        api("/api/lineage"),
      ]);
      Object.assign(state, { health, stats, chunks, audit, lineage });
      renderAll();
    } catch (err) {
      $("#engine-chips").innerHTML = `<span class="rounded-md border border-stale/40 bg-panel px-2.5 py-1 text-stale">API unreachable: ${esc(err.message)}</span>`;
    }
  }

  // ------------------------------------------------------------------ actions
  async function ingestPayload(formData, label) {
    setBusy(true);
    try {
      const result = await api("/api/ingest", { method: "POST", body: formData });
      state.lastIngest = result;
      state.justHealed = new Set(result.conflicts.map((c) => c.id));
      await refresh();
      setTimeout(() => state.justHealed.clear(), 1500);
      if (result.conflicts.length) {
        toast(`Conflict healed: ${result.conflicts.length} stale chunk${result.conflicts.length === 1 ? "" : "s"} deprecated.`, "warn");
      } else if (result.duplicates_skipped && !result.chunks.length) {
        toast(`${label}: duplicate content, nothing new stored.`, "info");
      } else {
        toast(`${label}: ${result.chunks.length} chunk${result.chunks.length === 1 ? "" : "s"} stored.`, "ok");
      }
    } catch (err) {
      toast(`Ingestion failed: ${err.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function ingestDemo(key) {
    const demo = DEMOS[key];
    if (!demo) return;
    const fd = new FormData();
    fd.append("doc_name", demo.doc_name);
    fd.append("text", demo.text);
    return ingestPayload(fd, demo.doc_name);
  }

  async function askQuestion(prompt) {
    const q = prompt.trim();
    if (!q || state.busy) return;
    $("#chat-empty")?.remove();
    state.chat.push({ role: "user", text: q });
    const pending = { role: "assistant", pending: true };
    state.chat.push(pending);
    renderChat();
    setBusy(true);
    try {
      const data = await api("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q, top_k: 4 }),
      });
      Object.assign(pending, { pending: false, data });
    } catch (err) {
      Object.assign(pending, { pending: false, error: `Query failed: ${err.message}` });
    } finally {
      setBusy(false);
      renderChat();
    }
  }

  async function toggleConflict(id) {
    try {
      const res = await api(`/api/conflicts/${id}/toggle`, { method: "POST" });
      state.justHealed = new Set();
      await refresh();
      toast(res.conflict.reverted ? "Reverted: older chunk is active again." : "Re-applied: older chunk is deprecated.", res.conflict.reverted ? "warn" : "ok");
    } catch (err) {
      toast(`Could not update conflict: ${err.message}`, "error");
    }
  }

  async function resetKb() {
    if (!window.confirm("Delete every chunk, lineage edge and audit entry?")) return;
    setBusy(true);
    try {
      await api("/api/reset", { method: "POST" });
      state.lastIngest = null;
      state.chat = [];
      $("#ingest-result").className = "mt-3 text-sm text-muted";
      $("#ingest-result").textContent = "Nothing ingested in this session yet. Use the demo buttons to start.";
      $("#chat-log").innerHTML = `<div class="rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted" id="chat-empty">Ask a question to see which chunks were used and which were blocked.</div>`;
      await refresh();
      toast("Knowledge base cleared.", "ok");
    } catch (err) {
      toast(`Reset failed: ${err.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function switchTab(tab) {
    state.tab = tab;
    $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    ["ingest", "conflicts", "playground"].forEach((name) => $(`#view-${name}`).classList.toggle("hidden", name !== tab));
    if (tab === "conflicts" || tab === "playground") refresh();
  }

  // ------------------------------------------------------------------ wiring
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-demo], [data-toggle], [data-goto], [data-tab], .suggest, #btn-reset");
    if (!target) return;
    if (target.dataset.demo) ingestDemo(target.dataset.demo);
    else if (target.dataset.toggle) toggleConflict(Number(target.dataset.toggle));
    else if (target.dataset.goto) switchTab(target.dataset.goto);
    else if (target.dataset.tab) switchTab(target.dataset.tab);
    else if (target.classList.contains("suggest")) { switchTab("playground"); askQuestion(target.dataset.q); }
    else if (target.id === "btn-reset") resetKb();
  });

  $("#ingest-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#doc-name").value.trim();
    const text = $("#doc-text").value;
    const file = $("#doc-file").files[0];
    if (!text.trim() && !file) {
      toast("Paste some text or choose a .md/.txt file first.", "warn");
      return;
    }
    const fd = new FormData();
    fd.append("doc_name", name);
    fd.append("text", text);
    if (file) fd.append("file", file);
    await ingestPayload(fd, name || (file ? file.name : "Document"));
    $("#doc-text").value = "";
    $("#doc-file").value = "";
  });

  $("#chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#chat-input");
    const value = input.value;
    input.value = "";
    askQuestion(value);
  });

  // initial load + polling (paused while the tab is hidden)
  refresh();
  setInterval(() => { if (!document.hidden && !state.busy) refresh(); }, 6000);
})();
