import { useState } from "react";
import { Wallet } from "lucide-react";
import { formatUnits } from "viem";
import { useBalance, useConnection, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain, CHAIN_HEX, FAUCET, shortAddress } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";

type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function injectedProvider(): Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: Provider }).ethereum;
  return eth ?? null;
}

export async function ensureMonadChain() {
  const eth = injectedProvider();
  if (!eth) return;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 4902 && code !== -32603) throw err;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: activeChain.name,
          nativeCurrency: activeChain.nativeCurrency,
          rpcUrls: [activeChain.rpcUrls.default.http[0]],
          blockExplorerUrls: [activeChain.blockExplorers.default.url],
        },
      ],
    });
  }
}

export function WalletButton() {
  const { t } = useI18n();
  const connection = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const balance = useBalance({
    address: connection.address,
    chainId: activeChain.id,
    query: { enabled: Boolean(connection.address) },
  });
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const wrong = connection.isConnected && connection.chainId !== activeChain.id;

  async function onConnect() {
    setNote("");
    const eth = injectedProvider();
    if (!eth) {
      setNote("missing");
      setOpen(true);
      return;
    }
    try {
      await connect.mutateAsync({ connector: connect.connectors[0]! });
      try {
        await switchChain.mutateAsync({ chainId: activeChain.id });
      } catch {
        await ensureMonadChain();
      }
      setOpen(true);
    } catch {
      setNote("closed");
    }
  }

  async function onSwitch() {
    try {
      await switchChain.mutateAsync({ chainId: activeChain.id });
    } catch {
      try {
        await ensureMonadChain();
      } catch {
        setNote("closed");
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={wrong ? "btn btn-ghost px-3" : "btn btn-sun px-3"}
        aria-label={connection.address ? shortAddress(connection.address) : t.wallet.connect}
        onClick={() => (connection.isConnected ? setOpen((v) => !v) : void onConnect())}
        disabled={connect.isPending}
      >
        <Wallet className="size-5" />
        {connection.address ? shortAddress(connection.address) : null}
      </button>
      {open ? (
        <div className="card absolute right-0 z-40 mt-2 w-64 p-4 text-sm">
          {note === "missing" ? (
            <p>
              {t.wallet.noProvider}{" "}
              <a className="font-semibold underline" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                {t.wallet.install}
              </a>
            </p>
          ) : null}
          {connection.address ? (
            <>
              <p className="font-semibold">{shortAddress(connection.address)}</p>
              <p className="mt-1 text-ink-soft">
                {t.wallet.balance}:{" "}
                {balance.data
                  ? `${Number(formatUnits(balance.data.value, 18)).toFixed(3)} ${activeChain.nativeCurrency.symbol}`
                  : "—"}
              </p>
              {wrong ? <p className="mt-2 text-ember">{t.wallet.wrong}</p> : <p className="mt-2">{activeChain.name}</p>}
              <div className="mt-3 flex flex-col gap-2">
                {wrong ? (
                  <button type="button" className="btn btn-ember btn-block" onClick={() => void onSwitch()}>
                    {t.wallet.switch}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => {
                    void navigator.clipboard?.writeText(connection.address ?? "");
                    setCopied(true);
                  }}
                >
                  {copied ? t.wallet.copied : t.wallet.copy}
                </button>
                <p className="text-ink-soft">{t.wallet.privyOff}</p>
                <a className="btn btn-ghost btn-block" href={FAUCET} target="_blank" rel="noreferrer">
                  {t.home.faucet}
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => {
                    disconnect.mutate();
                    setOpen(false);
                  }}
                >
                  {t.wallet.disconnect}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
