/**
 * [AGENT 4: LOCAL DATA & SESSION LOG ENGINEER]
 * 100% Offline Persistence Layer (SQLite Schema + LocalStorage Engine + CSV Session Log Exporter)
 */

import {
  EfficacyRating,
  IsoPhase,
  MeltdownSessionLog,
  NoiseColor,
  SensoryProfile,
  SessionMode,
  ShaderId,
} from '../types/aurasync';

const PROFILE_STORAGE_KEY = 'neurosos_offline_sensory_profile_v2';
const LOGS_STORAGE_KEY = 'neurosos_offline_session_logs_v2';

export const SQLITE_DDL_SCHEMA = `
-- [AGENT 4] NeuroSOS Offline SQLite Persistence Schema (sqflite / drift compatible)
CREATE TABLE IF NOT EXISTS sensory_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  child_name TEXT NOT NULL,
  preferred_sos_shader TEXT NOT NULL,
  preferred_focus_shader TEXT NOT NULL,
  preferred_calm_shader TEXT NOT NULL,
  max_volume_dbfs REAL NOT NULL CHECK (max_volume_dbfs <= -3.0),
  max_brightness_percent INTEGER NOT NULL CHECK (max_brightness_percent BETWEEN 20 AND 100),
  default_focus_minutes INTEGER NOT NULL,
  sos_650hz_comfort_filter INTEGER NOT NULL DEFAULT 1,
  vocal_band_filter_enabled INTEGER NOT NULL DEFAULT 0,
  default_noise_color TEXT NOT NULL,
  blacklisted_timbres_json TEXT NOT NULL,
  kalimba_touch_synth_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meltdown_session_logs (
  id TEXT PRIMARY KEY NOT NULL,
  started_at_iso TEXT NOT NULL,
  ended_at_iso TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  mode TEXT NOT NULL,
  shader_used TEXT NOT NULL,
  iso_phase_reached TEXT NOT NULL,
  completed_full_iso_cycle INTEGER NOT NULL,
  initial_bpm REAL NOT NULL,
  final_bpm REAL NOT NULL,
  initial_cutoff_hz REAL NOT NULL,
  final_cutoff_hz REAL NOT NULL,
  kalimba_touch_count INTEGER NOT NULL DEFAULT 0,
  efficacy_rating TEXT NOT NULL CHECK (efficacy_rating IN ('EFFECTIVE', 'NEUTRAL', 'ESCALATED', 'UNRATED')),
  caregiver_notes TEXT NOT NULL
);
`.trim();

export const DEFAULT_SENSORY_PROFILE: SensoryProfile = {
  id: 'profile-leo-01',
  childName: 'Leo (Age 7 · Sound Sensitive & Tactile Explorer)',
  preferredSosShader: ShaderId.BIOLUMINESCENT_TUNNEL,
  preferredFocusShader: ShaderId.CLASSROOM_BUBBLES,
  preferredCalmShader: ShaderId.OLED_LANTERNS,
  maxVolumeDbFs: -6.0, // Strictly <= -3.0 dBFS hardware brickwall limit
  maxBrightnessPercent: 80,
  defaultFocusMinutes: 15,
  hyperacusisSos650HzLock: true,
  sspProsodyModeEnabled: false,
  defaultNoiseColor: NoiseColor.BROWNIAN,
  blacklistedTimbres: ['HIGH_CHIMES_1500HZ', 'SHARP_TRANSIENTS'],
  kalimbaTouchSynthEnabled: true,
  updatedAtIso: '2026-10-20T08:00:00.000Z',
};

