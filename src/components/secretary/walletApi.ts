export type WalletRow = {
  address: string;
  walletClientType: string;
  switchChain: (id: number) => Promise<void>;
};

export type WalletApi = {
  ready: boolean;
  login: () => void;
  wallets: WalletRow[];
  sendTransaction: (
    tx: { to: string; from: string; value: string; chainId: number },
    opts: { address: string },
  ) => Promise<{ hash: string }>;
};

export const emptyWallet: WalletApi = {
  ready: false,
  login() {},
  wallets: [],
  async sendTransaction() {
    throw new Error("wallet");
  },
};
