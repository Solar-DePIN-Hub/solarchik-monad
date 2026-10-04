import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EXPLORER, FAUCET, HACKATHON, MONAD_REPO, DEPLOYED, addressUrl, activeChain } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";

export const Route = createFileRoute("/judges")({ component: JudgesPage });

const copy = {
  en: {
    title: "Project profile",
    track: "Track · Trust, Identity & AI Infrastructure",
    lead: "Passkey account, daily check-in, and a strategy mint. The agent does not trade.",
    demo1: "Open the desk. Create a passkey. No seed is shown and MetaMask is not the account.",
    demo2: "Check in. The hash opens on the Monad explorer. A second check-in inside 24 hours reverts.",
    demo3: "Mint a strategy. The card shows the token id and the Strategy contract.",
    demo4: "Limits and pause stay in the browser until AgentDesk is deployed. The screen says so.",
    demo5: "Transfer stays rejected until a CVI read says verified. History says not indexed when Envio is unset. Chat says offline demo when a model key is missing.",
    missing: "AgentDesk is not deployed. No address is invented. No public demo URL is written here yet.",
    blurb: `Solarchik on Monad is an agent desk.

Track: Trust, Identity & AI Infrastructure.

On Monad testnet (chain id 10143) the desk signs SolarchikStreak.checkIn once per 24 hours and mints SolarchikStrategy, an ERC-721 with a name and a risk level. It does not trade.

The account is a Mera passkey. No seed is shown. MetaMask is not on this path.

Privy app id cmutyetdu035e0cjpxez5f3hl is set. The agent wallet is not drawn, and it is not a second login. AgentDesk is not deployed, so limits and pause stay in the browser and say so. The CRE workflow is not live. History is not indexed until VITE_ENVIO_URL is set. Kimi and Qwen say offline demo when their server keys are missing. A transfer stays rejected until a CVI read returns verified.

Contracts:
Streak https://testnet.monadexplorer.com/address/0x357c1a631f208FBB84d430bd18FEE65B54456a38
Strategy https://testnet.monadexplorer.com/address/0xDfdd6b3402180316D780d7634624d09b9026Fb42

Code: https://github.com/Solar-DePIN-Hub/solarchik-monad

Deadline: 13 October 2026, 11:59 PM ET. Submit at https://hackathon.monad.xyz`,
  },
  uk: {
    title: "Профіль проєкту",
    track: "Трек · Довіра, особа й інфраструктура ШІ",
    lead: "Акаунт з passkey, щоденна відмітка і мінт стратегії. Агент не торгує.",
    demo1: "Відкрий стіл. Створи passkey. Сід не показується, MetaMask не є акаунтом.",
    demo2: "Відміться. Хеш відкривається в оглядачі Monad. Друга відмітка за 24 години падає.",
    demo3: "Замінть стратегію. Картка показує token id і контракт Strategy.",
    demo4: "Ліміти й пауза лишаються в браузері, поки AgentDesk не задеплоєний. Екран так і пише.",
    demo5: "Переказ лишається відхиленим, поки читання CVI не скаже verified. Історія каже, що не індексована, якщо Envio не заданий. Чат каже офлайн-демо, якщо немає ключа моделі.",
    missing: "AgentDesk не задеплоєний. Адреса не вигадана. Публічного демо-URL тут ще немає.",
    blurb: "",
  },
} as const;

function JudgesPage() {
  const { lang } = useI18n();
  const t = copy[lang];
  const blurb = copy.en.blurb;
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  async function copyBlurb() {
    try {
      await navigator.clipboard.writeText(blurb);
      setCopyState("ok");
    } catch {
      setCopyState("fail");
    }
  }

  return (
    <div className="rise flex flex-col gap-4 pb-4">
      <header>
        <p className="pill">Monad Metropolis</p>
        <h1 className="font-display mt-3 text-4xl">{t.title}</h1>
        <p className="mt-2 font-semibold">{t.track}</p>
        <p className="mt-2 text-ink-soft">{t.lead}</p>
      </header>
      <section className="card p-4">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t.demo1}</li>
          <li>{t.demo2}</li>
          <li>{t.demo3}</li>
          <li>{t.demo4}</li>
          <li>{t.demo5}</li>
        </ol>
      </section>
      <section className="card p-4 text-sm">
        <p>
          {activeChain.id} · {activeChain.name}
        </p>
        <p className="mt-2">{activeChain.rpcUrls.default.http[0]}</p>
        <p className="mt-2">
          <a href={EXPLORER} target="_blank" rel="noreferrer">
            {EXPLORER}
          </a>
        </p>
        <p className="mt-2">
          <a href={FAUCET} target="_blank" rel="noreferrer">
            {FAUCET}
          </a>
        </p>
        <p className="mt-2">
          <a href={MONAD_REPO} target="_blank" rel="noreferrer">
            {MONAD_REPO}
          </a>
        </p>
        <p className="mt-2">
          <a href={HACKATHON} target="_blank" rel="noreferrer">
            {HACKATHON}
          </a>
        </p>
      </section>
      <ul className="space-y-1 text-sm font-semibold">
        <li>
          <a href={addressUrl(DEPLOYED.streak)} target="_blank" rel="noreferrer">
            Streak {DEPLOYED.streak}
          </a>
        </li>
        <li>
          <a href={addressUrl(DEPLOYED.strategy)} target="_blank" rel="noreferrer">
            Strategy {DEPLOYED.strategy}
          </a>
        </li>
      </ul>
      <p className="text-sm">{t.missing}</p>
      <section className="card p-4">
        <button type="button" className="btn btn-sun" onClick={() => void copyBlurb()}>
          {copyState === "ok" ? (lang === "uk" ? "Скопійовано" : "Copied") : lang === "uk" ? "Скопіювати опис" : "Copy write-up"}
        </button>
        {copyState === "fail" ? <p className="mt-2 text-sm font-semibold">{lang === "uk" ? "Не вдалося скопіювати." : "Could not copy."}</p> : null}
        <textarea className="field mt-3 min-h-64" readOnly value={blurb} />
      </section>
    </div>
  );
}
