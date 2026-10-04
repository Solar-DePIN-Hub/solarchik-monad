import { createServerFn } from "@tanstack/react-start";

type ModelId = "kimi" | "qwen";

type DeskAsk = {
  lang: "en" | "uk";
  model: ModelId;
  text: string;
};

export type DeskReply =
  | { mode: "offline"; model: ModelId }
  | { mode: "live"; model: ModelId; text: string }
  | { mode: "error"; model: ModelId };

function clip(value: unknown, max: number) {
  return String(value ?? "").slice(0, max);
}

function parse(input: unknown): DeskAsk {
  const row = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    lang: row.lang === "uk" ? "uk" : "en",
    model: row.model === "qwen" ? "qwen" : "kimi",
    text: clip(row.text, 500).trim(),
  };
}

function keyFor(model: ModelId) {
  if (model === "kimi") return process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || "";
  return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "";
}

function endpoint(model: ModelId) {
  if (model === "kimi") {
    const base = (process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/$/, "");
    return { url: `${base}/chat/completions`, model: process.env.MOONSHOT_MODEL || "moonshot-v1-8k" };
  }
  const base = (process.env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  return { url: `${base}/chat/completions`, model: process.env.QWEN_MODEL || "qwen-plus" };
}

export const askDesk = createServerFn({ method: "POST" })
  .validator(parse)
  .handler(async ({ data }): Promise<DeskReply> => {
    if (!data.text) return { mode: "error", model: data.model };
    const key = keyFor(data.model);
    if (!key) return { mode: "offline", model: data.model };
    const slot = endpoint(data.model);
    const language = data.lang === "uk" ? "Ukrainian" : "English";
    try {
      const upstream = await fetch(slot.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: slot.model,
          stream: false,
          max_tokens: 220,
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: `You are the Solarchik agent on Monad testnet. Talk only about the spend limit, the last recorded decision, and the identity gate. You do not trade, quote prices, or place orders. Reply only in ${language}.`,
            },
            { role: "user", content: data.text },
          ],
        }),
      });
      if (!upstream.ok) return { mode: "error", model: data.model };
      const json = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
      const text = clip(json.choices?.[0]?.message?.content, 600).trim();
      if (!text) return { mode: "error", model: data.model };
      return { mode: "live", model: data.model, text };
    } catch {
      return { mode: "error", model: data.model };
    }
  });
