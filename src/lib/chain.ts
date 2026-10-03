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

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia-rollup.arbitrum.io/rpc"] } },
  blockExplorers: {
    default: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" },
  },
  testnet: true,
});

const selectedId = Number(import.meta.env.VITE_CHAIN_ID || "10143");
export const activeChain = selectedId === arbitrumSepolia.id ? arbitrumSepolia : monadTestnet;

/** Chainlink ETH/USD on Arbitrum Sepolia. Monad testnet has no Chainlink price feeds. */
export const CHAINLINK_FEEDS: Record<number, `0x${string}` | null> = {
  [monadTestnet.id]: null,
  [arbitrumSepolia.id]: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
};

export const priceFeed = CHAINLINK_FEEDS[activeChain.id] ?? null;

export const EXPLORER = activeChain.blockExplorers.default.url;
export const FAUCET =
  activeChain.id === arbitrumSepolia.id
    ? "https://www.alchemy.com/faucets/arbitrum-sepolia"
    : "https://faucet.monad.xyz";
export const CHAIN_HEX = `0x${activeChain.id.toString(16)}` as `0x${string}`;
export const MONAD_HEX = "0x279f";
/** This submission. Not the Solana Mobile repository. */
export const MONAD_REPO = "https://github.com/Solar-DePIN-Hub/solarchik-monad";
export const HACKATHON = "https://hackathon.monad.xyz";
/** Separate program. Do not submit it as the Metropolis project. */
export const ORIGINAL_REPO = "https://github.com/Solar-DePIN-Hub/Solarchik";

/** Deployed 2026-10-03 from 0x148c10bC74cC3cFb8F99d48DeA90cbF7897Cc2e1 on chain 10143. */
export const DEPLOYED = {
  streak: "0x357c1a631f208FBB84d430bd18FEE65B54456a38",
  strategy: "0xDfdd6b3402180316D780d7634624d09b9026Fb42",
  suns: "0x060961d6495811582C886DB14B9F5cE6271fF3d6",
  agent: "0xb18cad14A950CD4cB7EEC936FE8843ef38eB6cDE",
} as const;

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

export const sunsAbi = [
  {
    type: "function",
    name: "authorize",
    stateMutability: "payable",
    inputs: [
      { name: "sessionKey", type: "address" },
      { name: "spendLimit", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "recordSun",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "recordSuns",
    stateMutability: "nonpayable",
    inputs: [{ name: "count", type: "uint32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "sunsOf",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "sessionOf",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "key", type: "address" },
      { name: "expiry", type: "uint64" },
      { name: "spent", type: "uint32" },
      { name: "limit", type: "uint32" },
      { name: "revoked", type: "bool" },
    ],
  },
] as const;

export const agentAbi = [
  {
    type: "function",
    name: "configure",
    stateMutability: "payable",
    inputs: [
      { name: "agentKey", type: "address" },
      { name: "maxPer", type: "uint256" },
      { name: "daily", type: "uint256" },
      { name: "allowedMask", type: "uint8" },
    ],
    outputs: [],
  },
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "revoke", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "recordPaper",
    stateMutability: "nonpayable",
    inputs: [
      { name: "strategyId", type: "uint256" },
      { name: "action", type: "uint8" },
      { name: "size", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "price", type: "int256" },
      { name: "decimals", type: "uint8" },
      { name: "fromChainlink", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "agent",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "feed",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "maxPerTrade",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "dailyCap",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "spentToday",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "paperCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "paperAt",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "strategyId", type: "uint256" },
          { name: "action", type: "uint8" },
          { name: "price", type: "int256" },
          { name: "decimals", type: "uint8" },
          { name: "fromChainlink", type: "bool" },
          { name: "size", type: "uint256" },
          { name: "at", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "PaperRecorded",
    inputs: [
      { name: "agentKey", type: "address", indexed: true },
      { name: "strategyId", type: "uint256", indexed: true },
      { name: "action", type: "uint8", indexed: false },
      { name: "price", type: "int256", indexed: false },
      { name: "decimals", type: "uint8", indexed: false },
      { name: "fromChainlink", type: "bool", indexed: false },
      { name: "size", type: "uint256", indexed: false },
    ],
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
