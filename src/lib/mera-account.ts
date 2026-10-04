import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { Secp256k1SigningSession } from "@category-labs/mera";
import { createPublicClient, createWalletClient, http, type LocalAccount, type PublicClient } from "viem";
import { monadTestnet } from "@/lib/chain";

const CRED_KEY = "solarchik.mera.credential";
const RPC = monadTestnet.rpcUrls.default.http[0];

type StoredCred = { credentialId: string; transports?: string[] };
type Session = Secp256k1SigningSession;

let live: { session: Session; address: `0x${string}` } | null = null;
let adapt: ((session: Session) => LocalAccount) | null = null;

export function deriveEvmKey(prfOutput: Uint8Array, index = 0): Uint8Array {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (node.privateKey === null) throw new Error("derivation produced no key");
  return node.privateKey;
}

function readCred(): StoredCred | null {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCred;
    if (!parsed.credentialId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function remember(credentialId: string, transports?: readonly string[]) {
  const row: StoredCred = { credentialId, transports: transports ? [...transports] : undefined };
  localStorage.setItem(CRED_KEY, JSON.stringify(row));
}

export function hasSavedPasskey() {
  return typeof window !== "undefined" && Boolean(readCred());
}

export function lockMera() {
  live?.session.end();
  live = null;
}

export function publicMonad(): PublicClient {
  return createPublicClient({ chain: monadTestnet, transport: http(RPC) });
}

async function loadMera() {
  const mera = await import("@category-labs/mera");
  const bridge = await import("@category-labs/mera/viem");
  adapt = (session) => bridge.toViemAccount(session);
  return mera;
}

export async function unlockMera(mode: "create" | "resume"): Promise<`0x${string}`> {
  const mera = await loadMera();
  const rpId = location.hostname;
  if (mode === "create") {
    const created = await mera.createPasskeyWithPrfOutput({
      rp: { id: rpId, name: "Solarchik" },
      user: { name: "solarchik", displayName: "Solarchik" },
    });
    remember(created.credentialId, created.transports);
    return openSession(mera.createSecp256k1SigningSession({ privateKey: deriveEvmKey(created.prfOutput) }));
  }
  const saved = readCred();
  const got = await mera.getPasskeyPrfOutput({
    rpId,
    credential: saved ? { credentialId: saved.credentialId, transports: saved.transports } : undefined,
  });
  remember(got.credentialId);
  return openSession(mera.createSecp256k1SigningSession({ privateKey: deriveEvmKey(got.prfOutput) }));
}

function openSession(session: Session) {
  live?.session.end();
  if (!adapt) throw new Error("locked");
  const account = adapt(session);
  live = { session, address: account.address };
  return account.address;
}

export function meraSigner() {
  if (!live || !adapt) throw new Error("locked");
  const account = adapt(live.session);
  const client = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) });
  return { client, account };
}
