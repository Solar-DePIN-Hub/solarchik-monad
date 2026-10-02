export type RunPhase = "ready" | "running" | "over";
export type RunHint = "jump" | "slide" | null;
export type RunEvent = "jump" | "collect" | "die";

export type RunSnapshot = {
  phase: RunPhase;
  suns: number;
  distance: number;
  grounded: boolean;
  hint: RunHint;
};

type Sun = { x: number; y: number; taken: boolean };
type Roof = {
  x: number;
  w: number;
  y: number;
  chimney: number;
  wire: number;
  suns: Sun[];
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  on: boolean;
};
type Cloud = { x: number; y: number; w: number; s: number };
type Bld = { x: number; w: number; h: number };

const PX = 92;
const PW = 32;
const STAND_H = 54;
const SLIDE_H = 30;
const JUMP_V = 720;
const GRAVITY = 2100;
const MAX_FALL = 1100;

export type Palette = {
  ink: string;
  soft: string;
  cream: string;
  sand: string;
  sun: string;
  ember: string;
  sky: string;
};

export const FALLBACK_PALETTE: Palette = {
  ink: "#3a2410",
  soft: "#7a5636",
  cream: "#fff6e8",
  sand: "#ffe4c2",
  sun: "#ffb703",
  ember: "#fb6d1e",
  sky: "#7ec8e3",
};

export class Runner {
  phase: RunPhase = "ready";
  suns = 0;
  distance = 0;
  grounded = true;
  speed = 200;
  viewH = 640;
  onEnd: ((run: { suns: number; distance: number }) => void) | null = null;

