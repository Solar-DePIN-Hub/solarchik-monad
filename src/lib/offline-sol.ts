import type { Dict } from "@/lib/i18n/en";

export function offlineReply(dict: Dict, text: string) {
  const q = text.toLowerCase();
  const has = (...words: string[]) => words.some((word) => q.includes(word));
  if (has("trade", "profit", "price", "buy", "sell", "торг", "цін", "прибу", "ордер", "зароб")) {
    return dict.sol.demo.trade;
  }
  if (has("nft", "strateg", "риск", "ризик", "стратег")) return dict.sol.demo.strategy;
  if (has("streak", "check", "сері", "чек", "відміт")) return dict.sol.demo.streak;
  if (has("play", "run", "sun", "jump", "roof", "гра", "біг", "сонц", "стриб", "дах")) {
    return dict.sol.demo.play;
  }
  if (has("monad", "монад", "wallet", "гаман", "faucet", "кран")) return dict.sol.demo.monad;
  if (has("hi", "hello", "hey", "привіт", "здоров", "добр")) return dict.sol.demo.hello;
  return dict.sol.demo.default;
}
