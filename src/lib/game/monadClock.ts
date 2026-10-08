import { AGENTS_BYTECODE, STREAK_BYTECODE } from "./monadBytecode";

const CHAIN_ID = 10143;
const CHAIN_HEX = "0x279f";
const RPC = "https://testnet-rpc.monad.xyz";
const EXPLORER = "https://testnet.monadexplorer.com";

export type MonadProof =
  | { ok: true; address: string; signature: string; cluster: "monad"; kind: "tx" }
  | { ok: false; error: string };

type Ethereum = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function provider(): Ethereum | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: Ethereum }).ethereum;
  return eth ?? null;
}

function rejected(error: unknown): boolean {
  const code = (error as { code?: number }).code;
  if (code === 4001 || code === 4900) return true;
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return message.includes("reject") || message.includes("denied") || message.includes("cancel");
}

function streakAddress(): `0x${string}` | null {
  const raw = String(import.meta.env.VITE_STREAK_ADDRESS ?? "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : null;
}

function hexMemo(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let hex = "0x";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

async function ensureChain(eth: Ethereum) {
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902 && code !== -32603) throw error;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: "Monad Testnet",
          nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
          rpcUrls: [RPC],
          blockExplorerUrls: [EXPLORER],
        },
      ],
    });
  }
}

export type NamedWallet = {
  id: string;
  name: string;
  connect: () => Promise<{ ok: true; address: string } | { ok: false; error: string }>;
};

type Announced = {
  info: { uuid: string; name: string };
  provider: Ethereum;
};

async function connectProvider(eth: Ethereum): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  try {
    try {
      await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
    } catch (error) {
      if (rejected(error)) return { ok: false, error: "wallet" };
    }
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const from = accounts[0];
    if (!from || !/^0x[a-fA-F0-9]{40}$/.test(from)) return { ok: false, error: "no-wallet" };
    await ensureChain(eth);
    return { ok: true, address: from };
  } catch (error) {
    if (rejected(error)) return { ok: false, error: "wallet" };
    return { ok: false, error: "wallet" };
  }
}

/** Wallets that announced themselves. Falls back to whatever grabbed `window.ethereum`. */
export function listBrowserWallets(): Promise<NamedWallet[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  return new Promise((resolve) => {
    const found = new Map<string, Announced>();
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Announced>).detail;
      if (!detail?.info?.uuid || typeof detail.provider?.request !== "function") return;
      found.set(detail.info.uuid, detail);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      const rows = [...found.values()].map((row) => ({
        id: row.info.uuid,
        name: row.info.name || "Wallet",
        connect: () => connectProvider(row.provider),
      }));
      if (rows.length > 0) {
        resolve(rows);
        return;
      }
      const eth = provider();
      resolve(eth ? [{ id: "injected", name: "Browser wallet", connect: () => connectProvider(eth) }] : []);
    }, 200);
  });
}

export function monadTxUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function monadAddressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export async function readMonadAccount(): Promise<string> {
  const eth = provider();
  if (!eth) return "";
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    const from = accounts[0] ?? "";
    return /^0x[a-fA-F0-9]{40}$/.test(from) ? from : "";
  } catch {
    return "";
  }
}

export async function connectMonad(): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  const eth = provider();
  if (!eth) return { ok: false, error: "no-wallet" };
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const from = accounts[0];
    if (!from || !/^0x[a-fA-F0-9]{40}$/.test(from)) return { ok: false, error: "no-wallet" };
    await ensureChain(eth);
    return { ok: true, address: from };
  } catch (error) {
    if (rejected(error)) return { ok: false, error: "wallet" };
    return { ok: false, error: "wallet" };
  }
}

export async function readMonBalance(address: string): Promise<number | null> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
    });
    const json = (await res.json()) as { result?: string };
    if (!json.result) return null;
    return Number(BigInt(json.result)) / 1e18;
  } catch {
    return null;
  }
}

export async function readMonTransfer(hash: string): Promise<{ from: string; to: string; value: number } | null> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return null;
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [hash] }),
    });
    const json = (await res.json()) as { result?: { from?: string; to?: string; value?: string } | null };
    const tx = json.result;
    if (!tx?.from || !tx.to || typeof tx.value !== "string") return null;
    return { from: tx.from, to: tx.to, value: Number(BigInt(tx.value)) / 1e18 };
  } catch {
    return null;
  }
}

