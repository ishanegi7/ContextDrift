import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const icons = {
  ok: <CheckCircle2 className="w-4 h-4 text-fresh shrink-0" />,
  warn: <AlertTriangle className="w-4 h-4 text-caution shrink-0" />,
  error: <AlertCircle className="w-4 h-4 text-stale shrink-0" />,
  info: <Info className="w-4 h-4 text-muted shrink-0" />,
};

const styles = {
  ok: 'border-fresh/30 bg-fresh/10 text-fresh shadow-card',
  warn: 'border-caution/30 bg-caution/10 text-caution shadow-card',
  error: 'border-stale/30 bg-stale/10 text-stale shadow-card',
  info: 'border-line bg-panel text-ink shadow-card',
};

export default function ToastContainer({ toasts = [] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium ${
              styles[toast.kind] || styles.info
            }`}
          >
            {icons[toast.kind] || icons.info}
            <span className="flex-1 text-ink">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
