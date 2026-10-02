import { BaseError } from "viem";

export type TxFail = "rejected" | "tooSoon" | "locked" | "other";

export function classifyTx(err: unknown): TxFail {
  const msg = (
    err instanceof BaseError ? err.shortMessage : err instanceof Error ? err.message : ""
  ).toLowerCase();
  if (msg.includes("user rejected") || msg.includes("user denied") || msg.includes("rejected the")) {
    return "rejected";
  }
  if (msg.includes("too soon")) return "tooSoon";
  if (msg.includes("sale locked")) return "locked";
  return "other";
}

export function formatCountdown(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}
