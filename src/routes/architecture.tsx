import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DEPLOYED, addressUrl, MONAD_REPO } from "@/lib/chain";

export const Route = createFileRoute("/architecture")({ component: ArchitecturePage });

type Lang = "en" | "uk";

const copy = {
  en: {
    kicker: "Monad testnet · chain 10143",
    title: "Solarchik architecture",
    lead: "Same map as the Solana diagram. Every box below is what this repository actually does on Monad. Nothing from Solana is left in the path.",
    live: "On Monad",
    device: "On this device",
    absent: "Not in this build",
    back: "Judges",
    sections: [
      {
        n: "1",
        title: "System",
        body: "The player opens the web app. MetaMask switches to Monad testnet. The yard, roof run, friend, shop and work desk are this app. There is no Android APK and no Seed Vault.",
      },
      {
        n: "2",
        title: "On-chain data",
        body: "Four contracts. Streak stores the daily check-in. Strategy is the ERC-721 paper agent. Suns stores suns recorded by a session key. Agent stores paper rows, and only the configured agent key may write them.",
      },
      {
        n: "3",
        title: "Mint",
        body: "The work desk mints four strategy NFTs: Bitcoin Windows #11 (crypto), Weather, Events Scout #04, and Combo. The player signs mint(name, risk). The name stores the window, for example Weather · 5m. Gas is the only cost. The contract does not charge 0.1 MON and does not place an order.",
      },
      {
        n: "4",
        title: "Who signs",
        body: "There is no server co-sign and no Metaplex. The player wallet is the owner of the NFT. tokenURI is JSON on the contract and says the strategy is paper.",
      },
      {
        n: "5",
        title: "Desk shift",
        body: "Start and stop stay in the browser. Asking for a 1, 5, 10, or 15 minute window shows a confirmation card, and signing it calls updateStrategy on that NFT, which locks transfers for 240 hours. Monad testnet has no Chainlink feed in this app, so the desk does not open a position and does not send an order.",
      },
      {
        n: "6",
        title: "Day and suns",
        body: "A roof run of 1200 m unlocks the day. Closing it calls checkIn() once per 24 hours. A second call in that window reverts. Suns on the yard are local until the player funds a session key with 0.02 MON. After that, recordSuns is a transaction without another popup.",
      },
      {
        n: "7",
        title: "Sol",
        body: "The friend chat is in the app. With no model key it is labelled offline demo and does not invent market numbers.",
      },
      {
        n: "8",
        title: "Secretary",
        body: "The phone secretary, USDC credit and call notes are not in this Monad build. There is no number and no payment path for them.",
      },
    ],
  },
  uk: {
    kicker: "Monad testnet · мережа 10143",
    title: "Архітектура Solarchik",
    lead: "Та сама схема, що в діаграмі Solana. Кожен блок нижче — це те, що цей репозиторій реально робить на Monad. Шляху Solana тут немає.",
    live: "У Monad",
    device: "На пристрої",
    absent: "Цього в збірці немає",
    back: "Суддям",
    sections: [
      {
        n: "1",
        title: "Система",
        body: "Гравець відкриває вебзастосунок. MetaMask перемикається на Monad testnet. Двір, забіг, друг, магазин і стіл — це цей застосунок. APK і Seed Vault немає.",
      },
      {
        n: "2",
        title: "Дані в мережі",
        body: "Чотири контракти. Streak тримає денну відмітку. Strategy — це ERC-721 паперового агента. Suns пише сонця сесійним ключем. Agent пише паперові рядки, і лише налаштований ключ агента може їх додати.",
      },
      {
        n: "3",
        title: "Мінт",
        body: "Стіл мінтить чотири NFT стратегії: Bitcoin Windows #11 (крипта), Weather (погода), Events Scout #04 (події) і Combo (комбо). Гравець підписує mint(name, risk). У назві лежить вікно, наприклад Weather · 5m. Платиться лише газ. Контракт не бере 0.1 MON і не відкриває угоду.",
      },
      {
        n: "4",
        title: "Хто підписує",
        body: "Немає підпису сервера і немає Metaplex. Власник NFT — гаманець гравця. tokenURI — це JSON у контракті, і там написано, що стратегія паперова.",
      },
      {
        n: "5",
        title: "Зміна столу",
        body: "Старт і пауза лишаються в браузері. Прохання про вікно на 1, 5, 10 або 15 хвилин показує картку, і підпис кличе updateStrategy на цьому NFT: продаж блокується на 240 годин. Фіда Chainlink на Monad testnet у цьому застосунку немає, тож стіл не відкриває позицію і не шле ордер.",
      },
      {
        n: "6",
        title: "День і сонця",
        body: "Забіг на 1200 м відкриває день. Закриття кличе checkIn() раз на 24 години. Другий виклик у цьому вікні контракт відхиляє. Сонця на дворі локальні, поки гравець не покладе 0.02 MON на сесійний ключ. Далі recordSuns іде без нового вікна.",
      },
      {
        n: "7",
        title: "Сол",
        body: "Чат друга є в застосунку. Без ключа моделі він позначений offline demo і не вигадує ринкові числа.",
      },
      {
        n: "8",
        title: "Секретар",
        body: "Телефонний секретар, кредит USDC і нотатки дзвінків у цю збірку Monad не входять. Номера і оплати для них немає.",
      },
    ],
  },
} as const;

