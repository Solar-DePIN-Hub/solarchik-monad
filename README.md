# Solarchik on Monad

Metropolis submission. **Not** the Solana Mobile app in [Solar-DePIN-Hub/Solarchik](https://github.com/Solar-DePIN-Hub/Solarchik).

**Track:** 02 — Consumer Products & Payments  
**Chain:** Monad testnet, id `10143`  
**Deadline:** 13 October 2026, 11:59 PM ET, at [hackathon.monad.xyz](https://hackathon.monad.xyz)

Deployed 2026-10-03 on Monad testnet from `0x148c10bC74cC3cFb8F99d48DeA90cbF7897Cc2e1`:

- Streak: https://testnet.monadexplorer.com/address/0x357c1a631f208FBB84d430bd18FEE65B54456a38
- Strategy: https://testnet.monadexplorer.com/address/0xDfdd6b3402180316D780d7634624d09b9026Fb42
- Suns: https://testnet.monadexplorer.com/address/0x060961d6495811582C886DB14B9F5cE6271fF3d6
- Agent: https://testnet.monadexplorer.com/address/0xb18cad14A950CD4cB7EEC936FE8843ef38eB6cDE

Deploy txs: `0x8ab779b5aaa6d12fcbc911031b95909a81d5291952264c658528509391f3a9c7`, `0x91115427deef5cbde479680a01be98bfdf7695a1a77e533285bb97c103ca730c`, `0x28bfab553cf55f8dfc0d28df0f85edacabaadc283e5bda949fdbf3d4402aa657`, `0x29e653a6e29b78ead753c9a2df46d27fb61589cb88376bc027e2f373437dd058`.

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
