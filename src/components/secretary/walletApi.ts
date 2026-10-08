export type WalletRow = {
  address: string;
  walletClientType: string;
  switchChain: (id: number) => Promise<void>;
};

export type WalletApi = {
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  createWallet: () => Promise<void>;
  wallets: WalletRow[];
  sendTransaction: (
    tx: { to: string; from: string; value: string; chainId: number },
    opts: { address: string },
  ) => Promise<{ hash: string }>;
};

export const emptyWallet: WalletApi = {
  ready: false,
  authenticated: false,
  login() {},
  async createWallet() {},
  wallets: [],
  async sendTransaction() {
    throw new Error("wallet");
  },
};
