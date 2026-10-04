import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { House, ScrollText } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";

function SunMark() {
  return (
    <svg viewBox="0 0 48 48" className="sun-spin size-9 text-sun" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M24 6v4M24 38v4M6 24h4M38 24h4M11 11l2.8 2.8M34.2 34.2 37 37M37 11l-2.8 2.8M13.8 34.2 11 37" />
      </g>
      <circle cx="24" cy="24" r="8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { lang, setLang } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const game = path === "/play";
  const items = [
    { to: "/", label: lang === "uk" ? "Стіл" : "Desk" },
    { to: "/judges", label: lang === "uk" ? "Суддям" : "Judges" },
  ] as const;

  return (
    <div className="app-sky flex min-h-dvh flex-col">
      {game ? null : (
        <header className="sticky top-0 z-20 mx-auto flex w-full min-w-0 max-w-lg items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 text-ink no-underline">
            <SunMark />
            <span>
              <span className="font-display block text-lg leading-none">Solarchik</span>
              <span className="text-xs font-semibold text-ink-soft">Monad</span>
            </span>
          </Link>
          <div className="glass flex rounded-full p-1" role="group" aria-label="language">
            <button
              type="button"
              className={lang === "en" ? "btn btn-sun min-h-9 px-3 py-1" : "btn btn-ghost min-h-9 border-transparent px-3 py-1"}
              onClick={() => setLang("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={lang === "uk" ? "btn btn-sun min-h-9 px-3 py-1" : "btn btn-ghost min-h-9 border-transparent px-3 py-1"}
              onClick={() => setLang("uk")}
            >
              УК
            </button>
          </div>
        </header>
      )}
      <main className={game ? "relative h-dvh" : "mx-auto w-full max-w-lg flex-1 px-4 pb-28"}>{children}</main>
      {game ? null : (
        <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
          <div className="glass dock pointer-events-auto w-full max-w-lg">
            {items.map((item) => {
              const active = path === item.to;
              const Icon = item.to === "/" ? House : ScrollText;
              return (
                <Link key={item.to} to={item.to} data-active={active} aria-current={active ? "page" : undefined}>
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
