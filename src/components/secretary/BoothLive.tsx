import { useEffect, useRef, useState, type ComponentType } from "react";
import { Phone } from "lucide-react";
import { parseEther } from "viem";
import { detectLocale } from "@/lib/game/i18n";
import {
  ASSISTANT_LINE,
  callTranscript,
  claimLine,
  cleanForwardNumber,
  listCalls,
  makePlayerId,
  screenCall,
  setSecretaryLang,
  type LiveCall,
  type SecretarySummary,
  type TranscriptLine,
} from "@/lib/game/secretary";
import { filledOn, fwdName, fwdRule, readFwdId, sortedFwd } from "@/lib/game/fwd";
import { nativeUssd } from "@/lib/game/buddyNet";
import { monadAddressUrl, monadTxUrl, connectMonad, listBrowserWallets, readMonBalance, readMonTransfer, type NamedWallet } from "@/lib/game/monadClock";
import { mintUrl, passContract, readPass, type PassRead } from "@/lib/cvi";
import { createAccount, hasPasskey, openAccount, passkeyFailed } from "@/lib/passkey";
import { emptyWallet, type WalletApi, type WalletRow } from "./walletApi";

const ID_KEY = "solarchik-secretary-id";
const SESSION_KEY = "solarchik-booth-session";
const CALL_MON = 0.01;
const TOPUP_MON = 0.05;
const CREDIT_KEY = "solarchik-booth-credit";
const SESSION_MS = 12 * 60 * 60 * 1000;
const LANG_KEY = "solarchik-secretary-lang";
const THEME_KEY = "solarchik-secretary-theme";
const LINE_KEY = "solarchik-secretary-line";
const COUNTRY_KEY = "solarchik-secretary-country";
const CALLS_KEY = "solarchik-secretary-calls";
const FAUCET = "https://faucet.monad.xyz";

type Lang = "en" | "uk";

