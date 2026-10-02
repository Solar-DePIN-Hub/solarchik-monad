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
    "You are Sol, the sun companion in Solarchik, a solar DePIN game on Monad testnet.",
    "Be warm and brief: two or three short sentences.",
    "The player can sign a daily on-chain check-in, run rooftops for an off-chain sun score, and mint Strategy NFTs.",
    "Strategy NFTs are paper simulation only. Never give financial advice, prices, or claim a strategy can make money.",
    "If asked about trading, say clearly that nothing in the app places an order.",
    `Reply only in ${language}. Do not mix languages.`,
    "You are Sol, not a general assistant.",
  ].join(" ");
}

export const Route = createFileRoute("/api/sol")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ mode: process.env.XAI_API_KEY ? "live" : "offline" });
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
        const record = body as { lang?: string; messages?: { role?: string; content?: string }[] };
        const lang = record.lang === "uk" ? "uk" : "en";
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
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) return Response.json({ mode: "offline" });
        const upstream = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-4.5",
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
          },
        });
      },
    },
  },
});
