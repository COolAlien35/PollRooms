/**
 * lib/fingerprint.ts
 *
 * Anti-Abuse Mechanism #1 — Device Fingerprinting
 * Uses @fingerprintjs/fingerprintjs (open-source) to generate a
 * stable, unique visitor ID based on browser + hardware signals.
 *
 * Falls back to SHA-256 of browser properties if FingerprintJS fails.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedFingerprint: string | null = null;

/**
 * Returns a stable device fingerprint string (≤ 32 chars).
 *
 * The result is cached in memory so subsequent calls are instant.
 * The fingerprint is per-device, not per-poll — the backend
 * enforces uniqueness per (poll_id, voter_fingerprint).
 */
export async function getDeviceFingerprint(): Promise<string> {
    if (cachedFingerprint) return cachedFingerprint;

    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        // visitorId is a stable hash of 50+ browser signals
        cachedFingerprint = result.visitorId.slice(0, 32);
        return cachedFingerprint;
    } catch (err) {
        console.warn('FingerprintJS failed, falling back to manual hash:', err);
        return fallbackFingerprint();
    }
}

// ─── Fallback: SHA-256 of browser properties ──────────────
async function fallbackFingerprint(): Promise<string> {
    const signals = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        sessionStorage: !!window.sessionStorage,
        localStorage: !!window.localStorage,
        canvasHash: getCanvasFingerprint(),
    };

    const raw = JSON.stringify(signals);
    const hash = await sha256(raw);
    cachedFingerprint = hash.slice(0, 32);
    return cachedFingerprint;
}

async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCanvasFingerprint(): string {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'no-canvas';

        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('fingerprint', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('fingerprint', 4, 17);

        return canvas.toDataURL().slice(0, 100);
    } catch {
        return 'canvas-error';
    }
}