const copy = {
  en: {
    kicker: "Night booth",
    night: "Night",
    day: "Day",
    langNote: "The phone answers in this language.",
    langEn: "Answering in English.",
    langUk: "Answering in Ukrainian.",
    langFail: "The line did not take the language. Press EN again.",
    dial: "Call this number. The talk shows under the handset.",
    codes: "Codes",
    title: "Secretary",
    lead: "The passkey is the account: it makes two keys. A browser wallet only lets us read a pass you already hold. Privy is the payer. It sends test MON to the agent key, so a judge does not need MetaMask.",
    recheck: "Check key",
    browser: "Check browser wallet",
    changeWallet: "Change wallet",
    whichWallet: "Which wallet holds the pass?",
    browserShort: "Browser",
    noBrowser: "No browser wallet.",
    chain: "Chain",
    credit: "Credit",
    price: "A call",
    call: "The call",
    placeholder: "Who called, and what did they want?",
    pick: "Pick up",
    hang: "Hang up",
    waiting: "Listening…",
    silent: "No reply.",
    need: "No credit. Top up 0.05 MON. That is 5 calls.",
    callsLeft: "{n} calls left",
    topup: "Top up from Privy",
    added: "Added {mon} MON · {n} calls.",
    topupMiss: "The transfer landed, but the chain has not shown it yet.",
    empty: "Write the call first.",
    needAccount: "Open the account first.",
    account: "Account",
    create: "Create account",
    unlock: "Open account",
    noAccount: "No account yet.",
    accountFail: "Passkey did not open.",
    accountCancel: "Cancelled.",
    seed: "One passkey, two keys. Each one signs, and the signature has to match that address.",
    fund: "Send 0.01 MON",
    funded: "Sent to the agent key.",
    txFail: "The transfer did not send.",
    needAgent: "Open the passkey first.",
    needPrivy: "Connect Privy first. The browser wallet does not pay the agent.",
    keyYou: "You · …/0",
    keyAgent: "Agent · …/1",
    pay: "Privy",
    connect: "Connect Privy",
    privyWait: "Privy is still opening.",
    privyMake: "Creating the Privy wallet…",
    privyFail: "The Privy wallet was not created. Press Connect Privy again.",
    noWallet: "Not connected.",
    mon: "MON",
    faucet: "Test MON",
    note: "Privy is not the account. Top up sends 0.05 MON from this wallet to the agent key. That is 5 calls.",
    pass: "Pass",
    passOpen: "Pass open",
    passClosed: "No pass",
    passFail: "Check unavailable",
    passLook: "Checking the pass…",
    mint: "Get a pass",
    copy: "Copy",
    copied: "Copied.",
    who: "Who",
    why: "Why",
    next: "Next",
    line: "Your number",
    linePh: "+380…",
    lineBad: "Use the international number, like +380…",
    assist: "Assistant",
    country: "SIM country",
    fwdOn: "Turn on",
    fwdOff: "Turn off",
    fwdAsk: "Check",
    codeOn: "On",
    codeOff: "Off",
    codeAsk: "Check",
    fwdHint: "Pick the country of the SIM. From abroad the number starts with that country's exit code, 00 or 011. Nothing is forwarded until the phone confirms.",
    armed: "Calls to the assistant are filed here for {n} s.",
    claimMiss: "The line was not linked. The code is still in the phone.",
    archive: "Archive",
    archiveEmpty: "Archive is empty. A call appears here only after the assistant answers it.",
    archiveMiss: "The archive did not open. Showing the last saved list.",
    archiveDown: "The archive did not open.",
    statusDone: "Answered",
    statusPending: "Still writing",
    statusFailed: "Did not connect",
    statusTopup: "No credit",
    statusBlocked: "Blocked",
    you: "You",
    caller: "Caller",
    sol: "Assistant",
  },
  uk: {
    kicker: "Нічна будка",
    night: "Ніч",
    day: "День",
    langNote: "Телефон відповідає цією мовою.",
    langEn: "Відповідає англійською.",
    langUk: "Відповідає українською.",
    langFail: "Лінія не прийняла мову. Натисни EN ще раз.",
    dial: "Дзвони на цей номер. Розмова з’явиться під слухавкою.",
    codes: "Коди",
    title: "Секретар",
    lead: "Passkey — це рахунок: з нього виходять два ключі. Гаманець браузера лише читає пас, який у тебе вже є. Privy — платник: він шле тестовий MON на ключ агента, тож судді не потрібен MetaMask.",
    recheck: "Перевірити ключ",
    browser: "Перевірити гаманець",
    changeWallet: "Змінити гаманець",
    whichWallet: "У якому гаманці лежить пас?",
    browserShort: "Браузер",
    noBrowser: "Немає гаманця в браузері.",
    chain: "Мережа",
    credit: "Кредит",
    price: "Дзвінок",
    call: "Дзвінок",
    placeholder: "Хто дзвонив і чого хотів?",
    pick: "Взяти слухавку",
    hang: "Покласти",
    waiting: "Слухаю…",
    silent: "Відповіді немає.",
    need: "Немає кредиту. Поповни 0.05 MON. Це 5 дзвінків.",
    callsLeft: "Лишилось дзвінків: {n}",
    topup: "Поповнити з Privy",
    added: "Поповнено {mon} MON · {n} дзвінків.",
    topupMiss: "Переказ пішов, але мережа його ще не показала.",
    empty: "Спочатку напиши дзвінок.",
    needAccount: "Спочатку рахунок.",
    account: "Рахунок",
    create: "Створити рахунок",
    unlock: "Відкрити рахунок",
    noAccount: "Рахунку ще немає.",
    accountFail: "Passkey не відкрився.",
    accountCancel: "Скасовано.",
    seed: "Один passkey, два ключі. Кожен підписує, і підпис має збігтися з його адресою.",
    fund: "Надіслати 0.01 MON",
    funded: "Надіслано на ключ агента.",
    txFail: "Переказ не пішов.",
    needAgent: "Спочатку passkey.",
    needPrivy: "Спочатку Privy. Гаманець браузера агенту не платить.",
    keyYou: "Ти · …/0",
    keyAgent: "Агент · …/1",
    pay: "Privy",
    connect: "Підключити Privy",
    privyWait: "Privy ще відкривається.",
    privyMake: "Створюю гаманець Privy…",
    privyFail: "Гаманець Privy не створився. Натисни Підключити Privy ще раз.",
    noWallet: "Не підключений.",
    mon: "MON",
    faucet: "Тестовий MON",
    note: "Privy не є рахунком. Поповнення шле 0.05 MON з цього гаманця на ключ агента. Це 5 дзвінків.",
    pass: "Пас",
    passOpen: "Пас відкритий",
    passClosed: "Паса немає",
    passFail: "Перевірка недоступна",
    passLook: "Дивлюсь пас…",
    mint: "Взяти пас",
    copy: "Копіювати",
    copied: "Скопійовано.",
    who: "Хто",
    why: "Навіщо",
    next: "Далі",
    line: "Твій номер",
    linePh: "+380…",
    lineBad: "Потрібен міжнародний номер, як +380…",
    assist: "Помічник",
    country: "Країна SIM",
    fwdOn: "Увімкнути",
    fwdOff: "Зняти",
    fwdAsk: "Перевірити",
    codeOn: "Увімкнути",
    codeOff: "Зняти",
    codeAsk: "Перевірити",
    fwdHint: "Обери країну SIM. З-за кордону перед номером стоїть вихід у міжнародний, 00 або 011. Поки телефон не підтвердив, переадресації немає.",
    armed: "Дзвінки на помічника {n} с пишуться в цей архів.",
    claimMiss: "Лінію не прив'язано. Код усе одно в телефоні.",
    archive: "Архів",
    archiveEmpty: "Архів порожній. Сюди падає дзвінок лише після того, як помічник його прийняв.",
    archiveMiss: "Архів не відкрився. Це останній збережений список.",
    archiveDown: "Архів не відкрився.",
    statusDone: "Відповів",
    statusPending: "Ще пише",
    statusFailed: "Не з'єдналось",
    statusTopup: "Немає кредиту",
    statusBlocked: "Заблоковано",
    you: "Ти",
    caller: "Той, хто дзвонив",
    sol: "Помічник",
  },
} as const;

function readSession(): { person: string; agent: string; browser: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || "") as { person?: unknown; agent?: unknown; browser?: unknown; at?: unknown };
    if (typeof raw.at !== "number" || Date.now() - raw.at > SESSION_MS) return null;
    const hex = (value: unknown) => (typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) ? value : "");
    const person = hex(raw.person);
    const agent = hex(raw.agent);
    if (!person || !agent) return null;
    return { person, agent, browser: hex(raw.browser) };
  } catch {
    return null;
  }
}

function remember(person: string, agent: string, browser: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(person) || !/^0x[a-fA-F0-9]{40}$/.test(agent)) return;
  const next = /^0x[a-fA-F0-9]{40}$/.test(browser) ? browser : "";
  localStorage.setItem(SESSION_KEY, JSON.stringify({ person, agent, browser: next, at: Date.now() }));
}

function writeLedger(row: { hashes: string[]; spent: number }) {
  localStorage.setItem(CREDIT_KEY, JSON.stringify(row));
}

