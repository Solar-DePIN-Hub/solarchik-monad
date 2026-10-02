import { createConfig, http, injected } from "wagmi";
import { activeChain, arbitrumSepolia, monadTestnet } from "@/lib/chain";

const chains =
  activeChain.id === arbitrumSepolia.id
    ? ([arbitrumSepolia, monadTestnet] as const)
    : ([monadTestnet, arbitrumSepolia] as const);

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [monadTestnet.id]: http(monadTestnet.rpcUrls.default.http[0]),
    [arbitrumSepolia.id]: http(arbitrumSepolia.rpcUrls.default.http[0]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

