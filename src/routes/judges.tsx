import { createFileRoute, Link } from "@tanstack/react-router";
import { EXPLORER, FAUCET, MONAD_REPO, activeChain } from "@/lib/chain";
import { ASSISTANT_LINE } from "@/lib/game/secretary";
import { useI18n } from "@/lib/i18n/provider";

export const Route = createFileRoute("/judges")({ component: JudgesPage });

const copy = {
  en: {
    kicker: "Monad testnet · chain 10143",
    title: "For judges",
    lead: "The demo is the night booth on the home page. This page is the order. Nothing else on the old desk is part of the run.",
    open: "Open the booth",
    steps: "The run",
    stop: "If it stops",
    s1: "Create account. One passkey. The card shows You · …/0 and Agent · …/1. No seed is shown. MetaMask is not the account.",
    s2: "The pass has to say Pass open before the line arms. Get a pass, or Check browser wallet if that wallet already holds one. No pass leaves Turn on blocked.",
    s3: "Connect Privy. It is not the account. Open Test MON, then Send 0.01 MON. The transfer goes to the agent key. The hash opens on the explorer. The browser wallet does not pay.",
    s4: `Your number and the SIM country. Turn on only if this phone should forward to ${ASSISTANT_LINE}. The phone must confirm the code. For a short window the next call on that shared line is filed under this account.`,
    s5: "Credit starts at 0.00 MON. Top up 0.05 MON. That hash is a testnet transfer to the agent key, and the booth then shows 0.05 MON and 5 calls. Pick up spends one call.",
    w1: "Cancelled or Passkey did not open: press Open account again. Do not create a second passkey unless the first one is gone.",
    w2: "Check unavailable: the pass read failed. Press Check key once more. Do not treat a closed pass as open.",
    w3: "The transfer did not send: take Test MON into the Privy wallet first. A browser wallet cannot send this transfer.",
    w4: "The line was not linked: the code can still be in the phone. The archive will not file the call under this account.",
    w5: "No credit: Pick up stops until a top-up lands on the agent key. Forwarding the phone does not spend a call.",
    chain: "Chain",
    faucet: "Faucet",
    code: "Code",
    home: "Booth",
  },
  uk: {
    kicker: "Тестнет Monad · мережа 10143",
    title: "Суддям",
    lead: "Демо — нічна будка на головній. Тут лише порядок прогону. Старий стіл у цей прогін не входить.",
    open: "Відкрити будку",
    steps: "Прогін",
    stop: "Якщо зупинилось",
    s1: "Створити рахунок. Один passkey. На картці буде Ти · …/0 і Агент · …/1. Сід не показується. MetaMask не є рахунком.",
    s2: "Пас має сказати «Пас відкритий», інакше лінія не вмикається. Взяти пас, або Перевірити гаманець, якщо пас уже лежить у ньому. Без паса «Увімкнути» не піде.",
    s3: "Підключити Privy. Це не рахунок. Тестовий MON, потім Надіслати 0.01 MON. Переказ іде на ключ агента, хеш відкривається в оглядачі. Гаманець браузера не платить.",
    s4: `Твій номер і країна SIM. Увімкнути лише якщо цей телефон має слати дзвінки на ${ASSISTANT_LINE}. Телефон мусить підтвердити код. Коротке вікно після цього пише наступний дзвінок на спільну лінію на цей рахунок.`,
    s5: "Кредит починається з 0.00 MON. Поповнити на 0.05 MON. Це тестовий переказ на ключ агента, після нього будка показує 0.05 MON і 5 дзвінків. Взяти слухавку знімає один.",
    w1: "Скасовано або Passkey не відкрився: ще раз Відкрити рахунок. Другий passkey не створюй, якщо перший живий.",
    w2: "Перевірка недоступна: читання паса впало. Натисни Перевірити ключ ще раз. Закритий пас не вважай відкритим.",
    w3: "Переказ не пішов: спочатку візьми тестовий MON на гаманець Privy. Браузерний гаманець цей переказ не шле.",
    w4: "Лінію не прив'язано: код усе одно може бути в телефоні. Архів цей дзвінок на рахунок не запише.",
    w5: "Немає кредиту: Взяти слухавку стоїть, поки поповнення не дійде на ключ агента. Переадресація дзвінок не списує.",
    chain: "Мережа",
    faucet: "Кран",
    code: "Код",
    home: "Будка",
  },
} as const;

function JudgesPage() {
  const { lang, setLang } = useI18n();
  const t = copy[lang];
  const steps = [t.s1, t.s2, t.s3, t.s4, t.s5];
  const stops = [t.w1, t.w2, t.w3, t.w4, t.w5];

  return (
    <div className="booth h-dvh w-full overflow-y-auto" data-theme="night">
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="booth-gold text-xs font-semibold uppercase tracking-[0.18em]">{t.kicker}</p>
            <h1 className="font-display mt-1 text-4xl leading-none">{t.title}</h1>
          </div>
          <div className="booth-chip flex rounded-full p-1" role="group" aria-label="Language">
            <button type="button" className={lang === "en" ? "rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg" : "booth-muted rounded-full px-3 py-1.5 text-sm font-semibold"} onClick={() => setLang("en")}>
              EN
            </button>
            <button type="button" className={lang === "uk" ? "rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg" : "booth-muted rounded-full px-3 py-1.5 text-sm font-semibold"} onClick={() => setLang("uk")}>
              УК
            </button>
          </div>
        </header>
        <p className="booth-muted text-sm leading-relaxed">{t.lead}</p>
        <Link to="/" className="inline-flex w-fit rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg no-underline">
          {t.open}
        </Link>
        <section className="booth-card rounded-2xl p-4">
          <h2 className="font-display text-2xl">{t.steps}</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <section className="booth-card rounded-2xl p-4">
          <h2 className="font-display text-2xl">{t.stop}</h2>
          <ul className="booth-muted mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {stops.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </section>
        <section className="booth-chip grid gap-2 rounded-2xl p-4 text-sm sm:grid-cols-2">
          <p>
            {t.chain} {activeChain.id}
          </p>
          <p>
            {t.home}{" "}
            <Link to="/" className="underline">
              /
            </Link>
          </p>
          <p>
            <a href={FAUCET} target="_blank" rel="noreferrer">
              {t.faucet}
            </a>
          </p>
          <p>
            <a href={EXPLORER} target="_blank" rel="noreferrer">
              {EXPLORER.replace("https://", "")}
            </a>
          </p>
          <p className="sm:col-span-2">
            {t.code}{" "}
            <a href={MONAD_REPO} target="_blank" rel="noreferrer">
              {MONAD_REPO.replace("https://", "")}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
