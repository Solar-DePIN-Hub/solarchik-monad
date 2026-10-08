import { failOf, isOnline, type FailKind } from "./netErr";

const BASE = "https://solarchik-screen.davidbell1603.workers.dev";
const SESSION_USD = 0.2;

export type SecretarySummary = {
  caller_name: string;
  company: string;
  callback: string;
  intent: string;
  urgency: string;
  spam_risk: string;
  action: string;
  notes: string;
};

export type SecretaryReport = {
  at: number;
  summary: SecretarySummary;
  chargedUsd: number;
  usd: number;
};

export type SecretaryBalance = { userId: string; usd: number; sessionUsd: number };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function sessionCost(): number {
  return SESSION_USD;
}

export function makePlayerId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* old webview */
  }
  return `sol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function readPlayerId(raw: unknown): string {
  const s = str(raw);
  if (s.length >= 8 && s.length <= 80 && !/\s/.test(s)) return s;
  return makePlayerId();
}

export function emptySummary(): SecretarySummary {
  return {
    caller_name: "",
    company: "",
    callback: "",
    intent: "",
    urgency: "",
    spam_risk: "",
    action: "",
    notes: "",
  };
}

export function readSummary(raw: unknown): SecretarySummary {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    caller_name: str(o.caller_name),
    company: str(o.company),
    callback: str(o.callback),
    intent: str(o.intent),
    urgency: str(o.urgency),
    spam_risk: str(o.spam_risk),
    action: str(o.action),
    notes: str(o.notes),
  };
}

export function readReport(raw: unknown): SecretaryReport | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const at = Number(o.at);
  return {
    at: Number.isFinite(at) ? at : 0,
    summary: readSummary(o.summary),
    chargedUsd: Number(o.chargedUsd) || 0,
    usd: Number(o.usd) || 0,
  };
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function cleanSecretaryReply(raw: string): string {
  return raw
    .replace(/SUMMARY_JSON\s*=\s*\{[\s\S]*$/, "")
    .replace(/[*_#`>~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function getBalance(userId: string): Promise<SecretaryBalance> {
  const res = await fetch(`${BASE}/balance?userId=${encodeURIComponent(userId)}`, { method: "GET" });
  const j = await parseJson(res);
  return {
    userId,
    usd: Number(j.usd) || 0,
    sessionUsd: Number(j.sessionUsd) || SESSION_USD,
  };
}

export async function topupCredit(userId: string, usd = 5): Promise<SecretaryBalance> {
  const times = Math.max(1, Math.ceil(usd / 5));
  let last: SecretaryBalance = { userId, usd: 0, sessionUsd: SESSION_USD };
  for (let i = 0; i < times; i++) {
    const res = await fetch(`${BASE}/topup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, usd: 5, sig: "onchain" }),
    });
    const j = await parseJson(res);
    if (!res.ok) throw new Error("topup");
    last = {
      userId,
      usd: Number(j.usd) || 0,
      sessionUsd: SESSION_USD,
    };
  }
  return last;
}

export type ScreenOk = {
  ok: true;
  reply: string;
  summary: SecretarySummary;
  chargedUsd: number;
  usd: number;
};
export type ScreenNeed = { ok: false; needTopup: true; usd: number };
export type ScreenFail = { ok: false; needTopup: false; error: FailKind };

export async function screenCall(
  userId: string,
  text: string,
  contacts: string[] = [],
  locale = "uk",
): Promise<ScreenOk | ScreenNeed | ScreenFail> {
  if (!userId.trim() || !text.trim()) return { ok: false, needTopup: false, error: "bad" };
  if (!isOnline()) return { ok: false, needTopup: false, error: "offline" };
  const names = contacts.map((n) => n.trim()).filter(Boolean).slice(0, 40);
  const call = text.trim().slice(0, 900);
  const book =
    names.length === 0
      ? ""
      : locale === "uk"
        ? `ТЕЛЕФОННА КНИГА (цих людей секретар знає. НЕ переадресовуй їх дзвінки гравцю. Сам візьми слухавку і запиши суть): ${names.join(", ")}\n\nДЗВІНОК:\n`
        : `PHONE BOOK (these people are known. Do NOT redirect, transfer, or forward their calls to the player. Answer yourself and take a message): ${names.join(", ")}\n\nCALL:\n`;
  const tongue =
    locale === "uk"
      ? "МОВА: відповідай лише українською, навіть якщо абонент говорить іншою мовою.\n\n"
      : "LANGUAGE: reply only in English, even if the caller speaks another language.\n\n";
  const body = JSON.stringify({
    userId,
    locale,
    text: `${tongue}${book}${call}`.slice(0, 1400),
    contacts: names,
  });
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ac ? window.setTimeout(() => ac.abort(), 35000) : 0;
  try {
    const res = await fetch(`${BASE}/screen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: ac?.signal,
    });
    const j = await parseJson(res);
    if (res.status === 402 || str(j.error) === "NEED_TOPUP") {
      return { ok: false, needTopup: true, usd: Number(j.usd) || 0 };
    }
    if (!res.ok) return { ok: false, needTopup: false, error: res.status >= 500 ? "bad" : "empty" };
    let reply = cleanSecretaryReply(str(j.reply));
    if (!reply) return { ok: false, needTopup: false, error: "empty" };
    let summary = readSummary(j.summary);
    const known = matchKnown(`${summary.caller_name} ${summary.company} ${call}`, names);
    if (known) summary = applyKnownContact(summary, known);
    return {
      ok: true,
      reply,
      summary,
      chargedUsd: Number(j.chargedUsd) || SESSION_USD,
      usd: Number(j.usd) || 0,
    };
  } catch (e) {
    return { ok: false, needTopup: false, error: failOf(e) };
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

export type SecretaryMessage = {
  id: string;
  at: number;
  user: string;
  reply: string;
  summary: SecretarySummary;
  chargedUsd: number;
  usd: number;
  archived: boolean;
  read: boolean;
};

export function makeMessageId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readMessage(raw: unknown): SecretaryMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const at = Number(o.at);
  const user = str(o.user);
  const reply = str(o.reply);
  if (!reply && !user) return null;
  return {
    id: str(o.id) || makeMessageId(),
    at: Number.isFinite(at) ? at : 0,
    user,
    reply,
    summary: readSummary(o.summary),
    chargedUsd: Number(o.chargedUsd) || 0,
    usd: Number(o.usd) || 0,
    archived: Boolean(o.archived),
    read: Boolean(o.read),
  };
}

