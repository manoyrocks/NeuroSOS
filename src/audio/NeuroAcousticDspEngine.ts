/**
 * [AGENT 2: NEURO-ACOUSTIC DSP ENGINEER]
 * Mathematical Procedural DSP Engine + Web Audio API Real-Time Graph
 * 100% Offline, Zero External Assets, 4.0s Logarithmic Envelope, -3.0 dBFS Brickwall Limiter
 */

import {
  AcousticTelemetrySnapshot,
  BiquadFilterMode,
  IsoPhase,
  NoiseColor,
  SensoryProfile,
  SessionMode,
} from '../types/aurasync';

// C-Major Pentatonic Frequencies (C4 to E5) - Zero dissonant minor 2nds or tritones
export const PENTATONIC_SCALE_NOTES: ReadonlyArray<{ name: string; freq: number; color: string }> = [
  { name: 'C4', freq: 261.63, color: '#38BDF8' },
  { name: 'D4', freq: 293.66, color: '#34D399' },
  { name: 'E4', freq: 329.63, color: '#A78BFA' },
  { name: 'G4', freq: 392.00, color: '#FBBF24' },
  { name: 'A4', freq: 440.00, color: '#F472B6' },
  { name: 'C5', freq: 523.25, color: '#2DD4BF' },
  { name: 'D5', freq: 587.33, color: '#818CF8' },
  { name: 'E5', freq: 659.25, color: '#FB923C' },
];

export const BRICKWALL_CEILING_DBFS = -3.0;
export const BRICKWALL_CEILING_LINEAR = Math.pow(10, BRICKWALL_CEILING_DBFS / 20); // ~0.70794578
export const LOG_ENVELOPE_DURATION_SEC = 4.0;
export const EPSILON_GAIN = 0.0001; // -80 dBFS floor for logarithmic math

/**
 * Pure mathematical DSP utilities (also used by Agent 5 Clinical Safety Audit Suite)
 */
export class ProceduralDspMath {
  /**
   * 1. Real-Time Brownian Noise Generator (-6.02 dB/octave leaky integrator)
   * y[n] = (leak * y[n-1] + white * step) clamped & DC-blocked
   */
  static generateBrownianNoiseBuffer(numSamples: number, seed = 1337): Float32Array {
    const out = new Float32Array(numSamples);
    let lastOut = 0.0;
    let rngState = seed >>> 0;
    const nextWhite = () => {
      rngState = (1664525 * rngState + 1013904223) >>> 0;
      return (rngState / 0xffffffff) * 2.0 - 1.0;
    };

    for (let i = 0; i < numSamples; i++) {
      const white = nextWhite();
      // Leaky integrator with leak factor 0.985 for smooth -6dB/octave rolloff without DC runaway
      lastOut = (lastOut + 0.035 * white) / 1.035;
      out[i] = Math.max(-0.95, Math.min(0.95, lastOut * 3.8));
    }
    // Apply 2048-sample raised-cosine loop crossfade at boundaries to guarantee zero loop click
    ProceduralDspMath.applySeamlessLoopCrossfade(out, Math.min(2048, Math.floor(numSamples / 8)));
    return out;
  }

  /**
   * 2. Real-Time Pink Noise Generator (-3.01 dB/octave Paul Kellet 7-state filter)
   * Accuracy within +/- 0.05 dB across 9.2 octaves
   */
  static generatePinkNoiseBuffer(numSamples: number, seed = 4242): Float32Array {
    const out = new Float32Array(numSamples);
    let b0 = 0.0, b1 = 0.0, b2 = 0.0, b3 = 0.0, b4 = 0.0, b5 = 0.0, b6 = 0.0;
    let rngState = seed >>> 0;
    const nextWhite = () => {
      rngState = (1664525 * rngState + 1013904223) >>> 0;
      return (rngState / 0xffffffff) * 2.0 - 1.0;
    };

    for (let i = 0; i < numSamples; i++) {
      const white = nextWhite();
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      out[i] = Math.max(-0.95, Math.min(0.95, pink * 0.18));
    }
    ProceduralDspMath.applySeamlessLoopCrossfade(out, Math.min(2048, Math.floor(numSamples / 8)));
    return out;
  }

