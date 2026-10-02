import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { activeChain, sunsAbi } from "@/lib/chain";

const KEY = "solarchik.sessionKey";

export function sessionAccount() {
  let pk = sessionStorage.getItem(KEY);
  if (!pk) {
    pk = generatePrivateKey();
    sessionStorage.setItem(KEY, pk);
  }
  return privateKeyToAccount(pk as Hex);
}

export type SunFeed = {
  pending: number;
  confirmed: number;
  lastHash: Hex | null;
  lastCount: number;
  error: string | null;
};

function shortErr(err: unknown) {
  if (err && typeof err === "object" && "shortMessage" in err) {
    return String((err as { shortMessage?: string }).shortMessage ?? "tx").slice(0, 160);
  }
  return err instanceof Error ? err.message.slice(0, 160) : "tx";
}

export function createSunPoster(contract: `0x${string}`, onUpdate: (state: SunFeed) => void) {
  const account = sessionAccount();
  const transport = http(activeChain.rpcUrls.default.http[0]);
  const publicClient = createPublicClient({ chain: activeChain, transport });
  const wallet = createWalletClient({ account, chain: activeChain, transport });
  let queue = 0;
  let inflight = 0;
  let busy = false;
  let stopped = false;
  const state: SunFeed = { pending: 0, confirmed: 0, lastHash: null, lastCount: 0, error: null };

  const push = () => onUpdate({ ...state, pending: queue + inflight });

  async function flush() {
    if (busy || stopped || queue === 0) return;
    busy = true;
    const count = Math.min(queue, 8);
    queue -= count;
    inflight = count;
    push();
    try {
      const hash = await wallet.writeContract({
        address: contract,
        abi: sunsAbi,
        functionName: count === 1 ? "recordSun" : "recordSuns",
        args: count === 1 ? [] : [count],
      });
      state.lastHash = hash;
      state.lastCount = count;
      state.error = null;
      push();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("reverted");
      state.confirmed += count;
    } catch (err) {
      queue = 0;
      state.error = shortErr(err);
    } finally {
      inflight = 0;
      busy = false;
      push();
      if (queue > 0) void flush();
    }
  }

  return {
    note() {
      if (stopped) return;
      queue += 1;
      push();
      void flush();
    },
    stop() {
      stopped = true;
      queue = 0;
    },
  };
}
