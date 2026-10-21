/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NeuroSOS — 100% Offline Sensory Comfort, Focus Timer & Calm Audio-Visual Suite
 * Multi-Agent Architecture (Agents 1–5 Integrated Production Runtime)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Play,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Square,
  Timer,
  Volume2,
} from 'lucide-react';
import {
  BRICKWALL_CEILING_DBFS,
  PENTATONIC_SCALE_NOTES,
  sharedAudioEngine,
} from './audio/NeuroAcousticDspEngine';
import { ClinicalSafetyAuditor, SafetyAuditResult } from './audit/ClinicalSafetyAuditor';
import { MULTI_AGENT_BLUEPRINTS } from './audit/MultiAgentBlueprints';
import { ChildTouchLockWrapper } from './components/ChildTouchLockWrapper';
import {
  OfflineStatusBanner,
  PlayStorePublishingPanel,
  PWAInstallButton,
} from './components/PWAInstallSection';
import { SubOsDimmerOverlay, VisualTransitionTimer } from './components/VisualTransitionTimer';
import { OfflineClinicalStore, SQLITE_DDL_SCHEMA } from './persistence/OfflineClinicalStore';
import { SensoryShaderCanvas } from './shaders/SensoryShaderCanvas';
import {
  AcousticTelemetrySnapshot,
  BiquadFilterMode,
  EfficacyRating,
  IsoPhase,
  MeltdownSessionLog,
  NoiseColor,
  SensoryProfile,
  SessionMode,
  ShaderId,
  TimbreBlacklistItem,
  TouchRipplePoint,
} from './types/aurasync';

type ActiveWorkspaceTab = 'dashboard' | 'profile' | 'logs' | 'audit';

const SHADER_METADATA: Record<
  ShaderId,
  { title: string; subtitle: string; oscillationSpec: string }
> = {
  [ShaderId.BIOLUMINESCENT_TUNNEL]: {
    title: 'Shader A · Bioluminescent 3D Light Tunnel',
    subtitle: 'Constant slow Z-axis drift with soft teal/violet depth rings',
    oscillationSpec: '0.09 Hz (<0.2 Hz Low-Motion Safe)',
  },
  [ShaderId.CLASSROOM_BUBBLES]: {
    title: 'Shader B · Rising Translucent Classroom Bubbles',
    subtitle: 'Predictable upward buoyancy with Fresnel refractive rims',
    oscillationSpec: '0.07 Hz (<0.2 Hz Low-Motion Safe)',
  },
  [ShaderId.OLED_LANTERNS]: {
    title: 'Shader C · High-Contrast OLED Floating Lanterns',
    subtitle: 'Pure #000000 zero-glare background with warm amber ascension',
    oscillationSpec: '0.05 Hz (<0.2 Hz Low-Motion Safe)',
  },
  [ShaderId.BREATHING_ORB]: {
    title: 'Shader D · Guided Pacing Breathing Orb',
    subtitle: '4.0s sinusoidal inhale expansion · 6.0s slow exhale contraction',
    oscillationSpec: '0.10 Hz Exact (10.0s Cycle)',
  },
};

const BLACKLIST_LABELS: Record<TimbreBlacklistItem, { label: string; description: string }> = {
  HIGH_CHIMES_1500HZ: {
    label: 'High-Frequency Chimes (>1.5 kHz)',
    description: 'Clamps secondary notch filter at 1350 Hz and transposes upper kalimba octave down',
  },
  SHARP_TRANSIENTS: {
    label: 'Sharp Percussive Transients',
    description: 'Suppresses marimba pluck attack and extends kalimba envelope attack to 65ms',
  },
  BINAURAL_DETUNE: {
    label: 'Stereo Phase Detuning',
    description: 'Locks all harmonic pad oscillators to 0.0 cents phase-coherent unison',
  },
  SUB_BASS_RUMBLE: {
    label: 'Deep Low-End Rumble (<90 Hz)',
    description: 'Substitutes 65.4 Hz C2 bass pulse fundamental with warm 261.6 Hz C4 voicing',
  },
};

