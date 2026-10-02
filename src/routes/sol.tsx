import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { offlineReply } from "@/lib/offline-sol";

export const Route = createFileRoute("/sol")({ component: SolPage });

type Mode = "checking" | "live" | "offline";
type ProviderId = "xai" | "kimi" | "qwen";
type Flags = Record<ProviderId, boolean>;
type ChatMessage = { id: number; role: "user" | "sol"; text: string };

const emptyFlags: Flags = { xai: false, kimi: false, qwen: false };

function SolPage() {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<Mode>("checking");
  const [flags, setFlags] = useState<Flags>(emptyFlags);
  const [provider, setProvider] = useState<ProviderId>("xai");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    setMessages([{ id: 1, role: "sol", text: t.sol.intro }]);
  }, [t.sol.intro]);

  useEffect(() => {
    let gone = false;
    void fetch("/api/sol")
      .then((res) => res.json())
      .then((body: { mode?: string; providers?: Partial<Flags> }) => {
        if (gone) return;
        const next = {
          xai: Boolean(body.providers?.xai),
          kimi: Boolean(body.providers?.kimi),
          qwen: Boolean(body.providers?.qwen),
        };
        setFlags(next);
        setProvider(next.xai ? "xai" : next.kimi ? "kimi" : next.qwen ? "qwen" : "xai");
        setMode(body.mode === "live" ? "live" : "offline");
      })
      .catch(() => {
        if (!gone) setMode("offline");
      });
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, busy]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setText("");
    setError(false);
    const userId = ++idRef.current;
    const solId = ++idRef.current;
    const history = [...messages.filter((item) => item.id !== 1), { id: userId, role: "user" as const, text: content }];
    setMessages((prev) => [...prev, { id: userId, role: "user", text: content }, { id: solId, role: "sol", text: "" }]);
    setBusy(true);
    if (!flags[provider]) {
      setMessages((prev) =>
        prev.map((item) => (item.id === solId ? { ...item, text: mode === "offline" && !flags.xai && !flags.kimi && !flags.qwen ? offlineReply(t, content) : t.sol.notConfigured } : item)),
      );
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/sol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          provider,
          messages: history.map((item) => ({
            role: item.role === "sol" ? "assistant" : "user",
            content: item.text,
          })),
        }),
      });
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const body = (await res.json()) as { mode?: string };
        if (body.mode === "offline") {
          setMode("offline");
          const reply = offlineReply(t, content);
          setMessages((prev) => prev.map((item) => (item.id === solId ? { ...item, text: reply } : item)));
        } else if (body.mode === "unconfigured") {
          setMessages((prev) => prev.map((item) => (item.id === solId ? { ...item, text: t.sol.notConfigured } : item)));
        } else {
          setError(true);
          setMessages((prev) => prev.filter((item) => item.id !== solId));
        }
        return;
      }
      if (!res.ok || !res.body) {
        setError(true);
        setMessages((prev) => prev.filter((item) => item.id !== solId));
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
              const next = acc;
              setMessages((prev) => prev.map((item) => (item.id === solId ? { ...item, text: next } : item)));
            }
          } catch {
            // Ignore a partial SSE line.
          }
        }
      }
      if (!acc) {
        setError(true);
        setMessages((prev) => prev.filter((item) => item.id !== solId));
      }
    } catch {
      setError(true);
      setMessages((prev) => prev.filter((item) => item.id !== solId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise flex h-[calc(100dvh-8.5rem)] flex-col">
      <header className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-4xl">{t.sol.title}</h1>
          <span className={mode === "checking" ? "pill" : flags[provider] ? "pill pill-live" : "pill pill-warn"}>
            {mode === "checking" ? t.sol.checking : flags[provider] ? t.sol.live : t.sol.offline}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {flags[provider] ? t.sol.lead : mode === "offline" ? t.sol.demoNote : t.sol.notConfigured}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["xai", t.sol.grok],
              ["kimi", t.sol.kimi],
              ["qwen", t.sol.qwen],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={provider === id ? "btn btn-sun min-h-9 px-3 py-1" : "btn btn-ghost min-h-9 px-3 py-1"}
              onClick={() => setProvider(id)}
            >
              {label}
              {flags[id] ? "" : ` · ${t.sol.off}`}
            </button>
          ))}
        </div>
      </header>
      <div ref={scroller} className="card flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((item) => (
          <div key={item.id} className={item.role === "user" ? "ml-8" : "mr-8"}>
            <p className="text-xs font-semibold text-ink-soft">{item.role === "user" ? t.sol.you : t.sol.title}</p>
            <p className={item.role === "user" ? "mt-1 rounded-2xl bg-sun px-3 py-2" : "mt-1 rounded-2xl bg-cream px-3 py-2"}>
              {item.text || (busy ? "…" : "")}
            </p>
          </div>
        ))}
        {error ? <p className="text-sm">{t.sol.error}</p> : null}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="sol-text">
          {t.sol.placeholder}
        </label>
        <input
          id="sol-text"
          className="field"
          value={text}
          maxLength={400}
          placeholder={t.sol.placeholder}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className="btn btn-ember" disabled={busy || mode === "checking" || text.trim().length === 0}>
          {t.sol.send}
        </button>
      </form>
    </div>
  );
}
