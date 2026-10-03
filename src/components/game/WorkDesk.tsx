import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { activeChain, addressUrl, DEPLOYED, strategyAbi, txUrl } from "@/lib/chain";
import { ensureMonadChain } from "@/components/wallet-button";
import type { Locale } from "@/lib/game/i18n";

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

const STRATEGIES = [
  { name: "combo-free", risk: 1 as const, role: "combo", fee: "5% of paper profit" },
  { name: "desk-free", risk: 2 as const, role: "desk", fee: "5% of paper profit" },
  { name: "pred-free", risk: 3 as const, role: "pred", fee: "5% of paper profit" },
  { name: "combo-pro", risk: 1 as const, role: "combo", fee: "0% in the old design" },
  { name: "desk-pro", risk: 2 as const, role: "desk", fee: "0% in the old design" },
];

type Owned = { id: string; name: string; risk: number; lockedUntil: number };

type PaperRow = { id: string; name: string; move: string; size: string; at: number };

const PAPER_KEY = "solarchik.work.paper";

function readPaper(): PaperRow[] {
  try {
    const raw = localStorage.getItem(PAPER_KEY);
    const parsed = raw ? (JSON.parse(raw) as PaperRow[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

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
  onBack,
}: {
  locale: Locale;
  onBack: () => void;
}) {
  const [account, setAccount] = useState("");
  const [owned, setOwned] = useState<Owned[]>([]);
  const [picked, setPicked] = useState("");
  const [rows, setRows] = useState<PaperRow[]>(() => (typeof localStorage === "undefined" ? [] : readPaper()));
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [hash, setHash] = useState("");

  async function connect() {
    setNote("");
    try {
      const bag = await wallet();
      setAccount(bag.account);
      await load(bag.account, bag.reader);
    } catch (err) {
      setNote(err instanceof Error ? err.message.slice(0, 160) : "rejected");
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
    if (!picked && next[0]) setPicked(next[0].id);
  }

  async function mint(name: string, risk: 1 | 2 | 3) {
    if (busy) return;
    setBusy(name);
    setNote("");
    try {
      const bag = await wallet();
      setAccount(bag.account);
      const tx = await bag.client.writeContract({
        address: DEPLOYED.strategy,
        abi: strategyAbi,
        functionName: "mint",
        args: [name, risk],
        account: bag.account,
        chain: activeChain,
      });
      const receipt = await bag.reader.waitForTransactionReceipt({ hash: tx });
      setHash(tx);
      setNote(receipt.status === "success" ? `Minted ${name}. Paper NFT, no payment, no trade.` : "Mint reverted.");
      await load(bag.account, bag.reader);
    } catch (err) {
      setNote(err instanceof Error ? err.message.slice(0, 180) : "rejected");
    } finally {
      setBusy("");
    }
  }

  function runPaper() {
    const card = owned.find((item) => item.id === picked);
    if (!card) {
      setNote("Mint a strategy first. The paper row needs a token that is already on Monad.");
      return;
    }
    const row: PaperRow = {
      id: card.id,
      name: card.name,
      move: "SKIP",
      size: "0",
      at: Date.now(),
    };
    const next = [row, ...rows].slice(0, 12);
    setRows(next);
    localStorage.setItem(PAPER_KEY, JSON.stringify(next));
    setNote("Paper tick only. Price feed is not Chainlink on Monad testnet, so no position was opened and nothing was sent.");
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
      <a className="mt-2 inline-block text-sm font-semibold underline" href={addressUrl(DEPLOYED.strategy)} target="_blank" rel="noreferrer">
        Strategy contract
      </a>

      <button type="button" className="mt-4 h-11 rounded-md bg-[#e8b931] px-4 text-sm font-semibold text-[#1b140c]" onClick={() => void connect()}>
        {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect Monad wallet"}
      </button>

      <section className="mt-4 grid gap-2">
        {STRATEGIES.map((item) => (
          <article key={item.name} className="flex items-center justify-between gap-3 rounded-lg bg-[#2a2118] p-3">
            <div>
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-[#d9c7a2]">
                {item.role} · risk {item.risk} · {item.fee}
              </p>
            </div>
            <button
              type="button"
              disabled={busy !== ""}
              className="h-10 shrink-0 rounded-md bg-[#f6e7c1] px-3 text-sm font-semibold text-[#1b140c] disabled:opacity-60"
              onClick={() => void mint(item.name, item.risk)}
            >
              {busy === item.name ? "Minting…" : "Mint"}
            </button>
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-lg bg-[#2a2118] p-4">
        <h2 className="text-sm font-semibold">On this wallet</h2>
        {owned.length === 0 ? <p className="mt-2 text-sm text-[#d9c7a2]">No strategy NFT yet.</p> : null}
        <ul className="mt-2 space-y-2">
          {owned.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={
                  "w-full rounded-md px-3 py-2 text-left text-sm " +
                  (picked === item.id ? "bg-[#e8b931] text-[#1b140c]" : "bg-[#1b140c]")
                }
                onClick={() => setPicked(item.id)}
              >
                #{item.id} {item.name} · risk {item.risk}
                {item.lockedUntil * 1000 > Date.now() ? " · transfer locked" : ""}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-3 h-11 w-full rounded-md border border-[#e8b931] text-sm font-semibold" onClick={runPaper}>
          Run one paper tick
        </button>
        <p className="mt-2 text-xs text-[#d9c7a2]">The tick stays in this browser. It is not a transaction.</p>
        <ul className="mt-3 space-y-1 text-sm">
          {rows.map((row) => (
            <li key={`${row.at}-${row.id}`}>
              #{row.id} {row.name} · {row.move}
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
