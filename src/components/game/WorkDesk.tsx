import { useEffect, useState } from "react";
import { ArrowLeft, Mic } from "lucide-react";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { activeChain, DEPLOYED, strategyAbi, txUrl } from "@/lib/chain";
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
  const [pick, setPick] = useState<Record<CatalogAgent["key"], WindowCode>>({
    btc11: "15m",
    weather: "15m",
    scout04: "15m",
    combo: "15m",
  });

  useEffect(() => {
    const eth = (window as Window & { ethereum?: Eth }).ethereum;
    if (!eth) return;
    let cancel = false;
    void eth.request({ method: "eth_accounts" }).then((rows) => {
      const first = (rows as string[])[0] as `0x${string}` | undefined;
      if (!first || cancel) return;
      setAccount(first);
      const reader = createPublicClient({ chain: activeChain, transport: http(activeChain.rpcUrls.default.http[0]) });
      void load(first, reader);
    });
    return () => {
      cancel = true;
    };
    // The owned list should be on screen before the first click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setNote(
        uk
          ? "Сесійний ключ поповнено на 0.02 MON. Наступний забіг може записати до 40 сонць без нового вікна."
          : "Session key funded with 0.02 MON. The next roof run can record up to 40 suns without another popup.",
      );
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
    const chainName = card.chainLabel;
    setBusy(key);
    setNote("");
    try {
      const bag = await wallet();
      setAccount(bag.account);
      const ownedNow = await tokens(bag.account, bag.reader);
      const known = new Set(ownedNow.map((item) => item.id));
      let token = ownedNow.find((item) => item.name === chainName || item.name.startsWith(card.chainName));
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
        const after = await tokens(bag.account, bag.reader);
        token = after.find((item) => !known.has(item.id)) || after.find((item) => item.name.startsWith(card.chainName));
      } else if (token.name !== chainName) {
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
      remember({ key: card.key, tokenId: token.id, status: "running", windows: card.windows, risk: card.risk });
      await load(bag.account, bag.reader);
      setNote(
        uk
          ? `Працює. NFT #${token.id} зберігає «${chainName}». Угоду не відправлено.`
          : `Working. NFT #${token.id} stores “${chainName}”. No order was sent.`,
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
    if (/metamask|provider|ethereum/i.test(msg)) {
      return uk ? "Відкрий MetaMask. Мережа має бути Monad testnet." : "Open MetaMask. The network has to be Monad testnet.";
    }
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
    <div className="min-h-dvh overflow-y-auto bg-bg px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] text-fg">
      <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" className="mb-2 flex h-11 items-center gap-2 text-sm font-semibold" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Yard
          </button>
          <p className="text-xs uppercase tracking-wide text-muted">
            {uk ? "Соларчик · тестовий Monad" : "Solarchik · Monad testnet"}
          </p>
          <h1 className="font-display text-lg leading-tight">{uk ? "Робочий стіл" : "Work desk"}</h1>
          <p className="mt-1 text-xs text-muted">Monad testnet · MetaMask · ERC-721</p>
        </div>
        <button
          type="button"
          className="mt-2 h-11 shrink-0 rounded-md border border-border bg-elevated px-3 text-xs font-semibold"
          onClick={() => void connect()}
        >
          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : uk ? "Гаманець" : "Wallet"}
        </button>
      </div>

      <section className="mx-auto mt-4 max-w-lg rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{uk ? "Сонця в мережі" : "Suns on chain"}</h2>
        <p className="mt-1 text-xs text-muted">
          {uk
            ? "Один підпис кличе authorize і кладе 0.02 MON на сесійний ключ. Далі забіг пише recordSuns без нового вікна. Рахунок на дворі лишається на пристрої."
            : "One signature calls authorize and funds the session key with 0.02 MON. Later runs call recordSuns with no new popup. The yard score stays on this device."}
        </p>
        <p className="mt-2 text-sm">{uk ? "У контракті" : "On the contract"}: {chainTotal === null ? "—" : chainTotal}</p>
        <button
          type="button"
          disabled={busy !== ""}
          className="mt-3 h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-fg disabled:opacity-60"
          onClick={() => void allowSuns()}
        >
          {busy === "suns" ? (uk ? "Підпис…" : "Signing…") : uk ? "Дозволити запис сонць" : "Allow sun recording"}
        </button>
      </section>

      <ul className="mx-auto mt-4 grid max-w-lg gap-3">
        {CATALOG.map((item) => {
          const held = owned.find((token) => token.name === item.chainLabel || token.name.startsWith(item.chainName));
          const live = run?.key === item.key && run.status === "running";
          return (
            <li key={item.key} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted">{uk ? `Клас ${item.classId}` : `Class ${item.classId}`}</div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted">{uk ? item.blurb.uk : item.blurb.en}</p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{uk ? "безкоштовно" : "free"}</div>
                  <div className="text-xs text-muted">{uk ? "лише комісія мережі" : "network fee only"}</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {live
                  ? uk
                    ? "Працює. Пауза лише в браузері, транзакції немає."
                    : "Working. Pause stays in this browser. No transaction."
                  : held
                    ? uk
                      ? `NFT #${held.id} записано. Угоди немає.`
                      : `NFT #${held.id} is stored. No order.`
                    : uk
                      ? "NFT ще немає."
                      : "No NFT yet."}
              </p>
              {held ? (
                <a
                  className="mt-1 block text-xs font-semibold underline"
                  href={`https://testnet.monadexplorer.com/token/${DEPLOYED.strategy}/instance/${held.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  NFT #{held.id} · {held.name}
                </a>
              ) : null}
              {live ? (
                <button
                  type="button"
                  className="mt-3 h-11 w-full rounded-md border border-primary text-sm font-semibold"
                  onClick={() => stopAgent(item.key)}
                >
                  {uk ? "Пауза · лише в браузері" : "Pause · this browser only"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy !== ""}
                  className="mt-3 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-fg disabled:opacity-60"
                  onClick={() => void getAgent(item.key)}
                >
                  {busy === item.key ? (uk ? "Підпис…" : "Signing…") : uk ? "Взяти і працювати" : "Take and work"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {note ? <p className="mx-auto mt-3 max-w-lg text-sm">{note}</p> : null}
      {hash ? (
        <a className="mx-auto mt-1 block max-w-lg break-all text-sm font-semibold underline" href={txUrl(hash)} target="_blank" rel="noreferrer">
          {hash}
        </a>
      ) : null}

      <div className="mx-auto max-w-lg">
      <section className="mt-4 rounded-lg bg-[#2a2118] p-4 text-[#f6e7c1]">
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
    </div>
  );
}
