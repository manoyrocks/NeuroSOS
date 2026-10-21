import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Smartphone, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../pwa/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (isInstallable) {
            await install();
          } else {
            setShowGuideModal(true);
          }
        }}
        className="px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-200 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-4 h-4" />
        <span>{isIOS ? 'Install on iOS' : 'Install App (PWA)'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Install NeuroSOS for 100% Offline Use
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            {isIOS ? (
              <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                <p>To install NeuroSOS on your iPhone or iPad home screen:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-200">
                  <li>
                    Tap the <strong>Share</strong> icon in the Safari toolbar.
                  </li>
                  <li>
                    Scroll down and select <strong>Add to Home Screen</strong>.
                  </li>
                  <li>
                    Launch <strong>NeuroSOS</strong> from your home screen in Airplane Mode.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                <p>To install NeuroSOS as a standalone app on Android, ChromeOS, or Desktop:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-200">
                  <li>
                    Open NeuroSOS in its own browser tab (outside preview frames if applicable).
                  </li>
                  <li>
                    Click the <strong>Install NeuroSOS</strong> icon in your browser address bar or
                    browser menu (<strong>Add to Home Screen / Install App</strong>).
                  </li>
                  <li>
                    Once installed, all procedural audio DSP and visual shaders work 100% offline.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineStatusBanner: React.FC = () => {
  const { isOnline } = usePWAInstall();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-teal-950/95 border border-teal-500/40 px-3.5 py-2 text-xs font-medium text-teal-100 shadow-lg">
      <span>Airplane / Offline Mode Active — All procedural audio & shaders running locally.</span>
    </div>
  );
};

export const PlayStorePublishingPanel: React.FC = () => {
  const [packageName, setPackageName] = useState('app.neurosos.sensory');
  const [sha256Cert, setSha256Cert] = useState(
    '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const assetLinksJson = JSON.stringify(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: [sha256Cert],
        },
      },
    ],
    null,
    2
  );

  const bubblewrapCommands = `# 1. Install Google Bubblewrap CLI (Trusted Web Activitypackager for Google Play Store)
npm i -g @bubblewrap/cli

# 2. Initialize Android project from the deployed NeuroSOS Web App Manifest
bubblewrap init --manifest="https://YOUR_PRODUCTION_DOMAIN/manifest.webmanifest"

# 3. Build signed Android App Bundle (.aab) for Google Play Console & APK for testing
bubblewrap build

# 4. Place the generated SHA-256 fingerprint into public/.well-known/assetlinks.json`;

  const playStoreListingDisclaimer = `WELLNESS & NON-MEDICAL DISCLAIMER:
NeuroSOS is a general sensory comfort, ambient sound masking, relaxation, and visual task-timer application. It is not a medical device and does not provide medical advice, clinical diagnosis, treatment, or therapy for any medical or neurodevelopmental condition. All audio waveforms (Brownian noise, Pink noise, pentatonic chimes, and rhythmic pulses) and visual animations are procedurally generated in real time with zero third-party copyrighted media and 100% offline execution.`;

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadAssetLinks = () => {
    const blob = new Blob([assetLinksJson], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assetlinks.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pt-4">
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Web App (PWA) & Android Google Play Store Publishing Kit
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pre-configured with Service Worker precaching, maskable icons, Digital Asset Links,
            Privacy Policy, and IP-safe non-medical store disclosures.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton />
          <a
            href="/privacy-policy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Privacy Policy & Terms</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Compliance & IP Audit Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>IP & Trademark Cleanliness</span>
          </div>
          <h3 className="text-sm font-bold text-white">100% Original Procedural Synthesis</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Zero third-party audio samples, fonts, or proprietary therapy trademarks. All audio
            filters, noise generators, and WebGL shaders are synthesized from first-principles math.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Google Play Health & Wellness Policy</span>
          </div>
          <h3 className="text-sm font-bold text-white">Non-Medical Wellness Positioning</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Positioned strictly as a sensory comfort, relaxation, and visual timer tool with explicit
            non-medical disclaimers—no SaMD / FDA medical device claims.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Google Play Data Safety & Families</span>
          </div>
          <h3 className="text-sm font-bold text-white">Zero Data Collection (COPPA Safe)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Zero analytics, zero ad SDKs, zero account sign-ups, and zero network transmissions.
            Qualifies for "No data collected or shared" on Google Play Data Safety.
          </p>
        </div>
      </div>

      {/* Store Listing Non-Medical Disclaimer Copy */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-white">
              Google Play Store Listing & In-App Non-Medical Disclaimer
            </div>
            <div className="text-[11px] text-slate-400">
              Ready to paste into Google Play Console Full Description & App Content declarations
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyText('disclaimer', playStoreListingDisclaimer)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedId === 'disclaimer' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Disclaimer</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed bg-[#050911]">
          {playStoreListingDisclaimer}
        </pre>
      </div>

      {/* Android Trusted Web Activity (TWA) & Digital Asset Links Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">
                Android Digital Asset Links (.well-known/assetlinks.json)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verifies domain ownership so Android launches NeuroSOS in full-screen standalone mode
                without a browser URL bar.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadAssetLinks}
              className="px-3 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Android Application ID (Package Name)
              </label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Play App Signing SHA-256 Certificate Fingerprint
              </label>
              <input
                type="text"
                value={sha256Cert}
                onChange={(e) => setSha256Cert(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white"
              />
            </div>
          </div>

          <pre className="p-3 rounded-xl bg-[#050911] border border-slate-800 text-[11px] font-mono text-teal-300 overflow-x-auto">
            {assetLinksJson}
          </pre>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Google Play Store Bundle (.aab) Packaging Commands
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate a Play Store-ready Android App Bundle using Google Bubblewrap CLI.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyText('bubblewrap', bubblewrapCommands)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copiedId === 'bubblewrap' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy CLI</span>
                  </>
                )}
              </button>
            </div>

            <pre className="mt-4 p-3.5 rounded-xl bg-[#050911] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {bubblewrapCommands}
            </pre>
          </div>

          <div className="text-xs text-slate-400 border-t border-slate-800 pt-3 flex items-center justify-between">
            <span>Web App Manifest: /manifest.webmanifest</span>
            <span>Icons: 192px · 512px · 512px Maskable</span>
          </div>
        </div>
      </div>
    </div>
  );
};