export function readInbox(raw: unknown, fallback: SecretaryReport | null): SecretaryMessage[] {
  const out: SecretaryMessage[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const m = readMessage(row);
      if (m) out.push(m);
    }
  }
  if (out.length === 0 && fallback) {
    out.push({
      id: `legacy-${fallback.at}`,
      at: fallback.at,
      user: "",
      reply: "",
      summary: fallback.summary,
      chargedUsd: fallback.chargedUsd,
      usd: fallback.usd,
      archived: false,
      read: true,
    });
  }
  return out.slice(0, 40);
}

export function headlineOf(m: SecretaryMessage): string {
  return m.summary.caller_name || m.summary.intent || m.summary.notes || m.user || m.reply;
}

export type PhoneContact = { id: string; name: string };

export function readContacts(raw: unknown): PhoneContact[] {
  if (!Array.isArray(raw)) return [];
  const out: PhoneContact[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const name = str(o.name).slice(0, 40);
    if (name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: str(o.id) || `c-${out.length}-${key}`, name });
    if (out.length >= 200) break;
  }
  return out;
}

export function matchKnown(hay: string, names: string[]): string | null {
  const blob = hay.toLowerCase();
  if (!blob.trim()) return null;
  let best: string | null = null;
  for (const n of names) {
    const x = n.trim().toLowerCase();
    if (x.length < 2) continue;
    if (blob.includes(x) && (!best || x.length > best.length)) best = n.trim();
  }
  return best;
}

export function applyKnownContact(summary: SecretarySummary, name: string): SecretarySummary {
  const action = summary.action.toLowerCase();
  const redirect = /redirect|forward|transfer|переадрес|перенаправ/.test(action);
  return {
    ...summary,
    caller_name: summary.caller_name || name,
    action: redirect || !summary.action ? "do not redirect" : summary.action,
    notes: summary.notes.includes(name) ? summary.notes : [summary.notes, `${name}: known, no redirect`].filter(Boolean).join(" · "),
  };
}

export function isKnownAction(action: string): boolean {
  return /do not redirect|known|не переадрес/i.test(action);
}

export function cleanE164(raw: string): string {
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^0\d{9}$/.test(s)) s = `+38${s}`;
  if (/^380\d{9}$/.test(s)) s = `+${s}`;
  if (s.startsWith("+") && s.length >= 11 && s.length <= 17) return s;
  if (/^\d{10,15}$/.test(s)) return `+${s}`;
  return "";
}

export function ussdForward(num: string): string {
  const d = cleanE164(num).replace(/\D/g, "");
  return d ? `**21*${d}#` : "";
}

export function ussdCancel(): string {
  return "##21#";
}

export function stampMessage(
  user: string,
  reply: string,
  report: SecretaryReport,
): SecretaryMessage {
  return {
    id: makeMessageId(),
    at: report.at || Date.now(),
    user,
    reply,
    summary: report.summary,
    chargedUsd: report.chargedUsd,
    usd: report.usd,
    archived: false,
    read: false,
  };
}

