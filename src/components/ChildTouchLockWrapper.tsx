/**
 * [AGENT 3: SENSORY UI & GPU SHADER ENGINEER]
 * ChildTouchLockWrapper — Kiosk Touch-Lock & Dual-Corner 3.0-Second Parent Unlock
 * Intercepts all child taps/drags into gentle water ripples + C-Major Pentatonic Kalimba tones.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { TouchRipplePoint } from '../types/aurasync';

export const DUAL_CORNER_HOLD_DURATION_MS = 3000;
export const CORNER_HITBOX_RATIO = 0.18; // Top-left 18% and Top-right 18% screen zones

/**
 * Pure state verifier used by both the Kiosk UI and Agent 5's Clinical Safety Audit
 */
export class DualCornerUnlockVerifier {
  static isPointInTopLeftCorner(xNorm: number, yNorm: number): boolean {
    return xNorm >= 0 && xNorm <= CORNER_HITBOX_RATIO && yNorm >= 0 && yNorm <= CORNER_HITBOX_RATIO;
  }

  static isPointInTopRightCorner(xNorm: number, yNorm: number): boolean {
    return (
      xNorm >= 1.0 - CORNER_HITBOX_RATIO &&
      xNorm <= 1.0 &&
      yNorm >= 0 &&
      yNorm <= CORNER_HITBOX_RATIO
    );
  }

  static evaluateActiveTouches(
    touchPointsNormalized: ReadonlyArray<{ x: number; y: number }>,
    dualHoldStartMs: number | null,
    nowMs: number
  ): {
    bothCornersHeld: boolean;
    nextDualHoldStartMs: number | null;
    progressRatio: number;
    unlocked: boolean;
  } {
    let hasTopLeft = false;
    let hasTopRight = false;

    for (const pt of touchPointsNormalized) {
      if (DualCornerUnlockVerifier.isPointInTopLeftCorner(pt.x, pt.y)) {
        hasTopLeft = true;
      }
      if (DualCornerUnlockVerifier.isPointInTopRightCorner(pt.x, pt.y)) {
        hasTopRight = true;
      }
    }

    const bothCornersHeld = hasTopLeft && hasTopRight;
    if (!bothCornersHeld) {
      return {
        bothCornersHeld: false,
        nextDualHoldStartMs: null,
        progressRatio: 0,
        unlocked: false,
      };
    }

    const startMs = dualHoldStartMs ?? nowMs;
    const elapsed = Math.max(0, nowMs - startMs);
    const progressRatio = Math.min(1.0, elapsed / DUAL_CORNER_HOLD_DURATION_MS);

    return {
      bothCornersHeld: true,
      nextDualHoldStartMs: startMs,
      progressRatio,
      unlocked: elapsed >= DUAL_CORNER_HOLD_DURATION_MS,
    };
  }
}

interface ChildTouchLockWrapperProps {
  isLocked: boolean;
  onUnlockSuccess: () => void;
  onEngageLock: () => void;
  onChildCanvasTouch: (xNorm: number, yNorm: number) => void;
  ripples: TouchRipplePoint[];
  children: React.ReactNode;
}

