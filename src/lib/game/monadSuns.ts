import { createPublicClient, createWalletClient, custom, http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { activeChain, DEPLOYED, sunsAbi } from "@/lib/chain";
import { ensureMonadChain } from "@/components/wallet-button";

const KEY = "solarchik.suns.sessionKey";
const PLAYER = "solarchik.suns.player";

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function reader() {
  return createPublicClient({ chain: activeChain, transport: http(activeChain.rpcUrls.default.http[0]) });
}

export function sessionAccount() {
  let stored = localStorage.getItem(KEY) as `0x${string}` | null;
  if (!stored || !/^0x[0-9a-fA-F]{64}$/.test(stored)) {
    stored = generatePrivateKey();
    localStorage.setItem(KEY, stored);
  }
  return privateKeyToAccount(stored);
}

export function savedPlayer() {
  return (localStorage.getItem(PLAYER) || "") as `0x${string}` | "";
}

async function playerWallet() {
  const eth = (window as Window & { ethereum?: Eth }).ethereum;
  if (!eth) throw new Error("Connect MetaMask");
  await ensureMonadChain();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const account = accounts[0] as `0x${string}` | undefined;
  if (!account) throw new Error("Connect MetaMask");
  const client = createWalletClient({ account, chain: activeChain, transport: custom(eth) });
  return { account, client };
}

export async function authorizeSuns() {
  const { account, client } = await playerWallet();
  const session = sessionAccount();
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
  const hash = await client.writeContract({
    address: DEPLOYED.suns,
    abi: sunsAbi,
    functionName: "authorize",
    args: [session.address, 40, expiry],
    value: parseEther("0.02"),
    account,
    chain: activeChain,
  });
  const receipt = await reader().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("authorize reverted");
  localStorage.setItem(PLAYER, account);
  return { hash, session: session.address, player: account };
}

export async function chainSuns(player: `0x${string}`) {
  const total = await reader().readContract({
    address: DEPLOYED.suns,
    abi: sunsAbi,
    functionName: "sunsOf",
    args: [player],
  });
  return Number(total);
}

/** Sends one batch from the session key. No wallet popup. Returns null if the session cannot pay. */
export async function recordRunSuns(count: number) {
  const player = savedPlayer();
  const n = Math.min(8, Math.floor(count));
  if (!player || n < 1) return null;
  const session = sessionAccount();
  const chain = reader();
  const row = await chain.readContract({
    address: DEPLOYED.suns,
    abi: sunsAbi,
    functionName: "sessionOf",
    args: [player],
  });
  const [key, expiry, spent, limit, revoked] = row as readonly [string, bigint, number, number, boolean];
  if (revoked || key.toLowerCase() !== session.address.toLowerCase()) return null;
  if (Number(expiry) * 1000 < Date.now()) return null;
  const room = Number(limit) - Number(spent);
  const batch = Math.min(n, room, 8);
  if (batch < 1) return null;
  const wallet = createWalletClient({ account: session, chain: activeChain, transport: http(activeChain.rpcUrls.default.http[0]) });
  const hash = await wallet.writeContract({
    address: DEPLOYED.suns,
    abi: sunsAbi,
    functionName: "recordSuns",
    args: [batch],
    account: session,
    chain: activeChain,
  });
  return hash;
}
