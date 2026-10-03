export type AgentRisk = 1 | 2 | 3;

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
    windows: "15m+1h",
  },
  {
    key: "scout04",
    title: "Events Scout #04",
    chainName: "Events Scout #04",
    market: "Events",
    risk: 1,
    windows: "1h",
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

export function riskWord(risk: AgentRisk, uk: boolean) {
  if (risk === 1) return uk ? "спокійний" : "calm";
  if (risk === 3) return uk ? "ризиковий" : "risky";
  return uk ? "збалансований" : "balanced";
}

function windowsPhrase(windows: string, uk: boolean) {
  if (windows === "5m") return uk ? "5 хвилин" : "5-minute markets";
  if (windows === "15m+1h") return uk ? "вікна 15 хвилин і 1 година" : "15-minute and 1-hour markets";
  if (windows === "1h") return uk ? "вікно 1 година" : "1-hour markets";
  return windows;
}

function wantsStrategy(text: string) {
  return /what(?:'s| is) my strategy|my strategy|which agent|яка (?:моя )?стратег|моя стратегія|що за стратегі/i.test(text);
}

function wantsFive(text: string) {
  return /(?:change|set|switch|змін|постав|зроби).{0,40}(?:5|five|п.?ять)|(?:5|five|п.?ять).{0,24}(?:min|minute|хв|minutes)|5m markets/i.test(
    text,
  );
}

export function agentAnswer(text: string, locale: string): { text: string; pending?: PendingChange } | null {
  const ask = wantsStrategy(text);
  const five = wantsFive(text);
  if (!ask && !five) return null;
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
  if (five) {
    const pending: PendingChange = {
      key: run.key,
      tokenId: run.tokenId,
      windows: "5m",
      risk: run.risk,
      chainName: `${card.chainName} 5m`,
    };
    writePending(pending);
    const risk = riskWord(run.risk, uk);
    return {
      pending,
      text: uk
        ? `Готую ${card.title} на вікна 5 хвилин, ризик ${risk}. Картка підтвердження на столі. Це підпис зміни NFT, не угода.`
        : `I'll set ${card.title} to 5-minute markets with ${risk} risk. A confirmation card is on the work desk. That signs the NFT change, not a trade.`,
    };
  }
  const risk = riskWord(run.risk, uk);
  return {
    text: uk
      ? `Працює ${card.title} на папері: ${windowsPhrase(run.windows, true)}, ризик ${risk}. Угоду не відправлено.`
      : `You have ${card.title} running on paper with ${windowsPhrase(run.windows, false)} in ${risk} risk. No order was sent.`,
  };
}