function readLedger(): { hashes: string[]; spent: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(CREDIT_KEY) || "") as { hashes?: unknown; spent?: unknown };
    const hashes = Array.isArray(raw.hashes)
      ? raw.hashes.filter((hash): hash is string => typeof hash === "string" && /^0x[a-fA-F0-9]{64}$/.test(hash))
      : [];
    const spent = typeof raw.spent === "number" && raw.spent > 0 ? Math.floor(raw.spent) : 0;
    return { hashes, spent };
  } catch {
    return { hashes: [], spent: 0 };
  }
}

function callsFrom(mon: number, spent: number): number {
  return Math.max(0, Math.floor(mon / CALL_MON + 1e-6) - spent);
}

function readId(): string {
  try {
    const own = localStorage.getItem(ID_KEY);
    if (own && own.length >= 8) return own;
    const raw = localStorage.getItem("solarchik-clock-in-v8");
    if (raw) {
      const id = (JSON.parse(raw) as { playerId?: unknown }).playerId;
      if (typeof id === "string" && id.length >= 8 && id.length <= 80) {
        localStorage.setItem(ID_KEY, id);
        return id;
      }
    }
  } catch {
    /* private mode */
  }
  const id = makePlayerId();
  try {
    localStorage.setItem(ID_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "uk") return saved;
  } catch {
    /* ignore */
  }
  return detectLocale() === "uk" ? "uk" : "en";
}

function readTheme(): "night" | "day" {
  try {
    return localStorage.getItem(THEME_KEY) === "day" ? "day" : "night";
  } catch {
    return "night";
  }
}

function shortHex(addr: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function readCalls(): LiveCall[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CALLS_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((row): row is LiveCall => Boolean(row) && typeof (row as LiveCall).text === "string" && Boolean((row as LiveCall).text));
  } catch {
    return [];
  }
}

function statusLabel(
  status: string,
  t: { statusDone: string; statusPending: string; statusTopup: string; statusBlocked: string; statusFailed: string },
): string {
  if (status === "done" || status === "") return t.statusDone;
  if (status === "pending") return t.statusPending;
  if (status === "need_topup") return t.statusTopup;
  if (status === "blocked") return t.statusBlocked;
  if (status === "failed") return t.statusFailed;
  return status;
}

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function speak(text: string, locale: Lang) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = locale === "uk" ? "uk-UA" : "en-US";
  window.speechSynthesis.speak(utter);
}

const btn = "booth-btn inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40";

