# NeuroSOS

NeuroSOS is an offline sensory comfort, focus timer, and calm audio-visual suite for families, educators, and caregivers. It runs procedural audio and WebGL visuals locally in the browser, stores profiles and session history on the device, and can be installed as a Progressive Web App.

> **Wellness notice:** NeuroSOS is a general wellness and sensory-support tool. It is not a medical device and does not diagnose, treat, cure, or prevent any medical, psychological, behavioral, or neurodevelopmental condition.

## Current features

### Three session modes

- **1-Tap Meltdown SOS** starts a three-stage pacing session designed for sensory overload support:
  - Phase 1: 104 BPM matching tempo
  - Phase 2: gradual 104 → 72 BPM harmonic thinning
  - Phase 3: 58 BPM deep-rest baseline with a 500 Hz low-pass target and automatic visual dimming
- **Focus & Transition Arc** provides a configurable 5–45 minute focus session with steady 72 BPM pacing, ambient noise masking, and a non-numerical vanishing rainbow arc timer.
- **Calm & Kalimba Ripples** provides a slower sensory canvas with interactive water ripples and velocity-capped C-major pentatonic kalimba tones.

### Procedural audio controls

- Brownian noise, Pink noise, or a muted noise bed
- Real-time C-major pentatonic tones from canvas taps, drags, and audition buttons
- 4.0-second logarithmic fade-in and fade-out transitions
- Live waveform oscilloscope and DSP telemetry
- Acoustic comfort controls including:
  - A master ceiling locked at or below **-3.0 dBFS**
  - Optional **650 Hz SOS comfort low-pass filter**
  - Optional **500–2500 Hz vocal-band filter**
  - Timbre blacklist options for high chimes, sharp transients, stereo detuning, and sub-bass rumble

### Visual sensory presets

- Bioluminescent 3D light tunnel
- Predictable rising classroom bubbles
- High-contrast OLED floating lanterns on a pure black background
- Guided breathing orb with a 4-second inhale and 6-second exhale cycle
- Low-motion pacing with shader speed and brightness controls

### Child-safe kiosk mode

- Optional SOS launch with a full-screen child touch-lock kiosk
- Child taps become visual ripples and musical feedback rather than navigation actions
- Parent unlock requires simultaneous top-left and top-right holds for 3 seconds
- Caregiver can stop all audio immediately or stop gracefully with a 4-second fade

### Sensory profiles and offline logs

- Custom profile name and preferred shader for each session mode
- Focus duration, maximum volume, brightness, filter, noise, and timbre preferences
- Session records include mode, duration, shader, pacing phase, BPM/cutoff telemetry, kalimba touches, and caregiver helpfulness rating
- Filter logs by session mode and rate completed sessions as Helpful, Neutral, or Needs Adjustment
- Export session records as CSV for caregivers, educators, or support specialists
- Download the compatible SQLite DDL schema and export format

### PWA and publishing support

- Installable PWA with standalone display, offline precaching, and maskable icons
- In-app installation guidance for Android, ChromeOS, desktop browsers, and iOS Safari
- Offline status indicator
- Privacy policy and non-medical disclaimer page
- Built-in documentation for Android Trusted Web Activity publishing, Digital Asset Links, and Google Play wellness/data-safety disclosures

### Built-in safety audit

The Audit view runs the current local checks for:

- Procedural noise loop continuity and click-free boundaries
- 4-second envelope continuity
- -3.0 dBFS limiter and 650 Hz SOS filter defaults
- Deterministic 104 → 72 → 58 BPM pacing
- Resistance to accidental kiosk unlocks
- Low-motion breathing frequency and absence of external CDN/script dependencies

## Privacy and offline behavior

NeuroSOS is designed to operate without a backend, account, analytics SDK, advertising SDK, microphone, camera, or external media assets. Sensory preferences and session logs are stored in browser `localStorage` and are not transmitted automatically. CSV and SQL files are generated locally when the user explicitly downloads them.

See [`public/privacy-policy.html`](public/privacy-policy.html) for the full privacy policy and disclaimer.

## Tech stack

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4
- Web Audio API procedural DSP
- WebGL fragment-shader sensory canvases
- `lucide-react` icons
- Motion-based UI animation
- `vite-plugin-pwa` for service-worker precaching and installation

## Getting started

### Requirements

- Node.js 20+ recommended
- npm or Bun
- A modern browser with Web Audio API and WebGL support

### Install and run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. The configured development server uses port `3000`.

### Available scripts

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build
npm run preview   # Preview the production build locally
npm run lint      # Run the TypeScript check
npm run clean     # Remove generated build/server artifacts
```

## Project structure

```text
src/
├── App.tsx                         Main studio, profile, logs, and audit views
├── audio/NeuroAcousticDspEngine.ts Procedural Web Audio DSP and pacing state machine
├── audit/                          Runtime clinical/sensory safety checks
├── components/                     Kiosk, timer, and PWA/publishing UI
├── persistence/                    Local profile/log storage and export helpers
├── shaders/                        WebGL sensory visual canvas
├── types/                          Shared session, profile, audio, and telemetry types
└── pwa/                            PWA installation state
```

## Data and safety boundaries

NeuroSOS intentionally positions itself as a non-medical wellness application. Audio and visual responses can vary by device, browser, operating-system audio settings, headphones, and environment. Caregivers should supervise use, stop a session if it causes discomfort, and consult an appropriately qualified professional for health-related concerns.

## License

Source files include Apache-2.0 license headers where applicable. Confirm the repository's licensing terms before redistributing the application or its generated assets.