export const INITIAL_CLINICAL_LOGS: MeltdownSessionLog[] = [
  {
    id: 'session-log-101',
    startedAtIso: '2026-10-19T16:12:00.000Z',
    endedAtIso: '2026-10-19T16:24:30.000Z',
    durationSeconds: 750,
    mode: SessionMode.SOS_MELTDOWN,
    shaderUsed: ShaderId.BIOLUMINESCENT_TUNNEL,
    isoPhaseReached: IsoPhase.PHASE_3_VAGAL_BASELINE,
    completedFullIsoCycle: true,
    initialBpm: 104,
    finalBpm: 58,
    initialCutoffHz: 650,
    finalCutoffHz: 500,
    kalimbaTouchCount: 34,
    efficacyRating: 'EFFECTIVE',
    caregiverNotes:
      'Post-school noisy cafeteria environment. Breathing pace slowed by Minute 6 during Phase 2 harmonic thinning.',
  },
  {
    id: 'session-log-102',
    startedAtIso: '2026-10-18T10:05:00.000Z',
    endedAtIso: '2026-10-18T10:20:00.000Z',
    durationSeconds: 900,
    mode: SessionMode.FOCUS_TIMER,
    shaderUsed: ShaderId.CLASSROOM_BUBBLES,
    isoPhaseReached: IsoPhase.STATIC_REGULATION,
    completedFullIsoCycle: true,
    initialBpm: 72,
    finalBpm: 72,
    initialCutoffHz: 650,
    finalCutoffHz: 650,
    kalimbaTouchCount: 12,
    efficacyRating: 'EFFECTIVE',
    caregiverNotes:
      'Morning tabletop reading & worksheet transition using vanishing rainbow arc timer.',
  },
  {
    id: 'session-log-103',
    startedAtIso: '2026-10-17T19:40:00.000Z',
    endedAtIso: '2026-10-17T19:49:10.000Z',
    durationSeconds: 550,
    mode: SessionMode.CALM_STIM,
    shaderUsed: ShaderId.OLED_LANTERNS,
    isoPhaseReached: IsoPhase.STATIC_REGULATION,
    completedFullIsoCycle: true,
    initialBpm: 60,
    finalBpm: 60,
    initialCutoffHz: 650,
    finalCutoffHz: 650,
    kalimbaTouchCount: 68,
    efficacyRating: 'EFFECTIVE',
    caregiverNotes:
      'Evening wind-down with pure black OLED lanterns and C-Major pentatonic kalimba water ripples.',
  },
  {
    id: 'session-log-104',
    startedAtIso: '2026-10-15T14:22:00.000Z',
    endedAtIso: '2026-10-15T14:27:45.000Z',
    durationSeconds: 345,
    mode: SessionMode.SOS_MELTDOWN,
    shaderUsed: ShaderId.BREATHING_ORB,
    isoPhaseReached: IsoPhase.PHASE_2_HARMONIC_THINNING,
    completedFullIsoCycle: false,
    initialBpm: 104,
    finalBpm: 86,
    initialCutoffHz: 650,
    finalCutoffHz: 650,
    kalimbaTouchCount: 9,
    efficacyRating: 'NEUTRAL',
    caregiverNotes:
      'Busy store bright lighting environment; helped settle until we stepped outside to a quiet space.',
  },
];

export class OfflineClinicalStore {
  static loadProfile(): SensoryProfile {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(DEFAULT_SENSORY_PROFILE));
        return DEFAULT_SENSORY_PROFILE;
      }
      const parsed = JSON.parse(raw) as SensoryProfile;
      // Enforce mandatory -3.0 dBFS safety clamp even on stored data
      parsed.maxVolumeDbFs = Math.min(-3.0, parsed.maxVolumeDbFs);
      return parsed;
    } catch {
      return DEFAULT_SENSORY_PROFILE;
    }
  }

  static saveProfile(profile: SensoryProfile): SensoryProfile {
    const safeProfile: SensoryProfile = {
      ...profile,
      maxVolumeDbFs: Math.min(-3.0, profile.maxVolumeDbFs),
      updatedAtIso: new Date().toISOString(),
    };
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(safeProfile));
    } catch {
      // ignore storage quota errors in restricted sandboxes
    }
    return safeProfile;
  }

  static loadLogs(): MeltdownSessionLog[] {
    try {
      const raw = localStorage.getItem(LOGS_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(INITIAL_CLINICAL_LOGS));
        return INITIAL_CLINICAL_LOGS;
      }
      return JSON.parse(raw) as MeltdownSessionLog[];
    } catch {
      return INITIAL_CLINICAL_LOGS;
    }
  }

  static appendLog(log: MeltdownSessionLog): MeltdownSessionLog[] {
    const current = OfflineClinicalStore.loadLogs();
    const updated = [log, ...current];
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }

  static updateLogEfficacy(
    logId: string,
    rating: EfficacyRating,
    notes?: string
  ): MeltdownSessionLog[] {
    const current = OfflineClinicalStore.loadLogs();
    const updated = current.map((item) =>
      item.id === logId
        ? {
            ...item,
            efficacyRating: rating,
            caregiverNotes: notes !== undefined ? notes : item.caregiverNotes,
          }
        : item
    );
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }

  /**
   * Generates RFC-4180 compliant CSV string for sharing with caregivers, educators, or support specialists
   */
  static exportLogsToCsv(logs: MeltdownSessionLog[], profile: SensoryProfile): string {
    const headers = [
      'Session_ID',
      'User_Profile',
      'Started_At_ISO',
      'Duration_Sec',
      'Session_Mode',
      'Shader_Preset',
      'Pacing_Stage_Reached',
      'Full_Pacing_Cycle',
      'Initial_BPM',
      'Final_BPM',
      'Initial_LPF_Hz',
      'Final_LPF_Hz',
      'Kalimba_Touches',
      'Caregiver_Helpfulness_Rating',
      'Session_Notes',
    ];

    const escapeCsv = (val: string | number | boolean) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((l) =>
      [
        l.id,
        profile.childName,
        l.startedAtIso,
        l.durationSeconds,
        l.mode,
        l.shaderUsed,
        l.isoPhaseReached,
        l.completedFullIsoCycle ? 'YES' : 'NO',
        l.initialBpm,
        l.finalBpm,
        l.initialCutoffHz,
        l.finalCutoffHz,
        l.kalimbaTouchCount,
        l.efficacyRating,
        l.caregiverNotes,
      ]
        .map(escapeCsv)
        .join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
