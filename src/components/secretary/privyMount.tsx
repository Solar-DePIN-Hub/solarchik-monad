import { useEffect } from "react";
import { PrivyProvider, useCreateWallet, usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
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
        loginMethods: ["email"],
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
      }}
    >
      <Bind onChange={onChange} />
    </PrivyProvider>
  );
}

function Bind({ onChange }: { onChange: (api: WalletApi) => void }) {
  const { login, ready, authenticated } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  useEffect(() => {
    onChange({
      ready,
      authenticated,
      login,
      createWallet: async () => {
        await createWallet();
      },
      wallets,
      sendTransaction: (tx, opts) => sendTransaction(tx, opts),
    });
  }, [ready, authenticated, login, createWallet, wallets, sendTransaction, onChange]);
  return null;
}
