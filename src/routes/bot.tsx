import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { activeChain, addressUrl } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";

export const Route = createFileRoute("/bot")({ component: BotPage });

const MARKET = "0x26cd68436B6A4AEB3ec52abC20A4d121f8B4BAc9" as const;
const KEY = "solarchik-kuru-limits";

type Limits = { max: string; daily: string; hours: string; paused: boolean };

const EMPTY: Limits = { max: "0.01", daily: "0.05", hours: "24", paused: false };

function readLimits(): Limits {
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Limits>;
    return {
      max: typeof parsed.max === "string" ? parsed.max : EMPTY.max,
      daily: typeof parsed.daily === "string" ? parsed.daily : EMPTY.daily,
      hours: typeof parsed.hours === "string" ? parsed.hours : EMPTY.hours,
      paused: Boolean(parsed.paused),
    };
  } catch {
    return EMPTY;
  }
}

function BotPage() {
  const { t } = useI18n();
  const [limits, setLimits] = useState<Limits>(EMPTY);
  const [live, setLive] = useState<boolean | null>(null);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    setLimits(readLimits());
  }, []);

  useEffect(() => {
    const client = createPublicClient({ chain: activeChain, transport: http() });
    void client.getCode({ address: MARKET }).then((code) => {
      setLive(Boolean(code && code !== "0x"));
    });
  }, []);

  function save(next: Limits) {
    setLimits(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  return (
    <div className="rise flex flex-col gap-4">
      <header>
        <p className="pill">Monad testnet · 10143</p>
        <h1 className="font-display mt-3 text-4xl">{t.bot.title}</h1>
        <p className="mt-2 text-ink-soft">{t.bot.lead}</p>
      </header>
      <section className="card p-4 text-sm">
        <p className="font-semibold">{t.bot.market}</p>
        <a className="mt-2 block break-all font-semibold" href={addressUrl(MARKET)} target="_blank" rel="noreferrer">
          {MARKET}
        </a>
        <p className="mt-2 text-ink-soft">
          {live === null ? "…" : live ? t.bot.marketLive : t.bot.marketMissing}
        </p>
      </section>
      <form
        className="card flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (limits.paused) return;
          setAsked(true);
        }}
      >
        <label className="text-sm font-semibold">
          {t.bot.max}
          <input
            className="field mt-1"
            inputMode="decimal"
            value={limits.max}
            onChange={(event) => save({ ...limits, max: event.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          {t.bot.daily}
          <input
            className="field mt-1"
            inputMode="decimal"
            value={limits.daily}
            onChange={(event) => save({ ...limits, daily: event.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          {t.bot.hours}
          <input
            className="field mt-1"
            inputMode="numeric"
            value={limits.hours}
            onChange={(event) => save({ ...limits, hours: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setAsked(false);
            save({ ...limits, paused: !limits.paused });
          }}
        >
          {limits.paused ? t.bot.resume : t.bot.pause}
        </button>
        {limits.paused ? <p className="text-sm font-semibold">{t.bot.paused}</p> : null}
        <button type="submit" className="btn btn-ember" disabled={limits.paused || live === false}>
          {t.bot.swap}
        </button>
      </form>
      {asked ? (
        <section className="card p-4">
          <p className="font-semibold">{t.bot.sim}</p>
          <p className="mt-2 text-sm text-ink-soft">{t.bot.why}</p>
        </section>
      ) : null}
    </div>
  );
}
