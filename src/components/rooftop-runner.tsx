import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { FALLBACK_PALETTE, Runner, type Palette, type RunSnapshot } from "@/game/runner";
import { useI18n } from "@/lib/i18n/provider";
import { addRun, readMute, readSave, writeMute } from "@/lib/storage";

type Sfx = {
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  jump: () => void;
  collect: () => void;
  die: () => void;
};

function createSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let muted = false;
  const ac = () => {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };
  const tone = (freq: number, dur: number, type: OscillatorType, gain = 0.04) => {
    if (muted) return;
    const audio = ac();
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.value = gain;
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  };
  return {
    unlock() {
      ac();
    },
    setMuted(next) {
      muted = next;
    },
    jump() {
      tone(460, 0.08, "square", 0.03);
    },
    collect() {
      tone(720, 0.07, "sine", 0.05);
      window.setTimeout(() => tone(980, 0.09, "sine", 0.04), 70);
    },
    die() {
      tone(160, 0.28, "sawtooth", 0.035);
    },
  };
}

function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ink: pick("--color-ink", FALLBACK_PALETTE.ink),
    soft: pick("--color-ink-soft", FALLBACK_PALETTE.soft),
    cream: pick("--color-cream", FALLBACK_PALETTE.cream),
    sand: pick("--color-sand", FALLBACK_PALETTE.sand),
    sun: pick("--color-sun", FALLBACK_PALETTE.sun),
    ember: pick("--color-ember", FALLBACK_PALETTE.ember),
    sky: pick("--color-sky", FALLBACK_PALETTE.sky),
  };
}

const initialSnap: RunSnapshot = {
  phase: "ready",
  suns: 0,
  distance: 0,
  grounded: true,
  hint: null,
};

export function RooftopRunner() {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const [snap, setSnap] = useState<RunSnapshot>(initialSnap);
  const [bank, setBank] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [runSuns, setRunSuns] = useState(0);

  useEffect(() => {
    const save = readSave();
    setBank(save.suns);
    setBest(save.bestSuns);
    setMuted(readMute());
  }, []);

  useEffect(() => {
    sfxRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Runner();
    const sfx = createSfx();
    sfxRef.current = sfx;
    sfx.setMuted(readMute());
    engine.setPalette(readPalette(document.documentElement));
    const snapRef = { current: initialSnap };
    let raf = 0;
    let last = performance.now();
    let ended = false;

    engine.onEnd = (run) => {
      if (ended) return;
      ended = true;
      const next = addRun(run.suns, run.distance);
      setRunSuns(run.suns);
      setBank(next.suns);
      setBest(next.bestSuns);
    };

    const paint = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);
      const bw = Math.floor(cssW * dpr);
      const bh = Math.floor(cssH * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scale = cssW / 390;
      engine.setView(cssH / scale);
      engine.step(dt);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      engine.draw(ctx);
      for (const event of engine.pullEvents()) {
        if (event === "jump") sfx.jump();
        if (event === "collect") sfx.collect();
        if (event === "die") sfx.die();
      }
      const next = engine.snapshot();
      const prev = snapRef.current;
      if (
        next.phase !== prev.phase ||
        next.suns !== prev.suns ||
        next.hint !== prev.hint ||
        Math.floor(next.distance) !== Math.floor(prev.distance)
      ) {
        snapRef.current = next;
        setSnap(next);
      }
      window.__runner = {
        start: () => {
          ended = false;
          engine.start();
        },
        jump: () => engine.pressJump(),
        releaseJump: () => engine.releaseJump(),
        slide: (on: boolean) => engine.setSlide(on),
        getState: () => engine.snapshot(),
      };
      raf = requestAnimationFrame(paint);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
        event.preventDefault();
        sfx.unlock();
        engine.pressJump();
      }
      if (event.code === "ArrowDown" || event.code === "KeyS") {
        event.preventDefault();
        engine.setSlide(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") engine.releaseJump();
      if (event.code === "ArrowDown" || event.code === "KeyS") engine.setSlide(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    raf = requestAnimationFrame(paint);

    let pointer: { y: number } | null = null;
    const down = (event: PointerEvent) => {
      if (engine.phase !== "running") return;
      sfx.unlock();
      pointer = { y: event.clientY };
      engine.pressJump();
    };
    const move = (event: PointerEvent) => {
      if (!pointer) return;
      if (event.clientY - pointer.y > 36) engine.setSlide(true);
    };
    const up = () => {
      pointer = null;
      engine.releaseJump();
      engine.setSlide(false);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      delete window.__runner;
    };
  }, []);

  function begin() {
    window.__runner?.start();
    setSnap((prev) => ({ ...prev, phase: "running", suns: 0, distance: 0, hint: null }));
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full touch-none" aria-label={t.game.readyTitle} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 text-ink">
        <div className="card pointer-events-auto px-3 py-2">
          <p className="text-xs font-semibold text-ink-soft">{t.home.sunsLabel}</p>
          <p className="font-display text-2xl leading-none">{snap.suns}</p>
        </div>
        <div className="card pointer-events-auto px-3 py-2 text-right">
          <p className="text-xs font-semibold text-ink-soft">
            {Math.floor(snap.distance)} {t.game.meters}
          </p>
          <button
            type="button"
            className="btn btn-ghost mt-1 min-h-9 px-3 py-1"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              writeMute(next);
            }}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            {muted ? t.game.mute : t.game.sound}
          </button>
        </div>
      </div>
      {snap.hint ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <p className="pill">{snap.hint === "slide" ? t.game.slide : t.game.jump}</p>
        </div>
      ) : null}
      {snap.phase !== "running" ? (
        <div className="absolute inset-0 flex items-end justify-center px-4 pb-28">
          <div className="card w-full max-w-sm p-5">
            <p className="pill">{t.game.howSuns}</p>
            <h1 className="font-display mt-3 text-3xl">{snap.phase === "over" ? t.game.over : t.game.readyTitle}</h1>
            <p className="mt-2 text-sm text-ink-soft">{t.game.readyBody}</p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                {t.game.jump}: {t.game.howJump}
              </li>
              <li>
                {t.game.slide}: {t.game.howSlide}
              </li>
            </ul>
            {snap.phase === "over" ? (
              <p className="mt-3 font-semibold">
                {t.game.runSuns}: {runSuns}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-ink-soft">
              {t.game.bank}: {bank} · {t.home.best}: {best}
            </p>
            <button type="button" className="btn btn-ember btn-block mt-4" onClick={begin}>
              {snap.phase === "over" ? t.game.again : t.game.start}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

declare global {
  interface Window {
    __runner?: {
      start: () => void;
      jump: () => void;
      releaseJump: () => void;
      slide: (on: boolean) => void;
      getState: () => RunSnapshot;
    };
  }
}
