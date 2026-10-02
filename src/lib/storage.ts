import { parseAddress } from "@/lib/chain";

export type TxKind = "check-in" | "mint" | "update" | "transfer";

export type SavedTx = {
  hash: string;
  at: number;
  kind: TxKind;
  note: string;
};

export type Save = {
  version: 1;
  suns: number;
  bestSuns: number;
  bestDistance: number;
  txs: SavedTx[];
};

export type ContractPair = {
  streak: `0x${string}` | null;
  strategy: `0x${string}` | null;
  streakSource: "device" | "env" | "missing";
  strategySource: "device" | "env" | "missing";
};

const SAVE_KEY = "solarchik.v1";
const CONTRACT_KEY = "solarchik.contracts";
const LANG_KEY = "solarchik.lang";
const MUTE_KEY = "solarchik.mute";

export const EMPTY_SAVE: Save = {
  version: 1,
  suns: 0,
  bestSuns: 0,
  bestDistance: 0,
  txs: [],
};

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeStore(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function canStore() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readSave(): Save {
  if (!canStore()) return EMPTY_SAVE;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return EMPTY_SAVE;
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (parsed.version !== 1) return EMPTY_SAVE;
    return {
      version: 1,
      suns: Number(parsed.suns) || 0,
      bestSuns: Number(parsed.bestSuns) || 0,
      bestDistance: Number(parsed.bestDistance) || 0,
      txs: Array.isArray(parsed.txs) ? parsed.txs.slice(0, 12) : [],
    };
  } catch {
    return EMPTY_SAVE;
  }
}

function writeSave(save: Save) {
  if (!canStore()) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  emit();
}

export function addRun(suns: number, distance: number) {
  const prev = readSave();
  const next: Save = {
    ...prev,
    suns: prev.suns + suns,
    bestSuns: Math.max(prev.bestSuns, suns),
    bestDistance: Math.max(prev.bestDistance, Math.floor(distance)),
  };
  writeSave(next);
  return next;
}

export function addTx(tx: SavedTx) {
  const prev = readSave();
  writeSave({ ...prev, txs: [tx, ...prev.txs].slice(0, 12) });
}

type DeviceContracts = { streak?: string; strategy?: string };

function readDevice(): DeviceContracts {
  if (!canStore()) return {};
  try {
    const raw = localStorage.getItem(CONTRACT_KEY);
    return raw ? (JSON.parse(raw) as DeviceContracts) : {};
  } catch {
    return {};
  }
}

function envAddress(key: "VITE_STREAK_ADDRESS" | "VITE_STRATEGY_ADDRESS") {
  const value = import.meta.env[key];
  return typeof value === "string" ? value : undefined;
}

function resolveOne(
  device: string | undefined,
  env: string | undefined,
): { address: `0x${string}` | null; source: "device" | "env" | "missing" } {
  const fromDevice = parseAddress(device);
  if (fromDevice) return { address: fromDevice, source: "device" };
  const fromEnv = parseAddress(env);
  if (fromEnv) return { address: fromEnv, source: "env" };
  return { address: null, source: "missing" };
}

export function readContracts(): ContractPair {
  const device = readDevice();
  const streak = resolveOne(device.streak, envAddress("VITE_STREAK_ADDRESS"));
  const strategy = resolveOne(device.strategy, envAddress("VITE_STRATEGY_ADDRESS"));
  return {
    streak: streak.address,
    strategy: strategy.address,
    streakSource: streak.source,
    strategySource: strategy.source,
  };
}

export function saveContractOverride(next: { streak: string; strategy: string }) {
  if (!canStore()) return;
  const streak = parseAddress(next.streak);
  const strategy = parseAddress(next.strategy);
  if (!streak || !strategy) return false;
  localStorage.setItem(CONTRACT_KEY, JSON.stringify({ streak, strategy }));
  emit();
  return true;
}

export function clearContractOverride() {
  if (!canStore()) return;
  localStorage.removeItem(CONTRACT_KEY);
  emit();
}

export function readLang(): "en" | "uk" | null {
  if (!canStore()) return null;
  const value = localStorage.getItem(LANG_KEY);
  return value === "uk" || value === "en" ? value : null;
}

export function writeLang(lang: "en" | "uk") {
  if (!canStore()) return;
  localStorage.setItem(LANG_KEY, lang);
}

export function readMute() {
  if (!canStore()) return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function writeMute(muted: boolean) {
  if (!canStore()) return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

export function browserLang(): "en" | "uk" {
  if (typeof navigator === "undefined") return "en";
  const code = navigator.language.toLowerCase();
  return code.startsWith("uk") ? "uk" : "en";
}
