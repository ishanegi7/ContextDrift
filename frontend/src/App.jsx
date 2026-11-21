import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import HeroBanner from './components/HeroBanner';
import IngestView from './components/IngestView';
import ConflictsView from './components/ConflictsView';
import PlaygroundView from './components/PlaygroundView';
import ToastContainer from './components/Toast';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('ingest');
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [audit, setAudit] = useState([]);
  const [lineage, setLineage] = useState(null);
  const [lastIngest, setLastIngest] = useState(null);
  const [chat, setChat] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState(false);

  const addToast = useCallback((message, kind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [h, s, ch, a, l] = await Promise.all([
        api.getHealth(),
        api.getStats(),
        api.getChunks(),
        api.getAuditLogs(200),
        api.getLineage(),
      ]);
      setHealth(h);
      setStats(s);
      setChunks(ch);
      setAudit(a);
      setLineage(l);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      if (!document.hidden && !busy) {
        refreshData();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [refreshData, busy]);

  const handleIngest = async (formData, label) => {
    setBusy(true);
    try {
      const result = await api.ingest(formData);
      setLastIngest(result);
      await refreshData();
      if (result.conflicts?.length) {
        addToast(
          `Conflict healed: ${result.conflicts.length} stale chunk${
            result.conflicts.length === 1 ? '' : 's'
          } deprecated.`,
          'warn'
        );
      } else if (result.duplicates_skipped && !result.chunks?.length) {
        addToast(`${label}: duplicate content, nothing new stored.`, 'info');
      } else {
        addToast(
          `${label}: ${result.chunks?.length || 0} chunk${
            result.chunks?.length === 1 ? '' : 's'
          } stored.`,
          'ok'
        );
      }
    } catch (err) {
      addToast(`Ingestion failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAsk = async (prompt) => {
    if (!prompt.trim() || busy) return;
    const userMsg = { role: 'user', text: prompt };
    const pendingMsg = { role: 'assistant', pending: true };
    setChat((prev) => [...prev, userMsg, pendingMsg]);
    setBusy(true);

    try {
      const data = await api.query(prompt, 4);
      setChat((prev) =>
        prev.map((m) => (m === pendingMsg ? { role: 'assistant', pending: false, data } : m))
      );
    } catch (err) {
      setChat((prev) =>
        prev.map((m) =>
          m === pendingMsg ? { role: 'assistant', pending: false, error: err.message } : m
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggleConflict = async (auditId) => {
    setBusy(true);
    try {
      const res = await api.toggleConflict(auditId);
      await refreshData();
      addToast(
        res.conflict?.reverted
          ? 'Reverted: older chunk is active again.'
          : 'Re-applied: older chunk is deprecated.',
        res.conflict?.reverted ? 'warn' : 'ok'
      );
    } catch (err) {
      addToast(`Could not toggle conflict: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Delete every chunk, lineage edge and audit entry?')) return;
    setBusy(true);
    try {
      await api.reset();
      setLastIngest(null);
      setChat([]);
      await refreshData();
      addToast('Knowledge base cleared successfully.', 'ok');
    } catch (err) {
      addToast(`Reset failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const conflictCount = audit.filter((a) => a.event === 'CONFLICT_HEALED').length;

  return (
    <div className="min-h-screen bg-base font-sans text-ink antialiased">
      <Header
        health={health}
        stats={stats}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        conflictCount={conflictCount}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'ingest' && (
          <>
            <HeroBanner onNavigate={setActiveTab} />
            <IngestView
              chunks={chunks}
              stats={stats}
              lastIngest={lastIngest}
              onIngest={handleIngest}
              onReset={handleReset}
              busy={busy}
              onGotoConflicts={() => setActiveTab('conflicts')}
            />
          </>
        )}

        {activeTab === 'conflicts' && (
          <ConflictsView
            conflicts={audit}
            onToggle={handleToggleConflict}
            busy={busy}
            onGotoIngest={() => setActiveTab('ingest')}
          />
        )}

        {activeTab === 'playground' && (
          <PlaygroundView
            chat={chat}
            stats={stats}
            audit={audit}
            lineage={lineage}
            onAsk={handleAsk}
            busy={busy}
          />
        )}
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
