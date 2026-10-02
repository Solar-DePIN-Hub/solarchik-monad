import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export const EXPLORER = "https://testnet.monadexplorer.com";
export const FAUCET = "https://faucet.monad.xyz";
export const MONAD_HEX = "0x279f";
/** This submission. Not the Solana Mobile repository. */
export const MONAD_REPO = "https://github.com/Solar-DePIN-Hub/solarchik-monad";
export const HACKATHON = "https://hackathon.monad.xyz";
/** Separate program. Do not submit it as the Metropolis project. */
export const ORIGINAL_REPO = "https://github.com/Solar-DePIN-Hub/Solarchik";

export function txUrl(hash: string) {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string) {
  return `${EXPLORER}/address/${address}`;
}

export const streakAbi = [
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "streak",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "lastCheckIn",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "canCheckIn",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "nextCheckInAt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "INTERVAL",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "GRACE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "streak", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const strategyAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "LOCK",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "strategyName", type: "string" },
      { name: "risk", type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "updateStrategy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "strategyName", type: "string" },
      { name: "risk", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "strategyOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "risk", type: "uint8" },
      { name: "lockedUntil", type: "uint64" },
      { name: "mintedAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "tokensOfOwner",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const ADDR = /^0x[a-fA-F0-9]{40}$/;
const ZERO = "0x0000000000000000000000000000000000000000";

export function parseAddress(value: string | undefined | null): `0x${string}` | null {
  if (!value) return null;
  const v = value.trim();
  if (!ADDR.test(v) || v.toLowerCase() === ZERO) return null;
  return v as `0x${string}`;
}

export function shortAddress(value: string) {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function decodeJsonUri(uri: string): string {
  const marker = "base64,";
  const i = uri.indexOf(marker);
  if (i === -1) return uri;
  try {
    const bin = atob(uri.slice(i + marker.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return uri;
  }
}
