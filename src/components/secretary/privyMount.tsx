import { useEffect } from "react";
import { PrivyProvider, usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { monadTestnet } from "viem/chains";
import { type WalletApi } from "./walletApi";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || "cmutyetdu035e0cjpxez5f3hl";

export function PrivyMount({ onChange }: { onChange: (api: WalletApi) => void }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
      }}
    >
      <Bind onChange={onChange} />
    </PrivyProvider>
  );
}

function Bind({ onChange }: { onChange: (api: WalletApi) => void }) {
  const { login, ready } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  useEffect(() => {
    onChange({
      ready,
      login,
      wallets,
      sendTransaction: (tx, opts) => sendTransaction(tx, opts),
    });
  }, [ready, login, wallets, sendTransaction, onChange]);
  return null;
}