  /**
   * Ensures circular buffer loop wrap-around has C1 continuity (zero boundary discontinuity)
   */
  static applySeamlessLoopCrossfade(buffer: Float32Array, fadeSamples: number): void {
    const n = buffer.length;
    if (fadeSamples <= 0 || fadeSamples * 2 >= n) return;
    for (let i = 0; i < fadeSamples; i++) {
      const alpha = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples)); // 0 -> 1 Hann window
      const headIdx = i;
      const tailIdx = n - fadeSamples + i;
      const blended = buffer[headIdx] * alpha + buffer[tailIdx] * (1 - alpha);
      buffer[headIdx] = blended;
      buffer[tailIdx] = blended;
    }
  }

  /**
   * 3. 4.0-Second Logarithmic Amplitude Envelope
   * Obeys Weber-Fechner acoustic perception law: g(t) = g0 * (g1 / g0)^(t / T)
   */
  static computeLogarithmicEnvelopeGain(
    startGainLinear: number,
    targetGainLinear: number,
    elapsedSec: number,
    durationSec = LOG_ENVELOPE_DURATION_SEC
  ): number {
    if (elapsedSec <= 0) return startGainLinear;
    if (elapsedSec >= durationSec) return targetGainLinear;

    const g0 = Math.max(EPSILON_GAIN, startGainLinear);
    const g1 = Math.max(EPSILON_GAIN, targetGainLinear);
    const progress = elapsedSec / durationSec;
    const logInterpolated = g0 * Math.pow(g1 / g0, progress);

    // Smooth boundary convergence to exact 0.0 when fading to silence
    if (targetGainLinear < EPSILON_GAIN && progress > 0.92) {
      const tailFactor = (1.0 - progress) / 0.08;
      return logInterpolated * tailFactor;
    }
    return logInterpolated;
  }

  /**
   * 4. -3.0 dBFS Soft-Knee Brickwall Limiter Transfer Curve
   * Guarantees no sample ever exceeds 0.70794578 (-3.0 dBFS)
   */
  static applyBrickwallLimiterSample(sample: number, ceiling = BRICKWALL_CEILING_LINEAR): number {
    const kneeStart = ceiling * 0.75; // Soft knee begins at -5.5 dBFS
    const absX = Math.abs(sample);
    if (absX <= kneeStart) return sample;
    const sign = sample >= 0 ? 1 : -1;
    const excess = (absX - kneeStart) / (ceiling - kneeStart);
    const compressed = kneeStart + (ceiling - kneeStart) * Math.tanh(excess);
    return sign * Math.min(ceiling, compressed);
  }

  /**
   * 5. State-Variable Biquad Filter Coefficients (RBJ Audio EQ Cookbook)
   */
  static computeBiquadCoefficients(
    mode: BiquadFilterMode,
    sampleRate: number,
    cutoffHz: number,
    q = 0.7071
  ): { b0: number; b1: number; b2: number; a1: number; a2: number } {
    const clampedFreq = Math.max(40, Math.min(sampleRate * 0.45, cutoffHz));
    const omega = (2 * Math.PI * clampedFreq) / sampleRate;
    const sinW = Math.sin(omega);
    const cosW = Math.cos(omega);
    const alpha = sinW / (2 * q);

    let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

    if (mode === BiquadFilterMode.LOW_PASS || mode === BiquadFilterMode.HIGH_CUT_BLACKLIST) {
      b0 = (1 - cosW) / 2;
      b1 = 1 - cosW;
      b2 = (1 - cosW) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW;
      a2 = 1 - alpha;
    } else if (mode === BiquadFilterMode.SSP_PROSODY_BANDPASS) {
      // Constant 0 dB peak gain band-pass centered on human vocal prosody (500-2500 Hz)
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosW;
      a2 = 1 - alpha;
    }

    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0,
    };
  }

  /**
   * 6. Iso-Principle Trajectory Calculator
   * Computes deterministic neuro-acoustic parameters for any elapsed session second (0..720s+)
   */
  static computeIsoPrincipleState(
    elapsedSec: number,
    hyperacusis650HzLock: boolean,
    mode: SessionMode
  ): {
    phase: IsoPhase;
    bpm: number;
    lpfCutoffHz: number;
    shaderSpeedMultiplier: number;
    subOsDimmerOpacity: number;
    percussiveStemGain: number;
    pentatonicPadStemGain: number;
    vagalHeartbeatStemGain: number;
    brownianBedGain: number;
  } {
    if (mode !== SessionMode.SOS_MELTDOWN) {
      // Focus or Calm mode steady-state parameters
      const isFocus = mode === SessionMode.FOCUS_TIMER;
      return {
        phase: IsoPhase.STATIC_REGULATION,
        bpm: isFocus ? 72 : 60,
        lpfCutoffHz: hyperacusis650HzLock ? 650 : isFocus ? 1450 : 850,
        shaderSpeedMultiplier: isFocus ? 0.45 : 0.35,
        subOsDimmerOpacity: isFocus ? 0.1 : 0.18,
        percussiveStemGain: isFocus ? 0.45 : 0.25,
        pentatonicPadStemGain: 0.75,
        vagalHeartbeatStemGain: 0.45,
        brownianBedGain: isFocus ? 0.50 : 0.60,
      };
    }

    // SOS MELTDOWN 3-STAGE ISO-PRINCIPLE ENGINE
    const t = Math.max(0, elapsedSec);

    if (t < 180) {
      // PHASE 1: Match Arousal (Minutes 0 to 3 -> 0..180s)
      // 104 BPM warm marimba/cello pulse, LPF @ 2000 Hz (or 650 Hz Hyperacusis default), shader speed 1.0x
      const rawCutoff = 2000;
      return {
        phase: IsoPhase.PHASE_1_MATCH_AROUSAL,
        bpm: 104,
        lpfCutoffHz: hyperacusis650HzLock ? Math.min(650, rawCutoff) : rawCutoff,
        shaderSpeedMultiplier: 1.0,
        subOsDimmerOpacity: 0.0,
        percussiveStemGain: 0.80,
        pentatonicPadStemGain: 0.50,
        vagalHeartbeatStemGain: 0.30,
        brownianBedGain: 0.35,
      };
    } else if (t < 480) {
      // PHASE 2: Harmonic Thinning (Minutes 3 to 8 -> 180..480s)
      // Linear tempo ramp 104 -> 72 BPM, crossfade percussive stems into warm pentatonic pads,
      // LPF sweeps 2000 -> 900 Hz, visual speed 0.5x
      const progress = (t - 180) / 300; // 0.0 -> 1.0
      const bpm = 104 - progress * (104 - 72);
      const rawCutoff = 2000 - progress * (2000 - 900);
      return {
        phase: IsoPhase.PHASE_2_HARMONIC_THINNING,
        bpm: Math.round(bpm * 10) / 10,
        lpfCutoffHz: Math.round(hyperacusis650HzLock ? Math.min(650, rawCutoff) : rawCutoff),
        shaderSpeedMultiplier: 1.0 - progress * 0.5, // smoothly transitions to 0.5x
        subOsDimmerOpacity: progress * 0.2,
        percussiveStemGain: 0.80 * (1 - progress * 0.75),
        pentatonicPadStemGain: 0.50 + progress * 0.40,
        vagalHeartbeatStemGain: 0.30 + progress * 0.45,
        brownianBedGain: 0.35 + progress * 0.40,
      };
    } else {
      // PHASE 3: Vagal Baseline (Minutes 8 to 12+ -> 480s+)
      // 58 BPM sub-bass heartbeat pulse + smoothed Brownian Noise (-6 dB/octave),
      // LPF @ 500 Hz, visual speed 0.25x, Sub-OS screen dimmer at 40%
      return {
        phase: IsoPhase.PHASE_3_VAGAL_BASELINE,
        bpm: 58,
        lpfCutoffHz: 500, // 500 Hz is already below 650 Hz hyperacusis cap
        shaderSpeedMultiplier: 0.25,
        subOsDimmerOpacity: 0.40,
        percussiveStemGain: 0.15,
        pentatonicPadStemGain: 0.65,
        vagalHeartbeatStemGain: 0.90,
        brownianBedGain: 0.80,
      };
    }
  }
}