const contracts = [
  ["Streak", DEPLOYED.streak],
  ["Strategy", DEPLOYED.strategy],
  ["Suns", DEPLOYED.suns],
  ["Agent", DEPLOYED.agent],
] as const;

function ArchitecturePage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];
  return (
    <div className="rise flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <Link to="/judges" className="text-sm font-semibold">
          {t.back}
        </Link>
        <div className="glass flex rounded-full p-1">
          <button type="button" className={lang === "en" ? "btn btn-sun min-h-9 px-3 py-1" : "btn btn-ghost min-h-9 px-3 py-1"} onClick={() => setLang("en")}>
            EN
          </button>
          <button type="button" className={lang === "uk" ? "btn btn-sun min-h-9 px-3 py-1" : "btn btn-ghost min-h-9 px-3 py-1"} onClick={() => setLang("uk")}>
            УК
          </button>
        </div>
      </div>
      <header>
        <p className="pill">{t.kicker}</p>
        <h1 className="font-display mt-3 text-4xl">{t.title}</h1>
        <p className="mt-2 text-ink-soft">{t.lead}</p>
      </header>
      <section className="card p-4 text-sm">
        <p className="font-semibold">{t.live}</p>
        <ul className="mt-2 space-y-2">
          {contracts.map(([name, address]) => (
            <li key={name}>
              <a className="font-semibold" href={addressUrl(address)} target="_blank" rel="noreferrer">
                {name} {address}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-semibold">{t.device}</p>
        <p className="mt-1 text-ink-soft">{lang === "en" ? "Roof score, suns before a session, agent start and stop, Sol when no model key is set." : "Рахунок забігу, сонця до сесії, старт і пауза агента, Сол без ключа."}</p>
        <p className="mt-3 font-semibold">{t.absent}</p>
        <p className="mt-1 text-ink-soft">{lang === "en" ? "APK, Solana, Jupiter, Phantom, phone secretary, 0.1 MON pro mint, Kuru order." : "APK, Solana, Jupiter, Phantom, телефонний секретар, pro-мінт за 0.1 MON, ордер Kuru."}</p>
      </section>
      {t.sections.map((section) => (
        <section key={section.n} className="card p-4">
          <p className="text-xs font-semibold text-ink-soft">{section.n} / 8</p>
          <h2 className="font-display mt-1 text-2xl">{section.title}</h2>
          <p className="mt-2 text-sm">{section.body}</p>
        </section>
      ))}
      <a className="text-sm font-semibold" href={MONAD_REPO} target="_blank" rel="noreferrer">
        github.com/Solar-DePIN-Hub/solarchik-monad
      </a>
    </div>
  );
}
