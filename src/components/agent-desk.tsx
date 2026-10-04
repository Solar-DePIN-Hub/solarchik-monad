import { useEffect, useState } from "react";
import { formatEther, isAddress } from "viem";
import { askDesk } from "@/lib/desk-chat.functions";
import { DEPLOYED, FAUCET, strategyAbi, streakAbi, txUrl } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";
import { hasSavedPasskey, lockMera, meraSigner, publicMonad, unlockMera } from "@/lib/mera-account";

const APASS = "0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9" as const;
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
const PRIVY = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;
const ENVIO = import.meta.env.VITE_ENVIO_URL as string | undefined;
const DESK = import.meta.env.VITE_AGENT_DESK_ADDRESS as string | undefined;

const apassAbi = [
  {
    type: "function",
    name: "getAPassData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "tier", type: "uint8" },
      { name: "subTier", type: "uint8" },
      { name: "group", type: "uint8" },
      { name: "subGroup", type: "uint8" },
      { name: "expiry", type: "uint64" },
    ],
  },
] as const;

type Gate = "closed" | "unavailable" | "verified" | "rejected";
type Model = "kimi" | "qwen";

const copy = {
  en: {
    kicker: "Trust, Identity & AI",
    title: "Agent desk",
    lead: "Passkey account on Monad testnet. The agent does not trade.",
    create: "Create passkey",
    resume: "Use passkey",
    lock: "Lock",
    account: "Account",
    noSeed: "No seed phrase is shown. MetaMask is not the account.",
    checkin: "Check in",
    streak: "Streak",
    mint: "Mint strategy",
    name: "Strategy name",
    risk: "Risk 1–3",
    limits: "Limits",
    local: "Local until AgentDesk is deployed. Pause sends no transaction.",
    max: "Max per action",
    cap: "Daily cap",
    expiry: "Expiry, hours",
    save: "Save limits locally",
    pause: "Pause · local only",
    privy: "Privy not configured",
    privyBody: "No VITE_PRIVY_APP_ID. The agent wallet is not drawn.",
    cre: "Workflow is not live",
    creBody: "No Monad testnet forwarder address. A price is not this workflow.",
    history: "History is not indexed",
    historyBody: "VITE_ENVIO_URL is empty. This list is not Envio.",
    gate: "Transfer",
    gateClosed: "Transfer stays rejected until a CVI read says verified.",
    unavailable: "Verification unavailable",
    notVerified: "Not verified",
    verified: "Verified",
    ask: "Ask about the limit or the gate",
    send: "Ask",
    offline: "Offline demo. No model key, so there is no reply.",
    error: "The model call failed. No invented reply.",
    kimi: "Kimi",
    qwen: "Qwen",
    busy: "Waiting…",
    faucet: "Testnet faucet",
    needGas: "Check-in and mint need testnet MON for gas.",
    deskMissing: "AgentDesk is not deployed. No address is shown.",
  },
  uk: {
    kicker: "Довіра, особа й ШІ",
    title: "Стіл агента",
    lead: "Акаунт з passkey на тестнеті Monad. Агент не торгує.",
    create: "Створити passkey",
    resume: "Увійти passkey",
    lock: "Закрити",
    account: "Акаунт",
    noSeed: "Сід не показується. MetaMask не є акаунтом.",
    checkin: "Відмітитись",
    streak: "Серія",
    mint: "Мінт стратегії",
    name: "Назва стратегії",
    risk: "Ризик 1–3",
    limits: "Ліміти",
    local: "Лише локально, поки AgentDesk не задеплоєний. Пауза не шле транзакцію.",
    max: "Максимум на дію",
    cap: "Денна стеля",
    expiry: "Строк, години",
    save: "Зберегти ліміти локально",
    pause: "Пауза · лише локально",
    privy: "Privy не налаштовано",
    privyBody: "Немає VITE_PRIVY_APP_ID. Гаманець агента не малюється.",
    cre: "Воркфлоу не живий",
    creBody: "Немає адреси форвардера на тестнеті Monad. Ціна не є цим воркфлоу.",
    history: "Історія не індексована",
    historyBody: "VITE_ENVIO_URL порожній. Цей список не Envio.",
    gate: "Переказ",
    gateClosed: "Переказ лишається відхиленим, поки читання CVI не скаже verified.",
    unavailable: "Перевірка недоступна",
    notVerified: "Не верифіковано",
    verified: "Верифіковано",
    ask: "Запитай про ліміт або гейт",
    send: "Запитати",
    offline: "Офлайн-демо. Немає ключа моделі, тому відповіді немає.",
    error: "Виклик моделі впав. Відповідь не вигадана.",
    kimi: "Kimi",
    qwen: "Qwen",
    busy: "Чекаю…",
    faucet: "Кран тестнету",
    needGas: "Відмітка і мінт потребують тестовий MON на газ.",
    deskMissing: "AgentDesk не задеплоєний. Адреса не показується.",
  },
} as const;

