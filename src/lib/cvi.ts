import { createPublicClient, http, type Address } from "viem";
import { monadTestnet } from "viem/chains";
import { createServerFn } from "@tanstack/react-start";

export type PublicCleanverse = { apass: string | null; mint: string | null };

export const loadCleanversePublic = createServerFn({ method: "GET" }).handler(async (): Promise<PublicCleanverse> => {
  const { CleanverseClient } = await import("@usecordon/cleanverse");
  const client = new CleanverseClient();
  let apass: string | null = null;
  let mint: string | null = null;
  try {
    const cfg = await client.queryChainConfig();
    const monad = cfg.chains.find((row) => row.chain === "monad" && row.chain_id === 10143);
    if (monad && /^0x[a-fA-F0-9]{40}$/.test(monad.apass_address)) apass = monad.apass_address;
  } catch {
    apass = null;
  }
  try {
    const link = await client.getMagiclink();
    if (typeof link.register_url === "string" && link.register_url.startsWith("https://")) mint = link.register_url;
  } catch {
    mint = null;
  }
  return { apass, mint };
});

const abi = [
  {
    name: "getAPassData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "status", type: "uint256" },
      { name: "tier", type: "uint256" },
      { name: "subTier", type: "uint256" },
      { name: "group", type: "uint256" },
      { name: "subGroup", type: "uint256" },
      { name: "extra", type: "uint256" },
      { name: "expiration", type: "uint256" },
      { name: "tailA", type: "uint256" },
      { name: "tailB", type: "uint256" },
      { name: "tailC", type: "uint256" },
    ],
  },
] as const;

const client = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz", { timeout: 12_000 }),
});

let apass: Address | null = null;
let shared: Promise<PublicCleanverse> | null = null;

function publicCleanverse(): Promise<PublicCleanverse> {
  shared ??= loadCleanversePublic().catch(() => ({ apass: null, mint: null }));
  return shared;
}

async function apassAddress(): Promise<Address> {
  if (apass) return apass;
  const row = await publicCleanverse();
  if (!row.apass || !/^0x[a-fA-F0-9]{40}$/.test(row.apass)) throw new Error("no apass");
  apass = row.apass as Address;
  return apass;
}

export async function mintUrl(): Promise<string | null> {
  const row = await publicCleanverse();
  return row.mint;
}

export async function passContract(): Promise<string | null> {
  try {
    return await apassAddress();
  } catch {
    return null;
  }
}

export type PassRead = { open: boolean; status: number; expiration: number };

export async function readPass(address: string): Promise<PassRead | null> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return { open: false, status: 0, expiration: 0 };
  try {
    const result = await client.readContract({
      address: await apassAddress(),
      abi,
      functionName: "getAPassData",
      args: [address as Address],
    });
    const status = Number(result[0]);
    const expiration = Number(result[6]);
    return {
      open: status === 1 && expiration > Math.floor(Date.now() / 1000),
      status,
      expiration,
    };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    if (message.includes("revert") || message.includes("0xfb524a44")) {
      return { open: false, status: 0, expiration: 0 };
    }
    return null;
  }
}
