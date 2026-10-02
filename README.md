# Solarchik on Monad

Metropolis submission. **Not** the Solana Mobile app in [Solar-DePIN-Hub/Solarchik](https://github.com/Solar-DePIN-Hub/Solarchik).

**Track:** 02 — Consumer Products & Payments  
**Chain:** Monad testnet, id `10143`  
**Deadline:** 13 October 2026, 11:59 PM ET, at [hackathon.monad.xyz](https://hackathon.monad.xyz)

A daily check-in and a rooftop run. Strategy NFTs are a paper label, not a trade.

## What is on Monad

- `contracts/src/SolarchikStreak.sol` — `checkIn()` once per 24 hours. A gap longer than 48 hours resets the streak to 1. No tokens and no custody.
- `contracts/src/SolarchikStrategy.sol` — ERC-721. `mint(name, risk)` with risk `1 | 2 | 3`. `tokenURI` is on-chain JSON and says paper simulation. `updateStrategy` locks transfers for 240 hours.

## What is not on-chain

- The rooftop run and its suns live in the browser only.
- Sol replies from a script when no model key is configured, and the screen says so.
- No orders, prices, vaults, or yield.

## Demo

1. Open the deployed app in a normal browser with MetaMask.
2. Run the roofs. No wallet required.
3. Switch to Monad testnet and use [the faucet](https://faucet.monad.xyz) if you need gas.
4. Check in once.
5. Mint a strategy NFT and read its on-chain metadata.

The app reads `VITE_STREAK_ADDRESS` and `VITE_STRATEGY_ADDRESS`, or the two addresses pasted on the project profile page. Deploy:

```bash
cd contracts
forge install foundry-rs/forge-std
forge test
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Never commit a private key. RPC `https://testnet-rpc.monad.xyz`. Explorer `https://testnet.monadexplorer.com`.

## Judges

Open source is optional for Metropolis. This repository is public so the contracts and the client can be checked against the six-week build window (1 Sep–13 Oct 2026).
