import { useState } from "react";
import { ArrowLeft, Mic } from "lucide-react";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { activeChain, addressUrl, DEPLOYED, strategyAbi, txUrl } from "@/lib/chain";
import { ensureMonadChain } from "@/components/wallet-button";
import { authorizeSuns, chainSuns, sessionAccount } from "@/lib/game/monadSuns";
import { hearOnce, speakLocal, unlockAudio } from "@/lib/game/audio";
import {
  CATALOG,
  WINDOWS,
  catalogByKey,
  deskAnswer,
  parseStored,
  proposeWindow,
  readPending,
  readRun,
  riskWord,
  strategyName,
  windowsPhrase,
  writePending,
  writeRun,
  type AgentRun,
  type CatalogAgent,
  type PendingChange,
  type WindowCode,
} from "@/lib/game/paperAgents";
import type { Locale } from "@/lib/game/i18n";

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

type Owned = { id: string; name: string; risk: number; lockedUntil: number };

async function wallet() {
  const eth = (window as Window & { ethereum?: Eth }).ethereum;
  if (!eth) throw new Error("Connect MetaMask");
  await ensureMonadChain();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const account = accounts[0] as `0x${string}` | undefined;
  if (!account) throw new Error("Connect MetaMask");
  const client = createWalletClient({ account, chain: activeChain, transport: custom(eth) });
  const reader = createPublicClient({ chain: activeChain, transport: http(activeChain.rpcUrls.default.http[0]) });
  return { account, client, reader };
}

