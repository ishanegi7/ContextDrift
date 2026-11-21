// REST client for ContextDrift FastAPI endpoints

async function request(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || body);
    } catch (_) {
      // ignore JSON parse error
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  getHealth: () => request('/api/health'),
  getStats: () => request('/api/stats'),
  getChunks: (status) => request(status ? `/api/chunks?status=${status}` : '/api/chunks'),
  getAuditLogs: (limit = 200, conflictsOnly = false) =>
    request(`/api/audit-logs?limit=${limit}${conflictsOnly ? '&conflicts_only=true' : ''}`),
  getLineage: () => request('/api/lineage'),
  ingest: (formData) => request('/api/ingest', { method: 'POST', body: formData }),
  query: (prompt, topK = 4) =>
    request('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, top_k: topK }),
    }),
  toggleConflict: (auditId) => request(`/api/conflicts/${auditId}/toggle`, { method: 'POST' }),
  reset: () => request('/api/reset', { method: 'POST' }),
};
