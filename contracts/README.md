# Solarchik contracts (Monad testnet)

Four contracts, no custody and no trading:

- `src/SolarchikStreak.sol` — `checkIn()` once per 24 hours. Streak continues if the next check-in is within 48 hours of the last one; otherwise it starts again at 1.
- `src/SolarchikStrategy.sol` — ERC-721. `mint(name, risk)` with risk `1 | 2 | 3`. `tokenURI` is on-chain JSON and states paper simulation only. `updateStrategy` sets a **240 hour** sale lock. Transfers revert with `sale locked` until it ends.
- `src/SolarchikSuns.sol` — the player calls `authorize(sessionKey, limit, expiry)` once. That key then calls `recordSun()` / `recordSuns()` until the limit or expiry. `authorize` can fund the key for gas.
- `src/SolarchikAgent.sol` — owner `configure`s an agent key, max size, daily cap, and allowed paper actions. The agent key calls `recordPaper`. `quote()` uses a Chainlink feed when one is set and answering; otherwise it stores the labelled fallback and `fromChainlink` is false. No swaps and no custody. Leave `CHAINLINK_FEED` unset on Monad testnet.

Chain config for the app is `src/lib/chain.ts`. `VITE_CHAIN_ID=421614` selects Arbitrum Sepolia, where the ETH/USD Chainlink feed is `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165`.

Chain: Monad testnet, id `10143`, RPC `https://testnet-rpc.monad.xyz`, explorer `https://testnet.monadexplorer.com`, gas token MON. Faucet: https://faucet.monad.xyz

## Deploy (Foundry)

```bash
cd contracts
forge install foundry-rs/forge-std
forge test
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

The script prints `VITE_STREAK_ADDRESS`, `VITE_STRATEGY_ADDRESS`, `VITE_SUNS_ADDRESS`, and `VITE_AGENT_ADDRESS`.

The app reads those at build time. You can also paste them on the project profile; a saved set on that device wins over the build-time values. Never commit a private key.
