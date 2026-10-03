import { createPublicClient, createWalletClient, custom, http } from "viem";
import { activeChain, DEPLOYED, streakAbi } from "@/lib/chain";
import { ensureMonadChain } from "@/components/wallet-button";

export type MwaProof =
  | { ok: true; address: string; signature: string; cluster: "monad"; kind: "tx" }
  | { ok: false; error: string };

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

export async function signClockInMwa(
  _meters: number,
  _score: number,
  _streak: number,
): Promise<MwaProof> {
  const eth = (window as Window & { ethereum?: Eth }).ethereum;
  if (!eth) return { ok: false, error: "wallet" };
  try {
    await ensureMonadChain();
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const account = accounts[0] as `0x${string}` | undefined;
    if (!account) return { ok: false, error: "wallet" };
    const wallet = createWalletClient({ account, chain: activeChain, transport: custom(eth) });
    const hash = await wallet.writeContract({
      address: DEPLOYED.streak,
      abi: streakAbi,
      functionName: "checkIn",
      chain: activeChain,
      account,
    });
    const reader = createPublicClient({
      chain: activeChain,
      transport: http(activeChain.rpcUrls.default.http[0]),
    });
    const receipt = await reader.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return { ok: false, error: "reverted" };
    return { ok: true, address: account, signature: hash, cluster: "monad", kind: "tx" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "rejected";
    if (/too soon/i.test(msg)) return { ok: false, error: "too soon" };
    if (/user rejected|denied/i.test(msg)) return { ok: false, error: "rejected" };
    return { ok: false, error: msg.slice(0, 140) };
  }
}
