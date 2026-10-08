import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, type PasskeyCredentialMetadata } from "@category-labs/mera";
import { createSecp256k1SigningSession } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { recoverMessageAddress } from "viem";

const KEY = "solarchik-passkey";

function readStored(): PasskeyCredentialMetadata | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { credentialId?: unknown; transports?: unknown };
    if (typeof parsed.credentialId !== "string" || parsed.credentialId.length < 8) return null;
    const transports = Array.isArray(parsed.transports) ? parsed.transports.filter((row): row is string => typeof row === "string") : [];
    return transports.length > 0 ? { credentialId: parsed.credentialId, transports } : { credentialId: parsed.credentialId };
  } catch {
    return null;
  }
}

function writeStored(credential: PasskeyCredentialMetadata) {
  localStorage.setItem(KEY, JSON.stringify({ credentialId: credential.credentialId, transports: credential.transports ?? [] }));
}

export function hasPasskey(): boolean {
  if (typeof window === "undefined") return false;
  return readStored() !== null;
}

const PERSON_MESSAGE = "Solarchik person";
const AGENT_MESSAGE = "Solarchik agent";

async function signedAt(prfOutput: Uint8Array, index: number, message: string): Promise<{ address: string; signature: `0x${string}` }> {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (node.privateKey === null) throw new Error("no key");
  const session = createSecp256k1SigningSession({ privateKey: node.privateKey });
  try {
    const account = toViemAccount(session);
    const signature = await account.signMessage({ message });
    const recovered = await recoverMessageAddress({ message, signature });
    if (recovered.toLowerCase() !== account.address.toLowerCase()) throw new Error("bad signature");
    return { address: account.address, signature };
  } finally {
    session.end();
  }
}

export type PasskeyKeys = { person: string; agent: string };

async function keysFromPrf(prfOutput: Uint8Array): Promise<PasskeyKeys> {
  const person = await signedAt(prfOutput, 0, PERSON_MESSAGE);
  const agent = await signedAt(prfOutput, 1, AGENT_MESSAGE);
  if (person.address.toLowerCase() === agent.address.toLowerCase()) throw new Error("same key");
  return { person: person.address, agent: agent.address };
}

export async function createAccount(): Promise<PasskeyKeys> {
  const created = await createPasskeyWithPrfOutput({
    rp: { id: location.hostname, name: "Solarchik" },
    user: { name: "Solarchik", displayName: "Solarchik" },
  });
  writeStored({ credentialId: created.credentialId, transports: created.transports });
  return keysFromPrf(created.prfOutput);
}

export async function openAccount(): Promise<PasskeyKeys> {
  const known = readStored();
  const opened = await getPasskeyPrfOutput({
    rpId: location.hostname,
    credential: known ?? undefined,
  });
  writeStored(known?.credentialId === opened.credentialId && known ? known : { credentialId: opened.credentialId });
  return keysFromPrf(opened.prfOutput);
}

export function passkeyFailed(error: unknown): "cancel" | "fail" {
  const code = String((error as { code?: unknown }).code ?? "");
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  if (message.includes("cancel") || message.includes("not allowed") || message.includes("abort") || code === "NotAllowedError") return "cancel";
  return "fail";
}