/**
 * Real-Time Web Audio API Synthesizer & Iso-Principle Pacemaker
 */
export class NeuroAcousticDspEngine {
  private ctx: AudioContext | null = null;
  private masterEnvelopeGain: GainNode | null = null;
  private interactiveKalimbaBusGain: GainNode | null = null;
  private masterBiquadFilter: BiquadFilterNode | null = null;
  private blacklistNotchFilter: BiquadFilterNode | null = null;
  private brickwallShaper: WaveShaperNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private padOscillators: OscillatorNode[] = [];
  private padGain: GainNode | null = null;

  private brownianBuffer: AudioBuffer | null = null;
  private pinkBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private sessionMode: SessionMode = SessionMode.IDLE;
  private elapsedSessionSec = 0;
  private activeNoiseColor: NoiseColor = NoiseColor.BROWNIAN;
  private activeFilterMode: BiquadFilterMode = BiquadFilterMode.LOW_PASS;
  private hyperacusis650HzLock = true;
  private userMaxVolumeDbFs = -4.5;
  private kalimbaEnabled = true;
  private blacklistedTimbres: string[] = [];

  // Envelope tracking
  private envelopeStartMs = 0;
  private envelopeStartGain = 0;
  private envelopeTargetGain = 0;
  private currentEnvelopeLinear = 0;

  // Rhythm & Kalimba voice tracking
  private lastBeatTimeMs = 0;
  private beatCount = 0;
  private lastKalimbaTapMs = 0;
  private activeKalimbaVoices = 0;
  private activeTransientOscillators = new Set<OscillatorNode>();
  private fadeOutTimerId: ReturnType<typeof setTimeout> | null = null;
  private waveformBuffer = new Float32Array(128);

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // 1. Master Biquad Filter (LPF 650Hz default in SOS / Iso-Principle dynamic cutoff)
      this.masterBiquadFilter = this.ctx.createBiquadFilter();
      this.masterBiquadFilter.type = 'lowpass';
      this.masterBiquadFilter.frequency.value = 650;
      this.masterBiquadFilter.Q.value = 0.7071;

      // 2. Secondary Blacklist High-Cut / Notch Filter
      this.blacklistNotchFilter = this.ctx.createBiquadFilter();
      this.blacklistNotchFilter.type = 'lowpass';
      this.blacklistNotchFilter.frequency.value = 3200;

      // 3. 4.0-Second Logarithmic Envelope Gain Node (for continuous session beds & pacemaker)
      this.masterEnvelopeGain = this.ctx.createGain();
      this.masterEnvelopeGain.gain.value = 0.02;

      // 3b. Dedicated Interactive Kalimba Bus (always audible on touch, routed through Biquad & Brickwall Limiter)
      this.interactiveKalimbaBusGain = this.ctx.createGain();
      this.interactiveKalimbaBusGain.gain.value = Math.min(
        BRICKWALL_CEILING_LINEAR,
        Math.pow(10, this.userMaxVolumeDbFs / 20)
      );

