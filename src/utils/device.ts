import type { PairedDevice, Settings } from '../types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function asObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function generateLinkCode(len = 6): string {
  const n = Math.min(8, Math.max(6, len));
  const bytes = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < n; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

export function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeDeviceName(raw: unknown, fallback = '我的设备'): string {
  if (typeof raw !== 'string') return fallback;
  const s = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 32);
  return s || fallback;
}

export function normalizePairedDevices(raw: unknown): PairedDevice[] {
  if (!Array.isArray(raw)) return [];
  const out: PairedDevice[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const o = asObject(item);
    if (!o) continue;
    const id = typeof o.id === 'string' ? o.id.trim().slice(0, 80) : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = normalizeDeviceName(o.name, '设备');
    const lastSyncAt =
      typeof o.lastSyncAt === 'string' && o.lastSyncAt.trim()
        ? o.lastSyncAt.trim().slice(0, 40)
        : new Date().toISOString();
    out.push({ id, name, lastSyncAt });
  }
  return out.slice(0, 20);
}

export function normalizeLinkCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return s.length >= 4 ? s : null;
}

function guessDefaultDeviceName(): string {
  if (typeof navigator === 'undefined') return '我的设备';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return '我的 iPhone';
  if (/Android/i.test(ua)) return '我的 Android';
  if (/Mac/i.test(ua)) return '我的 Mac';
  if (/Windows/i.test(ua)) return '我的电脑';
  return '我的设备';
}

/** Ensure this browser has a stable deviceId + default name. */
export function ensureDeviceSettings(settings: Settings): Settings {
  const deviceId =
    typeof settings.deviceId === 'string' && settings.deviceId.trim()
      ? settings.deviceId.trim().slice(0, 80)
      : generateDeviceId();
  const deviceName = normalizeDeviceName(
    settings.deviceName && settings.deviceName !== '我的设备' ? settings.deviceName : guessDefaultDeviceName(),
    guessDefaultDeviceName(),
  );
  return {
    ...settings,
    deviceId,
    deviceName,
    linkCode: normalizeLinkCode(settings.linkCode),
    lastSyncUrl:
      typeof settings.lastSyncUrl === 'string' && settings.lastSyncUrl.trim()
        ? settings.lastSyncUrl.trim().slice(0, 500)
        : null,
    autoPullSync: settings.autoPullSync === true,
    knownDevices: normalizePairedDevices(settings.knownDevices),
  };
}

export function upsertDevice(list: PairedDevice[], device: PairedDevice): PairedDevice[] {
  const map = new Map(list.map((d) => [d.id, d]));
  const prev = map.get(device.id);
  if (!prev || (device.lastSyncAt && device.lastSyncAt >= (prev.lastSyncAt || ''))) {
    map.set(device.id, device);
  } else {
    map.set(device.id, { ...prev, name: device.name || prev.name });
  }
  return Array.from(map.values()).slice(0, 20);
}

export function mergeDevices(a: PairedDevice[], b: PairedDevice[]): PairedDevice[] {
  let out = [...a];
  for (const d of b) out = upsertDevice(out, d);
  return out;
}
