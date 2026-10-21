/**
 * [AGENT 1: LEAD ARCHITECT & STATE ORCHESTRATOR]
 * Core Type Contracts between UI, Procedural Audio DSP, GPU Shaders, and Offline Persistence
 */

export enum SessionMode {
  IDLE = 'IDLE',
  SOS_MELTDOWN = 'SOS_MELTDOWN',
  FOCUS_TIMER = 'FOCUS_TIMER',
  CALM_STIM = 'CALM_STIM',
}

export enum IsoPhase {
  PHASE_1_MATCH_AROUSAL = 'PHASE_1_MATCH_AROUSAL',         // Min 0–3: 104 BPM, LPF 2000Hz (or 650Hz SOS cap), 1.0x Shader
  PHASE_2_HARMONIC_THINNING = 'PHASE_2_HARMONIC_THINNING', // Min 3–8: 104->72 BPM, LPF 2000->900Hz, 0.5x Shader
  PHASE_3_VAGAL_BASELINE = 'PHASE_3_VAGAL_BASELINE',       // Min 8–12+: 58 BPM Sub-Bass + Brownian, LPF 500Hz, 0.25x Shader, 40% Dimmer
  STATIC_REGULATION = 'STATIC_REGULATION',                 // Non-SOS steady sensory regulation
}

export enum ShaderId {
  BIOLUMINESCENT_TUNNEL = 'BIOLUMINESCENT_TUNNEL', // Shader A: Constant slow Z-axis drift
  CLASSROOM_BUBBLES = 'CLASSROOM_BUBBLES',         // Shader B: Predictable upward buoyancy
  OLED_LANTERNS = 'OLED_LANTERNS',                 // Shader C: Pure #000000 high-contrast floating lanterns
  BREATHING_ORB = 'BREATHING_ORB',                 // Shader D: Co-regulation 4s inhale, 6s exhale (0.1 Hz)
}

export enum NoiseColor {
  BROWNIAN = 'BROWNIAN', // -6.02 dB/octave leaky integrator
  PINK = 'PINK',         // -3.01 dB/octave Paul Kellet 7-state filter
  SILENT = 'SILENT',
}

export enum BiquadFilterMode {
  LOW_PASS = 'LOW_PASS',
  SSP_PROSODY_BANDPASS = 'SSP_PROSODY_BANDPASS', // 500 Hz - 2500 Hz Safe & Sound Protocol human vocal band
  HIGH_CUT_BLACKLIST = 'HIGH_CUT_BLACKLIST',     // Steep notch/high-cut for hyperacusis triggers
}

export type TimbreBlacklistItem =
  | 'HIGH_CHIMES_1500HZ'
  | 'SHARP_TRANSIENTS'
  | 'BINAURAL_DETUNE'
  | 'SUB_BASS_RUMBLE';

export type EfficacyRating = 'EFFECTIVE' | 'NEUTRAL' | 'ESCALATED' | 'UNRATED';

export interface SensoryProfile {
  id: string;
  childName: string;
  preferredSosShader: ShaderId;
  preferredFocusShader: ShaderId;
  preferredCalmShader: ShaderId;
  maxVolumeDbFs: number; // Clamped <= -3.0 dBFS
  maxBrightnessPercent: number; // 20% to 100%
  defaultFocusMinutes: number; // 5 to 45 min
  hyperacusisSos650HzLock: boolean; // Default true: enforces 650 Hz LPF ceiling on SOS launch
  sspProsodyModeEnabled: boolean; // Band-pass 500-2500 Hz filter option
  defaultNoiseColor: NoiseColor;
  blacklistedTimbres: TimbreBlacklistItem[];
  kalimbaTouchSynthEnabled: boolean;
  updatedAtIso: string;
}

export interface MeltdownSessionLog {
  id: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  mode: SessionMode;
  shaderUsed: ShaderId;
  isoPhaseReached: IsoPhase;
  completedFullIsoCycle: boolean;
  initialBpm: number;
  finalBpm: number;
  initialCutoffHz: number;
  finalCutoffHz: number;
  kalimbaTouchCount: number;
  efficacyRating: EfficacyRating;
  caregiverNotes: string;
}

export interface AcousticTelemetrySnapshot {
  isPlaying: boolean;
  isCrossfading: boolean;
  crossfadeRemainingSec: number;
  currentEnvelopeLinear: number;
  currentMasterDbFs: number;
  brickwallCeilingDbFs: number;
  limiterGainReductionDb: number;
  currentBpm: number;
  currentLpfCutoffHz: number;
  activeFilterMode: BiquadFilterMode;
  activeNoiseColor: NoiseColor;
  percussiveStemGain: number;
  pentatonicPadStemGain: number;
  vagalHeartbeatStemGain: number;
  brownianBedGain: number;
  shaderSpeedMultiplier: number;
  subOsDimmerOpacity: number;
  activeKalimbaVoices: number;
  isoPhase: IsoPhase;
  elapsedSessionSeconds: number;
  waveformSamples: Float32Array;
}

export interface TouchRipplePoint {
  id: string;
  xNormalized: number; // 0..1
  yNormalized: number; // 0..1
  createdAtMs: number;
  noteName: string;
  frequencyHz: number;
  colorHex: string;
}