export function WorkDesk({
  locale,
  onBack,
}: {
  locale: Locale;
  onBack: () => void;
}) {
  const uk = locale === "uk";
  const [account, setAccount] = useState("");
  const [owned, setOwned] = useState<Owned[]>([]);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [hash, setHash] = useState("");
  const [chainTotal, setChainTotal] = useState<number | null>(null);
  const [session, setSession] = useState("");
  const [run, setRun] = useState<AgentRun | null>(() => (typeof localStorage === "undefined" ? null : readRun()));
  const [pending, setPending] = useState<PendingChange | null>(() =>
    typeof localStorage === "undefined" ? null : readPending(),
  );
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");
  const [said, setSaid] = useState("");
  const [pick, setPick] = useState<Record<CatalogAgent["key"], WindowCode>>({ btc11: "15m", scout04: "15m" });

  async function connect() {
    setNote("");
    try {
      const bag = await wallet();
      setAccount(bag.account);
      await load(bag.account, bag.reader);
      setSession(sessionAccount().address);
      setChainTotal(await chainSuns(bag.account));
    } catch (err) {
      setNote(quiet(err));
    }
  }

  async function load(owner: `0x${string}`, reader: ReturnType<typeof createPublicClient>) {
    const ids = (await reader.readContract({
      address: DEPLOYED.strategy,
      abi: strategyAbi,
      functionName: "tokensOfOwner",
      args: [owner],
    })) as bigint[];
    const next: Owned[] = [];
    for (const id of ids) {
      const row = (await reader.readContract({
        address: DEPLOYED.strategy,
        abi: strategyAbi,
        functionName: "strategyOf",
        args: [id],
      })) as readonly [string, number, bigint, bigint];
      next.push({ id: id.toString(), name: row[0], risk: Number(row[1]), lockedUntil: Number(row[2]) });
    }
    setOwned(next);
    const saved = readRun();
    let hydrated = false;
    for (const token of next) {
      const stored = parseStored(token.name);
      if (!stored?.windows) continue;
      setPick((prev) => ({ ...prev, [stored.key]: stored.windows as WindowCode }));
      const risk = token.risk === 1 || token.risk === 3 ? token.risk : 2;
      if (saved?.key === stored.key) {
        remember({ ...saved, tokenId: token.id, windows: stored.windows, risk });
      } else if (!saved && !hydrated) {
        hydrated = true;
        remember({ key: stored.key, tokenId: token.id, status: "stopped", windows: stored.windows, risk });
      }
    }
  }

  async function allowSuns() {
    if (busy) return;
    setBusy("suns");
    setNote("");
    try {
      const proof = await authorizeSuns();
      setAccount(proof.player);
      setSession(proof.session);
      setHash(proof.hash);
      setChainTotal(await chainSuns(proof.player));
      setNote("Session key funded with 0.02 MON. The next roof run can record up to 40 suns without another popup.");
    } catch (err) {
      setNote(quiet(err));
    } finally {
      setBusy("");
    }
  }

  function remember(next: AgentRun | null) {
    writeRun(next);
    setRun(next);
  }

  async function getAgent(key: CatalogAgent["key"]) {
    const card = catalogByKey(key);
    if (!card || busy) return;
    const windows = pick[key];
    const chainName = strategyName(card, windows);
    setBusy(key);
    setNote("");
    try {
      const bag = await wallet();
      setAccount(bag.account);
      let token = (await tokens(bag.account, bag.reader)).find((item) => item.name.startsWith(card.chainName));
      if (!token) {
        const tx = await bag.client.writeContract({
          address: DEPLOYED.strategy,
          abi: strategyAbi,
          functionName: "mint",
          args: [chainName, card.risk],
          account: bag.account,
          chain: activeChain,
        });
        const receipt = await bag.reader.waitForTransactionReceipt({ hash: tx });
        setHash(tx);
        if (receipt.status !== "success") throw new Error("revert");
        token = (await tokens(bag.account, bag.reader)).find((item) => item.name === chainName);
      } else {
        const tx = await bag.client.writeContract({
          address: DEPLOYED.strategy,
          abi: strategyAbi,
          functionName: "updateStrategy",
          args: [BigInt(token.id), chainName, card.risk],
          account: bag.account,
          chain: activeChain,
        });
        const receipt = await bag.reader.waitForTransactionReceipt({ hash: tx });
        setHash(tx);
        if (receipt.status !== "success") throw new Error("revert");
        token = { ...token, name: chainName, risk: card.risk };
      }
      if (!token) throw new Error("revert");
      remember({ key: card.key, tokenId: token.id, status: "running", windows, risk: card.risk });
      await load(bag.account, bag.reader);
      setNote(
        uk
          ? `NFT #${token.id} записав «${chainName}». Угоду не відправлено.`
          : `NFT #${token.id} recorded “${chainName}”. No order was sent.`,
      );
    } catch (err) {
      setNote(quiet(err));
    } finally {
      setBusy("");
    }
  }

  function stopAgent(key: CatalogAgent["key"]) {
    if (!run || run.key !== key) return;
    remember({ ...run, status: "stopped" });
    setNote(uk ? "Агент на паузі. Угоду не відправлено." : "Agent is paused. No order was sent.");
  }

  function quiet(err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (/reject|denied|cancel/i.test(msg)) {
      return uk ? "Підпис скасовано. Нічого не відправлено." : "Signature cancelled. Nothing was sent.";
    }
    if (/revert/i.test(msg)) {
      return uk
        ? "Контракт не записав NFT. Перевір Monad testnet і газ. Угоду не відправлено."
        : "The contract did not write the NFT. Check Monad testnet and gas. No order was sent.";
    }
    return uk
      ? "Не вийшло. Гаманець має бути в мережі Monad testnet. Нічого не відправлено."
      : "That did not go through. Switch the wallet to Monad testnet. Nothing was sent.";
  }

  function say(line: string) {
    setSaid(line);
    unlockAudio();
    speakLocal(line, locale, "eve");
  }

  function askAgent() {
    const text = draft.trim();
    if (!text) return;
    const answer = deskAnswer(text, locale);
    setDraft("");
    if (!answer) {
      say(
        uk
          ? "Питай, яка стратегія біжить, або постав вікно: 1, 5, 10 чи 15 хвилин."
          : "Ask what strategy is running, or set a 1, 5, 10, or 15 minute window.",
      );
      return;
    }
    say(answer.text);
    if (answer.pending) setPending(answer.pending);
  }

  function askVoice() {
    if (listening) return;
    unlockAudio();
    setListening(true);
    setSaid(uk ? "Слухаю…" : "Listening…");
    void hearOnce(locale)
      .then((text) => {
        setListening(false);
        if (!text) {
          say(uk ? "Не почув. Напиши в полі або скажи ще раз." : "Didn't catch that. Type it, or say it again.");
          return;
        }
        setDraft("");
        const answer = deskAnswer(text, locale);
        if (!answer) {
          say(
            uk
              ? `Почув: «${text}». Питай стратегію або вікно 1, 5, 10 чи 15 хвилин.`
              : `Heard “${text}”. Ask for the strategy, or a 1, 5, 10, or 15 minute window.`,
          );
          return;
        }
        say(answer.text);
        if (answer.pending) setPending(answer.pending);
      })
      .catch(() => {
        setListening(false);
        say(uk ? "Мікрофон не відкрився. Напиши в полі." : "The microphone did not open. Type it instead.");
      });
  }

  async function confirmChange() {
    if (!pending || busy) return;
    setBusy("confirm");
    setNote("");
    try {
      const bag = await wallet();
      setAccount(bag.account);
      const tx = await bag.client.writeContract({
        address: DEPLOYED.strategy,
        abi: strategyAbi,
        functionName: "updateStrategy",
        args: [BigInt(pending.tokenId), pending.chainName, pending.risk],
        account: bag.account,
        chain: activeChain,
      });
      const receipt = await bag.reader.waitForTransactionReceipt({ hash: tx });
      setHash(tx);
      if (receipt.status !== "success") throw new Error("Update reverted");
      if (run && run.tokenId === pending.tokenId) {
        remember({ ...run, windows: pending.windows, risk: pending.risk, status: "running" });
      }
      writePending(null);
      setPending(null);
      await load(bag.account, bag.reader);
      setNote(
        uk
          ? "Стратегію записано в NFT. Продаж заблоковано на 240 годин. Угоду не відправлено."
          : "Strategy written to the NFT. Transfers stay locked for 240 hours. No order was sent.",
      );
    } catch (err) {
      setNote(quiet(err));
    } finally {
      setBusy("");
    }
  }

  async function tokens(owner: `0x${string}`, reader: ReturnType<typeof createPublicClient>) {
    const ids = (await reader.readContract({
      address: DEPLOYED.strategy,
      abi: strategyAbi,
      functionName: "tokensOfOwner",
      args: [owner],
    })) as bigint[];
    const next: Owned[] = [];
    for (const id of ids) {
      const row = (await reader.readContract({
        address: DEPLOYED.strategy,
        abi: strategyAbi,
        functionName: "strategyOf",
        args: [id],
      })) as readonly [string, number, bigint, bigint];
      next.push({ id: id.toString(), name: row[0], risk: Number(row[1]), lockedUntil: Number(row[2]) });
    }
    return next;
  }

  return (
    <div className="min-h-dvh overflow-y-auto bg-[#1b140c] px-4 pb-10 pt-4 text-[#f6e7c1]">
      <button type="button" className="flex h-11 items-center gap-2 text-sm font-semibold" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Yard
      </button>
      <p className="text-xs font-semibold tracking-wide text-[#e8b931]">Monad testnet · paper desk</p>
      <h1 className="mt-1 font-display text-3xl">Work</h1>
      <p className="mt-2 max-w-md text-sm text-[#d9c7a2]">
        Same five strategy names as the Solarchik desk. Mint is a real ERC-721 on {DEPLOYED.strategy.slice(0, 6)}…{DEPLOYED.strategy.slice(-4)}. The contract does not take 0.1 MON and does not place an order.
      </p>
      <a className="mt-3 block text-sm font-semibold underline" href={addressUrl(DEPLOYED.strategy)} target="_blank" rel="noreferrer">
        Strategy contract {DEPLOYED.strategy.slice(0, 6)}…{DEPLOYED.strategy.slice(-4)}
      </a>
      <button type="button" className="mt-3 h-11 rounded-md bg-[#e8b931] px-4 text-sm font-semibold text-[#1b140c]" onClick={() => void connect()}>
        {account ? `Wallet ${account.slice(0, 6)}…${account.slice(-4)}` : "Connect Monad wallet"}
      </button>

      <section className="mt-4 rounded-lg bg-[#2a2118] p-4">
        <h2 className="text-sm font-semibold">Suns on Monad</h2>
        <p className="mt-1 text-xs text-[#d9c7a2]">
          One signature funds a session key with 0.02 MON. After that, suns from the roof run are a real recordSuns transaction. The score on the yard stays on this device.
        </p>
        <p className="mt-2 text-sm">On chain: {chainTotal === null ? "—" : chainTotal}</p>
        <p className="mt-1 break-all text-xs text-[#d9c7a2]">Session key: {session || "not created yet"}</p>
        <button
          type="button"
          disabled={busy !== ""}
          className="mt-3 h-11 rounded-md bg-[#f6e7c1] px-3 text-sm font-semibold text-[#1b140c] disabled:opacity-60"
          onClick={() => void allowSuns()}
        >
          {busy === "suns" ? "Signing…" : "Allow sun recording"}
        </button>
      </section>

      <section className="mt-4 rounded-lg bg-[#2a2118] p-4">
        <h2 className="text-sm font-semibold">{uk ? "Паперовий гаманець · симуляція" : "Paper purse · simulated"}</h2>
        <p className="mt-1 text-xs text-[#d9c7a2]">
          {uk
            ? "Агент лише записує намір. Ціни Chainlink на Monad testnet тут немає, тож угоду не відправлено."
            : "The agent only records an intent. This app has no Chainlink price on Monad testnet, so no order is sent."}
        </p>
      </section>

      <section className="mt-4 grid gap-2">
        {CATALOG.map((item) => {
          const held = owned.find((token) => token.name.startsWith(item.chainName));
          const stored = held ? parseStored(held.name) : null;
          const live = run?.key === item.key && run.status === "running";
          return (
            <article key={item.key} className="rounded-lg bg-[#2a2118] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-[#e8b931]">
                  {live ? (uk ? "Біжить" : "Running") : uk ? "Стоп" : "Stopped"}
                  {" · "}
                  {held ? (uk ? "Є NFT" : "Owned") : uk ? "Немає NFT" : "Not owned"}
                </p>
              </div>
              <p className="mt-1 text-xs text-[#d9c7a2]">
                {item.market} · {riskWord(item.risk, uk)} ·{" "}
                {stored?.windows
                  ? uk
                    ? `у NFT ${windowsPhrase(stored.windows, true)}`
                    : `on the NFT ${windowsPhrase(stored.windows, false)}`
                  : uk
                    ? "у NFT ще не записано"
                    : "not stored on an NFT yet"}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {WINDOWS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={
                      "h-8 rounded-md text-xs font-semibold " +
                      (pick[item.key] === code ? "bg-[#e8b931] text-[#1b140c]" : "bg-[#1b140c]")
                    }
                    onClick={() => setPick((prev) => ({ ...prev, [item.key]: code }))}
                  >
                    {code.replace("m", uk ? " хв" : "m")}
                  </button>
                ))}
              </div>
              {live ? (
                <button
                  type="button"
                  className="mt-3 h-10 w-full rounded-md border border-[#e8b931] text-sm font-semibold"
                  onClick={() => stopAgent(item.key)}
                >
                  {uk ? "Пауза" : "Stop"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy !== ""}
                  className="mt-3 h-10 w-full rounded-md bg-[#e8b931] text-sm font-semibold text-[#1b140c] disabled:opacity-60"
                  onClick={() => void getAgent(item.key)}
                >
                  {busy === item.key
                    ? uk
                      ? "Підпис…"
                      : "Signing…"
                    : held
                      ? uk
                        ? "Записати стратегію"
                        : "Record strategy"
                      : uk
                        ? "Замінтити NFT"
                        : "Mint NFT"}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-4 rounded-lg bg-[#2a2118] p-4">
        <h2 className="text-sm font-semibold">{uk ? "Запитай агента" : "Ask the agent"}</h2>
        <p className="mt-1 text-xs text-[#d9c7a2]">
          {uk
            ? "«Яка моя стратегія?» або «зміни на 1 / 5 / 10 / 15 хвилин»."
            : "“What is my strategy?” or “change it to 1, 5, 10, or 15 minutes.”"}
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {WINDOWS.map((code) => (
            <button
              key={code}
              type="button"
              className="h-10 rounded-md bg-[#1b140c] text-sm font-semibold"
              onClick={() => {
                const answer = proposeWindow(code, locale);
                say(answer.text);
                if (answer.pending) setPending(answer.pending);
              }}
            >
              {code.replace("m", uk ? " хв" : " min")}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            askAgent();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-md bg-[#1b140c] px-3 text-sm"
            placeholder={uk ? "Напиши агенту" : "Message the agent"}
          />
          <button type="submit" className="h-11 rounded-md bg-[#f6e7c1] px-3 text-sm font-semibold text-[#1b140c]">
            {uk ? "Далі" : "Send"}
          </button>
          <button
            type="button"
            disabled={listening}
            className="grid size-11 place-items-center rounded-md bg-[#e8b931] text-[#1b140c] disabled:opacity-60"
            aria-label={uk ? "Говорити" : "Speak"}
            onClick={askVoice}
          >
            <Mic className="size-5" />
          </button>
        </form>
        {said ? <p className="mt-3 text-sm">{said}</p> : null}
        {pending ? (
          <div className="mt-3 rounded-md bg-[#1b140c] p-3">
            <p className="text-sm font-semibold">
              {uk ? "Картка підтвердження" : "Confirmation card"}
            </p>
            <p className="mt-1 text-xs text-[#d9c7a2]">
              {uk
                ? `Записати «${pending.chainName}» у NFT #${pending.tokenId}. Продаж блокується на 240 годин. Угоди немає.`
                : `Write “${pending.chainName}” onto NFT #${pending.tokenId}. Transfers lock for 240 hours. No trade.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy !== ""}
                className="h-10 rounded-md bg-[#e8b931] px-3 text-sm font-semibold text-[#1b140c] disabled:opacity-60"
                onClick={() => void confirmChange()}
              >
                {busy === "confirm" ? (uk ? "Підпис…" : "Signing…") : uk ? "Підписати зміну" : "Sign the change"}
              </button>
              <button
                type="button"
                className="h-10 rounded-md px-3 text-sm font-semibold"
                onClick={() => {
                  writePending(null);
                  setPending(null);
                }}
              >
                {uk ? "Скасувати" : "Cancel"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-lg bg-[#2a2118] p-4">
        <h2 className="text-sm font-semibold">{uk ? "На цьому гаманці" : "On this wallet"}</h2>
        {owned.length === 0 ? (
          <p className="mt-2 text-sm text-[#d9c7a2]">{uk ? "NFT стратегії ще немає. Підключи гаманець." : "No strategy NFT yet. Connect the wallet."}</p>
        ) : null}
        <ul className="mt-2 space-y-2">
          {owned.map((item) => (
            <li key={item.id} className="rounded-md bg-[#1b140c] px-3 py-2 text-sm">
              #{item.id} {item.name} · {riskWord(item.risk === 1 || item.risk === 3 ? item.risk : 2, uk)}
              {item.lockedUntil * 1000 > Date.now() ? (uk ? " · продаж заблоковано" : " · transfer locked") : ""}
            </li>
          ))}
        </ul>
      </section>

      {note ? <p className="mt-3 text-sm">{note}</p> : null}
      {hash ? (
        <a className="mt-2 block break-all text-sm font-semibold underline" href={txUrl(hash)} target="_blank" rel="noreferrer">
          {hash}
        </a>
      ) : null}
    </div>
  );
}
