import { useEffect, useState } from "react";
import { useBytecode } from "wagmi";
import { activeChain } from "@/lib/chain";
import { readContracts, subscribeStore, type ContractPair } from "@/lib/storage";

const empty: ContractPair = {
  streak: null,
  strategy: null,
  suns: null,
  agent: null,
  streakSource: "missing",
  strategySource: "missing",
  sunsSource: "missing",
  agentSource: "missing",
};

export function useContracts() {
  const [pair, setPair] = useState<ContractPair>(() => readContracts());
  useEffect(() => {
    const pull = () => setPair(readContracts());
    pull();
    return subscribeStore(pull);
  }, []);
  return pair;
}

export function useHasCode(address: `0x${string}` | null) {
  const query = useBytecode({
    address: address ?? undefined,
    chainId: activeChain.id,
    query: { enabled: Boolean(address) },
  });
  const code = query.data;
  const hasCode = Boolean(code && code !== "0x");
  return { hasCode, loading: query.isLoading, error: query.isError, refetch: query.refetch };
}
