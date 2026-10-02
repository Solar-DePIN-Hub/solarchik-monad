import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useConnection, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { ContractFields } from "@/components/contract-fields";
import { useContracts, useHasCode } from "@/components/use-contracts";
import { ensureMonadChain } from "@/components/wallet-button";
import { addressUrl, monadTestnet, streakAbi, txUrl } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";
import { addTx, readSave, subscribeStore, type SavedTx } from "@/lib/storage";
import { classifyTx, formatCountdown, type TxFail } from "@/lib/tx";

export const Route = createFileRoute("/check-in")({ component: CheckInPage });

type Status = "idle" | "pending" | "success" | TxFail;

function CheckInPage() {
  const { t, lang } = useI18n();
  const pair = useContracts();
  const connection = useConnection();
  const code = useHasCode(pair.streak);
  const client = usePublicClient({ chainId: monadTestnet.id });
  const write = useWriteContract();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [status, setStatus] = useState<Status>("idle");
  const [txs, setTxs] = useState<SavedTx[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const pull = () => setTxs(readSave().txs.filter((tx) => tx.kind === "check-in"));
    pull();
    return subscribeStore(pull);
  }, []);

  const enabled = Boolean(pair.streak && connection.address && code.hasCode);
  const streak = useReadContract({
    address: pair.streak ?? undefined,
    abi: streakAbi,
    functionName: "streak",
    args: connection.address ? [connection.address] : undefined,
    chainId: monadTestnet.id,
    query: { enabled },
  });
  const last = useReadContract({
    address: pair.streak ?? undefined,
    abi: streakAbi,
    functionName: "lastCheckIn",
    args: connection.address ? [connection.address] : undefined,
    chainId: monadTestnet.id,
    query: { enabled },
  });
  const can = useReadContract({
    address: pair.streak ?? undefined,
    abi: streakAbi,
    functionName: "canCheckIn",
    args: connection.address ? [connection.address] : undefined,
    chainId: monadTestnet.id,
    query: { enabled },
  });

  const lastSec = last.data !== undefined ? Number(last.data) : 0;
  const nextAt = lastSec > 0 ? lastSec + 24 * 60 * 60 : 0;
  const left = nextAt > now ? nextAt - now : 0;
  const resetting = lastSec > 0 && now > lastSec + 48 * 60 * 60;
  const ready = Boolean(can.data) && connection.chainId === monadTestnet.id;
  const when = new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  async function onCheckIn() {
    if (!pair.streak || !client) return;
    setStatus("pending");
    try {
      if (connection.chainId !== monadTestnet.id) await ensureMonadChain();
      const hash = await write.mutateAsync({
        address: pair.streak,
        abi: streakAbi,
        functionName: "checkIn",
        chainId: monadTestnet.id,
      });
      await client.waitForTransactionReceipt({ hash });
      addTx({ hash, at: Date.now(), kind: "check-in", note: "" });
      setStatus("success");
      await Promise.all([streak.refetch(), last.refetch(), can.refetch()]);
    } catch (err) {
      setStatus(classifyTx(err));
    }
  }

  const message =
    status === "pending"
      ? t.checkin.pending
      : status === "success"
        ? t.checkin.success
        : status === "rejected"
          ? t.checkin.rejected
          : status === "tooSoon"
            ? t.checkin.tooSoon
            : status === "other"
              ? t.checkin.failed
              : "";

  return (
    <div className="rise flex flex-col gap-4">
      <header>
        <p className="pill">{t.checkin.onMonad}</p>
        <h1 className="font-display mt-3 text-4xl">{t.checkin.title}</h1>
        <p className="mt-2 text-ink-soft">{t.checkin.lead}</p>
      </header>
      <section className="card p-5">
        <p className="text-sm text-ink-soft">{t.home.streakLabel}</p>
        <p className="font-display text-6xl leading-none">{streak.data !== undefined ? streak.data.toString() : "—"}</p>
        <p className="mt-3 text-sm">
          {lastSec > 0 ? `${t.checkin.last}: ${when.format(lastSec * 1000)}` : t.checkin.never}
        </p>
        {left > 0 ? (
          <p className="mt-1 text-sm">
            {t.checkin.next}: {formatCountdown(left)}
          </p>
        ) : null}
        {resetting ? <p className="mt-2 text-sm">{t.checkin.resetHint}</p> : null}
        {!pair.streak ? <p className="mt-3 text-sm">{t.checkin.noContract}</p> : null}
        {pair.streak && !code.loading && !code.hasCode ? <p className="mt-3 text-sm">{t.checkin.noCode}</p> : null}
        {streak.isError ? <p className="mt-3 text-sm">{t.checkin.rpc}</p> : null}
        {!connection.address ? <p className="mt-3 text-sm">{t.strategy.needWallet}</p> : null}
        {pair.streak ? (
          <a className="mt-2 inline-block text-sm font-semibold" href={addressUrl(pair.streak)} target="_blank" rel="noreferrer">
            {t.judges.explorer}
          </a>
        ) : null}
        <button type="button" className="btn btn-ember btn-block mt-4" disabled={!ready || status === "pending"} onClick={() => void onCheckIn()}>
          {status === "pending" ? t.checkin.pending : left > 0 ? t.checkin.waiting : t.checkin.now}
        </button>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
        {streak.isError ? (
          <button type="button" className="btn btn-ghost mt-3" onClick={() => void streak.refetch()}>
            {t.checkin.retry}
          </button>
        ) : null}
      </section>
      <section className="card p-4">
        <h2 className="font-display text-xl">{t.checkin.history}</h2>
        {txs.length === 0 ? <p className="mt-2 text-sm text-ink-soft">{t.checkin.emptyTx}</p> : null}
        <ul className="mt-2 space-y-2">
          {txs.map((tx) => (
            <li key={tx.hash}>
              <a className="text-sm font-semibold" href={txUrl(tx.hash)} target="_blank" rel="noreferrer">
                {tx.hash.slice(0, 10)}…{tx.hash.slice(-4)}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <ContractFields />
    </div>
  );
}