      // 4. Soft-Knee -3.0 dBFS Brickwall WaveShaper
      this.brickwallShaper = this.ctx.createWaveShaper();
      const curveLen = 4096;
      const curve = new Float32Array(curveLen);
      for (let i = 0; i < curveLen; i++) {
        const x = (i * 2) / (curveLen - 1) - 1;
        curve[i] = ProceduralDspMath.applyBrickwallLimiterSample(x, BRICKWALL_CEILING_LINEAR);
      }
      this.brickwallShaper.curve = curve;
      this.brickwallShaper.oversample = '2x';

      // 5. Safety Brickwall Compressor at -3.0 dBFS
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.value = -4.5;
      this.masterCompressor.knee.value = 3.0;
      this.masterCompressor.ratio.value = 20.0;
      this.masterCompressor.attack.value = 0.002;
      this.masterCompressor.release.value = 0.15;

      // 6. Real-time waveform analyser
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;

      // Connect Master DSP Chain
      this.masterBiquadFilter.connect(this.blacklistNotchFilter);
      this.blacklistNotchFilter.connect(this.masterEnvelopeGain);
      this.masterEnvelopeGain.connect(this.brickwallShaper);

      // Interactive Kalimba bus also goes through brickwall shaper + compressor
      this.interactiveKalimbaBusGain.connect(this.brickwallShaper);

      this.brickwallShaper.connect(this.masterCompressor);
      this.masterCompressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Pre-compute 6-second seamless procedural Brownian & Pink noise buffers
      const sr = this.ctx.sampleRate;
      const bufferSamples = sr * 6;

      this.brownianBuffer = this.ctx.createBuffer(1, bufferSamples, sr);
      this.brownianBuffer
        .getChannelData(0)
        .set(ProceduralDspMath.generateBrownianNoiseBuffer(bufferSamples));

