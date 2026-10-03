export type AgentRisk = 1 | 2 | 3;

export const WINDOWS = ["1m", "5m", "10m", "15m"] as const;
export type WindowCode = (typeof WINDOWS)[number];

export type CatalogAgent = {
  key: "btc11" | "scout04";
  title: string;
  chainName: string;
  market: string;
  risk: AgentRisk;
  windows: string;
};

export const CATALOG: CatalogAgent[] = [
  {
    key: "btc11",
    title: "Bitcoin Windows #11",
    chainName: "Bitcoin Windows #11",
    market: "BTC 15m",
    risk: 2,
    windows: "15m",
  },
  {
    key: "scout04",
    title: "Events Scout #04",
    chainName: "Events Scout #04",
    market: "Events",
    risk: 1,
    windows: "15m",
  },
];

export type AgentRun = {
  key: CatalogAgent["key"];
  tokenId: string;
  status: "running" | "stopped";
  windows: string;
  risk: AgentRisk;
};

export type PendingChange = {
  key: CatalogAgent["key"];
  tokenId: string;
  windows: string;
  risk: AgentRisk;
  chainName: string;
};

const RUN_KEY = "solarchik.agent.run";
const PENDING_KEY = "solarchik.agent.pending";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function readRun(): AgentRun | null {
  if (typeof localStorage === "undefined") return null;
  const row = readJson<AgentRun>(RUN_KEY);
  if (!row || (row.key !== "btc11" && row.key !== "scout04")) return null;
  if (row.status !== "running" && row.status !== "stopped") return null;
  return row;
}

export function writeRun(run: AgentRun | null) {
  if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
  else localStorage.removeItem(RUN_KEY);
}

export function readPending(): PendingChange | null {
  if (typeof localStorage === "undefined") return null;
  return readJson<PendingChange>(PENDING_KEY);
}

export function writePending(pending: PendingChange | null) {
  if (pending) localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  else localStorage.removeItem(PENDING_KEY);
}

export function catalogByKey(key: string) {
  return CATALOG.find((item) => item.key === key) || null;
}

export function parseStored(name: string): { key: CatalogAgent["key"]; windows: WindowCode | null } | null {
  const card = CATALOG.find((item) => name.startsWith(item.chainName));
  if (!card) return null;
  let windows: WindowCode | null = null;
  if (/15m/.test(name)) windows = "15m";
  else if (/10m/.test(name)) windows = "10m";
  else if (/(?:^|[^0-9])5m/.test(name)) windows = "5m";
  else if (/(?:^|[^0-9])1m/.test(name)) windows = "1m";
  return { key: card.key, windows };
}

export function strategyName(card: CatalogAgent, windows: string) {
  return `${card.chainName} · ${windows}`;
}

export function riskWord(risk: AgentRisk, uk: boolean) {
  if (risk === 1) return uk ? "спокійний" : "calm";
  if (risk === 3) return uk ? "ризиковий" : "risky";
  return uk ? "збалансований" : "balanced";
}

export function windowsPhrase(windows: string, uk: boolean) {
  if (windows === "1m") return uk ? "1 хвилина" : "1-minute markets";
  if (windows === "5m") return uk ? "5 хвилин" : "5-minute markets";
  if (windows === "10m") return uk ? "10 хвилин" : "10-minute markets";
  if (windows === "15m") return uk ? "15 хвилин" : "15-minute markets";
  if (windows === "15m+1h") return uk ? "вікна 15 хвилин і 1 година" : "15-minute and 1-hour markets";
  if (windows === "1h") return uk ? "вікно 1 година" : "1-hour markets";
  return windows;
}

function askedWindow(text: string): WindowCode | null {
  const t = text.toLowerCase();
  let code: WindowCode | null = null;
  if (/15\s*(m\b|min|minute|хв)|fifteen|п.?ятнадцять/.test(t)) code = "15m";
  else if (/10\s*(m\b|min|minute|хв)|ten\s*minute|десять/.test(t)) code = "10m";
  else if (/(?:^|[^0-9])5\s*(m\b|min|minute|хв)|five\s*minute|п.?ять/.test(t)) code = "5m";
  else if (/(?:^|[^0-9])1\s*(m\b|min|minute|хв)|one\s*minute|одн[аеу]/.test(t)) code = "1m";
  if (!code) return null;
  if (/change|set|switch|window|market|змін|постав|зроби|вікн|хв|min|minute/.test(t)) return code;
  return null;
}

export function proposeWindow(windows: WindowCode, locale: string): { text: string; pending?: PendingChange } {
  const uk = locale === "uk";
  const run = readRun();
  const card = run ? catalogByKey(run.key) : null;
  if (!run || !card || run.status !== "running") {
    return {
      text: uk
        ? "Агент не біжить. Візьми Bitcoin Windows #11 на столі. Угоду не відправлено."
        : "No agent is running. Get Bitcoin Windows #11 on the work desk. No order was sent.",
    };
  }
  const pending: PendingChange = {
    key: run.key,
    tokenId: run.tokenId,
    windows,
    risk: run.risk,
    chainName: strategyName(card, windows),
  };
  writePending(pending);
  const risk = riskWord(run.risk, uk);
  const label = windowsPhrase(windows, uk);
  return {
    pending,
    text: uk
      ? `Готую ${card.title} на ${label}, ризик ${risk}. Картка підтвердження на столі. Це підпис зміни NFT, не угода.`
      : `I'll set ${card.title} to ${label} with ${risk} risk. A confirmation card is on the work desk. That signs the NFT change, not a trade.`,
  };
}

function explicitStrategy(text: string) {
  return /strateg|стратег/i.test(text);
}

export function agentAnswer(text: string, locale: string): { text: string; pending?: PendingChange } | null {
  if (!explicitStrategy(text)) return null;
  return deskAnswer(text, locale);
}

export function deskAnswer(text: string, locale: string): { text: string; pending?: PendingChange } | null {
  const window = askedWindow(text);
  if (window) return proposeWindow(window, locale);
  if (!explicitStrategy(text) && !/agent|агент/i.test(text)) return null;
  const uk = locale === "uk";
  const run = readRun();
  const card = run ? catalogByKey(run.key) : null;
  if (!run || !card || run.status !== "running") {
    return {
      text: uk
        ? "Агент не біжить. Візьми Bitcoin Windows #11 на столі. Угоду не відправлено."
        : "No agent is running. Get Bitcoin Windows #11 on the work desk. No order was sent.",
    };
  }
  const risk = riskWord(run.risk, uk);
  return {
    text: uk
      ? `Працює ${card.title} на папері: ${windowsPhrase(run.windows, true)}, ризик ${risk}. Це записано в NFT #${run.tokenId}. Угоду не відправлено.`
      : `You have ${card.title} running on paper with ${windowsPhrase(run.windows, false)} in ${risk} risk. That is stored on NFT #${run.tokenId}. No order was sent.`,
  };
}