export async function sendMon(to: string, amount: number): Promise<MonadProof> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return { ok: false, error: "Потрібна адреса 0x" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Вкажи суму в MON" };
  const eth = provider();
  if (!eth) return { ok: false, error: "no-wallet" };
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const from = accounts[0];
    if (!from) return { ok: false, error: "no-wallet" };
    await ensureChain(eth);
    const wei = BigInt(Math.round(amount * 1e9)) * 10n ** 9n;
    const hash = (await eth.request({
      method: "eth_sendTransaction",
      params: [{ from, to, value: `0x${wei.toString(16)}` }],
    })) as string;
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return { ok: false, error: "Гаманець не віддав транзакцію" };
    return { ok: true, address: from, signature: hash, cluster: "monad", kind: "tx" };
  } catch (error) {
    if (rejected(error)) return { ok: false, error: "wallet" };
    const message = error instanceof Error ? error.message : "wallet";
    return { ok: false, error: message.slice(0, 140) };
  }
}

function isHexAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function codeAt(address: string): Promise<boolean> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [address, "latest"] }),
  });
  const json = (await res.json()) as { result?: string };
  return Boolean(json.result && json.result !== "0x" && json.result !== "0x0");
}

async function waitReceipt(hash: string): Promise<{ contractAddress?: string; logs?: { topics?: string[] }[] }> {
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash] }),
    });
    const json = (await res.json()) as { result?: { contractAddress?: string; status?: string } | null };
    if (json.result) {
      if (json.result.status === "0x0") throw new Error("Транзакцію відхилено мережею");
      return json.result;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Транзакція ще не в блоці");
}

async function connectedFrom(): Promise<{ eth: Ethereum; from: `0x${string}` }> {
  const eth = provider();
  if (!eth) throw new Error("no-wallet");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const from = accounts[0];
  if (!from || !isHexAddress(from)) throw new Error("no-wallet");
  await ensureChain(eth);
  return { eth, from };
}

/** First visit deploys from the connected wallet. Later visits reuse the address. */
export async function ensureMonadContract(kind: "streak" | "agents"): Promise<`0x${string}`> {
  const env = String(kind === "streak" ? import.meta.env.VITE_STREAK_ADDRESS : import.meta.env.VITE_AGENTS_ADDRESS ?? "").trim();
  if (isHexAddress(env) && (await codeAt(env))) return env;
  const key = `solarchik.monad.${kind}`;
  const cached = localStorage.getItem(key) ?? "";
  if (isHexAddress(cached) && (await codeAt(cached))) return cached;
  const { eth, from } = await connectedFrom();
  const data = kind === "streak" ? STREAK_BYTECODE : AGENTS_BYTECODE;
  const hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, data }],
  })) as string;
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new Error("Гаманець не віддав деплой");
  const receipt = await waitReceipt(hash);
  const address = receipt.contractAddress ?? "";
  if (!isHexAddress(address)) throw new Error("Мережа не повернула адресу контракту");
  localStorage.setItem(key, address);
  return address;
}

export async function sendMonadData(
  to: `0x${string}`,
  data: string,
): Promise<{ from: `0x${string}`; hash: `0x${string}`; logs: { topics?: string[] }[] }> {
  const { eth, from } = await connectedFrom();
  const hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data, value: "0x0" }],
  })) as string;
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw new Error("Гаманець не віддав транзакцію");
  const receipt = await waitReceipt(hash);
  return { from, hash: hash as `0x${string}`, logs: receipt.logs ?? [] };
}

export async function currentMonadAccount(): Promise<`0x${string}`> {
  const { from } = await connectedFrom();
  return from;
}

export async function signClockInMonad(meters: number, streak: number): Promise<MonadProof> {
  const eth = provider();
  if (!eth) return { ok: false, error: "no-wallet" };
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const from = accounts[0];
    if (!from || !/^0x[a-fA-F0-9]{40}$/.test(from)) return { ok: false, error: "no-wallet" };
    await ensureChain(eth);
    const contract = await ensureMonadContract("streak");
    const hash = (await eth.request({
      method: "eth_sendTransaction",
      params: [{ from, to: contract, data: "0x183ff085", value: "0x0" }],
    })) as string;
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return { ok: false, error: "Wallet sent no transaction" };
    return { ok: true, address: from, signature: hash, cluster: "monad", kind: "tx" };
  } catch (error) {
    if (rejected(error)) return { ok: false, error: "wallet" };
    const message = error instanceof Error ? error.message : "wallet";
    return { ok: false, error: message.slice(0, 140) };
  }
}

export const MONAD_CHAIN_ID = CHAIN_ID;
