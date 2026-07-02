'use client';

import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 70;

/**
 * Shared pull-to-refresh gesture (same behavior as /mobile/jobs).
 * Spread `bind` onto the page's root element and render <PullIndicator/>
 * plus apply `contentStyle` to the translating content wrapper.
 */
export function usePullToRefresh(onRefresh: () => Promise<any>) {
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0 && !refreshing) {
      pullStartY.current = e.touches[0].clientY;
    } else {
      pullStartY.current = null;
    }
  }, [refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) setPullDistance(Math.min(delta * 0.5, 100));
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (pullStartY.current === null) return;
    const shouldRefresh = pullDistance > PULL_THRESHOLD;
    pullStartY.current = null;
    if (shouldRefresh) {
      setRefreshing(true);
      setPullDistance(56);
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  return {
    bind: { onTouchStart, onTouchMove, onTouchEnd },
    pullDistance,
    refreshing,
    isPulling: pullStartY.current !== null,
    rootStyle: { overscrollBehaviorY: 'contain' as const },
    contentStyle: {
      transform: `translateY(${pullDistance}px)`,
      transition: pullStartY.current === null ? 'transform 0.2s ease-out' : undefined,
    },
  };
}

export function PullIndicator({ pullDistance, refreshing }: { pullDistance: number; refreshing: boolean }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-30"
      style={{ height: pullDistance, opacity: pullDistance > 10 ? 1 : 0 }}
    >
      <div className="mt-2 bg-white shadow-md rounded-full p-2 border border-slate-100">
        <RefreshCw
          className={`w-6 h-6 text-indigo-500 ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${pullDistance * 3}deg)` }}
        />
      </div>
    </div>
  );
}
