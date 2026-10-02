import { createFileRoute } from "@tanstack/react-router";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS = 12;
const hits = new Map<string, { n: number; reset: number }>();

function allow(ip: string) {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now > row.reset) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (row.n >= MAX_CALLS) return false;
  row.n += 1;
  return true;
}

function systemPrompt(lang: "en" | "uk") {
  const language = lang === "uk" ? "Ukrainian" : "English";
  return [
    "You are Sol, the sun companion in Solarchik, a solar DePIN game.",
    "Be warm and brief: two or three short sentences.",
    "The player can sign a daily on-chain check-in, arm a session key so collected suns are posted as small transactions, and mint Strategy NFTs.",
    "An agent account can record paper trade intents only. It does not swap or hold funds.",
    "Strategy NFTs and agent actions are paper simulation. Never give financial advice, prices, or claim a strategy can make money.",
    "If asked about trading, say clearly that nothing in the app places an order.",
    `Reply only in ${language}. Do not mix languages.`,
    "You are Sol, not a general assistant.",
  ].join(" ");
}

type ProviderId = "xai" | "kimi" | "qwen";

function providers() {
  const moonshotBase = (process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/$/, "");
  const qwenBase = (process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(
    /\/$/,
    "",
  );
  return [
    {
      id: "xai" as const,
      key: process.env.XAI_API_KEY,
      url: process.env.XAI_BASE_URL || "https://api.x.ai/v1/chat/completions",
      model: process.env.XAI_MODEL || "grok-4.5",
    },
    {
      id: "kimi" as const,
      key: process.env.MOONSHOT_API_KEY,
      url: `${moonshotBase}/chat/completions`,
      model: process.env.MOONSHOT_MODEL || "moonshot-v1-8k",
    },
    {
      id: "qwen" as const,
      key: process.env.DASHSCOPE_API_KEY,
      url: `${qwenBase}/chat/completions`,
      model: process.env.QWEN_MODEL || "qwen-plus",
    },
  ];
}

function providerFlags() {
  const flags = { xai: false, kimi: false, qwen: false };
  for (const item of providers()) flags[item.id] = Boolean(item.key);
  return flags;
}

export const Route = createFileRoute("/api/sol")({
  server: {
    handlers: {
      GET: async () => {
        const flags = providerFlags();
        const live = flags.xai || flags.kimi || flags.qwen;
        return Response.json({ mode: live ? "live" : "offline", providers: flags });
      },
      POST: async ({ request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
        if (!allow(ip)) return Response.json({ mode: "error" }, { status: 429 });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ mode: "error" }, { status: 400 });
        }
        const record = body as {
          lang?: string;
          provider?: string;
          messages?: { role?: string; content?: string }[];
        };
        const lang = record.lang === "uk" ? "uk" : "en";
        const requested =
          record.provider === "kimi" || record.provider === "qwen" || record.provider === "xai" ? record.provider : null;
        const picked: ProviderId = requested ?? (providers().find((item) => item.key)?.id ?? "xai");
        const slot = providers().find((item) => item.id === picked);
        if (!slot?.key) return Response.json({ mode: "unconfigured", provider: picked });
        const messages = Array.isArray(record.messages) ? record.messages : [];
        const clean = messages
          .filter((item) => item.role === "user" || item.role === "assistant")
          .slice(-8)
          .map((item) => ({
            role: item.role as "user" | "assistant",
            content: String(item.content ?? "").slice(0, 500),
          }))
          .filter((item) => item.content.length > 0);
        if (!clean.some((item) => item.role === "user")) {
          return Response.json({ mode: "error" }, { status: 400 });
        }
        const upstream = await fetch(slot.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${slot.key}`,
          },
          body: JSON.stringify({
            model: slot.model,
            stream: true,
            max_tokens: 280,
            temperature: 0.7,
            messages: [{ role: "system", content: systemPrompt(lang) }, ...clean],
          }),
        });
        if (!upstream.ok || !upstream.body) {
          return Response.json({ mode: "error", status: upstream.status }, { status: 502 });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "X-Sol-Provider": slot.id,
          },
        });
      },
    },
  },
});
