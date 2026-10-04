import { indexer, type CheckIn, type StrategyMint } from "envio";

indexer.onEvent(
  { contract: "Streak", event: "CheckedIn" },
  async ({ event, context }) => {
    const row: CheckIn = {
      id: `${event.transaction.hash}-${event.logIndex}`,
      user: event.params.user,
      streak: event.params.streak,
      timestamp: event.params.timestamp,
      txHash: event.transaction.hash,
    };
    context.CheckIn.set(row);
  },
);

indexer.onEvent(
  { contract: "Strategy", event: "StrategyMinted" },
  async ({ event, context }) => {
    const row: StrategyMint = {
      id: `${event.transaction.hash}-${event.logIndex}`,
      owner: event.params.owner,
      tokenId: event.params.tokenId,
      name: event.params.name,
      risk: event.params.risk,
      txHash: event.transaction.hash,
    };
    context.StrategyMint.set(row);
  },
);
