import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createPublicClient, createWalletClient, custom, http, isAddress, parseEther } from "viem";
import { activeChain, DEPLOYED, strategyAbi, txUrl } from "@/lib/chain";
import { ensureMonadChain } from "@/components/wallet-button";
import type { Locale } from "@/lib/game/i18n";

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

async function wallet() {
  const eth = (window as Window & { ethereum?: Eth }).ethereum;
  if (!eth) throw new Error("wallet");
  await ensureMonadChain();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const account = accounts[0] as `0x${string}` | undefined;
  if (!account) throw new Error("wallet");
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
  const [name, setName] = useState("Roof");
  const [risk, setRisk] = useState<1 | 2 | 3>(1);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"mint" | "send" | null>(null);
  const [note, setNote] = useState("");
  const [hash, setHash] = useState("");

  async function onMint() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || busy) return;
    setBusy("mint");
    setNote("");
    try {
      const { account, client, reader } = await wallet();
      const tx = await client.writeContract({
        address: DEPLOYED.strategy,
        abi: strategyAbi,
        functionName: "mint",
        args: [trimmed, risk],
        account,
        chain: activeChain,
      });
      const receipt = await reader.waitForTransactionReceipt({ hash: tx });
      setHash(tx);
      setNote(receipt.status === "success" ? "Minted. Paper strategy, not a trade." : "Mint reverted.");
    } catch (err) {
      setNote(err instanceof Error ? err.message.slice(0, 160) : "rejected");
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    if (!isAddress(to) || busy) {
      setNote("Paste a 0x address.");
      return;
    }
    setBusy("send");
    setNote("");
    try {
      const { account, client, reader } = await wallet();
      const tx = await client.sendTransaction({
        account,
        chain: activeChain,
        to,
        value: parseEther("0.001"),
      });
      const receipt = await reader.waitForTransactionReceipt({ hash: tx });
      setHash(tx);
      setNote(receipt.status === "success" ? "Sent 0.001 MON." : "Transfer reverted.");
    } catch (err) {
      setNote(err instanceof Error ? err.message.slice(0, 160) : "rejected");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#1b140c] px-4 pb-8 pt-4 text-[#f6e7c1]">
      <button type="button" className="flex h-11 items-center gap-2 text-sm font-semibold" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Yard
      </button>
      <h1 className="mt-2 font-display text-3xl">Work</h1>
      <p className="mt-1 max-w-sm text-sm text-[#d9c7a2]">
        Monad testnet. Mint is a paper strategy NFT. The 0.001 MON send is a real transfer. Nothing here is a trade.
      </p>

      <section className="mt-4 rounded-lg bg-[#2a2118] p-4">
        <h2 className="text-sm font-semibold">Mint strategy</h2>
        <p className="mt-1 break-all text-xs text-[#d9c7a2]">{DEPLOYED.strategy}</p>
        <input
          className="mt-3 h-11 w-full rounded-md bg-[#1b140c] px-3 text-sm"
          value={name}
          maxLength={32}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={
                "h-10 rounded-md text-sm font-semibold " +
                (risk === level ? "bg-[#e8b931] text-[#1b140c]" : "bg-[#1b140c]")
              }
              onClick={() => setRisk(level)}
            >
              {level === 1 ? "Low" : level === 2 ? "Mid" : "High"}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy !== null}
          className="mt-3 h-12 w-full rounded-md bg-[#e8b931] text-sm font-semibold text-[#1b140c] disabled:opacity-60"
          onClick={() => void onMint()}
        >
          {busy === "mint" ? "Minting…" : "Mint on Monad"}
        </button>
      </section>

      <section className="mt-3 rounded-lg bg-[#2a2118] p-4">
        <h2 className="text-sm font-semibold">Send 0.001 MON</h2>
        <input
          className="mt-3 h-11 w-full rounded-md bg-[#1b140c] px-3 text-sm"
          placeholder="0x…"
          value={to}
          spellCheck={false}
          onChange={(event) => setTo(event.target.value.trim())}
        />
        <button
          type="button"
          disabled={busy !== null}
          className="mt-3 h-12 w-full rounded-md bg-[#f6e7c1] text-sm font-semibold text-[#1b140c] disabled:opacity-60"
          onClick={() => void onSend()}
        >
          {busy === "send" ? "Sending…" : "Send 0.001 MON"}
        </button>
      </section>

      {note ? <p className="mt-3 text-sm">{note}</p> : null}
      {hash ? (
        <a className="mt-2 break-all text-sm font-semibold underline" href={txUrl(hash)} target="_blank" rel="noreferrer">
          {hash}
        </a>
      ) : null}
    </div>
  );
}
