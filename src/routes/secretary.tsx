import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export const Route = createFileRoute("/secretary")({ component: SecretaryPage });

const copy = {
  en: {
    kicker: "Booth secretary",
    title: "Secretary",
    lead: "The red phone from the booth. This is not a phone network. He answers only if a model replies.",
    caller: "Unknown caller",
    answer: "Pick up",
    hangup: "Hang up",
    waiting: "Listening…",
    silent: "No reply. No model is live, so the report is not invented.",
    failed: "The model call failed. No invented report.",
    who: "Who called, why, and what to do next? Do not spend.",
  },
  uk: {
    kicker: "Секретар будки",
    title: "Секретар",
    lead: "Червона слухавка з будки. Це не телефонна мережа. Він відповідає лише якщо модель відповіла.",
    caller: "Невідомий абонент",
    answer: "Взяти слухавку",
    hangup: "Покласти",
    waiting: "Слухаю…",
    silent: "Відповіді немає. Модель не жива, звіт не вигаданий.",
    failed: "Виклик моделі впав. Звіт не вигаданий.",
    who: "Хто дзвонив, навіщо, і що робити далі? Не витрачай.",
  },
} as const;

function SecretaryPage() {
  const { lang } = useI18n();
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);

  async function pickUp() {
    setOpen(true);
    setBusy(true);
    setReport("");
    try {
      const res = await fetch("/api/sol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          provider: "kimi",
          messages: [{ role: "user", content: t.who }],
        }),
      });
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        setReport(t.silent);
        return;
      }
      if (!res.ok || !res.body) {
        setReport(t.failed);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              acc += delta;
              setReport(acc);
            }
          } catch {
            // Ignore a partial line.
          }
        }
      }
      if (!acc) setReport(t.silent);
    } catch {
      setReport(t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise flex flex-col gap-4">
      <header>
        <p className="pill">{t.kicker}</p>
        <h1 className="font-display mt-3 text-4xl">{t.title}</h1>
        <p className="mt-2 text-ink-soft">{t.lead}</p>
      </header>
      <section className="card p-4">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-ember text-3xl font-semibold text-ink">
          {open ? "●" : "○"}
        </div>
        <p className="mt-3 text-center text-sm font-semibold">{t.caller}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ember" disabled={busy} onClick={() => void pickUp()}>
            {t.answer}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setOpen(false);
              setReport("");
            }}
          >
            {t.hangup}
          </button>
        </div>
        {open ? <p className="mt-3 text-sm font-semibold">{busy && !report ? t.waiting : report}</p> : null}
      </section>
    </div>
  );
}