export const ChildTouchLockWrapper: React.FC<ChildTouchLockWrapperProps> = ({
  isLocked,
  onUnlockSuccess,
  onChildCanvasTouch,
  ripples,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftCornerPressed, setLeftCornerPressed] = useState(false);
  const [rightCornerPressed, setRightCornerPressed] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const dualHoldStartRef = useRef<number | null>(null);
  const lastDragRippleMsRef = useRef<number>(0);

  const bothHeld = leftCornerPressed && rightCornerPressed;

  useEffect(() => {
    if (!isLocked || !bothHeld) {
      dualHoldStartRef.current = null;
      setHoldProgress(0);
      return;
    }

    dualHoldStartRef.current = performance.now();
    let rafId = 0;

    const updateHold = (now: number) => {
      if (!dualHoldStartRef.current) return;
      const elapsed = now - dualHoldStartRef.current;
      const ratio = Math.min(1, elapsed / DUAL_CORNER_HOLD_DURATION_MS);
      setHoldProgress(ratio);

      if (ratio >= 1) {
        setLeftCornerPressed(false);
        setRightCornerPressed(false);
        setHoldProgress(0);
        dualHoldStartRef.current = null;
        onUnlockSuccess();
        return;
      }
      rafId = requestAnimationFrame(updateHold);
    };

    rafId = requestAnimationFrame(updateHold);
    return () => cancelAnimationFrame(rafId);
  }, [isLocked, bothHeld, onUnlockSuccess]);

  const handleSurfacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const yNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));

    onChildCanvasTouch(xNorm, yNorm);
  };

  const handleSurfacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !containerRef.current) return;
    const now = performance.now();
    if (now - lastDragRippleMsRef.current < 160) return;
    lastDragRippleMsRef.current = now;

    const rect = containerRef.current.getBoundingClientRect();
    const xNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const yNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
    onChildCanvasTouch(xNorm, yNorm);
  };

  // Multi-touch handler for real iOS/Android tablet dual-corner hold
  const handleTouchEvent = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isLocked || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let hasLeft = false;
    let hasRight = false;

    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      const xNorm = (t.clientX - rect.left) / Math.max(1, rect.width);
      const yNorm = (t.clientY - rect.top) / Math.max(1, rect.height);
      if (DualCornerUnlockVerifier.isPointInTopLeftCorner(xNorm, yNorm)) hasLeft = true;
      if (DualCornerUnlockVerifier.isPointInTopRightCorner(xNorm, yNorm)) hasRight = true;
    }

    setLeftCornerPressed(hasLeft);
    setRightCornerPressed(hasRight);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handleSurfacePointerDown}
      onPointerMove={handleSurfacePointerMove}
      onTouchStart={handleTouchEvent}
      onTouchMove={handleTouchEvent}
      onTouchEnd={handleTouchEvent}
      onTouchCancel={() => {
        setLeftCornerPressed(false);
        setRightCornerPressed(false);
      }}
      className="relative w-full h-full select-none overflow-hidden touch-none"
    >
      {/* Underlying Sensory Shader & Content */}
      {children}

      {/* Visual Water Ripples + Kalimba Note Floating Feedback */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {ripples.map((r) => (
          <div
            key={r.id}
            style={{
              left: `${r.xNormalized * 100}%`,
              top: `${r.yNormalized * 100}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div
              style={{ borderColor: r.colorHex }}
              className="w-28 h-28 rounded-full border-2 opacity-60 animate-ping"
            />
            <span
              style={{ color: r.colorHex }}
              className="block text-center text-xs font-mono tabular-nums font-medium mt-1 opacity-80"
            >
              {r.noteName} · {Math.round(r.frequencyHz)}Hz
            </span>
          </div>
        ))}
      </div>

      {/* Kiosk Child Touch-Lock Dual-Corner Parent Anchors */}
      {isLocked && (
        <>
          {/* Top-Left Parent Corner Hold Target */}
          <button
            type="button"
            aria-label="Top-Left Parent Unlock Corner (Hold both corners 3s, or Shift+Hold on desktop)"
            onPointerDown={(e) => {
              e.stopPropagation();
              setLeftCornerPressed(true);
              if (e.shiftKey) setRightCornerPressed(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setLeftCornerPressed(false);
              if (e.shiftKey) setRightCornerPressed(false);
            }}
            onPointerLeave={() => {
              setLeftCornerPressed(false);
            }}
            className={`absolute top-4 left-4 z-40 w-20 h-20 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${
              leftCornerPressed
                ? 'bg-teal-500/30 border-teal-300 text-teal-100 scale-95'
                : 'bg-slate-950/55 border-white/15 text-slate-300/80 hover:border-white/30'
            } backdrop-blur-md`}
          >
            <Lock className="w-4 h-4" />
            <span className="text-[10px] font-mono tabular-nums tracking-tight">
              {bothHeld ? `${(holdProgress * 3.0).toFixed(1)}s` : 'Corner L'}
            </span>
          </button>

          {/* Top-Right Parent Corner Hold Target */}
          <button
            type="button"
            aria-label="Top-Right Parent Unlock Corner (Hold both corners 3s, or Shift+Hold on desktop)"
            onPointerDown={(e) => {
              e.stopPropagation();
              setRightCornerPressed(true);
              if (e.shiftKey) setLeftCornerPressed(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setRightCornerPressed(false);
              if (e.shiftKey) setLeftCornerPressed(false);
            }}
            onPointerLeave={() => {
              setRightCornerPressed(false);
            }}
            className={`absolute top-4 right-4 z-40 w-20 h-20 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${
              rightCornerPressed
                ? 'bg-teal-500/30 border-teal-300 text-teal-100 scale-95'
                : 'bg-slate-950/55 border-white/15 text-slate-300/80 hover:border-white/30'
            } backdrop-blur-md`}
          >
            <Lock className="w-4 h-4" />
            <span className="text-[10px] font-mono tabular-nums tracking-tight">
              {bothHeld ? `${(holdProgress * 3.0).toFixed(1)}s` : 'Corner R'}
            </span>
          </button>

          {/* Top-Center Caregiver Dual-Corner Unlock Progress Banner */}
          <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-white/15 text-slate-200">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <div className="text-xs">
              <span className="font-medium">Child Touch-Lock Active</span>
              <span className="mx-2 text-slate-500">·</span>
              <span className="text-slate-400">
                Hold L + R corners 3.0s to unlock (or hold button below on single-mouse desktop)
              </span>
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                setLeftCornerPressed(true);
                setRightCornerPressed(true);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                setLeftCornerPressed(false);
                setRightCornerPressed(false);
              }}
              onPointerLeave={() => {
                setLeftCornerPressed(false);
                setRightCornerPressed(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-teal-200 transition-colors whitespace-nowrap shrink-0"
            >
              {bothHeld
                ? `Holding ${(holdProgress * 3.0).toFixed(1)}s / 3.0s`
                : 'Hold 3.0s Dual-Corner'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
