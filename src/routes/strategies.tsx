import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { useConnection, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { ContractFields } from "@/components/contract-fields";
import { useContracts, useHasCode } from "@/components/use-contracts";
import { ensureMonadChain } from "@/components/wallet-button";
import { addressUrl, activeChain, decodeJsonUri, strategyAbi } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";
import { addTx } from "@/lib/storage";
import { classifyTx, fill, type TxFail } from "@/lib/tx";

export const Route = createFileRoute("/strategies")({ component: StrategiesPage });

type Risk = 1 | 2 | 3;
type Status = "idle" | "pending" | "minted" | "updated" | "sent" | TxFail;

function nameOk(value: string) {
  const trimmed = value.trim();
  const bytes = new TextEncoder().encode(trimmed).length;
  return bytes >= 1 && bytes <= 64 && !trimmed.includes('"') && !trimmed.includes("\\");
}

function StrategiesPage() {
  const { t } = useI18n();
  const pair = useContracts();
  const connection = useConnection();
  const code = useHasCode(pair.strategy);
  const client = usePublicClient({ chainId: activeChain.id });
  const write = useWriteContract();
  const [name, setName] = useState("");
  const [risk, setRisk] = useState<Risk>(2);
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; risk: Risk; to: string }>>({});
  const [meta, setMeta] = useState<Record<string, string>>({});

  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const enabled = Boolean(pair.strategy && connection.address && code.hasCode);
  const owned = useReadContract({
    address: pair.strategy ?? undefined,
    abi: strategyAbi,
    functionName: "tokensOfOwner",
    args: connection.address ? [connection.address] : undefined,
    chainId: activeChain.id,
    query: { enabled },
  });
  const ids = owned.data ?? EMPTY_IDS;
  const details = useReadContracts({
    contracts: ids.map((id) => ({
      address: pair.strategy!,
      abi: strategyAbi,
      functionName: "strategyOf" as const,
      args: [id] as const,
      chainId: activeChain.id,
    })),
    query: { enabled: ids.length > 0 && Boolean(pair.strategy) },
  });

  const riskLabel = (value: number) => (value === 1 ? t.strategy.low : value === 3 ? t.strategy.high : t.strategy.med);

  async function send(
    kind: "mint" | "update" | "transfer",
    run: () => Promise<`0x${string}`>,
    success: Status,
    successText: string,
  ) {
    if (!client || !pair.strategy) return;
    setStatus("pending");
    setNote("");
    try {
      if (connection.chainId !== activeChain.id) await ensureMonadChain();
      const hash = await run();
      await client.waitForTransactionReceipt({ hash });
      addTx({ hash, at: Date.now(), kind, note: "" });
      setStatus(success);
      setNote(successText);
      await owned.refetch();
      await details.refetch();
    } catch (err) {
      const fail = classifyTx(err);
      setStatus(fail);
      setNote(fail === "rejected" ? t.strategy.rejected : fail === "locked" ? t.strategy.free : t.strategy.failed);
    }
  }

  async function onMint() {
    if (!pair.strategy || !nameOk(name)) {
      setNote(t.strategy.nameErr);
      return;
    }
    await send(
      "mint",
      () =>
        write.mutateAsync({
          address: pair.strategy!,
          abi: strategyAbi,
          functionName: "mint",
          args: [name.trim(), risk],
          chainId: activeChain.id,
        }),
      "minted",
      t.strategy.minted,
    );
    setName("");
  }

  const message = status === "pending" ? t.checkin.pending : note;

  return (
    <div className="rise flex flex-col gap-4">
      <header>
        <p className="pill pill-warn">{t.strategy.paper}</p>
        <h1 className="font-display mt-3 text-4xl">{t.strategy.title}</h1>
        <p className="mt-2 text-ink-soft">{t.strategy.lead}</p>
      </header>
      <section className="card p-4">
        <h2 className="font-display text-xl">{t.strategy.simTitle}</h2>
        <p className="mt-1 text-sm">{t.strategy.simBody}</p>
      </section>
      <section className="card p-4">
        <label className="text-sm font-semibold" htmlFor="strategy-name">
          {t.strategy.name}
        </label>
        <input id="strategy-name" className="field mt-1" value={name} placeholder={t.strategy.namePh} onChange={(e) => setName(e.target.value)} />
        <p className="mt-3 text-sm font-semibold">{t.strategy.risk}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((level) => (
            <button key={level} type="button" className={risk === level ? "btn btn-sun" : "btn btn-ghost"} onClick={() => setRisk(level)}>
              {riskLabel(level)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-soft">{t.strategy.lockNote}</p>
        {!connection.address ? <p className="mt-2 text-sm">{t.strategy.needWallet}</p> : null}
        {!pair.strategy ? <p className="mt-2 text-sm">{t.strategy.noContract}</p> : null}
        {pair.strategy && !code.loading && !code.hasCode ? <p className="mt-2 text-sm">{t.strategy.noCode}</p> : null}
        {pair.strategy ? (
          <a className="mt-2 inline-block text-sm font-semibold" href={addressUrl(pair.strategy)} target="_blank" rel="noreferrer">
            {t.judges.explorer}
          </a>
        ) : null}
        <button
          type="button"
          className="btn btn-ember btn-block mt-4"
          disabled={!enabled || status === "pending" || connection.chainId !== activeChain.id}
          onClick={() => void onMint()}
        >
          {status === "pending" ? t.strategy.minting : t.strategy.mint}
        </button>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t.strategy.gallery}</h2>
        {enabled && ids.length === 0 && !owned.isLoading ? <p className="mt-2 text-sm text-ink-soft">{t.strategy.empty}</p> : null}
        <ul className="mt-3 space-y-3">
          {ids.map((id, index) => {
            const row = details.data?.[index]?.result as readonly [string, number, bigint, bigint] | undefined;
            const label = row?.[0] ?? "…";
            const level = Number(row?.[1] ?? 2);
            const lockedUntil = Number(row?.[2] ?? 0);
            const locked = lockedUntil > now;
            const hours = Math.max(1, Math.ceil((lockedUntil - now) / 3600));
            const key = id.toString();
            const draft = drafts[key] ?? { name: label === "…" ? "" : label, risk: (level as Risk) || 2, to: "" };
            return (
              <li key={key} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-ink-soft">
                      {t.strategy.token} #{key}
                    </p>
                    <h3 className="font-display text-2xl">{label}</h3>
                    <p className="text-sm">
                      {riskLabel(level)} · {t.strategy.paper}
                    </p>
                    <p className="mt-1 text-sm">{locked ? fill(t.strategy.lockedFor, { hours }) : t.strategy.free}</p>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(open === key ? null : key)}>
                    {t.strategy.update}
                  </button>
                </div>
                {open === key ? (
                  <div className="mt-3 space-y-2">
                    <input
                      className="field"
                      value={draft.name}
                      onChange={(e) => setDrafts({ ...drafts, [key]: { ...draft, name: e.target.value } })}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {([1, 2, 3] as const).map((levelOption) => (
                        <button
                          key={levelOption}
                          type="button"
                          className={draft.risk === levelOption ? "btn btn-sun" : "btn btn-ghost"}
                          onClick={() => setDrafts({ ...drafts, [key]: { ...draft, risk: levelOption } })}
                        >
                          {riskLabel(levelOption)}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ember btn-block"
                      disabled={status === "pending"}
                      onClick={() => {
                        if (!pair.strategy || !nameOk(draft.name)) {
                          setNote(t.strategy.nameErr);
                          return;
                        }
                        void send(
                          "update",
                          () =>
                            write.mutateAsync({
                              address: pair.strategy!,
                              abi: strategyAbi,
                              functionName: "updateStrategy",
                              args: [id, draft.name.trim(), draft.risk],
                              chainId: activeChain.id,
                            }),
                          "updated",
                          t.strategy.updated,
                        );
                      }}
                    >
                      {t.strategy.update}
                    </button>
                    <label className="block text-sm font-semibold" htmlFor={`to-${key}`}>
                      {t.strategy.to}
                    </label>
                    <input
                      id={`to-${key}`}
                      className="field"
                      value={draft.to}
                      spellCheck={false}
                      onChange={(e) => setDrafts({ ...drafts, [key]: { ...draft, to: e.target.value } })}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-block"
                      disabled={locked || status === "pending"}
                      onClick={() => {
                        if (!pair.strategy || !connection.address || !isAddress(draft.to)) {
                          setNote(t.strategy.addrErr);
                          return;
                        }
                        void send(
                          "transfer",
                          () =>
                            write.mutateAsync({
                              address: pair.strategy!,
                              abi: strategyAbi,
                              functionName: "safeTransferFrom",
                              args: [connection.address!, draft.to as `0x${string}`, id],
                              chainId: activeChain.id,
                            }),
                          "sent",
                          t.strategy.sent,
                        );
                      }}
                    >
                      {locked ? fill(t.strategy.lockedFor, { hours }) : t.strategy.send}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-block"
                      onClick={() => {
                        if (!client || !pair.strategy) return;
                        if (meta[key]) {
                          setMeta({ ...meta, [key]: "" });
                          return;
                        }
                        void client
                          .readContract({
                            address: pair.strategy,
                            abi: strategyAbi,
                            functionName: "tokenURI",
                            args: [id],
                          })
                          .then((uri) => setMeta({ ...meta, [key]: decodeJsonUri(uri) }));
                      }}
                    >
                      {meta[key] ? t.strategy.hideMeta : t.strategy.metadata}
                    </button>
                    {meta[key] ? <pre className="code whitespace-pre-wrap">{meta[key]}</pre> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <ContractFields />
    </div>
  );
}

const EMPTY_IDS: readonly bigint[] = [];