function BoothInner() {
  const [locale, setLocale] = useState<Lang>("uk");
  const [theme, setTheme] = useState<"night" | "day">("night");
  const [playerId, setPlayerId] = useState("");
  const [lineLang, setLineLang] = useState<"" | "en" | "uk" | "fail">("");
  const [spentCalls, setSpentCalls] = useState(0);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");
  const [summary, setSummary] = useState<SecretarySummary | null>(null);
  const [note, setNote] = useState("");
  const [hint, setHint] = useState("");
  const [mon, setMon] = useState<number | null>(null);
  const [pass, setPass] = useState<PassRead | null | "wait">("wait");
  const [mint, setMint] = useState<string | null>(null);
  const [contract, setContract] = useState("");
  const [holder, setHolder] = useState("");
  const [account, setAccount] = useState("");
  const [agent, setAgent] = useState("");
  const [agentMon, setAgentMon] = useState<number | null>(null);
  const [tx, setTx] = useState("");
  const [saved, setSaved] = useState(false);
  const [line, setLine] = useState("");
  const [country, setCountry] = useState("UA");
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [callsState, setCallsState] = useState<"load" | "ok" | "miss">("load");
  const [openId, setOpenId] = useState("");
  const [lines, setLines] = useState<TranscriptLine[] | null>(null);
  const [liveLines, setLiveLines] = useState<TranscriptLine[]>([]);
  const talkRef = useRef<HTMLDivElement>(null);
  const [lineNote, setLineNote] = useState("");
  const sendRef = useRef(emptyWallet.sendTransaction);
  const loginRef = useRef(emptyWallet.login);
  const createWalletRef = useRef(emptyWallet.createWallet);
  const authedRef = useRef(false);
  const walletsRef = useRef<WalletRow[]>([]);
  const [ready, setReady] = useState(false);
  const [wallet, setWallet] = useState("");
  const [browser, setBrowser] = useState("");
  const [walletChoices, setWalletChoices] = useState<NamedWallet[]>([]);
  const takeWallet = useRef((next: WalletApi) => {
    sendRef.current = next.sendTransaction;
    loginRef.current = next.login;
    createWalletRef.current = next.createWallet;
    authedRef.current = next.authenticated;
    walletsRef.current = next.wallets;
    const embedded = next.wallets.find((row) => row.walletClientType === "privy");
    const address = embedded?.address ?? "";
    setReady((cur) => (cur === next.ready ? cur : next.ready));
    setWallet((cur) => (cur === address ? cur : address));
  });

  const t = copy[locale];
  const listening = open && busy && !report;

  useEffect(() => {
    const lang = readLang();
    setLocale(lang);
    setTheme(readTheme());
    const id = readId();
    setPlayerId(id);
    void setSecretaryLang(id, lang).then((got) => setLineLang(got ?? "fail"));
    void mintUrl().then(setMint);
    void passContract().then((value) => setContract(value || ""));
    setSaved(hasPasskey());
    const session = readSession();
    if (session) {
      setAccount(session.person);
      setAgent(session.agent);
      if (session.browser) setBrowser(session.browser);
      remember(session.person, session.agent, session.browser);
    }
    try {
      const savedLine = localStorage.getItem(LINE_KEY) || "";
      const id = readFwdId(localStorage.getItem(COUNTRY_KEY), lang);
      setCountry(id);
      setLine(savedLine || `+${fwdRule(id, lang).cc}`);
    } catch {
      setCountry(readFwdId("", lang));
    }
    setCalls(readCalls());
  }, []);

  useEffect(() => {
    if (!wallet) {
      setMon(null);
      return;
    }
    let live = true;
    void readMonBalance(wallet).then((row) => {
      if (live) setMon(row);
    });
    return () => {
      live = false;
    };
  }, [wallet]);

  useEffect(() => {
    const who = browser || account;
    if (!who) {
      setPass("wait");
      return;
    }
    let live = true;
    setPass("wait");
    void (async () => {
      const first = await readPass(who);
      if (!live) return;
      if (first?.open || !account || !browser || account.toLowerCase() === browser.toLowerCase()) {
        setPass(first);
        setHolder(first?.open ? who : "");
        return;
      }
      const other = await readPass(who === browser ? account : browser);
      if (!live) return;
      if (other?.open) {
        setPass(other);
        setHolder(who === browser ? account : browser);
        return;
      }
      setPass(first);
      setHolder("");
    })();
    return () => {
      live = false;
    };
  }, [account, browser]);

  useEffect(() => {
    if (!agent) return;
    let live = true;
    const ledger = readLedger();
    setSpentCalls(ledger.spent);
    void (async () => {
      let mon = 0;
      for (const hash of ledger.hashes) {
        const tx = await readMonTransfer(hash);
        if (tx && tx.to.toLowerCase() === agent.toLowerCase() && tx.value + 1e-9 >= CALL_MON) mon += tx.value;
      }
      if (live) setPaidMon(mon);
    })();
    return () => {
      live = false;
    };
  }, [agent]);

  useEffect(() => {
    if (!agent) {
      setAgentMon(null);
      return;
    }
    let live = true;
    void readMonBalance(agent).then((row) => {
      if (live) setAgentMon(row);
    });
    return () => {
      live = false;
    };
  }, [agent]);

  useEffect(() => {
    if (!playerId) return;
    let live = true;
    const pull = () => {
      void listCalls(playerId).then((rows) => {
        if (!live) return;
        if (rows === null) {
          setCallsState("miss");
          return;
        }
        setCalls(rows);
        setCallsState("ok");
        try {
          localStorage.setItem(CALLS_KEY, JSON.stringify(rows));
        } catch {
          /* ignore */
        }
      });
    };
    pull();
    const timer = window.setInterval(pull, 5000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [playerId]);

  const liveCall = calls.find((row) => row.status === "pending" && row.callId) ?? null;

  useEffect(() => {
    if (!playerId || !liveCall?.callId) {
      setLiveLines([]);
      return;
    }
    const id = liveCall.callId;
    let on = true;
    const pull = () => {
      void callTranscript(playerId, id).then((rows) => {
        if (on && rows) setLiveLines(rows);
      });
    };
    pull();
    const timer = window.setInterval(pull, 3000);
    return () => {
      on = false;
      window.clearInterval(timer);
    };
  }, [playerId, liveCall?.callId]);

  useEffect(() => {
    const el = talkRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveLines]);

  function choose(lang: Lang) {
    setLocale(lang);
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    if (playerId) void setSecretaryLang(playerId, lang).then((got) => setLineLang(got ?? "fail"));
  }

  function chooseTheme(next: "night" | "day") {
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function connect() {
    if (!ready) {
      setHint(t.privyWait);
      return;
    }
    if (wallet) return;
    if (authedRef.current) {
      setHint(t.privyMake);
      void createWalletRef.current().catch(() => setHint(t.privyFail));
      return;
    }
    loginRef.current();
  }

  async function fundAgent() {
    if (!agent) {
      setHint(t.needAgent);
      return;
    }
    const embedded = walletsRef.current.find((row) => row.walletClientType === "privy");
    if (!embedded || !wallet || busy) {
      setHint(t.needPrivy);
      return;
    }
    setBusy(true);
    setHint("");
    try {
      await embedded.switchChain(10143);
      const sent = await sendRef.current(
        { to: agent, from: wallet, value: `0x${parseEther("0.01").toString(16)}`, chainId: 10143 },
        { address: wallet },
      );
      setTx(sent.hash);
      setHint(t.funded);
      window.setTimeout(() => {
        void readMonBalance(wallet).then(setMon);
        void readMonBalance(agent).then(setAgentMon);
      }, 4000);
    } catch {
      setHint(t.txFail);
    }
    setBusy(false);
  }

  async function topUp() {
    if (!agent) {
      setHint(t.needAgent);
      return;
    }
    const embedded = walletsRef.current.find((row) => row.walletClientType === "privy");
    if (!embedded || !wallet || busy) {
      setHint(t.needPrivy);
      return;
    }
    setBusy(true);
    setHint("");
    try {
      await embedded.switchChain(10143);
      const sent = await sendRef.current(
        { to: agent, from: wallet, value: `0x${parseEther(String(TOPUP_MON)).toString(16)}`, chainId: 10143 },
        { address: wallet },
      );
      const hash = sent.hash;
      let tx: { from: string; to: string; value: number } | null = null;
      for (let i = 0; i < 8; i++) {
        tx = await readMonTransfer(hash);
        if (tx) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (!tx || tx.to.toLowerCase() !== agent.toLowerCase() || tx.value + 1e-9 < TOPUP_MON) {
        setHint(t.topupMiss);
        setBusy(false);
        return;
      }
      const ledger = readLedger();
      if (!ledger.hashes.includes(hash)) ledger.hashes.push(hash);
      writeLedger(ledger);
      setTx(hash);
      setPaidMon((cur) => cur + tx.value);
      const n = Math.floor(tx.value / CALL_MON + 1e-6);
      setHint(t.added.replace("{mon}", tx.value.toFixed(2)).replace("{n}", String(n)));
      window.setTimeout(() => {
        void readMonBalance(wallet).then(setMon);
        void readMonBalance(agent).then(setAgentMon);
      }, 2000);
    } catch {
      setHint(t.txFail);
    }
    setBusy(false);
  }

  function swapPrefix(cur: string, fromCc: string, toCc: string): string {
    const to = `+${toCc}`;
    const from = `+${fromCc}`;
    const raw = cur.trim();
    if (!raw || raw === "+" || raw === from) return to;
    if (raw.startsWith(from)) return to + raw.slice(from.length);
    return to;
  }

  function chooseCountry(id: string) {
    const next = readFwdId(id, locale);
    const from = fwdRule(country, locale).cc;
    const to = fwdRule(next, locale).cc;
    setCountry(next);
    setLine((cur) => swapPrefix(cur, from, to));
    try {
      localStorage.setItem(COUNTRY_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function saveLine(): boolean {
    const mine = cleanForwardNumber(line);
    if (!mine) {
      setLineNote(t.lineBad);
      return false;
    }
    try {
      localStorage.setItem(LINE_KEY, mine);
    } catch {
      /* ignore */
    }
    setLine(mine);
    return true;
  }

  async function forward(code: string) {
    if (!saveLine()) return;
    if (!account) {
      setLineNote(t.needAccount);
      return;
    }
    if (pass === "wait") {
      setLineNote(t.passLook);
      return;
    }
    if (pass === null || !pass.open) {
      setLineNote(pass === null ? t.passFail : t.passClosed);
      return;
    }
    setLineNote(code);
    nativeUssd(code);
    const armed = await claimLine(playerId, locale);
    setLineNote(armed === null ? `${t.claimMiss} ${code}` : `${t.armed.replace("{n}", String(armed))} ${code}`);
  }

  function dialOnly(code: string) {
    if (!code || !saveLine()) return;
    setLineNote(code);
    nativeUssd(code);
  }

  async function openCall(row: LiveCall) {
    if (openId === row.callId) {
      setOpenId("");
      setLines(null);
      return;
    }
    if (!row.callId) {
      setOpenId("");
      setLines(null);
      return;
    }
    setOpenId(row.callId);
    setLines(null);
    const next = await callTranscript(playerId, row.callId);
    setLines(next);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setHint(t.copied);
    } catch {
      setHint(shortHex(value));
    }
  }

  async function lookPass(addr: string) {
    setPass("wait");
    const row = await readPass(addr);
    setPass(row);
    setHolder(row?.open ? addr : "");
  }

  async function useWallet(row: NamedWallet) {
    if (busy) return;
    setBusy(true);
    setHint("");
    const out = await row.connect();
    if (!out.ok) setHint(out.error === "no-wallet" ? t.noBrowser : t.accountCancel);
    else {
      setBrowser(out.address);
      setWalletChoices([]);
      remember(account, agent, out.address);
      await lookPass(out.address);
    }
    setBusy(false);
  }

  async function checkWallet() {
    if (busy) return;
    setHint("");
    const rows = await listBrowserWallets();
    if (rows.length === 0) {
      setBusy(true);
      const out = await connectMonad();
      if (!out.ok) setHint(out.error === "no-wallet" ? t.noBrowser : t.accountCancel);
      else {
        setBrowser(out.address);
        remember(account, agent, out.address);
        await lookPass(out.address);
      }
      setBusy(false);
      return;
    }
    if (rows.length === 1) {
      await useWallet(rows[0]);
      return;
    }
    setWalletChoices(rows);
  }

  async function accountClick() {
    if (busy) return;
    setBusy(true);
    setHint("");
    try {
      const keys = saved ? await openAccount() : await createAccount();
      setAccount(keys.person);
      setAgent(keys.agent);
      setSaved(true);
      remember(keys.person, keys.agent, browser);
    } catch (error) {
      setHint(passkeyFailed(error) === "cancel" ? t.accountCancel : t.accountFail);
    }
    setBusy(false);
  }

  async function pickUp() {
    const text = draft.replace(/\s+/g, " ").trim();
    if (busy || !playerId) return;
    if (!text) {
      setNote(t.empty);
      return;
    }
    if (!account) {
      setNote(t.needAccount);
      return;
    }
    if (pass === "wait") {
      setNote(t.passLook);
      return;
    }
    if (pass === null) {
      setNote(t.passFail);
      return;
    }
    if (!pass.open) {
      setNote(t.passClosed);
      return;
    }
    if (callsFrom(paidMon, spentCalls) < 1) {
      setNote(t.need);
      return;
    }
    setOpen(true);
    setBusy(true);
    setReport("");
    setSummary(null);
    setNote("");
    const result = await screenCall(playerId, text, [], locale);
    if (result.ok) {
      setReport(result.reply);
      setSummary(result.summary);
      setSpentCalls((cur) => {
        const next = cur + 1;
        const ledger = readLedger();
        ledger.spent = next;
        writeLedger(ledger);
        return next;
      });
      speak(result.reply, locale);
    } else if (result.needTopup) {
      setNote(t.need);
    } else {
      setReport(t.silent);
    }
    setBusy(false);
  }

  function hangUp() {
    setOpen(false);
    setReport("");
    setSummary(null);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  const facts: { k: string; v: string }[] = [];
  if (summary?.caller_name) facts.push({ k: t.who, v: summary.caller_name });
  if (summary?.intent) facts.push({ k: t.why, v: summary.intent });
  if (summary?.action) facts.push({ k: t.next, v: summary.action });

  const passLabel = !account ? null : pass === "wait" ? t.passLook : pass === null ? t.passFail : pass.open ? t.passOpen : t.passClosed;
  const passTone = !account || pass === "wait" || pass === null ? "text-muted" : pass.open ? "text-ok" : "text-danger";
  const callsLeft = callsFrom(paidMon, spentCalls);
  const creditLabel = `${paidMon.toFixed(2)} MON`;

  return (
    <div className={"booth relative h-dvh w-full overflow-y-auto" + (listening || liveCall ? " is-live" : "")} data-theme={theme}>
    <PrivyHost onChange={takeWallet.current} />
    <div className="relative mx-auto grid w-full max-w-6xl content-start gap-4 px-4 py-5 sm:px-6 lg:grid-cols-12 lg:gap-5 lg:px-8 lg:py-6">
      <div aria-hidden className="booth-glow pointer-events-none absolute -left-16 top-0 size-72" />
      <header className="relative order-1 flex items-start justify-between gap-3 lg:col-span-12">
        <div>
          <p className="booth-gold text-xs font-semibold uppercase tracking-[0.18em]">{t.kicker}</p>
          <h1 className="font-display mt-1 text-4xl leading-none">{t.title}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="booth-chip flex rounded-full p-1" role="group" aria-label="Theme">
            <button type="button" className={theme === "night" ? "rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg" : "booth-muted rounded-full px-3 py-1.5 text-sm font-semibold"} onClick={() => chooseTheme("night")}>
              {t.night}
            </button>
            <button type="button" className={theme === "day" ? "rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg" : "booth-muted rounded-full px-3 py-1.5 text-sm font-semibold"} onClick={() => chooseTheme("day")}>
              {t.day}
            </button>
          </div>
          <a className="booth-muted px-1 text-xs font-semibold underline" href="/judges">
            {locale === "uk" ? "Суддям" : "Judges"}
          </a>
        </div>
      </header>
      <p className="booth-muted relative order-2 max-w-3xl text-sm leading-relaxed lg:col-span-12">{t.lead}</p>
      <div className="relative order-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-span-12">
        <div className="booth-chip rounded-lg px-3 py-2">
          <p className="booth-faint text-xs font-semibold uppercase tracking-wide">{t.account}</p>
          <p className="truncate text-sm font-semibold">{account ? shortHex(account) : t.noAccount}</p>
        </div>
        <div className="booth-chip rounded-lg px-3 py-2">
          <p className="booth-faint text-xs font-semibold uppercase tracking-wide">{t.pass}</p>
          <p className={"truncate text-sm font-semibold " + passTone}>{passLabel ?? t.noAccount}</p>
        </div>
        <div className="booth-chip rounded-lg px-3 py-2">
          <p className="booth-faint text-xs font-semibold uppercase tracking-wide">{t.pay}</p>
          <p className="truncate text-sm font-semibold">{wallet ? shortHex(wallet) : t.noWallet}</p>
        </div>
        <div className="booth-chip rounded-lg px-3 py-2">
          <p className="booth-faint text-xs font-semibold uppercase tracking-wide">{t.keyAgent}</p>
          <p className="truncate text-sm font-semibold">{agent ? (agentMon === null ? shortHex(agent) : `${agentMon.toFixed(4)} ${t.mon}`) : t.noAccount}</p>
        </div>
      </div>

      <section className="booth-card relative order-4 rounded-xl p-5 lg:order-5 lg:col-span-7" style={{ animationDelay: "40ms" }}>
        <div className="booth-handset relative mx-auto grid size-24 place-items-center">
          <span className="booth-ring" aria-hidden />
          <span className="booth-ring booth-ring-late" aria-hidden />
          <span className="booth-phone relative grid size-20 place-items-center rounded-full">
            <Phone className="size-8" aria-hidden />
          </span>
        </div>
        <div className="mx-auto mt-4 flex max-w-sm flex-col items-center gap-2 text-center">
          <div className="booth-chip flex rounded-full p-1" role="group" aria-label="Language">
            <button type="button" className={locale === "en" ? "rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg" : "booth-muted rounded-full px-5 py-2 text-sm font-semibold"} onClick={() => choose("en")}>
              EN
            </button>
            <button type="button" className={locale === "uk" ? "rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg" : "booth-muted rounded-full px-5 py-2 text-sm font-semibold"} onClick={() => choose("uk")}>
              УК
            </button>
          </div>
          <p className={"text-sm font-semibold " + (lineLang === "fail" ? "booth-gold" : "booth-muted")}>
            {lineLang === "en" ? t.langEn : lineLang === "uk" ? t.langUk : lineLang === "fail" ? t.langFail : t.langNote}
          </p>
          <a className="font-display text-2xl font-semibold tracking-wide" href={`tel:${ASSISTANT_LINE}`}>{ASSISTANT_LINE}</a>
          <p className="booth-muted text-sm">{t.dial}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="booth-chip rounded-lg px-3 py-2">
            <p className="booth-faint text-xs font-semibold uppercase tracking-wide">{t.credit}</p>
            <p className="font-display text-xl tabular-nums">{creditLabel}</p>
          </div>
          <div className="booth-chip rounded-lg px-3 py-2">
            <p className="booth-faint text-xs font-semibold uppercase tracking-wide">{t.price}</p>
            <p className="font-display text-xl tabular-nums">{CALL_MON.toFixed(2)} MON</p>
          </div>
        </div>
        <p className="booth-muted mt-2 text-sm">{t.callsLeft.replace("{n}", String(callsLeft))}</p>
        <button type="button" className={btn + " mt-3 bg-primary text-primary-fg"} disabled={busy} onClick={() => void topUp()}>
          {t.topup}
        </button>
        <label className="mt-4 block text-sm font-semibold">
          {t.call}
          {liveCall ? (
            <div ref={talkRef} className="booth-field mt-1 max-h-52 min-h-24 overflow-y-auto rounded-lg px-3 py-2 text-sm font-normal" aria-live="polite">
              <p className="booth-faint text-xs font-semibold">
                {(liveCall.callerName || liveCall.caller || t.caller) + " · " + t.statusPending}
              </p>
              {liveLines.length === 0 && liveCall.text ? <p className="mt-2">{liveCall.text}</p> : null}
              {liveLines.map((lineRow, i) => (
                <p key={`${liveCall.callId}-${i}`} className="mt-2">
                  <span className="booth-faint font-semibold">{lineRow.caller ? liveCall.callerName || liveCall.caller || t.caller : t.sol}: </span>
                  {lineRow.text}
                </p>
              ))}
            </div>
          ) : (
            <textarea
              className="booth-field mt-1 min-h-24 w-full resize-none rounded-lg px-3 py-2 text-sm font-normal outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              value={draft}
              placeholder={t.placeholder}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={btn + " bg-danger text-white"} disabled={busy} onClick={() => void pickUp()}>
            {listening ? t.waiting : t.pick}
          </button>
          <button type="button" className={btn + " booth-chip"} onClick={hangUp}>
            {t.hang}
          </button>
        </div>
        <div className="booth-chip mt-4 rounded-lg px-3 py-3">
          <label className="block text-sm font-semibold">
            {t.line}
            <input
              className="booth-field mt-1 h-11 w-full rounded-lg px-3 text-sm font-normal outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              inputMode="tel"
              autoComplete="tel"
              placeholder={`+${fwdRule(country, locale).cc}…`}
              value={line}
              onChange={(e) => setLine(e.target.value)}
            />
          </label>
          <p className="booth-muted mt-2 text-sm">
            {t.assist}: {ASSISTANT_LINE}
          </p>
          <p className="booth-muted mt-1 text-sm leading-relaxed">{t.fwdHint}</p>
          <label className="mt-3 block text-sm font-semibold">
            {t.country}
            <select
              className="booth-field mt-1 h-11 w-full rounded-lg px-3 text-sm font-normal outline-none"
              value={country}
              onChange={(e) => chooseCountry(e.target.value)}
            >
              {sortedFwd(locale).map((row) => (
                <option key={row.id} value={row.id}>
                  {fwdName(row, locale)} +{row.cc}
                </option>
              ))}
            </select>
          </label>
          <details className="mt-2">
            <summary className="booth-muted cursor-pointer text-sm">{t.codes}</summary>
            <p className="booth-muted mt-2 font-mono text-xs leading-relaxed">
              {filledOn(fwdRule(country, locale), ASSISTANT_LINE)}
              <br />
              {t.codeOff}: {fwdRule(country, locale).off}
              {fwdRule(country, locale).check ? (
                <>
                  <br />
                  {t.codeAsk}: {fwdRule(country, locale).check}
                </>
              ) : null}
            </p>
          </details>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className={btn + " bg-danger text-white"} onClick={() => void forward(filledOn(fwdRule(country, locale), ASSISTANT_LINE))}>
              {t.fwdOn}
            </button>
            <button type="button" className={btn + " booth-chip"} onClick={() => dialOnly(fwdRule(country, locale).off)}>
              {t.fwdOff}
            </button>
            {fwdRule(country, locale).check ? (
              <button type="button" className={btn + " booth-chip"} onClick={() => dialOnly(fwdRule(country, locale).check)}>
                {t.fwdAsk}
              </button>
            ) : null}
          </div>
          {lineNote ? <p className="booth-gold mt-3 font-mono text-sm font-semibold break-all">{lineNote}</p> : null}
        </div>
        {open ? (
          <p className="booth-reply booth-chip mt-4 rounded-lg px-3 py-3 text-sm font-semibold leading-relaxed" aria-live="polite">
            {listening ? t.waiting : report}
          </p>
        ) : null}
        {facts.length > 0 ? (
          <dl className="mt-3 grid gap-2">
            {facts.map((row) => (
              <div key={row.k} className="booth-reply booth-chip rounded-lg px-3 py-2">
                <dt className="booth-faint text-xs font-semibold uppercase tracking-wide">{row.k}</dt>
                <dd className="text-sm font-semibold">{row.v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {note ? <p className="booth-gold mt-3 text-sm font-semibold">{note}</p> : null}
      </section>

      <div className="order-5 flex flex-col gap-3 lg:order-4 lg:col-span-5">
      <section className="booth-card relative rounded-xl p-4" style={{ animationDelay: "120ms" }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{t.account}</h2>
          {passLabel ? <span className={"text-xs font-semibold " + passTone}>{passLabel}</span> : null}
        </div>
        <p className="mt-2 font-mono text-sm font-semibold">
          {account ? (
            <a className="underline" href={monadAddressUrl(account)} target="_blank" rel="noreferrer">
              {t.keyYou} {shortHex(account)}
            </a>
          ) : (
            t.noAccount
          )}
        </p>
        {agent ? (
          <p className="mt-1 font-mono text-sm font-semibold">
            <a className="underline" href={monadAddressUrl(agent)} target="_blank" rel="noreferrer">
              {t.keyAgent} {shortHex(agent)}
            </a>
            <span className="booth-muted"> · {agentMon === null ? "—" : `${agentMon.toFixed(4)} ${t.mon}`}</span>
          </p>
        ) : null}
        {account ? <p className="mt-1 break-all font-mono text-xs font-semibold">{account}</p> : null}
        {pass && pass !== "wait" ? (
          <p className="booth-muted mt-1 font-mono text-xs">
            {t.chain}: status {pass.status}
            {pass.expiration > 0 ? ` · ${new Date(pass.expiration * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC` : ""}
            {holder ? ` · ${shortHex(holder)}` : ""}
          </p>
        ) : null}
        {browser ? <p className="mt-1 font-mono text-sm font-semibold">{t.browserShort}: {shortHex(browser)}</p> : null}
        <p className="booth-muted mt-1 text-sm">{t.seed}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btn + " bg-primary text-primary-fg"} disabled={busy} onClick={() => void accountClick()}>
            {saved ? t.unlock : t.create}
          </button>
          {account ? (
            <button type="button" className={btn + " booth-chip"} disabled={busy} onClick={() => void lookPass(browser || account)}>
              {t.recheck}
            </button>
          ) : null}
          <button type="button" className={btn + " booth-chip"} disabled={busy} onClick={() => void checkWallet()}>
            {browser ? t.changeWallet : t.browser}
          </button>
          {walletChoices.length > 0 ? (
            <p className="booth-muted basis-full text-sm">{t.whichWallet}</p>
          ) : null}
          {walletChoices.map((row) => (
            <button key={row.id} type="button" className={btn + " bg-primary text-primary-fg"} disabled={busy} onClick={() => void useWallet(row)}>
              {row.name}
            </button>
          ))}
          {mint ? (
            <a className={btn + " booth-chip"} href={mint} target="_blank" rel="noreferrer">
              {t.mint}
            </a>
          ) : null}
          {contract ? (
            <a className={btn + " booth-chip"} href={monadAddressUrl(contract)} target="_blank" rel="noreferrer">
              A-Pass
            </a>
          ) : null}
          {account ? (
            <button type="button" className={btn + " booth-chip"} onClick={() => void copyText(account)}>
              {t.keyYou}
            </button>
          ) : null}
          {agent ? (
            <button type="button" className={btn + " booth-chip"} onClick={() => void copyText(agent)}>
              {t.keyAgent}
            </button>
          ) : null}
        </div>
      </section>

      <section className="booth-card relative rounded-xl p-4" style={{ animationDelay: "200ms" }}>
        <h2 className="font-display text-2xl">{t.pay}</h2>
        <p className="mt-2 font-mono text-sm font-semibold">{wallet ? shortHex(wallet) : t.noWallet}</p>
        {wallet ? (
          <p className="booth-muted mt-1 text-sm tabular-nums">
            {mon === null ? "—" : mon.toFixed(4)} {t.mon}
          </p>
        ) : null}
        <p className="booth-muted mt-1 text-sm">{t.note}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btn + " bg-primary text-primary-fg"} disabled={busy} onClick={connect}>
            {t.connect}
          </button>
          <a className={btn + " booth-chip"} href={FAUCET} target="_blank" rel="noreferrer">
            {t.faucet}
          </a>
          <button type="button" className={btn + " bg-primary text-primary-fg"} disabled={!wallet || !agent || busy} onClick={() => void topUp()}>
            {t.topup}
          </button>
          <button type="button" className={btn + " booth-chip"} disabled={!wallet || !agent || busy} onClick={() => void fundAgent()}>
            {t.fund}
          </button>
          {wallet ? (
            <button type="button" className={btn + " booth-chip"} onClick={() => void copyText(wallet)}>
              {t.copy}
            </button>
          ) : null}
        </div>
        {hint ? <p className="booth-gold mt-3 text-sm font-semibold">{hint}</p> : null}
        {tx ? (
          <a className="booth-gold mt-2 block font-mono text-sm font-semibold underline" href={monadTxUrl(tx)} target="_blank" rel="noreferrer">
            {shortHex(tx)}
          </a>
        ) : null}
      </section>
      </div>
      <section className="booth-card relative order-6 rounded-xl p-4 lg:col-span-12" style={{ animationDelay: "260ms" }}>
        <h2 className="font-display text-2xl">{t.archive}</h2>
        {callsState === "miss" ? <p className="booth-gold mt-2 text-sm font-semibold">{calls.length ? t.archiveMiss : t.archiveDown}</p> : null}
        {callsState === "ok" && calls.length === 0 ? <p className="booth-muted mt-2 text-sm">{t.archiveEmpty}</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {calls.map((row) => {
            const who = row.callerName || (row.caller && row.caller !== "unknown" ? row.caller : "");
            const open = openId !== "" && openId === row.callId;
            const when = row.at
              ? new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(row.at)
              : "";
            const phone = row.caller && row.caller !== "unknown" && row.caller !== who ? row.caller : "";
            return (
              <li key={row.callId || `${row.at}`} className="booth-chip rounded-lg px-3 py-2">
                <button type="button" className="w-full text-left" onClick={() => void openCall(row)}>
                  <p className="text-sm font-semibold">{who || t.caller}</p>
                  <p className="booth-faint text-xs font-semibold">
                    {when}
                    {phone ? ` · ${phone}` : ""}
                    {row.durationSec ? ` · ${clock(row.durationSec)}` : ""}
                    {` · ${statusLabel(row.status, t)}`}
                  </p>
                  {row.intent ? <p className="booth-muted mt-1 text-sm">{row.intent}</p> : null}
                </button>
                {open && lines === null ? <p className="booth-muted mt-2 text-sm">…</p> : null}
                {open && lines && lines.length > 0 ? (
                  <div className="mt-2 grid gap-1 border-t border-white/10 pt-2">
                    {lines.map((lineRow, i) => (
                      <p key={`${row.callId}-${i}`} className="text-sm">
                        <span className="booth-faint font-semibold">{lineRow.caller ? who || t.caller : t.sol}: </span>
                        {lineRow.text}
                      </p>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
    </div>
  );
}

export function BoothLive() {
  return <BoothInner />;
}

function PrivyHost({ onChange }: { onChange: (api: WalletApi) => void }) {
  const [Mount, setMount] = useState<ComponentType<{ onChange: (api: WalletApi) => void }> | null>(null);
  useEffect(() => {
    void import("./privyMount").then((mod) => setMount(() => mod.PrivyMount));
  }, []);
  if (!Mount) return null;
  return <Mount onChange={onChange} />;
}
