import { InView } from '@/components/core/in-view';
import { ArrowDown, Sparkles } from 'lucide-react';

export function InViewBasic() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-6 shadow-soft">
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between border-b border-line/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blush text-ink">
            <Sparkles className="h-4 w-4 text-ice" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink">Motion-Primitives Scroll Animation</h3>
            <p className="text-xs text-muted">Scroll the preview box below to trigger the blur + slide InView transition</p>
          </div>
        </div>
        <span className="rounded-full bg-raised px-2.5 py-0.5 text-[11px] font-mono text-muted border border-line/60">
          InView &middot; motion/react
        </span>
      </div>

      {/* Scrollable Container */}
      <div className="h-[350px] w-full overflow-y-auto rounded-xl border border-line/80 bg-base/60 scroll-thin">
        {/* Scroll down indicator */}
        <div className="py-12 text-center text-sm font-medium text-muted flex flex-col items-center justify-center gap-2">
          <span>Scroll down to reveal animated card</span>
          <ArrowDown className="h-4 w-4 animate-bounce text-ice" />
        </div>

        {/* Scroll Target Area */}
        <div className="flex h-[500px] items-end justify-center px-4 pb-24">
          <InView
            variants={{
              hidden: { opacity: 0, y: 100, filter: 'blur(4px)' },
              visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
            }}
            viewOptions={{ margin: '0px 0px -100px 0px' }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            <div className="max-w-md rounded-2xl border border-line bg-panel p-6 shadow-card hover:border-ice/50 transition-colors">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ice">
                <span className="h-2 w-2 rounded-full bg-ice" />
                Motion-Primitives Component
              </div>
              <p className="text-sm leading-relaxed text-ink/90">
                <strong className="font-semibold text-ink">
                  Craft beautiful animated components with Motion-Primitives.
                </strong>{' '}
                Designed for developers and designers. The library leverages the power of Motion,
                with intuitive APIs that simplifies creating complex animations for any project.
                Start building more dynamic interfaces today.
              </p>
              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-line/50 text-[11px] text-muted">
                <span className="font-mono bg-raised px-1.5 py-0.5 rounded text-ink/70">variants</span>
                <span>blur(4px) &rarr; blur(0px)</span>
                <span className="font-mono bg-raised px-1.5 py-0.5 rounded text-ink/70 ml-auto">duration: 0.35s</span>
              </div>
            </div>
          </InView>
        </div>
      </div>
    </div>
  );
}

export default InViewBasic;
