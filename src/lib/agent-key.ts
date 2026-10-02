import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const KEY = "solarchik.agentKey";

export function agentAccount() {
  let pk = sessionStorage.getItem(KEY);
  if (!pk) {
    pk = generatePrivateKey();
    sessionStorage.setItem(KEY, pk);
  }
  return privateKeyToAccount(pk as Hex);
}