const formatPhaseLabel = (phase: IsoPhase): string => {
  switch (phase) {
    case IsoPhase.PHASE_1_MATCH_AROUSAL:
      return 'PHASE 1 MATCH TEMPO';
    case IsoPhase.PHASE_2_HARMONIC_THINNING:
      return 'PHASE 2 HARMONIC THINNING';
    case IsoPhase.PHASE_3_VAGAL_BASELINE:
      return 'PHASE 3 DEEP REST BASELINE';
    case IsoPhase.STATIC_REGULATION:
      return 'STEADY CALM FLOW';
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('dashboard');
  const [profile, setProfile] = useState<SensoryProfile>(() => OfflineClinicalStore.loadProfile());
  const [sessionLogs, setSessionLogs] = useState<MeltdownSessionLog[]>(() =>
    OfflineClinicalStore.loadLogs()
  );

  // Active sensory session state
  const [sessionMode, setSessionMode] = useState<SessionMode>(SessionMode.IDLE);
  const [activeShader, setActiveShader] = useState<ShaderId>(profile.preferredSosShader);
  const [isKioskLocked, setIsKioskLocked] = useState<boolean>(false);
  const [ripples, setRipples] = useState<TouchRipplePoint[]>([]);
  const [kalimbaTouchCounter, setKalimbaTouchCounter] = useState<number>(0);
  const [manualDimmerOverride, setManualDimmerOverride] = useState<number | null>(null);
  const [pendingLogForRating, setPendingLogForRating] = useState<MeltdownSessionLog | null>(null);
  const [sessionStartIso, setSessionStartIso] = useState<string>('');

  // Telemetry snapshot from Agent 2 DSP Engine
  const [telemetry, setTelemetry] = useState<AcousticTelemetrySnapshot>(() =>
    sharedAudioEngine.tick(0)
  );

  // Acoustic & Safety Audit Results (Agent 5)
  const [auditResults, setAuditResults] = useState<SafetyAuditResult[]>(() =>
    ClinicalSafetyAuditor.runFullClinicalAudit()
  );
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [logModeFilter, setLogModeFilter] = useState<'ALL' | SessionMode>('ALL');

  const lastTickMsRef = useRef<number>(performance.now());

  // 20Hz UI/DSP synchronization loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      const dtSec = Math.min(0.25, Math.max(0.01, (now - lastTickMsRef.current) / 1000));
      lastTickMsRef.current = now;
      const snap = sharedAudioEngine.tick(dtSec);
      setTelemetry(snap);

      // Prune water ripples older than 2.8 seconds
      setRipples((prev) => prev.filter((r) => now - r.createdAtMs < 2800));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Launch 1-Tap Meltdown SOS (<400ms immediate execution + 4.0s logarithmic audio envelope)
  const handleLaunchSosMeltdown = useCallback(
    (autoLockKiosk = true) => {
      const targetShader = profile.preferredSosShader;
      setActiveShader(targetShader);
      setSessionMode(SessionMode.SOS_MELTDOWN);
      setKalimbaTouchCounter(0);
      setSessionStartIso(new Date().toISOString());
      setPendingLogForRating(null);
      sharedAudioEngine.startSession(SessionMode.SOS_MELTDOWN, profile);
      if (autoLockKiosk) {
        setIsKioskLocked(true);
      }
      setActiveTab('dashboard');
    },
    [profile]
  );

  // Launch Task Focus & Classroom Readiness Mode
  const handleLaunchFocusMode = useCallback(() => {
    setActiveShader(profile.preferredFocusShader);
    setSessionMode(SessionMode.FOCUS_TIMER);
    setKalimbaTouchCounter(0);
    setSessionStartIso(new Date().toISOString());
    setPendingLogForRating(null);
    sharedAudioEngine.startSession(SessionMode.FOCUS_TIMER, profile);
  }, [profile]);

  // Launch Daily Sensory Comfort & Interactive Kalimba Mode
  const handleLaunchCalmMode = useCallback(() => {
    setActiveShader(profile.preferredCalmShader);
    setSessionMode(SessionMode.CALM_STIM);
    setKalimbaTouchCounter(0);
    setSessionStartIso(new Date().toISOString());
    setPendingLogForRating(null);
    sharedAudioEngine.startSession(SessionMode.CALM_STIM, profile);
  }, [profile]);

  // Graceful 4.0-second logarithmic fade-out & session log capture
  const handleStopSession = useCallback(() => {
    if (sessionMode !== SessionMode.IDLE) {
      const newLog: MeltdownSessionLog = {
        id: `session-${Date.now()}`,
        startedAtIso: sessionStartIso || new Date().toISOString(),
        endedAtIso: new Date().toISOString(),
        durationSeconds: Math.max(1, Math.round(telemetry.elapsedSessionSeconds)),
        mode: sessionMode,
        shaderUsed: activeShader,
        isoPhaseReached: telemetry.isoPhase,
        completedFullIsoCycle: telemetry.elapsedSessionSeconds >= 480,
        initialBpm: sessionMode === SessionMode.SOS_MELTDOWN ? 104 : telemetry.currentBpm,
        finalBpm: telemetry.currentBpm,
        initialCutoffHz: profile.hyperacusisSos650HzLock ? 650 : 2000,
        finalCutoffHz: telemetry.currentLpfCutoffHz,
        kalimbaTouchCount: kalimbaTouchCounter,
        efficacyRating: 'UNRATED',
        caregiverNotes: 'Logged offline via NeuroSOS 3-Stage Pacing Engine.',
      };

      const updatedLogs = OfflineClinicalStore.appendLog(newLog);
      setSessionLogs(updatedLogs);
      setPendingLogForRating(newLog);
    }
    setIsKioskLocked(false);
    setSessionMode(SessionMode.IDLE);
    sharedAudioEngine.stopSessionGracefully();
  }, [
    activeShader,
    kalimbaTouchCounter,
    profile.hyperacusisSos650HzLock,
    sessionMode,
    sessionStartIso,
    telemetry.currentBpm,
    telemetry.currentLpfCutoffHz,
    telemetry.elapsedSessionSeconds,
    telemetry.isoPhase,
  ]);

  // Immediate click-free stop for ALL playing audio (noise bed, harmonic pad, pacemaker, and kalimba voices)
  const handleStopAllAudioImmediately = useCallback(() => {
    if (sessionMode !== SessionMode.IDLE) {
      const newLog: MeltdownSessionLog = {
        id: `session-${Date.now()}`,
        startedAtIso: sessionStartIso || new Date().toISOString(),
        endedAtIso: new Date().toISOString(),
        durationSeconds: Math.max(1, Math.round(telemetry.elapsedSessionSeconds)),
        mode: sessionMode,
        shaderUsed: activeShader,
        isoPhaseReached: telemetry.isoPhase,
        completedFullIsoCycle: telemetry.elapsedSessionSeconds >= 480,
        initialBpm: sessionMode === SessionMode.SOS_MELTDOWN ? 104 : telemetry.currentBpm,
        finalBpm: telemetry.currentBpm,
        initialCutoffHz: profile.hyperacusisSos650HzLock ? 650 : 2000,
        finalCutoffHz: telemetry.currentLpfCutoffHz,
        kalimbaTouchCount: kalimbaTouchCounter,
        efficacyRating: 'UNRATED',
        caregiverNotes: 'Stopped immediately by caregiver via Stop Audio control.',
      };

      const updatedLogs = OfflineClinicalStore.appendLog(newLog);
      setSessionLogs(updatedLogs);
      setPendingLogForRating(newLog);
    }
    setIsKioskLocked(false);
    setSessionMode(SessionMode.IDLE);
    setRipples([]);
    sharedAudioEngine.stopAllAudioImmediately();
  }, [
    activeShader,
    kalimbaTouchCounter,
    profile.hyperacusisSos650HzLock,
    sessionMode,
    sessionStartIso,
    telemetry.currentBpm,
    telemetry.currentLpfCutoffHz,
    telemetry.elapsedSessionSeconds,
    telemetry.isoPhase,
  ]);

  // Child touch on sensory canvas -> water ripple + velocity-capped C-Major Pentatonic Kalimba note
  const handleChildCanvasTouch = useCallback((xNorm: number, yNorm: number) => {
    const noteRes = sharedAudioEngine.triggerKalimbaNote(xNorm, yNorm);
    const ripple: TouchRipplePoint = {
      id: `ripple-${performance.now()}-${Math.random()}`,
      xNormalized: xNorm,
      yNormalized: yNorm,
      createdAtMs: performance.now(),
      noteName: noteRes.noteName,
      frequencyHz: noteRes.frequencyHz,
      colorHex: noteRes.colorHex,
    };
    setRipples((prev) => [...prev.slice(-10), ripple]);
    setKalimbaTouchCounter((c) => c + 1);
  }, []);

  // Caregiver 1-tap session helpfulness rating handler
  const handleRateSession = (logId: string, rating: EfficacyRating) => {
    const updated = OfflineClinicalStore.updateLogEfficacy(logId, rating);
    setSessionLogs(updated);
    if (pendingLogForRating?.id === logId) {
      setPendingLogForRating((prev) => (prev ? { ...prev, efficacyRating: rating } : null));
    }
  };

  // Profile update helper
  const updateProfileField = <K extends keyof SensoryProfile>(
    key: K,
    value: SensoryProfile[K]
  ) => {
    const next: SensoryProfile = { ...profile, [key]: value };
    const saved = OfflineClinicalStore.saveProfile(next);
    setProfile(saved);
    sharedAudioEngine.applyProfile(saved);
  };

  const toggleBlacklistedTimbre = (item: TimbreBlacklistItem) => {
    const exists = profile.blacklistedTimbres.includes(item);
    const nextList = exists
      ? profile.blacklistedTimbres.filter((i) => i !== item)
      : [...profile.blacklistedTimbres, item];
    updateProfileField('blacklistedTimbres', nextList);
  };

  // Export CSV for Caregivers & Educators
  const handleDownloadCsv = () => {
    const csvContent = OfflineClinicalStore.exportLogsToCsv(sessionLogs, profile);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurosos_session_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export SQLite DDL + Inserts
  const handleDownloadSqliteSchema = () => {
    const blob = new Blob([SQLITE_DDL_SCHEMA], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neurosos_offline_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute combined Sub-OS Dimmer Opacity (Phase 3 automatic 40% dimmer + profile brightness cap)
  const effectiveSubOsDimmer = useMemo(() => {
    if (manualDimmerOverride !== null) return manualDimmerOverride;
    const brightnessCapDim = (100 - profile.maxBrightnessPercent) / 100;
    return Math.max(brightnessCapDim, telemetry.subOsDimmerOpacity);
  }, [manualDimmerOverride, profile.maxBrightnessPercent, telemetry.subOsDimmerOpacity]);

  const filteredLogs = useMemo(() => {
    if (logModeFilter === 'ALL') return sessionLogs;
    return sessionLogs.filter((l) => l.mode === logModeFilter);
  }, [logModeFilter, sessionLogs]);

  // If Child Touch-Lock Kiosk is engaged, render full-viewport locked sensory canvas
  if (isKioskLocked) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden">
        <SubOsDimmerOverlay dimmerOpacity={effectiveSubOsDimmer} />
        <ChildTouchLockWrapper
          isLocked={true}
          onUnlockSuccess={() => setIsKioskLocked(false)}
          onEngageLock={() => setIsKioskLocked(true)}
          onChildCanvasTouch={handleChildCanvasTouch}
          ripples={ripples}
        >
          <SensoryShaderCanvas
            shaderId={activeShader}
            speedMultiplier={telemetry.shaderSpeedMultiplier}
            ripples={ripples}
          />

          {/* Subtle Non-Interactive Telemetry Watermark in Bottom Corner for Caregiver Observation */}
          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
            {sessionMode === SessionMode.FOCUS_TIMER && (
              <VisualTransitionTimer
                totalSeconds={profile.defaultFocusMinutes * 60}
                elapsedSeconds={telemetry.elapsedSessionSeconds}
                label="Classroom Focus Arc"
              />
            )}

            <div className="px-5 py-2.5 rounded-2xl bg-slate-950/65 backdrop-blur-md border border-white/10 text-xs text-slate-300 font-mono tabular-nums flex items-center gap-3">
              <span>{sessionMode.replace('_', ' ')}</span>
              <span aria-hidden="true">·</span>
              <span>{formatPhaseLabel(telemetry.isoPhase)}</span>
              <span aria-hidden="true">·</span>
              <span>{telemetry.currentBpm.toFixed(0)} BPM</span>
              <span aria-hidden="true">·</span>
              <span>LPF {telemetry.currentLpfCutoffHz} Hz</span>
              <span aria-hidden="true">·</span>
              <span>{telemetry.currentMasterDbFs.toFixed(1)} dBFS</span>
            </div>
          </div>
        </ChildTouchLockWrapper>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b13] text-slate-100 flex flex-col selection:bg-teal-500/30">
      {/* Hardware-Safe Sub-OS Screen Dimmer Overlay */}
      <SubOsDimmerOverlay dimmerOpacity={effectiveSubOsDimmer} />
      <OfflineStatusBanner />

      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-4 bg-[#060b13]/90 backdrop-blur-md border-b border-slate-800/80">
        {/* Zone 1: Single text element brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          NeuroSOS
        </a>

        {/* Zone 2: 3 single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'dashboard' ? 'text-white underline underline-offset-8 decoration-teal-400' : ''
            }`}
          >
            Sensory Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'profile' || activeTab === 'audit'
                ? 'text-white underline underline-offset-8 decoration-teal-400'
                : ''
            }`}
          >
            Sensory Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'logs' ? 'text-white underline underline-offset-8 decoration-teal-400' : ''
            }`}
          >
            Session Logs
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action CTA (Switches to Stop All Audio whenever audio is active) */}
        <div className="flex items-center shrink-0">
          {telemetry.isPlaying || telemetry.activeKalimbaVoices > 0 || sessionMode !== SessionMode.IDLE ? (
            <button
              type="button"
              onClick={handleStopAllAudioImmediately}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop All Audio</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleLaunchSosMeltdown(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              1-Tap Meltdown SOS
            </button>
          )}
        </div>
      </header>

      {/* Mobile Segmented Navigation Bar */}
      <div className="md:hidden flex items-center gap-1 px-4 py-2 bg-slate-900/90 border-b border-slate-800 overflow-x-auto">
        {(
          [
            { id: 'dashboard', label: 'Studio' },
            { id: 'profile', label: 'Sensory Profile' },
            { id: 'logs', label: 'Session Logs' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id || (tab.id === 'profile' && activeTab === 'audit')
                ? 'bg-teal-500/20 text-teal-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Container (1440px Desktop Presence) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Post-Session 1-Tap Caregiver Rating Prompt */}
        {pendingLogForRating && (
          <div className="mb-6 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Session Complete · Offline Activity Log Saved
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                <span>Mode: {pendingLogForRating.mode}</span>
                <span className="mx-2">·</span>
                <span>Duration: {pendingLogForRating.durationSeconds}s</span>
                <span className="mx-2">·</span>
                <span>Kalimba Ripples: {pendingLogForRating.kalimbaTouchCount}</span>
                <span className="mx-2">·</span>
                <span>Rate helpfulness for caregiver/educator log:</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(['EFFECTIVE', 'NEUTRAL', 'ESCALATED'] as const).map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleRateSession(pendingLogForRating.id, rating)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    pendingLogForRating.efficacyRating === rating
                      ? 'bg-teal-400 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {rating === 'EFFECTIVE'
                    ? 'Helpful'
                    : rating === 'NEUTRAL'
                    ? 'Neutral'
                    : 'Needs Adjustment'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPendingLogForRating(null)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: ZERO-CLUTTER HOME DASHBOARD & LIVE SENSORY STUDIO */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Top 3 Core Sensory Comfort State Launchers */}
            <section aria-label="Core Sensory Comfort Modes">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Offline Acoustic & Visual Sensory Comfort Studio
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    <span>100% Airplane-Mode Autonomous</span>
                    <span className="mx-2">·</span>
                    <span>4.0s Logarithmic Crossfade</span>
                    <span className="mx-2">·</span>
                    <span>-3.0 dBFS Comfort Ceiling</span>
                    <span className="mx-2">·</span>
                    <span>Profile: {profile.childName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PWAInstallButton />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Primary Focal Anchor: Oversized 1-Tap Meltdown SOS Button (<400ms launch) */}
                <div className="lg:col-span-6 p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-900 border border-amber-400/40 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-medium text-amber-300">
                      01. Sensory Overload De-escalation · 3-Stage Tempo Pacemaker
                    </div>
                    <h2 className="text-2xl font-bold text-white mt-2">
                      1-Tap Meltdown SOS
                    </h2>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      Engages the 3-stage automated tempo pacing engine (104 BPM warm marimba pulse
                      → 72 BPM harmonic thinning → 58 BPM deep rest bass pulse + Brownian noise)
                      with an immediate 650 Hz high-frequency comfort filter.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleLaunchSosMeltdown(false)}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm flex items-center gap-2.5 transition-transform active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ShieldAlert className="w-5 h-5" />
                      <span>Launch 1-Tap Meltdown SOS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLaunchSosMeltdown(true)}
                      className="min-h-[48px] px-4 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 font-medium text-xs flex items-center gap-2 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Lock className="w-4 h-4 text-teal-300" />
                      <span>SOS + Child Touch-Lock Kiosk</span>
                    </button>

                    {(telemetry.isPlaying || telemetry.activeKalimbaVoices > 0) && (
                      <button
                        type="button"
                        onClick={handleStopAllAudioImmediately}
                        className="min-h-[48px] px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        <span>Stop Audio</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Mode 2: Task Focus & Classroom Readiness */}
                <div className="lg:col-span-3 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-medium text-teal-300">
                      02. Task Focus & Classroom
                    </div>
                    <h2 className="text-lg font-bold text-white mt-2">
                      Focus & Transition Arc
                    </h2>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Pairs steady 72 BPM pacing and Paul Kellet Pink/Brownian sound masking with the
                      non-numerical vanishing rainbow arc timer ({profile.defaultFocusMinutes} min).
                    </p>
                  </div>
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleLaunchFocusMode}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Timer className="w-4 h-4" />
                      <span>Start Focus & Timer Mode</span>
                    </button>
                  </div>
                </div>

                {/* Mode 3: Daily Sensory Comfort & Interactive Kalimba Canvas */}
                <div className="lg:col-span-3 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-medium text-indigo-300">
                      03. Interactive Calm Canvas
                    </div>
                    <h2 className="text-lg font-bold text-white mt-2">
                      Calm & Kalimba Ripples
                    </h2>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Pure #000000 OLED lanterns and 0.10 Hz guided breathing orb with
                      velocity-capped C-Major Pentatonic water ripples.
                    </p>
                  </div>
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleLaunchCalmMode}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Open Calm & Kalimba Canvas</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Live Interactive GPU Shader Canvas + Real-Time Procedural Audio DSP Console */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 7 Columns: Live GPU Fragment Shader Viewport & Touch-Lock Surface */}
              <div className="lg:col-span-7 flex flex-col rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden min-h-[480px]">
                {/* Viewport Toolbar */}
                <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                    {(
                      [
                        { id: ShaderId.BIOLUMINESCENT_TUNNEL, label: 'A · Tunnel' },
                        { id: ShaderId.CLASSROOM_BUBBLES, label: 'B · Bubbles' },
                        { id: ShaderId.OLED_LANTERNS, label: 'C · OLED Lanterns' },
                        { id: ShaderId.BREATHING_ORB, label: 'D · Breathing Orb' },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveShader(s.id)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          activeShader === s.id
                            ? 'bg-teal-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsKioskLocked(true)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-teal-300 flex items-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Engage Child Touch-Lock Kiosk</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Shader + Kalimba Ripple Surface */}
                <div className="relative flex-1 min-h-[380px]">
                  <ChildTouchLockWrapper
                    isLocked={false}
                    onUnlockSuccess={() => setIsKioskLocked(false)}
                    onEngageLock={() => setIsKioskLocked(true)}
                    onChildCanvasTouch={handleChildCanvasTouch}
                    ripples={ripples}
                  >
                    <SensoryShaderCanvas
                      shaderId={activeShader}
                      speedMultiplier={telemetry.shaderSpeedMultiplier}
                      ripples={ripples}
                    />

                    {/* Overlay HUD inside canvas */}
                    <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-start justify-between gap-4">
                      <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 text-xs">
                        <div className="font-semibold text-white">
                          {SHADER_METADATA[activeShader].title}
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          <span>{SHADER_METADATA[activeShader].oscillationSpec}</span>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono tabular-nums text-teal-300">
                            Speed {telemetry.shaderSpeedMultiplier.toFixed(2)}x
                          </span>
                        </div>
                      </div>

                      {activeShader === ShaderId.BREATHING_ORB && (
                        <div className="px-3.5 py-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 text-xs text-right">
                          <div className="text-teal-300 font-medium">Breathing Pacer</div>
                          <div className="text-slate-300 font-mono tabular-nums">
                            4.0s Inhale · 6.0s Exhale
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vanishing Rainbow Arc when in Focus Mode */}
                    {sessionMode === SessionMode.FOCUS_TIMER && (
                      <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-20">
                        <VisualTransitionTimer
                          totalSeconds={profile.defaultFocusMinutes * 60}
                          elapsedSeconds={telemetry.elapsedSessionSeconds}
                        />
                      </div>
                    )}

                    {/* Bottom Touch Prompt */}
                    <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-slate-300/90 bg-slate-950/60 backdrop-blur-sm px-3.5 py-2 rounded-xl border border-white/10">
                      <span>
                        Tap or drag anywhere on canvas for water ripples & C-Major Pentatonic Kalimba
                      </span>
                      <span className="font-mono tabular-nums text-teal-300">
                        Ripples: {kalimbaTouchCounter} · Voices: {telemetry.activeKalimbaVoices}/4
                      </span>
                    </div>
                  </ChildTouchLockWrapper>
                </div>

                {/* Direct C-Major Pentatonic Kalimba Tine Audition Bar */}
                <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
                  <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                    Kalimba Tines (C-Maj Pentatonic):
                  </span>
                  <div className="flex items-center gap-1.5">
                    {PENTATONIC_SCALE_NOTES.map((note, idx) => (
                      <button
                        key={note.name}
                        type="button"
                        onClick={() =>
                          handleChildCanvasTouch(
                            (idx + 0.5) / PENTATONIC_SCALE_NOTES.length,
                            0.5
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-mono tabular-nums text-slate-200 transition-transform active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {note.name} · {Math.round(note.freq)}Hz
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: Agent 2 Procedural Audio DSP & Pacing Controller */}
              <div className="lg:col-span-5 flex flex-col justify-between p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-white">
                        Procedural Audio DSP & Pacing Engine
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                        <span>State: {sessionMode}</span>
                        <span className="mx-1.5">·</span>
                        <span>Ceiling: {BRICKWALL_CEILING_DBFS.toFixed(1)} dBFS</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => handleChildCanvasTouch(0.35, 0.25)}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-200 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Test Chime
                      </button>

                      {telemetry.isPlaying ? (
                        <button
                          type="button"
                          onClick={handleStopSession}
                          className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <span>4.0s Fade</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLaunchSosMeltdown(false)}
                          className="px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Start Audio DSP</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleStopAllAudioImmediately}
                        className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Audio</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Real-Time DSP Waveform Oscilloscope */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                      <Activity className="w-4 h-4 text-teal-400" />
                      <span className="font-mono tabular-nums">
                        {telemetry.isPlaying || telemetry.activeKalimbaVoices > 0
                          ? 'LIVE AUDIO STREAM'
                          : 'STANDBY (TAP TO PLAY)'}
                      </span>
                    </div>
                    <svg
                      viewBox="0 0 128 32"
                      className="w-44 h-8 overflow-visible shrink-0"
                      aria-label="Live DSP audio waveform oscilloscope"
                    >
                      <polyline
                        fill="none"
                        stroke="#2DD4BF"
                        strokeWidth="1.75"
                        points={Array.from(telemetry.waveformSamples)
                          .slice(0, 64)
                          .map((v, idx) => `${idx * 2},${16 - Math.max(-14, Math.min(14, v * 42))}`)
                          .join(' ')}
                      />
                    </svg>
                  </div>

                  {/* 4.0-Second Logarithmic Envelope & Master Limiter Telemetry */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">Master Gain</div>
                      <div className="text-sm font-mono tabular-nums font-semibold text-white mt-1">
                        {telemetry.currentMasterDbFs <= -79
                          ? '-∞ dBFS'
                          : `${telemetry.currentMasterDbFs.toFixed(1)} dBFS`}
                      </div>
                      <div className="text-[10px] text-teal-400 font-mono tabular-nums mt-0.5">
                        {telemetry.isCrossfading
                          ? `4s Ramp (${telemetry.crossfadeRemainingSec.toFixed(1)}s)`
                          : 'Locked <= -3.0 dB'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">Pacemaker BPM</div>
                      <div className="text-sm font-mono tabular-nums font-semibold text-white mt-1">
                        {telemetry.currentBpm.toFixed(1)} BPM
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                        Target: 58.0 BPM
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">Biquad Cutoff</div>
                      <div className="text-sm font-mono tabular-nums font-semibold text-teal-300 mt-1">
                        {telemetry.currentLpfCutoffHz} Hz
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                        {telemetry.activeFilterMode === BiquadFilterMode.SSP_PROSODY_BANDPASS
                          ? 'Vocal Band 500-2.5k'
                          : profile.hyperacusisSos650HzLock
                          ? '650Hz Comfort LPF'
                          : 'Dynamic LPF'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">Sub-OS Dimmer</div>
                      <div className="text-sm font-mono tabular-nums font-semibold text-white mt-1">
                        {Math.round(effectiveSubOsDimmer * 100)}%
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                        Phase 3 Auto: 40%
                      </div>
                    </div>
                  </div>

                  {/* 3-Stage Tempo Pacing State Machine Interactive Stage Selector / Scrubber */}
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        3-Stage Tempo Pacing Trajectory
                      </span>
                      <span className="text-xs font-mono tabular-nums text-teal-300">
                        t = {Math.floor(telemetry.elapsedSessionSeconds / 60)}m{' '}
                        {Math.floor(telemetry.elapsedSessionSeconds % 60)}s
                      </span>
                    </div>

                    {/* Caregiver Stage Audition Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (sessionMode !== SessionMode.SOS_MELTDOWN) {
                            handleLaunchSosMeltdown(false);
                          }
                          sharedAudioEngine.setElapsedSessionSeconds(30);
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          telemetry.isoPhase === IsoPhase.PHASE_1_MATCH_AROUSAL &&
                          sessionMode === SessionMode.SOS_MELTDOWN
                            ? 'bg-amber-500/20 border-amber-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-semibold">Phase 1 (Min 0–3)</div>
                        <div className="text-[10px] font-mono tabular-nums mt-0.5">
                          104 BPM · 1.0x
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (sessionMode !== SessionMode.SOS_MELTDOWN) {
                            handleLaunchSosMeltdown(false);
                          }
                          sharedAudioEngine.setElapsedSessionSeconds(300); // Min 5:00
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          telemetry.isoPhase === IsoPhase.PHASE_2_HARMONIC_THINNING &&
                          sessionMode === SessionMode.SOS_MELTDOWN
                            ? 'bg-teal-500/20 border-teal-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-semibold">Phase 2 (Min 3–8)</div>
                        <div className="text-[10px] font-mono tabular-nums mt-0.5">
                          104→72 BPM · 0.5x
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (sessionMode !== SessionMode.SOS_MELTDOWN) {
                            handleLaunchSosMeltdown(false);
                          }
                          sharedAudioEngine.setElapsedSessionSeconds(520); // Min 8:40
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          telemetry.isoPhase === IsoPhase.PHASE_3_VAGAL_BASELINE &&
                          sessionMode === SessionMode.SOS_MELTDOWN
                            ? 'bg-indigo-500/25 border-indigo-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-semibold">Phase 3 (Min 8–12+)</div>
                        <div className="text-[10px] font-mono tabular-nums mt-0.5">
                          58 BPM · 500Hz · 40% Dim
                        </div>
                      </button>
                    </div>

                    {/* Timeline Scrubber for Testing/Auditioning the 12-Minute Pacing Curve */}
                    <div>
                      <label
                        htmlFor="iso-scrubber"
                        className="flex items-center justify-between text-[11px] text-slate-400 mb-1"
                      >
                        <span>Scrub Pacing Session Timeline (0m – 12m)</span>
                        <span className="font-mono tabular-nums">
                          {Math.round(telemetry.elapsedSessionSeconds)}s / 720s
                        </span>
                      </label>
                      <input
                        id="iso-scrubber"
                        type="range"
                        min={0}
                        max={720}
                        step={5}
                        value={Math.min(720, Math.round(telemetry.elapsedSessionSeconds))}
                        onChange={(e) =>
                          sharedAudioEngine.setElapsedSessionSeconds(Number(e.target.value))
                        }
                        className="w-full accent-teal-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Procedural Noise Bed & Biquad Filter Controls */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-300">
                        Procedural Noise Generator:
                      </span>
                      <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                        {(
                          [
                            { id: NoiseColor.BROWNIAN, label: 'Brownian (-6dB/oct)' },
                            { id: NoiseColor.PINK, label: 'Pink (-3dB/oct)' },
                            { id: NoiseColor.SILENT, label: 'Mute Bed' },
                          ] as const
                        ).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              sharedAudioEngine.setNoiseColor(n.id);
                              updateProfileField('defaultNoiseColor', n.id);
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              telemetry.activeNoiseColor === n.id
                                ? 'bg-teal-500/25 text-teal-200 border border-teal-500/40'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-300">
                        Acoustic Comfort Biquad Filter:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !profile.hyperacusisSos650HzLock;
                            updateProfileField('hyperacusisSos650HzLock', nextVal);
                            sharedAudioEngine.setHyperacusis650HzLock(nextVal);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            profile.hyperacusisSos650HzLock
                              ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          650 Hz SOS Filter: {profile.hyperacusisSos650HzLock ? 'ON' : 'OFF'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const nextMode =
                              telemetry.activeFilterMode === BiquadFilterMode.SSP_PROSODY_BANDPASS
                                ? BiquadFilterMode.LOW_PASS
                                : BiquadFilterMode.SSP_PROSODY_BANDPASS;
                            sharedAudioEngine.setFilterMode(nextMode);
                            updateProfileField(
                              'sspProsodyModeEnabled',
                              nextMode === BiquadFilterMode.SSP_PROSODY_BANDPASS
                            );
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            telemetry.activeFilterMode === BiquadFilterMode.SSP_PROSODY_BANDPASS
                              ? 'bg-teal-400/20 border-teal-400/50 text-teal-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          Vocal Band 500–2500Hz
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Stem Mix & Sub-OS Dimmer Slider */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                    <div>
                      <span>Marimba: </span>
                      <span className="text-slate-200">
                        {Math.round(telemetry.percussiveStemGain * 100)}%
                      </span>
                    </div>
                    <div>
                      <span>Pad: </span>
                      <span className="text-slate-200">
                        {Math.round(telemetry.pentatonicPadStemGain * 100)}%
                      </span>
                    </div>
                    <div>
                      <span>Deep Pulse: </span>
                      <span className="text-slate-200">
                        {Math.round(telemetry.vagalHeartbeatStemGain * 100)}%
                      </span>
                    </div>
                    <div>
                      <span>Brownian: </span>
                      <span className="text-slate-200">
                        {Math.round(telemetry.brownianBedGain * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="sub-os-dimmer" className="text-xs text-slate-400 whitespace-nowrap">
                      Sub-OS Dimmer Override:
                    </label>
                    <input
                      id="sub-os-dimmer"
                      type="range"
                      min={0}
                      max={0.75}
                      step={0.05}
                      value={effectiveSubOsDimmer}
                      onChange={(e) => setManualDimmerOverride(Number(e.target.value))}
                      className="flex-1 accent-teal-400 cursor-pointer"
                    />
                    {manualDimmerOverride !== null && (
                      <button
                        type="button"
                        onClick={() => setManualDimmerOverride(null)}
                        className="text-[11px] text-teal-300 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: SENSORY PROFILE & FREQUENCY/TIMBRE PREFERENCES (AGENT 4) */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h1 className="text-2xl font-bold text-white">
                Sensory Comfort Profile & Acoustic Guardrails
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Persisted 100% offline on this device. Enforces hardware-independent ceiling limits
                and frequency/timbre preferences across all procedural audio synthesis graphs.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 6 Columns: Core Limits & Preset Preferences */}
              <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-teal-400" />
                  <span>Acoustic & Luminance Comfort Caps</span>
                </h2>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Profile Nickname
                  </label>
                  <input
                    type="text"
                    value={profile.childName}
                    onChange={(e) => updateProfileField('childName', e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-300">
                      Maximum Master Volume Ceiling (Brickwall Clamped ≤ -3.0 dBFS)
                    </span>
                    <span className="font-mono tabular-nums text-teal-300 font-semibold">
                      {profile.maxVolumeDbFs.toFixed(1)} dBFS
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-24.0}
                    max={-3.0}
                    step={0.5}
                    value={profile.maxVolumeDbFs}
                    onChange={(e) =>
                      updateProfileField('maxVolumeDbFs', Math.min(-3.0, Number(e.target.value)))
                    }
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500 mt-1">
                    <span>-24.0 dBFS (Quiet)</span>
                    <span>-12.0 dBFS</span>
                    <span>-3.0 dBFS (Hard Comfort Limit)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-300">
                      Maximum Screen Brightness Cap (Sub-OS Luminance Limiter)
                    </span>
                    <span className="font-mono tabular-nums text-teal-300 font-semibold">
                      {profile.maxBrightnessPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    step={5}
                    value={profile.maxBrightnessPercent}
                    onChange={(e) =>
                      updateProfileField('maxBrightnessPercent', Number(e.target.value))
                    }
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">SOS Default Shader</label>
                    <select
                      value={profile.preferredSosShader}
                      onChange={(e) =>
                        updateProfileField('preferredSosShader', e.target.value as ShaderId)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    >
                      <option value={ShaderId.BIOLUMINESCENT_TUNNEL}>A · Tunnel</option>
                      <option value={ShaderId.CLASSROOM_BUBBLES}>B · Bubbles</option>
                      <option value={ShaderId.OLED_LANTERNS}>C · OLED Lanterns</option>
                      <option value={ShaderId.BREATHING_ORB}>D · Breathing Orb</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Focus Mode Shader</label>
                    <select
                      value={profile.preferredFocusShader}
                      onChange={(e) =>
                        updateProfileField('preferredFocusShader', e.target.value as ShaderId)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    >
                      <option value={ShaderId.BIOLUMINESCENT_TUNNEL}>A · Tunnel</option>
                      <option value={ShaderId.CLASSROOM_BUBBLES}>B · Bubbles</option>
                      <option value={ShaderId.OLED_LANTERNS}>C · OLED Lanterns</option>
                      <option value={ShaderId.BREATHING_ORB}>D · Breathing Orb</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Focus Arc Minutes
                    </label>
                    <select
                      value={profile.defaultFocusMinutes}
                      onChange={(e) =>
                        updateProfileField('defaultFocusMinutes', Number(e.target.value))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono tabular-nums"
                    >
                      {[5, 10, 15, 20, 30, 45].map((m) => (
                        <option key={m} value={m}>
                          {m} min
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right 6 Columns: Frequency & Timbre Filter List */}
              <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Sound Sensitivity Frequency & Timbre Blacklist</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Any muted acoustic frequency or timbre is attenuated at the DSP synthesis and
                    biquad filter stage before reaching the speaker output buffer.
                  </p>
                </div>

                <div className="space-y-3">
                  {(Object.keys(BLACKLIST_LABELS) as TimbreBlacklistItem[]).map((itemKey) => {
                    const isBlocked = profile.blacklistedTimbres.includes(itemKey);
                    const info = BLACKLIST_LABELS[itemKey];
                    return (
                      <div
                        key={itemKey}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-4"
                      >
                        <div>
                          <div className="text-xs font-semibold text-white">{info.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{info.description}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleBlacklistedTimbre(itemKey)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isBlocked
                              ? 'bg-amber-400/20 border border-amber-400/50 text-amber-200'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {isBlocked ? 'Filtered Out' : 'Allowed'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Documentation Link Section: Safety Audit & Publish */}
            <div className="pt-4 border-t border-slate-800/80">
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-teal-300">
                    App Documentation &amp; Technical Reference
                  </div>
                  <h2 className="text-sm font-bold text-white mt-0.5">
                    Safety Audit &amp; Publish Documentation
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    View automated acoustic/visual safety verification, Web App (PWA) &amp; Android
                    Google Play Store publishing guides, and native multi-agent source blueprints.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuditResults(ClinicalSafetyAuditor.runFullClinicalAudit());
                    setActiveTab('audit');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-teal-300 hover:text-teal-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Safety Audit &amp; Publish Docs →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: OFFLINE SESSION ACTIVITY LOGS & CAREGIVER/EDUCATOR EXPORT (AGENT 4) */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Offline Session Activity Logs & Caregiver Notes
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Exportable local CSV summaries for families, teachers, and support specialists
                  with zero cloud transmission.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-4 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Session CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSqliteSchema}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Export SQLite .sql
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                {(
                  [
                    { id: 'ALL', label: 'All Sessions' },
                    { id: SessionMode.SOS_MELTDOWN, label: 'Meltdown SOS' },
                    { id: SessionMode.FOCUS_TIMER, label: 'Focus Timer' },
                    { id: SessionMode.CALM_STIM, label: 'Calm & Kalimba' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLogModeFilter(f.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      logModeFilter === f.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400 font-mono tabular-nums">
                Showing {filteredLogs.length} offline records · 100% Local Storage
              </div>
            </div>

            {/* Session Log Table */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                    <th className="py-3.5 px-4">Timestamp & Mode</th>
                    <th className="py-3.5 px-4">Shader & Pacing Stage</th>
                    <th className="py-3.5 px-4">BPM & LPF Trajectory</th>
                    <th className="py-3.5 px-4">Kalimba Taps</th>
                    <th className="py-3.5 px-4">Session Notes</th>
                    <th className="py-3.5 px-4 text-right">1-Tap Caregiver Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-950/50">
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-semibold text-white">{log.mode.replace('_', ' ')}</div>
                        <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                          {log.startedAtIso.slice(0, 16).replace('T', ' ')} ·{' '}
                          {Math.floor(log.durationSeconds / 60)}m {log.durationSeconds % 60}s
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="text-slate-200">{log.shaderUsed}</div>
                        <div className="text-slate-400 mt-0.5">
                          {formatPhaseLabel(log.isoPhaseReached)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top font-mono tabular-nums whitespace-nowrap">
                        <div className="text-teal-300">
                          {log.initialBpm} BPM → {log.finalBpm} BPM
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          LPF: {log.initialCutoffHz}Hz → {log.finalCutoffHz}Hz
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {log.kalimbaTouchCount} ripples
                      </td>
                      <td className="py-3.5 px-4 align-top text-slate-300 max-w-xs">
                        {log.caregiverNotes}
                      </td>
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                          {(['EFFECTIVE', 'NEUTRAL', 'ESCALATED'] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleRateSession(log.id, r)}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                log.efficacyRating === r
                                  ? r === 'EFFECTIVE'
                                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40'
                                    : r === 'NEUTRAL'
                                    ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40'
                                    : 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                                  : 'text-slate-500 hover:text-slate-200'
                              }`}
                            >
                              {r === 'EFFECTIVE'
                                ? 'Helpful'
                                : r === 'NEUTRAL'
                                ? 'Neutral'
                                : 'Adjust'}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* APP DOCUMENTATION: SAFETY AUDIT & PUBLISH (ACCESSED FROM SENSORY PROFILE) */}
        {activeTab === 'audit' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-teal-300 font-medium mb-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="hover:underline cursor-pointer"
                  >
                    ← Back to Sensory Profile
                  </button>
                  <span className="text-slate-600">·</span>
                  <span>App Documentation</span>
                </div>
                <h1 className="text-2xl font-bold text-white">
                  App Documentation: Safety Audit &amp; Publish Guide
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Technical documentation covering DSP buffer continuity, 4.0s logarithmic envelope,
                  -3.0 dBFS limiter, Kiosk Touch-Lock verification, and Web/Google Play Store
                  publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuditResults(ClinicalSafetyAuditor.runFullClinicalAudit())}
                className="px-4 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Re-Run Live Safety Suite</span>
              </button>
            </div>

            {/* Automated Test Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {auditResults.map((res) => (
                <div
                  key={res.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono tabular-nums text-teal-300 font-semibold">
                        {res.id} · {res.clinicalRule}
                      </span>
                      <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>{res.passed ? 'VERIFIED PASS' : 'FAILED'}</span>
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1.5">{res.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{res.details}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 text-[11px] font-mono tabular-nums text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span>Measured: {res.measuredMetric}</span>
                    <span className="text-slate-500">Spec: {res.thresholdSpec}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Web App (PWA) & Google Play Store Publishing Kit */}
            <PlayStorePublishingPanel />

            {/* Multi-Agent Native Flutter / Dart / C++ FFI / SQLite Source Code Inspector */}
            <div className="space-y-4 pt-4">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-xl font-bold text-white">
                  Multi-Agent Native Mobile Blueprints (Flutter + Impeller GLSL + C++17 FFI + SQLite)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Complete reference implementations across Agents 1–5 for iOS & Android offline
                  deployment.
                </p>
              </div>

              <div className="space-y-5">
                {MULTI_AGENT_BLUEPRINTS.map((bp) => (
                  <div
                    key={bp.agentTag}
                    className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden"
                  >
                    <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-teal-300 font-semibold">
                          {bp.agentTag}
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          {bp.roleTitle} · <span className="font-mono text-xs text-slate-400">{bp.fileName}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(bp.code);
                          setCopiedFile(bp.fileName);
                          setTimeout(() => setCopiedFile(null), 2000);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedFile === bp.fileName ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Source</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed bg-[#050911]">
                      <code>{bp.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Non-Medical Wellness & IP Disclaimer Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-5 px-6 text-xs text-slate-400 max-w-7xl w-full mx-auto space-y-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-200">Wellness &amp; Non-Medical Disclaimer:</strong> NeuroSOS
          is a general sensory comfort, ambient sound masking, relaxation, and visual task-timer
          application. It is not a medical device and is not intended to diagnose, treat, cure,
          mitigate, or prevent any disease, medical condition, or neurodevelopmental condition. All
          audio synthesis and visual shaders are 100% original procedural algorithms with zero
          third-party proprietary protocols or trademarks.
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500">
          <div className="flex items-center gap-3">
            <span>NeuroSOS Sensory Comfort Suite · 100% Offline PWA &amp; Android Ready</span>
            <span>·</span>
            <a
              href="/privacy-policy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Privacy Policy &amp; Disclaimers</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span>WCAG 2.1 AAA (&lt;0.2 Hz)</span>
            <span>·</span>
            <span>-3.0 dBFS Ceiling</span>
            <span>·</span>
            <span>4.0s Log Envelope</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