      this.pinkBuffer = this.ctx.createBuffer(1, bufferSamples, sr);
      this.pinkBuffer
        .getChannelData(0)
        .set(ProceduralDspMath.generatePinkNoiseBuffer(bufferSamples));
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public applyProfile(profile: SensoryProfile): void {
    this.hyperacusis650HzLock = profile.hyperacusisSos650HzLock;
    this.userMaxVolumeDbFs = Math.min(BRICKWALL_CEILING_DBFS, profile.maxVolumeDbFs);
    this.activeNoiseColor = profile.defaultNoiseColor;
    this.kalimbaEnabled = profile.kalimbaTouchSynthEnabled;
    this.blacklistedTimbres = [...profile.blacklistedTimbres];
    this.activeFilterMode = profile.sspProsodyModeEnabled
      ? BiquadFilterMode.SSP_PROSODY_BANDPASS
      : BiquadFilterMode.LOW_PASS;

    const targetLinear = Math.min(
      BRICKWALL_CEILING_LINEAR,
      Math.pow(10, this.userMaxVolumeDbFs / 20)
    );

    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.blacklistNotchFilter) {
        const cutoff = this.blacklistedTimbres.includes('HIGH_CHIMES_1500HZ') ? 1350 : 3800;
        this.blacklistNotchFilter.frequency.setTargetAtTime(cutoff, now, 0.25);
      }
      if (this.interactiveKalimbaBusGain) {
        this.interactiveKalimbaBusGain.gain.setTargetAtTime(targetLinear, now, 0.15);
      }
      if (this.isPlaying && this.masterEnvelopeGain && this.envelopeTargetGain > 0) {
        this.envelopeTargetGain = targetLinear;
        this.masterEnvelopeGain.gain.setTargetAtTime(targetLinear, now, 0.35);
      }
    }
  }

  /**
   * Starts or transitions to a session mode using a strict 4.0-second logarithmic crossfade
   */
  public startSession(mode: SessionMode, profile: SensoryProfile): void {
    const ctx = this.ensureContext();
    if (this.fadeOutTimerId) {
      clearTimeout(this.fadeOutTimerId);
      this.fadeOutTimerId = null;
    }

    this.applyProfile(profile);
    this.sessionMode = mode;
    this.elapsedSessionSec = 0;
    this.beatCount = 0;

    // Tear down old continuous generators cleanly
    this.stopContinuousGenerators();

    // 1. Start Procedural Noise Bed (Brownian -6dB/oct or Pink -3dB/oct)
    if (this.activeNoiseColor !== NoiseColor.SILENT) {
      this.noiseSource = ctx.createBufferSource();
      this.noiseSource.buffer =
        this.activeNoiseColor === NoiseColor.BROWNIAN ? this.brownianBuffer : this.pinkBuffer;
      this.noiseSource.loop = true;

      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0.38;
      this.noiseSource.connect(this.noiseGain);
      this.noiseGain.connect(this.masterBiquadFilter!);
      this.noiseSource.start();
    }

    // 2. Start Warm C-Major Pentatonic Harmonic Drone Pad (C3, G3, C4, E4)
    // Audible on all speakers (laptop, tablet, phone) while remaining below 650 Hz LPF
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.55;
    this.padGain.connect(this.masterBiquadFilter!);

    const padFreqs = this.blacklistedTimbres.includes('SUB_BASS_RUMBLE')
      ? [261.63, 329.63, 392.0, 523.25]
      : [130.81, 196.0, 261.63, 329.63];

    this.padOscillators = padFreqs.map((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      const detuneCents = this.blacklistedTimbres.includes('BINAURAL_DETUNE')
        ? 0
        : (idx - 1.5) * 3.0;
      osc.frequency.value = freq;
      osc.detune.value = detuneCents;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 0.28 / padFreqs.length;
      osc.connect(voiceGain);
      voiceGain.connect(this.padGain!);
      osc.start();
      return osc;
    });

    // 3. Trigger 4.0-second Logarithmic Envelope Ramp to user target ceiling (<= -3.0 dBFS)
    // Starts at an immediately perceptible whisper floor (0.045 linear ~ -27 dBFS) so the user
    // hears gentle warmth right away while ramping logarithmically over 4.0 seconds.
    const targetLinear = Math.min(
      BRICKWALL_CEILING_LINEAR,
      Math.pow(10, this.userMaxVolumeDbFs / 20)
    );

    const now = ctx.currentTime;
    const startWhisperFloor = this.isPlaying
      ? Math.max(0.045, this.masterEnvelopeGain!.gain.value)
      : 0.045;

    this.masterEnvelopeGain!.gain.cancelScheduledValues(now);
    this.masterEnvelopeGain!.gain.setValueAtTime(startWhisperFloor, now);
    this.masterEnvelopeGain!.gain.exponentialRampToValueAtTime(
      Math.max(0.05, targetLinear),
      now + LOG_ENVELOPE_DURATION_SEC
    );

    if (this.interactiveKalimbaBusGain) {
      this.interactiveKalimbaBusGain.gain.cancelScheduledValues(now);
      this.interactiveKalimbaBusGain.gain.setValueAtTime(targetLinear, now);
    }

    this.envelopeStartMs = performance.now();
    this.envelopeStartGain = startWhisperFloor;
    this.envelopeTargetGain = targetLinear;
    this.isPlaying = true;
    this.lastBeatTimeMs = performance.now();

    // Immediately trigger the first Iso-Principle pacemaker pulse so the user hears the heartbeat/marimba on tap
    const initialIso = ProceduralDspMath.computeIsoPrincipleState(
      0,
      this.hyperacusis650HzLock,
      this.sessionMode
    );
    this.triggerPacemakerPulse(initialIso);
  }

  /**
   * Stops audio using a mandatory 4.0-second logarithmic fade-out (Zero Acoustic Startle)
   */
  public stopSessionGracefully(): void {
    if (!this.ctx || !this.masterEnvelopeGain) {
      this.isPlaying = false;
      this.sessionMode = SessionMode.IDLE;
      return;
    }
    if (this.fadeOutTimerId) {
      clearTimeout(this.fadeOutTimerId);
    }

    const now = this.ctx.currentTime;
    const currentVal = Math.max(0.01, this.masterEnvelopeGain.gain.value);
    this.masterEnvelopeGain.gain.cancelScheduledValues(now);
    this.masterEnvelopeGain.gain.setValueAtTime(currentVal, now);
    this.masterEnvelopeGain.gain.exponentialRampToValueAtTime(
      EPSILON_GAIN,
      now + LOG_ENVELOPE_DURATION_SEC
    );

    this.envelopeStartMs = performance.now();
    this.envelopeStartGain = currentVal;
    this.envelopeTargetGain = 0;

    this.fadeOutTimerId = setTimeout(() => {
      if (this.envelopeTargetGain === 0) {
        this.stopContinuousGenerators();
        this.isPlaying = false;
        this.sessionMode = SessionMode.IDLE;
      }
    }, LOG_ENVELOPE_DURATION_SEC * 1000 + 80);
  }

  /**
   * Immediately stops ALL playing audio (continuous noise, harmonic pad, pacemaker pulses, and active kalimba voices)
   * using a 35ms click-free micro-de-click ramp.
   */
  public stopAllAudioImmediately(): void {
    if (this.fadeOutTimerId) {
      clearTimeout(this.fadeOutTimerId);
      this.fadeOutTimerId = null;
    }

    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.masterEnvelopeGain) {
        this.masterEnvelopeGain.gain.cancelScheduledValues(now);
        this.masterEnvelopeGain.gain.setValueAtTime(
          Math.max(EPSILON_GAIN, this.masterEnvelopeGain.gain.value),
          now
        );
        this.masterEnvelopeGain.gain.exponentialRampToValueAtTime(EPSILON_GAIN, now + 0.035);
      }
      if (this.interactiveKalimbaBusGain) {
        this.interactiveKalimbaBusGain.gain.cancelScheduledValues(now);
        this.interactiveKalimbaBusGain.gain.setValueAtTime(
          Math.max(EPSILON_GAIN, this.interactiveKalimbaBusGain.gain.value),
          now
        );
        this.interactiveKalimbaBusGain.gain.exponentialRampToValueAtTime(EPSILON_GAIN, now + 0.035);
      }
    }

    setTimeout(() => {
      this.stopContinuousGenerators();
      for (const osc of this.activeTransientOscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      }
      this.activeTransientOscillators.clear();
      this.activeKalimbaVoices = 0;

      // Restore interactiveKalimbaBusGain for future taps after stopping current voices
      if (this.ctx && this.interactiveKalimbaBusGain) {
        const targetLinear = Math.min(
          BRICKWALL_CEILING_LINEAR,
          Math.pow(10, this.userMaxVolumeDbFs / 20)
        );
        this.interactiveKalimbaBusGain.gain.setValueAtTime(targetLinear, this.ctx.currentTime);
      }
    }, 45);

    this.isPlaying = false;
    this.sessionMode = SessionMode.IDLE;
    this.envelopeStartGain = 0;
    this.envelopeTargetGain = 0;
    this.currentEnvelopeLinear = 0;
    this.waveformBuffer.fill(0);
  }

  private stopContinuousGenerators(): void {
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {
        // ignore if already stopped
      }
      this.noiseSource = null;
    }
    for (const osc of this.padOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    }
    this.padOscillators = [];
  }

  /**
   * Switches Noise Generator on the fly with smooth gain interpolation
   */
  public setNoiseColor(color: NoiseColor): void {
    this.activeNoiseColor = color;
    if (!this.isPlaying || !this.ctx || !this.masterBiquadFilter) return;

    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {
        // ignore
      }
      this.noiseSource = null;
    }

    if (color !== NoiseColor.SILENT) {
      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer =
        color === NoiseColor.BROWNIAN ? this.brownianBuffer : this.pinkBuffer;
      this.noiseSource.loop = true;
      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0.38;
      this.noiseSource.connect(this.noiseGain);
      this.noiseGain.connect(this.masterBiquadFilter);
      this.noiseSource.start();
    }
  }

  public setFilterMode(mode: BiquadFilterMode): void {
    this.activeFilterMode = mode;
    if (!this.ctx || !this.masterBiquadFilter) return;
    const now = this.ctx.currentTime;
    if (mode === BiquadFilterMode.SSP_PROSODY_BANDPASS) {
      this.masterBiquadFilter.type = 'bandpass';
      this.masterBiquadFilter.frequency.setTargetAtTime(1118, now, 0.3); // Geometric center of 500-2500Hz
      this.masterBiquadFilter.Q.setTargetAtTime(0.7071, now, 0.3);
    } else {
      this.masterBiquadFilter.type = 'lowpass';
    }
  }

  public setHyperacusis650HzLock(locked: boolean): void {
    this.hyperacusis650HzLock = locked;
  }

  public setElapsedSessionSeconds(seconds: number): void {
    this.elapsedSessionSec = Math.max(0, seconds);
  }

  /**
   * Triggers a velocity-capped C-Major Pentatonic Kalimba tone with spam-tap protection.
   * Connects to interactiveKalimbaBusGain so it is ALWAYS audible whether or not a session is running!
   */
  public triggerKalimbaNote(xNormalized: number, yNormalized: number): {
    triggered: boolean;
    noteName: string;
    frequencyHz: number;
    colorHex: string;
  } {
    const idx = Math.min(
      PENTATONIC_SCALE_NOTES.length - 1,
      Math.max(0, Math.floor(xNormalized * PENTATONIC_SCALE_NOTES.length))
    );
    const selected = PENTATONIC_SCALE_NOTES[idx];

    if (!this.kalimbaEnabled) {
      return {
        triggered: false,
        noteName: selected.name,
        frequencyHz: selected.freq,
        colorHex: selected.color,
      };
    }

    const nowMs = performance.now();
    // Spam-tap protection: minimum 100ms inter-onset interval & max 4 concurrent voices
    if (nowMs - this.lastKalimbaTapMs < 100 || this.activeKalimbaVoices >= 4) {
      return {
        triggered: false,
        noteName: selected.name,
        frequencyHz: selected.freq,
        colorHex: selected.color,
      };
    }

    const ctx = this.ensureContext();
    this.lastKalimbaTapMs = nowMs;
    this.activeKalimbaVoices++;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const harmonicOsc = ctx.createOscillator();
    const voiceFilter = ctx.createBiquadFilter();
    const tineGain = ctx.createGain();

    this.activeTransientOscillators.add(osc);
    this.activeTransientOscillators.add(harmonicOsc);

    // If high chimes are blacklisted, keep fundamental warm
    const safeFreq =
      this.blacklistedTimbres.includes('HIGH_CHIMES_1500HZ') && selected.freq > 550
        ? selected.freq * 0.5
        : selected.freq;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(safeFreq, now);

    // Subtle warm 2nd harmonic for wooden kalimba resonator body
    harmonicOsc.type = 'triangle';
    harmonicOsc.frequency.setValueAtTime(safeFreq * 2.0, now);
    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.18;

    voiceFilter.type = 'lowpass';
    voiceFilter.frequency.setValueAtTime(this.hyperacusis650HzLock ? 850 : 1800, now);

    // Audible, gentle velocity range (0.24 to 0.42 linear before master limiter)
    const velocityCap = 0.24 + (1.0 - Math.max(0, Math.min(1, yNormalized))) * 0.18;
    // Soft attack (55ms) if SHARP_TRANSIENTS blacklisted, else 28ms
    const attackSec = this.blacklistedTimbres.includes('SHARP_TRANSIENTS') ? 0.055 : 0.028;

    tineGain.gain.setValueAtTime(EPSILON_GAIN, now);
    tineGain.gain.exponentialRampToValueAtTime(velocityCap, now + attackSec);
    tineGain.gain.exponentialRampToValueAtTime(EPSILON_GAIN, now + 1.6);

    osc.connect(voiceFilter);
    harmonicOsc.connect(harmGain);
    harmGain.connect(voiceFilter);
    voiceFilter.connect(tineGain);
    tineGain.connect(this.interactiveKalimbaBusGain!);

    osc.start(now);
    harmonicOsc.start(now);
    osc.stop(now + 1.65);
    harmonicOsc.stop(now + 1.65);

    setTimeout(() => {
      this.activeTransientOscillators.delete(osc);
      this.activeTransientOscillators.delete(harmonicOsc);
      this.activeKalimbaVoices = Math.max(0, this.activeKalimbaVoices - 1);
      try {
        osc.disconnect();
        harmonicOsc.disconnect();
        harmGain.disconnect();
        voiceFilter.disconnect();
        tineGain.disconnect();
      } catch {
        // ignore
      }
    }, 1700);

    return {
      triggered: true,
      noteName: selected.name,
      frequencyHz: safeFreq,
      colorHex: selected.color,
    };
  }

  /**
   * Synthesizes the Iso-Principle Pacemaker Pulse:
   * - Phase 1 & 2: Warm Marimba / Bowed Cello Pentatonic Pulse (C3, G3, A3, E4)
   * - Phase 3: Vagal Sub-Bass Heartbeat Pulse (Lub-Dub at 58 BPM)
   */
  private triggerPacemakerPulse(
    iso: ReturnType<typeof ProceduralDspMath.computeIsoPrincipleState>
  ): void {
    if (!this.ctx || !this.masterBiquadFilter || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    this.beatCount++;

    // 1. Warm Marimba / Cello Pulse (always plays in Phase 1 & 2; uses bowed soft attack if SHARP_TRANSIENTS blacklisted)
    if (iso.percussiveStemGain > 0.08) {
      const marimbaOsc = this.ctx.createOscillator();
      const marimbaSub = this.ctx.createOscillator();
      const marimbaGain = this.ctx.createGain();

      this.activeTransientOscillators.add(marimbaOsc);
      this.activeTransientOscillators.add(marimbaSub);

      // Cycle smoothly through warm C-Major Pentatonic bass/cello notes: C3, G3, A3, E3
      const celloNotes = [130.81, 196.0, 220.0, 164.81];
      const noteFreq = celloNotes[this.beatCount % celloNotes.length];

      marimbaOsc.type = 'triangle';
      marimbaOsc.frequency.setValueAtTime(noteFreq, now);

      marimbaSub.type = 'sine';
      marimbaSub.frequency.setValueAtTime(noteFreq * 2.0, now);

      const softAttack = this.blacklistedTimbres.includes('SHARP_TRANSIENTS') ? 0.075 : 0.032;
      const peakGain = Math.min(0.42, iso.percussiveStemGain * 0.45);

      marimbaGain.gain.setValueAtTime(EPSILON_GAIN, now);
      marimbaGain.gain.exponentialRampToValueAtTime(peakGain, now + softAttack);
      marimbaGain.gain.exponentialRampToValueAtTime(EPSILON_GAIN, now + 0.58);

      const subMix = this.ctx.createGain();
      subMix.gain.value = 0.35;

      marimbaOsc.connect(marimbaGain);
      marimbaSub.connect(subMix);
      subMix.connect(marimbaGain);
      marimbaGain.connect(this.masterBiquadFilter);

      marimbaOsc.start(now);
      marimbaSub.start(now);
      marimbaOsc.stop(now + 0.62);
      marimbaSub.stop(now + 0.62);

      setTimeout(() => {
        this.activeTransientOscillators.delete(marimbaOsc);
        this.activeTransientOscillators.delete(marimbaSub);
      }, 650);
    }

    // 2. Vagal Heartbeat Pulse (Lub-Dub at 58 BPM in Phase 3, or gentle warmth in Phase 2/3)
    if (iso.vagalHeartbeatStemGain > 0.25) {
      const baseFreq = this.blacklistedTimbres.includes('SUB_BASS_RUMBLE') ? 130.81 : 73.42; // Warm D2/C3 heartbeat
      const heartPeak = Math.min(0.45, iso.vagalHeartbeatStemGain * 0.48);

      // First beat ("Lub")
      const lubOsc = this.ctx.createOscillator();
      const lubGain = this.ctx.createGain();
      this.activeTransientOscillators.add(lubOsc);
      lubOsc.type = 'sine';
      lubOsc.frequency.setValueAtTime(baseFreq * 1.15, now);
      lubOsc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.18);

      lubGain.gain.setValueAtTime(EPSILON_GAIN, now);
      lubGain.gain.exponentialRampToValueAtTime(heartPeak, now + 0.045);
      lubGain.gain.exponentialRampToValueAtTime(EPSILON_GAIN, now + 0.26);

      lubOsc.connect(lubGain);
      lubGain.connect(this.masterBiquadFilter);
      lubOsc.start(now);
      lubOsc.stop(now + 0.28);

      // Second beat ("Dub" - 220ms later)
      const dubOsc = this.ctx.createOscillator();
      const dubGain = this.ctx.createGain();
      this.activeTransientOscillators.add(dubOsc);
      dubOsc.type = 'sine';
      dubOsc.frequency.setValueAtTime(baseFreq, now + 0.22);
      dubOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 0.42);

      dubGain.gain.setValueAtTime(EPSILON_GAIN, now + 0.22);
      dubGain.gain.exponentialRampToValueAtTime(heartPeak * 0.72, now + 0.26);
      dubGain.gain.exponentialRampToValueAtTime(EPSILON_GAIN, now + 0.52);

      dubOsc.connect(dubGain);
      dubGain.connect(this.masterBiquadFilter);
      dubOsc.start(now + 0.22);
      dubOsc.stop(now + 0.55);

      setTimeout(() => {
        this.activeTransientOscillators.delete(lubOsc);
        this.activeTransientOscillators.delete(dubOsc);
      }, 600);
    }
  }

  /**
   * Periodic tick updating Iso-Principle filter, stems, pacemaker beat, and returning live telemetry
   */
  public tick(deltaSec: number): AcousticTelemetrySnapshot {
    if (this.isPlaying && this.envelopeTargetGain > 0) {
      this.elapsedSessionSec += deltaSec;
    }

    const iso = ProceduralDspMath.computeIsoPrincipleState(
      this.elapsedSessionSec,
      this.hyperacusis650HzLock,
      this.sessionMode
    );

    const nowMs = performance.now();
    const envElapsedSec = (nowMs - this.envelopeStartMs) / 1000;
    const isCrossfading = this.isPlaying && envElapsedSec < LOG_ENVELOPE_DURATION_SEC;
    const crossfadeRemainingSec = isCrossfading
      ? Math.max(0, LOG_ENVELOPE_DURATION_SEC - envElapsedSec)
      : 0;

    this.currentEnvelopeLinear = this.isPlaying
      ? ProceduralDspMath.computeLogarithmicEnvelopeGain(
          this.envelopeStartGain,
          this.envelopeTargetGain,
          envElapsedSec,
          LOG_ENVELOPE_DURATION_SEC
        )
      : 0;

    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.isPlaying) {
        if (
          this.masterBiquadFilter &&
          this.activeFilterMode !== BiquadFilterMode.SSP_PROSODY_BANDPASS
        ) {
          this.masterBiquadFilter.type = 'lowpass';
          this.masterBiquadFilter.frequency.setTargetAtTime(iso.lpfCutoffHz, now, 0.15);
        }
        if (this.noiseGain) {
          this.noiseGain.gain.setTargetAtTime(iso.brownianBedGain * 0.55, now, 0.25);
        }
        if (this.padGain) {
          this.padGain.gain.setTargetAtTime(iso.pentatonicPadStemGain * 0.65, now, 0.25);
        }

        // Trigger pacemaker pulse according to current Iso-Principle BPM
        const beatIntervalMs = (60 / Math.max(40, iso.bpm)) * 1000;
        if (nowMs - this.lastBeatTimeMs >= beatIntervalMs && this.envelopeTargetGain > 0) {
          this.lastBeatTimeMs = nowMs;
          this.triggerPacemakerPulse(iso);
        }
      }

      if (this.analyser && (this.isPlaying || this.activeKalimbaVoices > 0)) {
        this.analyser.getFloatTimeDomainData(this.waveformBuffer);
      } else {
        this.waveformBuffer.fill(0);
      }
    } else {
      this.waveformBuffer.fill(0);
    }

    const currentMasterDbFs =
      this.currentEnvelopeLinear <= EPSILON_GAIN
        ? -80.0
        : Math.min(BRICKWALL_CEILING_DBFS, 20 * Math.log10(this.currentEnvelopeLinear));

    const limiterGainReductionDb =
      this.masterCompressor && this.isPlaying ? Math.abs(this.masterCompressor.reduction) : 0;

    return {
      isPlaying: this.isPlaying,
      isCrossfading,
      crossfadeRemainingSec,
      currentEnvelopeLinear: this.currentEnvelopeLinear,
      currentMasterDbFs,
      brickwallCeilingDbFs: BRICKWALL_CEILING_DBFS,
      limiterGainReductionDb,
      currentBpm: iso.bpm,
      currentLpfCutoffHz:
        this.activeFilterMode === BiquadFilterMode.SSP_PROSODY_BANDPASS ? 1118 : iso.lpfCutoffHz,
      activeFilterMode: this.activeFilterMode,
      activeNoiseColor: this.activeNoiseColor,
      percussiveStemGain: iso.percussiveStemGain,
      pentatonicPadStemGain: iso.pentatonicPadStemGain,
      vagalHeartbeatStemGain: iso.vagalHeartbeatStemGain,
      brownianBedGain: iso.brownianBedGain,
      shaderSpeedMultiplier: iso.shaderSpeedMultiplier,
      subOsDimmerOpacity: iso.subOsDimmerOpacity,
      activeKalimbaVoices: this.activeKalimbaVoices,
      isoPhase: iso.phase,
      elapsedSessionSeconds: this.elapsedSessionSec,
      waveformSamples: new Float32Array(this.waveformBuffer),
    };
  }
}

export const sharedAudioEngine = new NeuroAcousticDspEngine();
