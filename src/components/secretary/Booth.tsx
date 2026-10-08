import { useEffect, useState, type ComponentType } from "react";
import { Phone } from "lucide-react";

export function Booth() {
  const [Live, setLive] = useState<ComponentType | null>(null);
  useEffect(() => {
    void import("./BoothLive").then((mod) => setLive(() => mod.BoothLive));
  }, []);
  if (!Live) return <BoothShell />;
  return <Live />;
}

function BoothShell() {
  return (
    <div className="booth relative flex h-dvh w-full flex-col px-4 pt-5" data-theme="night">
      <div aria-hidden className="booth-glow pointer-events-none absolute -left-10 top-0 size-64" />
      <p className="booth-gold relative text-xs font-semibold uppercase tracking-[0.18em]">Нічна будка</p>
      <h1 className="font-display relative mt-1 text-4xl leading-none">Секретар</h1>
      <div className="booth-handset relative mx-auto mt-10 grid size-28 place-items-center">
        <span className="booth-phone relative grid size-20 place-items-center rounded-full">
          <Phone className="size-8" aria-hidden />
        </span>
      </div>
    </div>
  );
}
