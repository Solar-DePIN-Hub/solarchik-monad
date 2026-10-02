# Solarchik contracts (Monad testnet)

Two contracts, no custody and no trading:

- `src/SolarchikStreak.sol` — `checkIn()` once per 24 hours. Streak continues if the next check-in is within 48 hours of the last one; otherwise it starts again at 1.
- `src/SolarchikStrategy.sol` — ERC-721. `mint(name, risk)` with risk `1 | 2 | 3`. `tokenURI` is on-chain JSON and states paper simulation only. `updateStrategy` sets a **240 hour** sale lock. `transferFrom` / `safeTransferFrom` revert with `sale locked` until it ends.

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

The script prints `VITE_STREAK_ADDRESS` and `VITE_STRATEGY_ADDRESS`.

The app reads those at build time. You can also paste both addresses into **For judges** in the app; that device override is stored locally and wins over the build-time value. Never commit a private key.
