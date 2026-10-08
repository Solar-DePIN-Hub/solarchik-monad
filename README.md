# Solarchik on Monad

Night-booth secretary on Monad testnet. One passkey makes two keys. A Cleanverse pass arms the phone line. Privy pays the agent key.

This is the Monad Metropolis entry. It is not the Solana Mobile app in [Solar-DePIN-Hub/Solarchik](https://github.com/Solar-DePIN-Hub/Solarchik).

| | |
|---|---|
| Live | https://solarchik-monad.vercel.app/ |
| Judges | https://solarchik-monad.vercel.app/judges |
| Track | Trust, Identity & AI Infrastructure |
| Chain | Monad testnet, id `10143` |
| RPC | https://testnet-rpc.monad.xyz |
| Explorer | https://testnet.monadexplorer.com |
| Code | https://github.com/Solar-DePIN-Hub/solarchik-monad |

The home page is the booth. [`/judges`](https://solarchik-monad.vercel.app/judges) is the order to follow. Architecture is in [ARCHITECTURE.md](ARCHITECTURE.md).

## What the booth does

The line is `+380914810885`. A call costs `0.01` MON. A Privy top-up of `0.05` MON is 5 calls. Credit starts at `0.00` MON. Test MON from the faucet does not buy a call. It only fills the Privy wallet so that wallet can send the top-up.

1. Press EN. The line answers in English.
2. Create the account. One passkey. The card shows `You · …/0` and `Agent · …/1`. No seed is shown. MetaMask is not the account.
3. The pass has to say **Pass open** before the line arms. A new passkey has no pass, so Turn on stays blocked. Get a pass, or check a browser wallet that already holds one. That wallet is only a reader.
4. Connect Privy. It is the payer, not the account. Open Test MON, then send. The transfer goes to the agent key. The hash opens on the explorer.
5. Top up `0.05` MON. The booth counts the call credit only after that transfer is on chain, to the agent key.
6. Turn on only if this phone should forward to `+380914810885`. The phone must confirm the carrier code. Nothing is forwarded until it does. Forwarding does not spend a call.
7. For a short window the next call on that shared line is filed under this account. Pick up on a typed call spends one call. Hang up, then open the archive row.
8. The archive gets a row only after the assistant answers. The booth does not invent a transcript. If the archive request fails, it says so and shows the last list saved in this browser.

## Three keys, three jobs

**Passkey.** `@category-labs/mera` returns a PRF secret. That secret becomes a BIP-39 mnemonic, then two secp256k1 keys at `m/44'/60'/0'/0/0` (person) and `m/44'/60'/0'/0/1` (agent). Each key signs its own message, `Solarchik person` or `Solarchik agent`, and the signature has to recover to that address. The credential id is stored in this browser under `solarchik-passkey`. It does not travel to another browser. No seed is rendered.

**Cleanverse pass.** The app asks Cleanverse for the live Monad testnet A-Pass contract. It does not hardcode that address. `getAPassData` is read on chain. The pass is open only when status is `1` and the expiration word (return index 5) is still in the future. A revert, including selector `0xfb524a44`, is a closed pass. A failed read is "check again", not open.

**Privy.** Email login creates an embedded wallet on chain `10143`. Top up sends `0.05` MON from that wallet to the agent key. A separate control sends `0.01` MON, which is one call, not the five-call top-up. The browser wallet never sends this payment.

## What is not the judge path

The yard, the roof run, and the work desk are still in this repository. They are older and they are not how a call is paid. These contracts are deployed and left as they are. Do not redeploy them. Do not describe them as the booth:

- Streak `0x357c1a631f208FBB84d430bd18FEE65B54456a38`
- Strategy `0xDfdd6b3402180316D780d7634624d09b9026Fb42`
- Suns `0x060961d6495811582C886DB14B9F5cE6271fF3d6`
- Agent `0xb18cad14A950CD4cB7EEC936FE8843ef38eB6cDE`

There is no Android package in this build, no Seed Vault, and no order.

## Limits

Testnet only. No customers and no revenue are claimed here. The passkey is per browser. The phone number is one shared demo line. Call credit is the sum of verified top-up hashes in this browser, minus calls already spent here. It is not a balance inside the old contracts.

## Local app

```bash
npm install
npm run dev
```

The dev server listens on port `8080`. `VITE_PRIVY_APP_ID` overrides the public Privy app id baked in for the demo. Do not commit a private key.
