import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { useConnection, useReadContract, useWriteContract } from "wagmi";
import { useContracts, useHasCode } from "@/components/use-contracts";
import { ensureMonadChain } from "@/components/wallet-button";
import { agentAccount } from "@/lib/agent-key";
import { activeChain, agentAbi, priceFeed, txUrl } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";

export const Route = createFileRoute("/agent")({ component: AgentPage });

function formatPrice(price: bigint, decimals: number) {
  const neg = price < 0n;
  const abs = neg ? -price : price;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(decimals, "0").slice(0, 8);
  return `${neg ? "-" : ""}${whole.toString()}.${frac}`;
}

function AgentPage() {
  const { t } = useI18n();
  const pair = useContracts();
  const code = useHasCode(pair.agent);
  const connection = useConnection();
  const write = useWriteContract();
  const [agentAddr, setAgentAddr] = useState<`0x${string}` | null>(null);
  const [strategyId, setStrategyId] = useState("0");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [lastHash, setLastHash] = useState<string | null>(null);
  const privyId = import.meta.env.VITE_PRIVY_APP_ID;

  useEffect(() => {
    setAgentAddr(agentAccount().address);
  }, []);

  const enabled = Boolean(pair.agent && code.hasCode);
  const quote = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "quote",
    chainId: activeChain.id,
    query: { enabled },
  });
  const paused = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "paused",
    chainId: activeChain.id,
    query: { enabled },
  });
  const agent = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "agent",
    chainId: activeChain.id,
    query: { enabled },
  });
  const maxPer = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "maxPerTrade",
    chainId: activeChain.id,
    query: { enabled },
  });
  const daily = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "dailyCap",
    chainId: activeChain.id,
    query: { enabled },
  });
  const spent = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "spentToday",
    chainId: activeChain.id,
    query: { enabled },
  });
  const papers = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "paperCount",
    chainId: activeChain.id,
    query: { enabled },
  });
  const feed = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "feed",
    chainId: activeChain.id,
    query: { enabled },
  });

  const lastIndex = papers.data && papers.data > 0n ? papers.data - 1n : null;
  const last = useReadContract({
    address: pair.agent ?? undefined,
    abi: agentAbi,
    functionName: "paperAt",
    args: lastIndex !== null ? [lastIndex] : undefined,
    chainId: activeChain.id,
    query: { enabled: enabled && lastIndex !== null },
  });

  async function refresh() {
    await Promise.all([quote.refetch(), paused.refetch(), agent.refetch(), spent.refetch(), papers.refetch(), last.refetch()]);
  }

  async function ownerTx(fn: "configure" | "pause" | "unpause" | "revoke") {
    if (!pair.agent || !connection.address) {
      setError(t.agent.needWallet);
      return;
    }
    setError("");
    setBusy(fn);
    try {
      if (connection.chainId !== activeChain.id) await ensureMonadChain();
      const hash =
        fn === "configure"
          ? await write.writeContractAsync({
              address: pair.agent,
              abi: agentAbi,
              functionName: "configure",
              args: [agentAddr ?? agentAccount().address, 1n, 20n, 3],
              value: parseEther("0.01"),
              chainId: activeChain.id,
            })
          : await write.writeContractAsync({
              address: pair.agent,
              abi: agentAbi,
              functionName: fn,
              chainId: activeChain.id,
            });
      setLastHash(hash);
      const client = createPublicClient({ chain: activeChain, transport: http(activeChain.rpcUrls.default.http[0]) });
      await client.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message.slice(0, 160) : t.checkin.failed);
    } finally {
      setBusy("");
    }
  }

  async function record(action: 1 | 2) {
    if (!pair.agent || !agentAddr) return;
    setError("");
    setBusy("record");
    try {
      const account = agentAccount();
      const transport = http(activeChain.rpcUrls.default.http[0]);
      const wallet = createWalletClient({ account, chain: activeChain, transport });
      const client = createPublicClient({ chain: activeChain, transport });
      const id = BigInt(strategyId || "0");
      const hash = await wallet.writeContract({
        address: pair.agent,
        abi: agentAbi,
        functionName: "recordPaper",
        args: [id, action, 1n],
      });
      setLastHash(hash);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("reverted");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message.slice(0, 160) : t.checkin.failed);
    } finally {
      setBusy("");
    }
  }

  const quoteRow = quote.data;
  const fromChainlink = Boolean(quoteRow?.[2]);
  const agentSet = agentAddr && agent.data && agent.data.toLowerCase() === agentAddr.toLowerCase();

  return (
    <div className="rise flex flex-col gap-4 pb-4">
      <header>
        <p className="pill pill-warn">{t.agent.sim}</p>
        <h1 className="font-display mt-3 text-4xl">{t.agent.title}</h1>
        <p className="mt-2 text-ink-soft">{t.agent.lead}</p>
      </header>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.agent.quote}</h2>
        {enabled && quoteRow ? (
          <>
            <p className="font-display mt-2 text-3xl">{formatPrice(quoteRow[0], Number(quoteRow[1]))}</p>
            <p className="mt-1 text-sm font-semibold">{fromChainlink ? t.agent.chainlink : t.agent.fallback}</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm">{t.agent.notDeployed}</p>
            <p className="font-display mt-2 text-3xl">{t.agent.fallbackPrice}</p>
            <p className="mt-1 text-sm font-semibold">{t.agent.fallback}</p>
          </>
        )}
        {priceFeed ? <p className="mt-2 text-sm text-ink-soft">{t.agent.chainlink} {priceFeed}</p> : null}
        {feed.data ? <p className="mt-1 text-xs text-ink-soft">feed {feed.data}</p> : null}
      </section>
      {!enabled ? <p className="text-sm font-semibold">{t.agent.noContract}</p> : null}
      {enabled ? (
        <section className="card p-4 text-sm">
          <h2 className="font-display text-2xl">{t.agent.limits}</h2>
          <p className="mt-2">
            {t.agent.max}: {maxPer.data?.toString() ?? "—"} · {t.agent.daily}: {daily.data?.toString() ?? "—"} · {t.agent.spent}:{" "}
            {spent.data?.toString() ?? "—"}
          </p>
          <p className="mt-1">{paused.data ? t.agent.paused : agentSet ? t.agent.armed : t.agent.needWallet}</p>
          <p className="mt-2">
            {t.agent.papers}: {papers.data?.toString() ?? "0"}
          </p>
          {last.data ? (
            <p className="mt-1">
              {t.agent.last}: #{last.data.strategyId.toString()} · {formatPrice(last.data.price, last.data.decimals)} ·{" "}
              {last.data.fromChainlink ? t.agent.chainlink : t.agent.fallback}
            </p>
          ) : null}
          <label className="mt-3 block font-semibold" htmlFor="strategy-id">
            {t.agent.strategy}
          </label>
          <input
            id="strategy-id"
            className="field mt-1"
            inputMode="numeric"
            value={strategyId}
            onChange={(event) => setStrategyId(event.target.value.replace(/[^\d]/g, "").slice(0, 8))}
          />
          <div className="mt-3 flex flex-col gap-2">
            <button type="button" className="btn btn-sun" disabled={busy !== ""} onClick={() => void ownerTx("configure")}>
              {busy === "configure" ? t.agent.configuring : t.agent.configure}
            </button>
            <button type="button" className="btn btn-ember" disabled={busy !== "" || !agentSet || Boolean(paused.data)} onClick={() => void record(1)}>
              {t.agent.record}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy !== "" || !agentSet || Boolean(paused.data)} onClick={() => void record(2)}>
              {t.agent.result}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy !== ""} onClick={() => void ownerTx(paused.data ? "unpause" : "pause")}>
              {paused.data ? t.agent.unpause : t.agent.pause}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy !== ""} onClick={() => void ownerTx("revoke")}>
              {t.agent.revoke}
            </button>
          </div>
          {error ? <p className="mt-2 text-ember">{error}</p> : null}
          {lastHash ? (
            <a className="mt-2 inline-block font-semibold" href={txUrl(lastHash)} target="_blank" rel="noreferrer">
              {t.game.lastTx}
            </a>
          ) : null}
        </section>
      ) : null}
      <section className="card p-4 text-sm">
        <h2 className="font-display text-2xl">{t.agent.privy}</h2>
        <p className="mt-2">{privyId ? "Privy app id is set." : t.wallet.privyOff}</p>
      </section>
    </div>
  );
}