  private cam = 0;
  private py = 400;
  private vy = 0;
  private sliding = false;
  private slideLeft = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private jumpHeld = false;
  private groundY = 480;
  private endX = 0;
  private roofs: Roof[] = [];
  private time = 0;
  private acc = 0;
  private shake = 0;
  private events: RunEvent[] = [];
  private empty: RunEvent[] = [];
  private built = false;
  private particles: Particle[] = Array.from({ length: 56 }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    size: 2,
    on: false,
  }));
  private clouds: Cloud[] = [
    { x: 20, y: 70, w: 78, s: 8 },
    { x: 160, y: 110, w: 110, s: 12 },
    { x: 300, y: 54, w: 64, s: 6 },
  ];
  private city: Bld[] = [];
  palette: Palette = FALLBACK_PALETTE;

  constructor() {
    let x = 0;
    for (let i = 0; i < 14; i++) {
      const w = 28 + ((i * 37) % 34);
      const h = 70 + ((i * 53) % 110);
      this.city.push({ x, w, h });
      x += w + 10 + (i % 3) * 6;
    }
  }

  setPalette(palette: Palette) {
    this.palette = palette;
  }

  setView(viewH: number) {
    const next = Math.max(520, viewH);
    const g = next * 0.76;
    this.viewH = next;
    if (!this.built) {
      this.groundY = g;
      this.buildPreview();
      return;
    }
    const d = g - this.groundY;
    if (Math.abs(d) > 1) {
      this.groundY = g;
      for (const roof of this.roofs) {
        roof.y += d;
        for (const sun of roof.suns) sun.y += d;
      }
      this.py += d;
    }
  }

  snapshot(): RunSnapshot {
    return {
      phase: this.phase,
      suns: this.suns,
      distance: this.distance,
      grounded: this.grounded,
      hint: this.hint(),
    };
  }

  pullEvents() {
    if (this.events.length === 0) return this.empty;
    const out = this.events;
    this.events = [];
    return out;
  }

  start() {
    this.cam = 0;
    this.speed = 200;
    this.suns = 0;
    this.distance = 0;
    this.vy = 0;
    this.sliding = false;
    this.slideLeft = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.shake = 0;
    this.acc = 0;
    this.grounded = true;
    this.roofs = [];
    this.endX = 0;
    this.groundY = this.viewH * 0.76;
    const first = this.makeRoof(-40, 700, this.groundY, true);
    first.suns = [
      { x: 180, y: this.groundY - 48, taken: false },
      { x: 340, y: this.groundY - 108, taken: false },
      { x: 520, y: this.groundY - 48, taken: false },
    ];
    this.roofs.push(first);
    this.endX = first.x + first.w;
    this.py = this.groundY - STAND_H;
    this.built = true;
    for (const p of this.particles) p.on = false;
    this.ensureRoofs();
    this.phase = "running";
  }

  pressJump() {
    if (this.phase !== "running" || this.sliding) return;
    this.jumpBuffer = 0.14;
    this.jumpHeld = true;
  }

  releaseJump() {
    this.jumpHeld = false;
  }

  setSlide(on: boolean) {
    if (this.phase !== "running") return;
    if (on && !this.sliding && this.grounded) {
      this.sliding = true;
      this.slideLeft = 0.62;
      this.py = this.py + STAND_H - SLIDE_H;
      this.jumpBuffer = 0;
    }
    if (!on && this.sliding) this.endSlide();
  }

  step(dt: number) {
    const capped = Math.min(0.05, dt);
    this.time += capped;
    for (const cloud of this.clouds) {
      cloud.x -= cloud.s * capped;
      if (cloud.x + cloud.w < -20) cloud.x = 420;
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - capped * 2.4);
    this.fadeParticles(capped);
    if (this.phase !== "running") return;
    this.acc += capped;
    const step = 1 / 60;
    let n = 0;
    while (this.acc >= step && n < 5) {
      this.simulate(step);
      this.acc -= step;
      n += 1;
      if (this.phase !== "running") break;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const w = 390;
    const h = this.viewH;
    const p = this.palette;
    const ox = this.shake > 0 ? Math.sin(this.time * 48) * 5 * this.shake : 0;
    ctx.save();
    ctx.translate(ox, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, p.sky);
    sky.addColorStop(0.45, p.sand);
    sky.addColorStop(1, p.cream);
    ctx.fillStyle = sky;
    ctx.fillRect(-8, -8, w + 16, h + 16);

    const glow = ctx.createRadialGradient(300, h * 0.34, 10, 300, h * 0.34, 150);
    glow.addColorStop(0, p.sun);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(300, h * 0.34, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.sun;
    ctx.beginPath();
    ctx.arc(300, h * 0.34, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.cream;
    for (const cloud of this.clouds) this.cloud(ctx, cloud.x, cloud.y, cloud.w);

    this.drawHills(ctx, p, h);
    this.drawCity(ctx, p, h);
    for (const roof of this.roofs) this.drawRoof(ctx, roof, p);
    this.drawPlayer(ctx, p);
    for (const particle of this.particles) {
      if (!particle.on) continue;
      const sx = particle.x - this.cam;
      ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      ctx.fillStyle = p.sun;
      ctx.beginPath();
      ctx.arc(sx, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private buildPreview() {
    this.roofs = [];
    const first = this.makeRoof(-40, 760, this.groundY, true);
    first.suns = [
      { x: 200, y: this.groundY - 48, taken: false },
      { x: 360, y: this.groundY - 108, taken: false },
    ];
    this.roofs.push(first);
    this.endX = first.x + first.w;
    this.py = this.groundY - STAND_H;
    this.built = true;
    this.ensureRoofs();
  }

  private makeRoof(x: number, w: number, y: number, easy: boolean): Roof {
    const roof: Roof = { x, w, y, chimney: -1, wire: -1, suns: [] };
    if (!easy && w > 210 && Math.random() < 0.45) roof.chimney = 64 + Math.random() * (w - 130);
    else if (!easy && w > 230 && Math.random() < 0.4) roof.wire = 48 + Math.random() * (w - 150);
    const count = Math.random() < 0.65 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const sx = x + w * (0.32 + i * 0.36);
      if (roof.chimney >= 0 && Math.abs(sx - (x + roof.chimney)) < 40) continue;
      if (roof.wire >= 0 && Math.abs(sx - (x + roof.wire)) < 40) continue;
      roof.suns.push({ x: sx, y: y - (i === 1 ? 108 : 48), taken: false });
    }
    return roof;
  }

  private ensureRoofs() {
    let guard = 0;
    while (this.endX < this.cam + 820 && guard < 8) {
      const ramp = Math.min(1, this.cam / 6400);
      const air = (2 * JUMP_V) / GRAVITY;
      const reach = this.speed * air;
      const gap = this.endX < 680 ? 50 : Math.min(reach * 0.7, 48 + ramp * 88);
      const w = 220 + Math.random() * 120;
      const y = this.groundY + (this.endX < 900 ? 0 : (Math.random() - 0.5) * 22);
      const roof = this.makeRoof(this.endX + gap, w, y, this.endX < 900);
      this.roofs.push(roof);
      this.endX = roof.x + roof.w;
      guard += 1;
    }
  }

  private endSlide() {
    if (!this.sliding) return;
    this.sliding = false;
    this.py = this.py + SLIDE_H - STAND_H;
  }

  private height() {
    return this.sliding ? SLIDE_H : STAND_H;
  }

  private simulate(dt: number) {
    const ramp = Math.min(1, this.cam / 6400);
    this.speed = 200 + ramp * 200;
    this.cam += this.speed * dt;
    this.distance = this.cam / 18;
    if (this.sliding) {
      this.slideLeft -= dt;
      if (this.slideLeft <= 0) this.endSlide();
    }
    const ph = this.height();
    if (this.grounded) this.coyote = 0.1;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0) && !this.sliding) {
      this.vy = -JUMP_V;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.events.push("jump");
    }
    if (!this.grounded) {
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      const prevFeet = this.py + ph;
      this.py += this.vy * dt;
      const feet = this.py + ph;
      const left = this.cam + PX;
      const right = left + PW;
      if (this.vy >= 0) {
        for (const roof of this.roofs) {
          if (roof.x >= right - 4 || roof.x + roof.w <= left + 4) continue;
          if (prevFeet <= roof.y + 12 && feet >= roof.y - 1) {
            this.py = roof.y - ph;
            this.vy = 0;
            this.grounded = true;
            break;
          }
        }
      }
    } else {
      const left = this.cam + PX + 4;
      const right = this.cam + PX + PW - 4;
      const feet = this.py + ph;
      const roof = this.roofs.find(
        (item) => item.x < right && item.x + item.w > left && Math.abs(item.y - feet) < 8,
      );
      if (roof) {
        this.py = roof.y - ph;
        this.vy = 0;
      } else {
        this.grounded = false;
      }
    }
    if (this.phase !== "running") return;
    const top = this.py;
    const bot = this.py + ph;
    const left = this.cam + PX;
    const right = left + PW;
    for (const roof of this.roofs) {
      if (roof.x > right + 20 || roof.x + roof.w < left - 20) continue;
      if (roof.chimney >= 0) {
        const cx = roof.x + roof.chimney;
        if (hit(left, top, right, bot, cx, roof.y - 52, cx + 26, roof.y - 2)) {
          this.die();
          return;
        }
      }
      if (roof.wire >= 0) {
        const wx = roof.x + roof.wire;
        if (hit(left, top, right, bot, wx, roof.y - 48, wx + 74, roof.y - 36)) {
          this.die();
          return;
        }
      }
      const midX = left + PW / 2;
      const midY = top + ph / 2;
      for (const sun of roof.suns) {
        if (sun.taken) continue;
        const dx = sun.x - midX;
        const dy = sun.y - midY;
        if (dx * dx + dy * dy < 34 * 34) {
          sun.taken = true;
          this.suns += 1;
          this.events.push("collect");
          this.burst(sun.x, sun.y);
        }
      }
    }
    if (bot > this.viewH + 30) this.die();
    if (this.roofs.length > 7 && this.roofs[0] && this.roofs[0].x + this.roofs[0].w < this.cam - 120) {
      this.roofs.shift();
    }
    this.ensureRoofs();
    if (this.grounded && !this.sliding && Math.floor(this.time * 8) !== Math.floor((this.time - dt) * 8)) {
      this.puff(left + 6, bot - 2);
    }
  }

  private die() {
    if (this.phase !== "running") return;
    this.phase = "over";
    this.shake = 1;
    this.events.push("die");
    this.onEnd?.({ suns: this.suns, distance: this.distance });
  }

  private hint(): RunHint {
    if (this.phase !== "running" || this.cam > 2400) return null;
    const left = this.cam + PX;
    const look = left + 150;
    const covered = this.roofs.some((roof) => roof.x <= look && roof.x + roof.w >= look);
    if (!covered) return "jump";
    for (const roof of this.roofs) {
      if (roof.chimney >= 0) {
        const cx = roof.x + roof.chimney;
        if (cx > left + 10 && cx < left + 170) return "jump";
      }
      if (roof.wire >= 0) {
        const wx = roof.x + roof.wire;
        if (wx > left + 10 && wx < left + 160) return "slide";
      }
    }
    return null;
  }

  private fadeParticles(dt: number) {
    for (const particle of this.particles) {
      if (!particle.on) continue;
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 40 * dt;
      if (particle.life <= 0) particle.on = false;
    }
  }

  private burst(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const particle = this.particles.find((item) => !item.on);
      if (!particle) return;
      const a = (Math.PI * 2 * i) / 8;
      particle.on = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(a) * 90;
      particle.vy = Math.sin(a) * 90;
      particle.life = 0.45;
      particle.max = 0.45;
      particle.size = 3.2;
    }
  }

  private puff(x: number, y: number) {
    const particle = this.particles.find((item) => !item.on);
    if (!particle) return;
    particle.on = true;
    particle.x = x;
    particle.y = y;
    particle.vx = -40;
    particle.vy = -10;
    particle.life = 0.28;
    particle.max = 0.28;
    particle.size = 2.2;
  }

  private cloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
    ctx.beginPath();
    ctx.ellipse(x + w * 0.35, y, w * 0.28, w * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.58, y + 4, w * 0.32, w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHills(ctx: CanvasRenderingContext2D, p: Palette, h: number) {
    ctx.fillStyle = p.sky;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    for (let x = 0; x <= 390; x += 20) {
      const y = h * 0.58 + Math.sin((x + this.cam * 0.04) * 0.02) * 16;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(390, h);
    ctx.lineTo(0, h);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawCity(ctx: CanvasRenderingContext2D, p: Palette, h: number) {
    const loop = this.city.length ? this.city[this.city.length - 1]!.x + this.city[this.city.length - 1]!.w + 16 : 400;
    const shift = (this.cam * 0.18) % loop;
    ctx.fillStyle = p.ink;
    ctx.globalAlpha = 0.18;
    for (let copy = 0; copy < 2; copy++) {
      const base = copy * loop - shift;
      for (const b of this.city) {
        const x = base + b.x;
        if (x > 400 || x + b.w < -10) continue;
        const y = h * 0.76 - b.h * 0.55;
        ctx.fillRect(x, y, b.w, b.h * 0.55 + 40);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = p.sun;
        for (let wy = y + 8; wy < y + b.h * 0.4; wy += 12) {
          for (let wx = x + 4; wx < x + b.w - 6; wx += 8) ctx.fillRect(wx, wy, 3, 4);
        }
        ctx.fillStyle = p.ink;
        ctx.globalAlpha = 0.18;
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawRoof(ctx: CanvasRenderingContext2D, roof: Roof, p: Palette) {
    const x = roof.x - this.cam;
    if (x > 420 || x + roof.w < -30) return;
    const y = roof.y;
    ctx.fillStyle = p.ember;
    ctx.beginPath();
    ctx.roundRect(x, y, roof.w, 46, 6);
    ctx.fill();
    ctx.fillStyle = p.cream;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x, y, roof.w, 5);
    ctx.globalAlpha = 1;
    const pad = 10;
    ctx.fillStyle = p.ink;
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + 12, roof.w - pad * 2, 22, 3);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = p.sun;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = x + pad + 8; gx < x + roof.w - pad; gx += 14) {
      ctx.moveTo(gx, y + 14);
      ctx.lineTo(gx, y + 32);
    }
    ctx.moveTo(x + pad, y + 23);
    ctx.lineTo(x + roof.w - pad, y + 23);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (roof.chimney >= 0) {
      const cx = x + roof.chimney;
      ctx.fillStyle = p.ink;
      ctx.fillRect(cx, y - 52, 26, 56);
      ctx.fillStyle = p.sand;
      ctx.fillRect(cx - 3, y - 58, 32, 8);
    }
    if (roof.wire >= 0) {
      const wx = x + roof.wire;
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wx, y);
      ctx.lineTo(wx, y - 52);
      ctx.moveTo(wx + 74, y);
      ctx.lineTo(wx + 74, y - 52);
      ctx.stroke();
      ctx.strokeStyle = p.ember;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(wx, y - 44);
      ctx.quadraticCurveTo(wx + 37, y - 34, wx + 74, y - 44);
      ctx.stroke();
    }
    for (const sun of roof.suns) {
      if (sun.taken) continue;
      this.drawSun(ctx, sun.x - this.cam, sun.y + Math.sin(this.time * 3 + sun.x) * 3, p);
    }
  }

  private drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, p: Palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = p.ember;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + this.time;
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
    }
    ctx.stroke();
    ctx.fillStyle = p.sun;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, p: Palette) {
    const ph = this.height();
    const x = PX + PW / 2;
    const feet = this.py + ph;
    const bob = this.grounded && !this.sliding ? Math.sin(this.time * 14) * 2 : 0;
    const swing = this.grounded && !this.sliding ? Math.sin(this.time * 14) : 0;
    ctx.save();
    ctx.translate(x, feet + bob);
    if (this.sliding) ctx.scale(1.08, 0.62);
    if (this.grounded) {
      ctx.fillStyle = p.ink;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.ellipse(0, 2, 18, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = p.ember;
    ctx.beginPath();
    ctx.moveTo(-8, -36);
    ctx.quadraticCurveTo(-26 - swing * 8, -30, -32, -16);
    ctx.quadraticCurveTo(-20, -22, -6, -32);
    ctx.fill();
    const leg = (ox: number, rot: number) => {
      ctx.save();
      ctx.translate(ox, -16);
      ctx.rotate(rot);
      ctx.fillStyle = p.ink;
      ctx.beginPath();
      ctx.roundRect(-4.5, 0, 9, 16, 5);
      ctx.fill();
      ctx.fillStyle = p.sun;
      ctx.beginPath();
      ctx.ellipse(0, 16, 6.5, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    leg(-7, swing * 0.7);
    leg(7, -swing * 0.7);
    ctx.fillStyle = p.ember;
    ctx.beginPath();
    ctx.roundRect(-15, -48, 30, 34, 14);
    ctx.fill();
    ctx.fillStyle = p.ink;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.roundRect(-8, -40, 16, 14, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.sun;
    ctx.lineWidth = 1;
    ctx.strokeRect(-5, -37, 10, 8);
    ctx.fillStyle = p.sun;
    ctx.beginPath();
    ctx.arc(1, -58, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.ember;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.85 + (Math.PI * 1.3 * i) / 6;
      ctx.moveTo(1 + Math.cos(a) * 18, -58 + Math.sin(a) * 18);
      ctx.lineTo(1 + Math.cos(a) * 24, -58 + Math.sin(a) * 24);
    }
    ctx.stroke();
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(-4, -60, 2, 0, Math.PI * 2);
    ctx.arc(6, -60, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(1, -55, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.restore();
  }
}

function hit(
  l1: number,
  t1: number,
  r1: number,
  b1: number,
  l2: number,
  t2: number,
  r2: number,
  b2: number,
) {
  return l1 < r2 && r1 > l2 && t1 < b2 && b1 > t2;
}
