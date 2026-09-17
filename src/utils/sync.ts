import type { AppState, Settings } from '../types';
import {
  ensureDeviceSettings,
  mergeDevices,
  normalizeLinkCode,
  normalizePairedDevices,
  upsertDevice,
} from './device';
import { importJson } from './storage';
import { ensurePigWallet } from './wallets';
import type { PairedDevice } from '../types';

export const SYNC_KIND = 'zhangben-sync' as const;
export const SYNC_VERSION = 1;
export const SYNC_MAX_BYTES = 2_000_000;
export const PAIR_BASE_URL = 'https://haytham-fu.github.io/zhangben/';

export type SyncImportMode = 'merge' | 'replace';

export type { PairedDevice } from '../types';
export {
  generateLinkCode,
  generateDeviceId,
  normalizeDeviceName,
  normalizePairedDevices,
  normalizeLinkCode,
  ensureDeviceSettings,
} from './device';

export interface SyncPackMeta {
  kind: typeof SYNC_KIND;
  version: number;
  exportedAt: string;
  linkCode?: string | null;
  devices?: PairedDevice[];
}

export type SyncPack = AppState & Partial<SyncPackMeta>;

export interface ParsedSyncPack {
  state: AppState;
  linkCode: string | null;
  devices: PairedDevice[];
  exportedAt: string | null;
}

