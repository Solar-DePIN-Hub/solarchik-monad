import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DEPLOYED, addressUrl, MONAD_REPO } from "@/lib/chain";

export const Route = createFileRoute("/architecture")({ component: ArchitecturePage });

type Lang = "en" | "uk";

const copy = {
  en: {
    kicker: "Monad testnet · chain 10143",
    title: "Solarchik architecture",
    lead: "The judge path is the night booth on the home page. One passkey makes two keys. A pass arms the phone line. Privy pays the agent key.",
    live: "Earlier contracts, not the call",
    device: "On this device",
    absent: "Not in this build",
    deviceBody: "The passkey stays in this browser. Call credit is the list of verified top-up hashes kept on this device.",
    absentBody: "No Android package. No seed on screen. No order. Test MON from the faucet does not buy a call.",
    back: "Judges",
    sections: [
      {
        n: "1",
        title: "Booth",
        body: "Home is the night booth. The line is +380914810885. A call is 0.01 MON. The yard, the roof run, and the work desk are still in the repo. They are not the judge path.",
      },
      {
        n: "2",
        title: "Passkey",
        body: "One passkey makes two keys: person at m/44'/60'/0'/0/0 and agent at index 1. Each key signs its own message and the signature has to match. No seed is shown. The credential does not travel to another browser.",
      },
      {
        n: "3",
        title: "Pass",
        body: "Cleanverse names the Monad testnet A-Pass contract. The booth reads getAPassData. The pass is open only when status is 1 and the expiration word is still in the future. A revert, including 0xfb524a44, stays closed. A browser wallet can only be read. It cannot pay.",
      },
      {
        n: "4",
        title: "Privy",
        body: "Privy is not the account. Top up sends 0.05 MON from the embedded wallet to the agent key. That is 5 calls. The booth counts them only after the transfer is on chain. Send 0.01 MON is one call, not the five-call top-up.",
      },
      {
        n: "5",
        title: "Line",
        body: "Turn on is refused until the pass is open. The phone must confirm the carrier code. Nothing is forwarded until it does. Claiming the shared line does not spend a call.",
      },
      {
        n: "6",
        title: "Archive",
        body: "A row appears only after the assistant answers. The booth does not invent a transcript. If the archive request fails, the booth says so and shows the last list saved in this browser.",
      },
      {
        n: "7",
        title: "English",
        body: "The judge path is English. EN is the line language. Ukrainian copy remains on this page and on the judges page.",
      },
      {
        n: "8",
        title: "Left behind",
        body: "Streak, Strategy, Suns, and Agent are deployed and left in place. They do not price a call, hold the pass, or store the transcript.",
      },
    ],
  },
  uk: {
    kicker: "Monad testnet · мережа 10143",
    title: "Архітектура Solarchik",
    lead: "Шлях для судді — нічна кабіна на головній. Один passkey дає два ключі. Пас вмикає лінію. Privy платить ключу агента.",
    live: "Старі контракти, не дзвінок",
    device: "На цьому пристрої",
    absent: "Цього в збірці немає",
    deviceBody: "Passkey лишається в цьому браузері. Кредит дзвінка — це список перевірених поповнень, збережений на пристрої.",
    absentBody: "Немає Android-пакета. Сід на екран не виводиться. Немає ордера. Тестовий MON з крана не купує дзвінок.",
    back: "Суддям",
    sections: [
      {
        n: "1",
        title: "Кабіна",
        body: "Головна — це нічна кабіна. Номер +380914810885. Дзвінок коштує 0.01 MON. Двір, забіг і стіл лишилися в репозиторії. Це не шлях для судді.",
      },
      {
        n: "2",
        title: "Passkey",
        body: "Один passkey робить два ключі: людина на m/44'/60'/0'/0/0 і агент на індексі 1. Кожен ключ підписує своє повідомлення, і підпис має збігтися. Сід не показується. Ключ не переїжджає в інший браузер.",
      },
      {
        n: "3",
        title: "Пас",
        body: "Cleanverse називає контракт A-Pass на Monad testnet. Кабіна читає getAPassData. Пас відкритий лише коли статус 1 і слово строку дії ще в майбутньому. Реверт, зокрема 0xfb524a44, лишає пас закритим. Браузерний гаманець лише читається. Він не платить.",
      },
      {
        n: "4",
        title: "Privy",
        body: "Privy не є рахунком. Поповнення шле 0.05 MON з вбудованого гаманця на ключ агента. Це 5 дзвінків. Кабіна рахує їх лише після транзакції в мережі. Надіслати 0.01 MON — це один дзвінок, не п'ять.",
      },
      {
        n: "5",
        title: "Лінія",
        body: "Увімкнути не можна, поки пас закритий. Телефон має підтвердити код оператора. Нічого не переадресовано, поки він цього не зробить. Захоплення спільної лінії не списує дзвінок.",
      },
      {
        n: "6",
        title: "Архів",
        body: "Рядок з'являється лише після того, як помічник відповів. Кабіна не вигадує розмову. Якщо архів не відкрився, вона так і каже і показує останній список із цього браузера.",
      },
      {
        n: "7",
        title: "Англійська",
        body: "Шлях для судді англійською. EN — це мова лінії. Український текст лишається на цій сторінці і на сторінці для суддів.",
      },
      {
        n: "8",
        title: "Залишилось позаду",
        body: "Streak, Strategy, Suns і Agent розгорнуті і лишаються на місці. Вони не беруть плату за дзвінок, не тримають пас і не зберігають розмову.",
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
        <p className="mt-1 text-ink-soft">{t.deviceBody}</p>
        <p className="mt-3 font-semibold">{t.absent}</p>
        <p className="mt-1 text-ink-soft">{t.absentBody}</p>
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
