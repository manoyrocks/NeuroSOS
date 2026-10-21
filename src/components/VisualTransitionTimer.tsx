/**
 * [AGENT 3: SENSORY UI & GPU SHADER ENGINEER]
 * VisualTransitionTimer (Vanishing Low-Arousal Rainbow Arc) & SubOsDimmerOverlay
 */

import React from 'react';

interface VisualTransitionTimerProps {
  totalSeconds: number;
  elapsedSeconds: number;
  label?: string;
}

export const VisualTransitionTimer: React.FC<VisualTransitionTimerProps> = ({
  totalSeconds,
  elapsedSeconds,
  label = 'Task Transition Arc',
}) => {
  const safeTotal = Math.max(1, totalSeconds);
  const remainingSec = Math.max(0, safeTotal - elapsedSeconds);
  const remainingRatio = Math.max(0, Math.min(1, remainingSec / safeTotal));

  // SVG semicircle geometry
  const radius = 84;
  const circumference = Math.PI * radius; // Half circle arc length
  const strokeDashoffset = circumference * (1 - remainingRatio);

  const mins = Math.floor(remainingSec / 60);
  const secs = Math.floor(remainingSec % 60);

  return (
    <div className="inline-flex flex-col items-center px-6 py-4 rounded-3xl bg-slate-950/65 backdrop-blur-md border border-white/10">
      <div className="text-xs font-medium text-slate-300 mb-2">
        <span>{label}</span>
        <span className="mx-2 text-slate-600">·</span>
        <span className="font-mono tabular-nums text-teal-300">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')} remaining
        </span>
      </div>

      <svg width="210" height="112" viewBox="0 0 210 112" className="overflow-visible">
        <defs>
          <linearGradient id="auraArcWarmSpectrum" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="35%" stopColor="#34D399" />
            <stop offset="70%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>

        {/* Background Track */}
        <path
          d="M 21 98 A 84 84 0 0 1 189 98"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Vanishing Spectrum Arc */}
        <path
          d="M 21 98 A 84 84 0 0 1 189 98"
          fill="none"
          stroke="url(#auraArcWarmSpectrum)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.35s linear' }}
        />

        {/* Inner Nested Harmonious Arcs */}
        <path
          d="M 35 98 A 70 70 0 0 1 175 98"
          fill="none"
          stroke="#2DD4BF"
          strokeOpacity="0.45"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={Math.PI * 70}
          strokeDashoffset={Math.PI * 70 * (1 - remainingRatio)}
          style={{ transition: 'stroke-dashoffset 0.35s linear' }}
        />

        <path
          d="M 49 98 A 56 56 0 0 1 161 98"
          fill="none"
          stroke="#A78BFA"
          strokeOpacity="0.40"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={Math.PI * 56}
          strokeDashoffset={Math.PI * 56 * (1 - remainingRatio)}
          style={{ transition: 'stroke-dashoffset 0.35s linear' }}
        />
      </svg>

      <div className="text-[11px] text-slate-400 mt-1">
        Non-numerical vanishing rainbow arc prevents countdown anxiety
      </div>
    </div>
  );
};

interface SubOsDimmerOverlayProps {
  dimmerOpacity: number; // 0.0 to 0.80
}

export const SubOsDimmerOverlay: React.FC<SubOsDimmerOverlayProps> = ({ dimmerOpacity }) => {
  const clamped = Math.max(0, Math.min(0.82, dimmerOpacity));
  if (clamped <= 0.01) return null;

  return (
    <div
      aria-hidden="true"
      style={{ opacity: clamped }}
      className="pointer-events-none fixed inset-0 z-50 bg-black transition-opacity duration-700"
    />
  );
};