export function AgentDesk() {
  const { lang } = useI18n();
  const t = copy[lang];
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [balance, setBalance] = useState("");
  const [streak, setStreak] = useState("—");
  const [checkTx, setCheckTx] = useState("");
  const [name, setName] = useState("Guard");
  const [risk, setRisk] = useState("1");
  const [tokenId, setTokenId] = useState("");
  const [mintTx, setMintTx] = useState("");
  const [max, setMax] = useState("1");
  const [cap, setCap] = useState("5");
  const [hours, setHours] = useState("24");
  const [paused, setPaused] = useState(false);
  const [limitsNote, setLimitsNote] = useState("");
  const [gate, setGate] = useState<Gate>("closed");
  const [model, setModel] = useState<Model>("kimi");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    setSaved(hasSavedPasskey());
  }, []);

  useEffect(() => {
    if (!address) return;
    const client = publicMonad();
    void client.getBalance({ address }).then((wei) => setBalance(formatEther(wei))).catch(() => setBalance("—"));
    void client
      .readContract({ address: DEPLOYED.streak, abi: streakAbi, functionName: "streak", args: [address] })
      .then((n) => setStreak(String(n)))
      .catch(() => setStreak("—"));
    void readGate(address).then(setGate);
  }, [address]);

  async function unlock(mode: "create" | "resume") {
    setBusy(t.busy);
    setNote("");
    try {
      setAddress(await unlockMera(mode));
      setSaved(true);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "passkey failed");
    } finally {
      setBusy("");
    }
  }

  async function checkIn() {
    const { client: wallet, account } = meraSigner();
    setBusy(t.busy);
    setNote("");
    try {
      const hash = await wallet.writeContract({
        account,
        chain: wallet.chain,
        address: DEPLOYED.streak,
        abi: streakAbi,
        functionName: "checkIn",
      });
      setCheckTx(hash);
      const n = await publicMonad().readContract({
        address: DEPLOYED.streak,
        abi: streakAbi,
        functionName: "streak",
        args: [account.address],
      });
      setStreak(String(n));
    } catch (error) {
      setNote(error instanceof Error ? error.message : "check-in failed");
    } finally {
      setBusy("");
    }
  }

  async function mint() {
    const { client: wallet, account } = meraSigner();
    const level = Number(risk);
    if (!name.trim() || level < 1 || level > 3) return;
    setBusy(t.busy);
    setNote("");
    try {
      const hash = await wallet.writeContract({
        account,
        chain: wallet.chain,
        address: DEPLOYED.strategy,
        abi: strategyAbi,
        functionName: "mint",
        args: [name.trim(), level],
      });
      setMintTx(hash);
      const receipt = await publicMonad().waitForTransactionReceipt({ hash });
      const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      const ownerTopic = `0x${account.address.slice(2).toLowerCase().padStart(64, "0")}`;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== DEPLOYED.strategy.toLowerCase()) continue;
        if (log.topics[0] !== transferTopic || log.topics[2] !== ownerTopic || !log.topics[3]) continue;
        setTokenId(BigInt(log.topics[3]).toString());
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "mint failed");
    } finally {
      setBusy("");
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setBusy(t.busy);
    setAnswer("");
    try {
      const reply = await askDesk({ data: { lang, model, text: question.trim() } });
      if (reply.mode === "offline") setAnswer(t.offline);
      else if (reply.mode === "live") setAnswer(reply.text);
      else setAnswer(t.error);
    } catch {
      setAnswer(t.error);
    } finally {
      setBusy("");
    }
  }

  const gateLabel =
    gate === "verified" ? t.verified : gate === "rejected" ? t.notVerified : gate === "unavailable" ? t.unavailable : t.gateClosed;

  return (
    <div className="rise flex flex-col gap-4 pb-4">
      <header>
        <p className="pill">{t.kicker}</p>
        <h1 className="font-display mt-3 text-4xl">{t.title}</h1>
        <p className="mt-2 text-ink-soft">{t.lead}</p>
      </header>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.account}</h2>
        <p className="mt-2 text-sm">{t.noSeed}</p>
        <p className="mt-2 break-all text-sm font-semibold">{address ?? "—"}</p>
        <p className="text-sm text-ink-soft">{balance ? `${balance} MON` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-sun" disabled={Boolean(busy)} onClick={() => void unlock("create")}>
            {t.create}
          </button>
          <button type="button" className="btn btn-ghost" disabled={Boolean(busy) || !saved} onClick={() => void unlock("resume")}>
            {t.resume}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              lockMera();
              setAddress(null);
              setGate("closed");
            }}
          >
            {t.lock}
          </button>
        </div>
        <p className="mt-3 text-sm">{t.needGas}</p>
        <a className="text-sm font-semibold" href={FAUCET} target="_blank" rel="noreferrer">
          {t.faucet}
        </a>
        {note ? <p className="mt-2 text-sm font-semibold">{note}</p> : null}
        {busy ? <p className="mt-2 text-sm">{busy}</p> : null}
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.checkin}</h2>
        <p className="mt-2 text-sm">
          {t.streak}: {streak}
        </p>
        <button type="button" className="btn btn-sun mt-3" disabled={!address || Boolean(busy)} onClick={() => void checkIn()}>
          {t.checkin}
        </button>
        {checkTx ? (
          <a className="mt-2 block text-sm font-semibold" href={txUrl(checkTx)} target="_blank" rel="noreferrer">
            {checkTx}
          </a>
        ) : null}
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.mint}</h2>
        <p className="mt-2 break-all text-xs font-semibold">{DEPLOYED.strategy}</p>
        <label className="mt-3 block text-sm font-semibold">
          {t.name}
          <input className="field mt-1" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          {t.risk}
          <input className="field mt-1" value={risk} inputMode="numeric" onChange={(e) => setRisk(e.target.value)} />
        </label>
        <button type="button" className="btn btn-sun mt-3" disabled={!address || Boolean(busy)} onClick={() => void mint()}>
          {t.mint}
        </button>
        {tokenId ? <p className="mt-2 text-sm font-semibold">#{tokenId}</p> : null}
        {mintTx ? (
          <a className="mt-2 block text-sm font-semibold" href={txUrl(mintTx)} target="_blank" rel="noreferrer">
            {mintTx}
          </a>
        ) : null}
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.limits}</h2>
        <p className="mt-2 text-sm">{DESK && isAddress(DESK) ? DESK : t.deskMissing}</p>
        <p className="mt-2 text-sm">{t.local}</p>
        <label className="mt-3 block text-sm font-semibold">
          {t.max}
          <input className="field mt-1" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          {t.cap}
          <input className="field mt-1" value={cap} onChange={(e) => setCap(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          {t.expiry}
          <input className="field mt-1" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setLimitsNote(`${max} / ${cap} / ${hours}h · local`)}>
            {t.save}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setPaused((v) => !v)}>
            {t.pause}
          </button>
        </div>
        {limitsNote ? <p className="mt-2 text-sm font-semibold">{limitsNote}</p> : null}
        {paused ? <p className="mt-2 text-sm font-semibold">{t.pause}</p> : null}
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{PRIVY ? "Privy" : t.privy}</h2>
        <p className="mt-2 text-sm">{PRIVY ? "App id is set. This desk does not draw a second login." : t.privyBody}</p>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.cre}</h2>
        <p className="mt-2 text-sm">{t.creBody}</p>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{ENVIO ? "Envio" : t.history}</h2>
        <p className="mt-2 text-sm">{ENVIO ? ENVIO : t.historyBody}</p>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.gate}</h2>
        <p className="mt-2 text-sm font-semibold">{gateLabel}</p>
        <p className="mt-2 text-sm">{t.gateClosed}</p>
        <button type="button" className="btn btn-ghost mt-3" disabled>
          {t.gate}
        </button>
      </section>
      <section className="card p-4">
        <div className="flex gap-2">
          <button type="button" className={model === "kimi" ? "btn btn-sun" : "btn btn-ghost"} onClick={() => setModel("kimi")}>
            {t.kimi}
          </button>
          <button type="button" className={model === "qwen" ? "btn btn-sun" : "btn btn-ghost"} onClick={() => setModel("qwen")}>
            {t.qwen}
          </button>
        </div>
        <label className="mt-3 block text-sm font-semibold">
          {t.ask}
          <textarea className="field mt-1 min-h-20" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </label>
        <button type="button" className="btn btn-sun mt-3" disabled={Boolean(busy)} onClick={() => void ask()}>
          {t.send}
        </button>
        {answer ? <p className="mt-3 text-sm font-semibold">{answer}</p> : null}
      </section>
    </div>
  );
}

async function readGate(user: `0x${string}`): Promise<Gate> {
  const client = publicMonad();
  try {
    const slot = await client.getStorageAt({ address: APASS, slot: IMPL_SLOT });
    const impl = slot && slot !== "0x" ? (`0x${slot.slice(-40)}` as `0x${string}`) : null;
    if (!impl || impl === "0x0000000000000000000000000000000000000000") return "unavailable";
    const now = Math.floor(Date.now() / 1000);
    const data = await client.readContract({ address: APASS, abi: apassAbi, functionName: "getAPassData", args: [user] });
    const status = Number(data[0]);
    const expiry = Number(data[5]);
    if (status === 1 && expiry > now) return "verified";
    return "rejected";
  } catch {
    return "unavailable";
  }
}