/** Zadarma line the secretary answers. Same default as the phone app. */
export const ASSISTANT_LINE = "+380914810885";

/** International only, so the MMI code cannot be altered by the typed text. */
export function cleanForwardNumber(raw: string): string {
  let t = raw.trim().replace(/[\s.\-()\u00A0]/g, "");
  if (t.startsWith("00")) t = `+${t.slice(2)}`;
  if (!t.startsWith("+")) return "";
  const digits = t.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(digits)) return "";
  return `+${digits}`;
}

export function forwardOnCode(kind: "61" | "67" | "62", number = ASSISTANT_LINE): string {
  const n = cleanForwardNumber(number);
  return n ? `**${kind}*${n}#` : "";
}

export function forwardOffAll(): string {
  return "##004#";
}

export function dialHref(code: string): string {
  return `tel:${encodeURIComponent(code)}`;
}

export type LiveCall = {
  callId: string;
  caller: string;
  text: string;
  at: number;
  status: string;
  callerName: string;
  intent: string;
  notes: string;
  callback: string;
  durationSec: number | null;
  reason: string;
};

export type TranscriptLine = { caller: boolean; text: string };

function canonCall(id: string): string {
  return id.replace(/^(rtc|live)_/, "");
}

export function parseCalls(raw: unknown): LiveCall[] {
  const items = raw && typeof raw === "object" ? (raw as { items?: unknown }).items : null;
  if (!Array.isArray(items)) return [];
  const all: LiveCall[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const text = str(o.text);
    const callId = str(o.callId);
    if (!text && !callId) continue;
    const s = o.summary && typeof o.summary === "object" ? (o.summary as Record<string, unknown>) : {};
    const dur = Number(o.durationSec);
    all.push({
      callId,
      caller: str(o.caller),
      text: text.slice(0, 600),
      at: Number(o.at) || 0,
      status: str(o.status) || (str(o.callId) ? "pending" : "done"),
      callerName: str(s.caller_name).slice(0, 60),
      intent: str(s.intent).slice(0, 200),
      notes: str(s.notes).slice(0, 400),
      callback: str(s.callback).slice(0, 40),
      durationSec: Number.isFinite(dur) && dur > 0 ? Math.floor(dur) : null,
      reason: str(o.reason).slice(0, 40),
    });
  }
  const good = new Set(all.filter((it) => it.callId && it.status !== "failed").map((it) => canonCall(it.callId)));
  const seen = new Set<string>();
  const out: LiveCall[] = [];
  for (const it of all) {
    if (it.callId && it.status === "failed" && good.has(canonCall(it.callId))) continue;
    const key = it.callId || `vm:${it.at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 40);
}

export async function listCalls(userId: string): Promise<LiveCall[] | null> {
  if (!userId.trim()) return null;
  try {
    const res = await fetch(`${BASE}/inbox?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    return parseCalls(await parseJson(res));
  } catch {
    return null;
  }
}

/** Tells the phone line which language to answer in. Same switch as Solarchik. */
export async function setSecretaryLang(userId: string, _locale: string): Promise<"en" | "uk" | null> {
  if (!userId.trim()) return null;
  const lang = "en";
  try {
    const res = await fetch(`${BASE}/secretary-lang`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, lang }),
    });
    if (!res.ok) return null;
    const got = str((await parseJson(res)).lang);
    return got === "en" || got === "uk" ? got : lang;
  } catch {
    return null;
  }
}

/** Arms the shared line so the next call is filed under this player. Returns seconds, or null. */
export async function claimLine(userId: string, _locale = "uk"): Promise<number | null> {
  if (!userId.trim()) return null;
  const lang = "en";
  try {
    const res = await fetch(`${BASE}/call-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, lang }),
    });
    if (!res.ok) return null;
    const n = Number((await parseJson(res)).armedSec);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function callTranscript(userId: string, callId: string): Promise<TranscriptLine[] | null> {
  if (!userId.trim() || !callId.trim()) return null;
  try {
    const res = await fetch(`${BASE}/call?userId=${encodeURIComponent(userId)}&callId=${encodeURIComponent(callId)}`);
    if (!res.ok) return null;
    const lines = (await parseJson(res)).lines;
    if (!Array.isArray(lines)) return [];
    const out: TranscriptLine[] = [];
    for (const row of lines) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const who = str(o.who || o.role || o.from).toLowerCase();
      const text = str(o.text).slice(0, 500);
      if (!text) continue;
      out.push({ caller: who === "caller" || who === "user" || who === "human" || who === "in", text });
    }
    return out;
  } catch {
    return null;
  }
}

