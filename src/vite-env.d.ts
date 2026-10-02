/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_STREAK_ADDRESS?: string;
  readonly VITE_STRATEGY_ADDRESS?: string;
  readonly VITE_SUNS_ADDRESS?: string;
  readonly VITE_AGENT_ADDRESS?: string;
  readonly VITE_PRIVY_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
