import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { FAUCET, monadTestnet, streakAbi } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";
import { readSave, subscribeStore, type Save, EMPTY_SAVE } from "@/lib/storage";
import { useContracts, useHasCode } from "@/components/use-contracts";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { t } = useI18n();
  const pair = useContracts();
  const connection = useConnection();
  const code = useHasCode(pair.streak);
  const [save, setSave] = useState<Save>(EMPTY_SAVE);
  useEffect(() => {
    const pull = () => setSave(readSave());
    pull();
    return subscribeStore(pull);
  }, []);
  const streak = useReadContract({
    address: pair.streak ?? undefined,
    abi: streakAbi,
    functionName: "streak",
    args: connection.address ? [connection.address] : undefined,
    chainId: monadTestnet.id,
    query: { enabled: Boolean(pair.streak && connection.address && code.hasCode) },
  });

  return (
    <div className="rise flex flex-col gap-4">
      <section className="pt-2">
        <p className="pill">Monad testnet</p>
        <h1 className="font-display mt-3 text-4xl leading-tight">{t.home.hello}</h1>
        <p className="mt-2 text-ink-soft">{t.home.lead}</p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <article className="card p-4">
          <p className="text-sm text-ink-soft">{t.home.streakLabel}</p>
          <p className="font-display text-4xl leading-none">
            {streak.data !== undefined ? streak.data.toString() : "—"}
          </p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-ink-soft">{t.home.sunsLabel}</p>
          <p className="font-display text-4xl leading-none">{save.suns}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {t.home.best}: {save.bestSuns}
          </p>
        </article>
      </div>
      <Link to="/play" className="btn btn-ember btn-block no-underline">
        {t.home.play}
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/check-in" className="card p-4 no-underline">
          <p className="font-display text-xl">{t.home.checkin}</p>
        </Link>
        <Link to="/strategies" className="card p-4 no-underline">
          <p className="font-display text-xl">{t.home.strategies}</p>
        </Link>
      </div>
      <Link to="/sol" className="card p-4 no-underline">
        <p className="font-display text-xl">{t.home.solTitle}</p>
        <p className="mt-1 text-sm text-ink-soft">{t.home.solBody}</p>
      </Link>
      <Link to="/judges" className="card p-4 no-underline">
        <p className="pill">{t.judges.kicker}</p>
        <p className="font-display mt-2 text-xl">{t.judges.track}</p>
        <p className="mt-1 text-sm text-ink-soft">{t.judges.cardBody}</p>
      </Link>
      <p className="text-sm font-semibold">{t.home.sim}</p>
      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <a href={FAUCET} target="_blank" rel="noreferrer">
          {t.home.faucet}
        </a>
        <Link to="/judges">{t.home.judges}</Link>
      </div>
    </div>
  );
}