export interface SyncMergeResult {
  state: AppState;
  addedTx: number;
  addedWallets: number;
  addedPantry: number;
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function syncExportFilename(linkCode?: string | null, d: Date = new Date()): string {
  const code = normalizeLinkCode(linkCode);
  if (code) return `zhangben-sync-${code}.json`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `zhangben-sync-${stamp}.json`;
}

export function pairDeepLink(linkCode: string): string {
  const code = normalizeLinkCode(linkCode) ?? linkCode;
  const base = PAIR_BASE_URL.endsWith('/') ? PAIR_BASE_URL : `${PAIR_BASE_URL}/`;
  return `${base}?pair=${encodeURIComponent(code)}`;
}

/** Build sync JSON with pairing meta + current device stamped. */
export function buildSyncPackJson(state: AppState): string {
  const settings = ensureDeviceSettings(state.settings);
  const now = new Date().toISOString();
  const self: PairedDevice = {
    id: settings.deviceId!,
    name: settings.deviceName!,
    lastSyncAt: now,
  };
  const devices = upsertDevice(settings.knownDevices ?? [], self);
  const pack: SyncPack = {
    kind: SYNC_KIND,
    version: SYNC_VERSION,
    exportedAt: now,
    linkCode: settings.linkCode ?? null,
    devices,
    settings: { ...settings, knownDevices: devices },
    transactions: state.transactions,
    categories: state.categories,
    wallets: state.wallets,
    pantryItems: state.pantryItems,
  };
  return JSON.stringify(pack, null, 2);
}

export function parseSyncPack(text: string): ParsedSyncPack {
  if (text.length > SYNC_MAX_BYTES) {
    throw new Error('同步包过大（上限约 2MB）');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('同步包不是有效 JSON');
  }
  const obj = asObject(raw);
  if (!obj) throw new Error('同步包格式无效');

  if (
    obj.settings &&
    typeof obj.settings === 'object' &&
    !Array.isArray(obj.transactions) &&
    obj.transactions === undefined &&
    (typeof obj.name === 'string' || typeof obj.label === 'string' || typeof obj.id === 'string') &&
    obj.kind !== SYNC_KIND &&
    !('wallets' in obj) &&
    !('categories' in obj)
  ) {
    throw new Error('这是个人计划配置，请用「导入个人计划配置」；关联设备请用同步文件');
  }

  if (obj.kind != null && obj.kind !== SYNC_KIND) {
    throw new Error('无法识别的同步包类型');
  }

  const linkCode = normalizeLinkCode(obj.linkCode);
  const devices = normalizePairedDevices(obj.devices);
  const exportedAt = typeof obj.exportedAt === 'string' ? obj.exportedAt : null;

  const { kind: _k, version: _v, exportedAt: _e, linkCode: _c, devices: _d, ...rest } = obj;
  const state = importJson(JSON.stringify(rest));
  const known = devices.length > 0 ? devices : normalizePairedDevices(state.settings.knownDevices);
  const code = linkCode ?? normalizeLinkCode(state.settings.linkCode);
  return {
    state: {
      ...state,
      settings: ensureDeviceSettings({
        ...state.settings,
        linkCode: code,
        knownDevices: known,
      }),
    },
    linkCode: code,
    devices: known,
    exportedAt,
  };
}

function mergeById<T extends { id: string }>(local: T[], incoming: T[]): { list: T[]; added: number } {
  const map = new Map(local.map((x) => [x.id, x]));
  let added = 0;
  for (const item of incoming) {
    if (!item?.id) continue;
    if (!map.has(item.id)) {
      map.set(item.id, item);
      added += 1;
    }
  }
  return { list: Array.from(map.values()), added };
}

export function mergeSyncIntoLocal(local: AppState, remote: AppState): SyncMergeResult {
  const localS = ensureDeviceSettings(local.settings);
  const remoteS = ensureDeviceSettings(remote.settings);

  const tx = mergeById(local.transactions, remote.transactions);
  const walletsMerge = mergeById(local.wallets, remote.wallets);
  const pantry = mergeById(local.pantryItems ?? [], remote.pantryItems ?? []);

  const now = new Date().toISOString();
  const devices = mergeDevices(
    mergeDevices(localS.knownDevices ?? [], remoteS.knownDevices ?? []),
    [
      { id: localS.deviceId!, name: localS.deviceName!, lastSyncAt: now },
      {
        id: remoteS.deviceId!,
        name: remoteS.deviceName!,
        lastSyncAt:
          remoteS.knownDevices?.find((d) => d.id === remoteS.deviceId)?.lastSyncAt || now,
      },
    ],
  );

  const linkCode = normalizeLinkCode(remoteS.linkCode) ?? normalizeLinkCode(localS.linkCode);

  const settings: Settings = ensureDeviceSettings({
    ...remoteS,
    deviceId: localS.deviceId,
    deviceName: localS.deviceName,
    linkCode,
    lastSyncUrl:
      remoteS.lastSyncUrl !== undefined && remoteS.lastSyncUrl !== null
        ? remoteS.lastSyncUrl
        : localS.lastSyncUrl ?? null,
    autoPullSync: localS.autoPullSync === true || remoteS.autoPullSync === true,
    knownDevices: devices,
  });

  const categories =
    remote.categories && remote.categories.length > 0 ? remote.categories : local.categories;

  return {
    state: {
      settings,
      transactions: tx.list,
      categories,
      wallets: ensurePigWallet(walletsMerge.list),
      pantryItems: pantry.list,
    },
    addedTx: tx.added,
    addedWallets: walletsMerge.added,
    addedPantry: pantry.added,
  };
}

export function assertHttpsUrl(url: string): URL {
  const u = url.trim();
  if (!/^https:\/\//i.test(u)) {
    throw new Error('请输入以 https:// 开头的链接');
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error('链接格式无效');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('仅支持 https 链接');
  }
  if (parsed.username || parsed.password) {
    throw new Error('链接不能包含账号密码');
  }
  return parsed;
}

export async function fetchSyncPackFromUrl(url: string): Promise<ParsedSyncPack> {
  const parsed = assertHttpsUrl(url);
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(parsed.toString(), {
      credentials: 'omit',
      mode: 'cors',
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}）`);
    const len = res.headers.get('content-length');
    if (len && Number(len) > SYNC_MAX_BYTES) throw new Error('远程同步包过大');
    const text = await res.text();
    if (text.length > SYNC_MAX_BYTES) throw new Error('远程同步包过大');
    return parseSyncPack(text);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('下载超时');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export function consumePairCodeFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('pair');
  if (!raw) return null;
  const code = normalizeLinkCode(raw);
  const url = new URL(window.location.href);
  url.searchParams.delete('pair');
  const q = url.searchParams.toString();
  window.history.replaceState({}, '', url.pathname + (q ? `?${q}` : '') + url.hash);
  return code;
}
