import { useEffect, useState } from "react";
import { clearContractOverride, readContracts, saveContractOverride } from "@/lib/storage";
import { useI18n } from "@/lib/i18n/provider";
import { useContracts } from "@/components/use-contracts";

export function ContractFields() {
  const { t } = useI18n();
  const pair = useContracts();
  const [streak, setStreak] = useState("");
  const [strategy, setStrategy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const current = readContracts();
    setStreak(current.streak ?? "");
    setStrategy(current.strategy ?? "");
  }, [pair.streak, pair.strategy]);

  const sourceLabel = (source: "device" | "env" | "missing") =>
    source === "device" ? t.contracts.device : source === "env" ? t.contracts.env : t.contracts.missing;

  return (
    <section className="card p-4">
      <h2 className="font-display text-xl">{t.contracts.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.contracts.help}</p>
      <label className="mt-3 block text-sm font-semibold" htmlFor="streak-addr">
        {t.contracts.streak}
        <span className="ml-2 font-medium text-ink-soft">{sourceLabel(pair.streakSource)}</span>
      </label>
      <input
        id="streak-addr"
        className="field mt-1"
        value={streak}
        spellCheck={false}
        autoCapitalize="off"
        onChange={(e) => setStreak(e.target.value)}
      />
      <label className="mt-3 block text-sm font-semibold" htmlFor="strategy-addr">
        {t.contracts.strategy}
        <span className="ml-2 font-medium text-ink-soft">{sourceLabel(pair.strategySource)}</span>
      </label>
      <input
        id="strategy-addr"
        className="field mt-1"
        value={strategy}
        spellCheck={false}
        autoCapitalize="off"
        onChange={(e) => setStrategy(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn btn-sun"
          onClick={() => {
            const ok = saveContractOverride({ streak, strategy });
            setMsg(ok ? t.contracts.saved : t.contracts.invalid);
          }}
        >
          {t.contracts.save}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            clearContractOverride();
            setMsg("");
          }}
        >
          {t.contracts.clear}
        </button>
      </div>
      {msg ? <p className="mt-2 text-sm">{msg}</p> : null}
    </section>
  );
}
