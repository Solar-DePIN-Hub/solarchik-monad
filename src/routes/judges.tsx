import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ContractFields } from "@/components/contract-fields";
import { EXPLORER, FAUCET, HACKATHON, MONAD_REPO, ORIGINAL_REPO, DEPLOYED, addressUrl, activeChain } from "@/lib/chain";
import { useI18n } from "@/lib/i18n/provider";

export const Route = createFileRoute("/judges")({ component: JudgesPage });

const DEPLOY = `cd contracts
forge install foundry-rs/forge-std
forge test
forge script script/Deploy.s.sol:Deploy \\
  --rpc-url https://testnet-rpc.monad.xyz \\
  --private-key $PRIVATE_KEY \\
  --broadcast`;

function JudgesPage() {
  const { t } = useI18n();
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  async function copyBlurb() {
    try {
      await navigator.clipboard.writeText(t.judges.blurb);
      setCopyState("ok");
    } catch {
      setCopyState("fail");
    }
  }

  return (
    <div className="rise flex flex-col gap-4 pb-4">
      <header>
        <p className="pill">{t.judges.kicker}</p>
        <h1 className="font-display mt-3 text-4xl">{t.judges.title}</h1>
        <p className="mt-2 font-semibold">{t.judges.track}</p>
        <p className="mt-2 text-ink-soft">{t.judges.lead}</p>
        <p className="mt-2 text-sm font-semibold">{t.judges.deadline}</p>
      </header>

      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.packetTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>{t.judges.packetDemo}</li>
          <li>{t.judges.packetWrite}</li>
          <li>{t.judges.packetCode}</li>
        </ul>
        <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
          <a href={MONAD_REPO} target="_blank" rel="noreferrer">
            {t.judges.code}
          </a>
          <a href={HACKATHON} target="_blank" rel="noreferrer">
            hackathon.monad.xyz
          </a>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.demoTitle}</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          <li>{t.judges.demo1}</li>
          <li>{t.judges.demo2}</li>
          <li>{t.judges.demo3}</li>
          <li>{t.judges.demo4}</li>
          <li>{t.judges.demo5}</li>
        </ol>
      </section>

      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.windowTitle}</h2>
        <p className="mt-2 text-sm">{t.judges.windowBody}</p>
      </section>

      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.onTitle}</h2>
        <p className="mt-2 text-sm">{t.judges.onStreak}</p>
        <p className="mt-2 text-sm">{t.judges.onNft}</p>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.sessionTitle}</h2>
        <p className="mt-2 text-sm">{t.judges.sessionBody}</p>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.agentCardTitle}</h2>
        <p className="mt-2 text-sm">{t.judges.agentCardBody}</p>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.sponsorTitle}</h2>
        <p className="mt-2 text-sm">{t.judges.sponsorBody}</p>
        <p className="mt-2 text-sm">{t.judges.portableBody}</p>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.simTitle}</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
          <li>{t.judges.simRun}</li>
          <li>{t.judges.simChat}</li>
          <li>{t.judges.simTrade}</li>
          <li>{t.judges.simScore}</li>
        </ul>
      </section>
      <section className="card p-4 text-sm">
        <h2 className="font-display text-2xl">{t.judges.chainTitle}</h2>
        <dl className="mt-3 space-y-2">
          <div>
            <dt className="font-semibold">{t.judges.chainId}</dt>
            <dd>
              {activeChain.id} · {activeChain.name}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t.judges.rpc}</dt>
            <dd>{activeChain.rpcUrls.default.http[0]}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t.judges.token}</dt>
            <dd>{activeChain.nativeCurrency.symbol}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t.judges.explorer}</dt>
            <dd>
              <a href={EXPLORER} target="_blank" rel="noreferrer">
                {EXPLORER}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t.judges.faucet}</dt>
            <dd>
              <a href={FAUCET} target="_blank" rel="noreferrer">
                {FAUCET}
              </a>
            </dd>
          </div>
        </dl>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.deployTitle}</h2>
        <p className="mt-2 text-sm">{t.judges.deployBody}</p>
        <pre className="code mt-3">{DEPLOY}</pre>
      </section>
      <div>
        <p className="mb-2 text-sm font-semibold">{t.judges.pasteHint}</p>
        <ul className="mb-3 space-y-1 text-sm font-semibold">
          <li>
            <a href={addressUrl(DEPLOYED.streak)} target="_blank" rel="noreferrer">
              Streak {DEPLOYED.streak}
            </a>
          </li>
          <li>
            <a href={addressUrl(DEPLOYED.strategy)} target="_blank" rel="noreferrer">
              Strategy {DEPLOYED.strategy}
            </a>
          </li>
          <li>
            <a href={addressUrl(DEPLOYED.suns)} target="_blank" rel="noreferrer">
              Suns {DEPLOYED.suns}
            </a>
          </li>
          <li>
            <a href={addressUrl(DEPLOYED.agent)} target="_blank" rel="noreferrer">
              Agent {DEPLOYED.agent}
            </a>
          </li>
        </ul>
        <ContractFields />
      </div>

      <section className="card p-4">
        <h2 className="font-display text-2xl">{t.judges.portalTitle}</h2>
        <p className="mt-2 text-sm">{t.judges.portalBody}</p>
        <button type="button" className="btn btn-sun mt-3" onClick={() => void copyBlurb()}>
          {copyState === "ok" ? t.judges.copied : t.judges.copy}
        </button>
        {copyState === "fail" ? <p className="mt-2 text-sm font-semibold">{t.judges.copyFail}</p> : null}
        <textarea className="field mt-3 min-h-64" readOnly value={t.judges.blurb} />
      </section>

      <p className="text-sm font-semibold">{t.judges.warn}</p>
      <a className="text-sm font-semibold" href={ORIGINAL_REPO} target="_blank" rel="noreferrer">
        {t.judges.original}
      </a>
    </div>
  );
}
