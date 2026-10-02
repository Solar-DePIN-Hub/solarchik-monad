/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STREAK_ADDRESS?: string;
  readonly VITE_STRATEGY_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
