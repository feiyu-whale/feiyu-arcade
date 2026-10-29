/* 勇者奶蛙传 · 肥鱼复刻版 v1.0.0
 * 逻辑为自写实现；美术素材沿用原站资源。
 */
'use strict';

// ==================== 常量 ====================
const W = 1280, H = 720;
const DEPTH = { bg: 0, floor: 5, shadow: 8, actor: 10, shot: 20, fx: 30, ui: 40 };
const VERSION = 'v1.0.0-复刻首版 20261029';

const ZONES = [
  { name: '奶笑村',   bg: 'village',  waves: [5, 8],        pool: ['chaser','chaser','chaser','shooter'] },
  { name: '咕嘎小径', bg: 'forest',   waves: [7, 11],       pool: ['chaser','jester','shooter','bell'] },
  { name: '刀盾山道', bg: 'mountain', waves: [9, 13, 17],   pool: ['shield','chaser','mimic','shooter','bell'] },
  { name: '风暴断桥', bg: 'bridge',   waves: [10, 14, 18],  pool: ['jester','bomber','shooter','mimic','bell'] },
  { name: '禁声堡垒', bg: 'courtyard',waves: [11, 16, 21],  pool: ['shield','hammer','shooter','bomber','scribe'] },
  { name: '肃静大殿', bg: 'hall',     waves: [12, 17, 23],  pool: ['scribe','hammer','bell','shield','jester','mimic'] },
  { name: '无声王座', bg: 'throne',   waves: [],            pool: [] }
];
const FINAL_ZONE = ZONES.length - 1;

// 敌人基础血 / 伤害 / 速度
const ENEMY = {
  hero:    { hp: 120, name: '奶蛙',     speed: 250, radius: 28 },
  chaser:  { hp: 36,  name: '憋笑小兵', speed: 73,  radius: 24, dmg: 10, ai: 'melee' },
  shooter: { hp: 42,  name: '紫帽法师', speed: 60,  radius: 24, dmg: 12, ai: 'ranged' },
  bomber:  { hp: 30,  name: '发条炸弹', speed: 100, radius: 24, dmg: 24, ai: 'suicide' },
  shield:  { hp: 65,  name: '盾卫',     speed: 58,  radius: 24, dmg: 10, ai: 'melee', front: true },
  bell:    { hp: 48,  name: '摇铃怪',   speed: 60,  radius: 24, dmg: 10, ai: 'support' },
  jester:  { hp: 45,  name: '弹簧小丑', speed: 73,  radius: 24, dmg: 15, ai: 'pouncer' },
  mimic:   { hp: 52,  name: '宝箱怪',   speed: 73,  radius: 24, dmg: 15, ai: 'pouncer' },
  hammer:  { hp: 90,  name: '重锤怪',   speed: 52,  radius: 33, dmg: 22, ai: 'melee' },
  scribe:  { hp: 55,  name: '冰霜书吏', speed: 60,  radius: 24, dmg: 12, ai: 'ranged', slow: true },
  dog:     { hp: 108, name: '刀盾狗',   speed: 82,  radius: 33, dmg: 20, ai: 'melee', front: true },
  penguin: { hp: 108, name: '凑企鹅',   speed: 73,  radius: 33, dmg: 20, ai: 'pouncer' },
  captain: { hp: 3168, name: '铁桶队长',     speed: 81, radius: 63, dmg: 18, ai: 'boss', boss: true },
  general: { hp: 5280, name: '裂甲将军',     speed: 81, radius: 63, dmg: 20, ai: 'boss', boss: true },
  marshal: { hp: 7480, name: '缄默大将军',   speed: 81, radius: 63, dmg: 19, ai: 'boss', boss: true },
  boss:    { hp: 8800, name: '憋笑魔王',     speed: 75, radius: 63, dmg: 28, ai: 'boss', boss: true }
};
const BOSS_ORDER = ['captain', 'general', 'marshal'];
const DIGUI = ['captain', 'general', 'marshal', 'boss'];
const DIFF = { easy: 1, normal: 1.22, hard: 1.5, hell: 1.85 };

// 强化池
const UPGRADES = [
  { id: 'auto',      name: '自动奶球', description: '自动索敌射击，F 仍可手动', icon: '◎' },
  { id: 'defense1',  name: '肚皮护盾·闪耀', description: '防御减伤 30% → 42%', icon: '◈' },
  { id: 'defense2',  name: '肚皮护盾·辉煌', description: '防御减伤 42% → 54%', icon: '◈' },
  { id: 'spread',    name: '哈哈三连', description: '普攻增加两道弹幕', icon: '✦' },
  { id: 'pierce',    name: '笑穿全场', description: '弹幕穿透，伤害提升', icon: '➶' },
  { id: 'rapid',     name: '根本停不下来', description: '普攻速度提升约 30%', icon: 'ϟ' },
  { id: 'pot',       name: '护体锅盖', description: '锅盖绕身，击退近身敌人', icon: '◉' },
  { id: 'aftershock',name: '肚皮地震', description: '冲撞引发冲击波，冷却 2 秒', icon: '≋' },
  { id: 'laugh',     name: '笑到地动山摇', description: '大笑范围与伤害提升', icon: '☺' }
];

// ==================== 工具 ====================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.6);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ==================== 资源 ====================
const IMG = {}, AUD = {};
const IMG_LIST = {
  'hero-idle': 'assets/characters/hero-idle.webp',
  'hero-run': 'assets/characters/hero-run.webp',
  'hero-laugh': 'assets/characters/hero-laugh.webp',
  'hero-guard': 'assets/characters/hero-guard.webp',
  'hero-guard-start': 'assets/characters/hero-guard-start.webp',
  'hero-guard-hold': 'assets/characters/hero-guard-hold.webp',
  'hero-guard-hit': 'assets/characters/hero-guard-hit.webp',
  'hero-poster': 'assets/characters/hero-poster.webp',
  'hero': 'assets/characters/hero.webp',
  'naidan-idle': 'assets/characters/naidan-idle.webp',
  'naidan-call': 'assets/characters/naidan-call.webp',
  'naidan-laugh': 'assets/characters/naidan-laugh.webp',
  'princess': 'assets/characters/princess.webp',
  'princess-laugh': 'assets/characters/princess-laugh.webp',
  'crate': 'assets/characters/crate.webp',
  'boss-laugh': 'assets/characters/boss-laugh.webp',
  'penguin-rage': 'assets/characters/penguin-rage.webp'
};
Object.keys(ENEMY).forEach(k => {
  if (k === 'hero') return;
  IMG_LIST[k] = `assets/characters/${k}.webp`;
});
Object.keys(ENEMY).forEach(k => {
  if (k === 'hero') return;
  IMG_LIST['o-' + k] = `assets/characters/outlines/${k}.webp`;
});
['captain', 'general', 'marshal', 'boss'].forEach(k => {
  ['attack', 'phase2', 'attack-outline', 'phase2-outline'].forEach(v => {
    IMG_LIST[`${k}-${v}`] = `assets/characters/boss-variants/${k}-${v}.webp`;
  });
});
ZONES.forEach(z => { IMG_LIST['bg-' + z.bg] = `assets/backgrounds/${z.bg}.webp`; });
IMG_LIST['cage'] = 'assets/backgrounds/cage-overlay.webp';

const AUD_LIST = {
  normal: 'assets/audio/normal-theme.mp3',
  death: 'assets/audio/death-theme.mp3',
  laugh: 'assets/audio/laugh.mp3',
  dog: 'assets/audio/dog-call.mp3',
  penguinRage: 'assets/audio/penguin-rage.mp3',
  penguinDeath: 'assets/audio/penguin-death.mp3',
  naidan: 'assets/audio/naidan-sequence-v241.mp3'
};

// 帧动画：奶蛙 192x208
const HERO_FW = 192, HERO_FH = 208;
const HERO_ANIM = {
  idle:   { img: 'hero-idle',   frames: 6, fps: 8,  loop: true },
  run:    { img: 'hero-run',    frames: 8, fps: 13, loop: true },
  laugh:  { img: 'hero-laugh',  frames: 8, fps: 12, loop: true },
  guard:  { img: 'hero-guard',  frames: 1, fps: 1,  loop: true },
  guardStart: { img: 'hero-guard-start', frames: 2, fps: 12, loop: false },
  guardHold:  { img: 'hero-guard-hold',  frames: 2, fps: 8, loop: true },
  guardHit:   { img: 'hero-guard-hit',   frames: 3, fps: 14, loop: false }
};

// ==================== 加载 ====================
function loadImage(key, src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { IMG[key] = im; res(); };
    im.onerror = () => { IMG[key] = null; res(); };
    im.src = src;
  });
}
function loadAudio(key, src) {
  return new Promise(res => {
    const a = new Audio();
    a.preload = 'auto';
    a.src = src;
    a.addEventListener('canplaythrough', () => res(), { once: true });
    a.addEventListener('error', () => res(), { once: true });
    setTimeout(res, 4000);
    AUD[key] = a;
  });
}

// ==================== 音效 ====================
const Sound = {
  on: true,
  bgm: null,
  bgmName: '',
  play(name, vol = 0.6) {
    if (!this.on || !AUD[name]) return;
    try {
      const a = AUD[name].cloneNode();
      a.volume = vol;
      a.play().catch(() => {});
    } catch (e) {}
  },
  music(name) {
    if (this.bgmName === name) return;
    this.bgmName = name;
    if (this.bgm) { try { this.bgm.pause(); } catch (e) {} }
    if (!AUD[name]) return;
    this.bgm = AUD[name];
    this.bgm.loop = true;
    this.bgm.volume = 0.35;
    if (this.on) this.bgm.play().catch(() => {});
  },
  stopMusic() {
    if (this.bgm) { try { this.bgm.pause(); } catch (e) {} }
    this.bgm = null; this.bgmName = '';
  },
  setOn(v) {
    this.on = v;
    if (!v) { if (this.bgm) this.bgm.pause(); }
    else if (this.bgm) this.bgm.play().catch(() => {});
  }
};

// ==================== 画布 ====================
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const stage = document.getElementById('stage');
let scale = 1;

function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const s = Math.min(vw / W, vh / H);
  const cw = Math.max(1, Math.floor(W * s));
  const ch = Math.max(1, Math.floor(H * s));

  stage.style.width = cw + 'px';
  stage.style.height = ch + 'px';

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = '100%';
  cv.style.height = '100%';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scale = s;

  const touchEl = document.getElementById('touch');
  if (touchEl) {
    const k = s / (cw / W) || 1;
    touchEl.style.transform = '';
    touchEl.style.width = W + 'px';
    touchEl.style.height = H + 'px';
    touchEl.style.left = '0';
    touchEl.style.top = '0';
  }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

// ==================== 粒子/特效 ====================
class FX {
  constructor() { this.list = []; this.texts = []; }
  clear() { this.list = []; this.texts = []; }
  spawn(o) { this.list.push(o); }
  text(str, x, y, color = '#fff', size = 24, life = 1) {
    this.texts.push({ str, x, y, color, size, life, max: life, vy: -46 });
  }
  ring(x, y, r, color = '#fff', life = 0.5, kind = 'ring') {
    this.spawn({ kind, x, y, r, color, life, max: life });
  }
  burst(x, y, color, n = 8, spd = 180, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(spd * 0.35, spd);
      this.spawn({ kind: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7,
        r: rand(1.6, 3.4), color, life, max: life });
    }
  }
  slash(x, y, r, color = '#fff', life = 0.32) {
    this.spawn({ kind: 'slash', x, y, r, color, life, max: life });
  }
  shake(t, m) { Scene.shakeT = Math.max(Scene.shakeT, t); Scene.shakeM = Math.max(Scene.shakeM, m); }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'dot') p.vy += 220 * dt; }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= 0.96;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }
  draw(g) {
    for (const p of this.list) {
      const k = p.life / p.max, o = 1 - k;
      g.globalAlpha = Math.min(1, k * 1.6);
      if (p.kind === 'ring') {
        g.strokeStyle = p.color; g.lineWidth = Math.max(1, 6 * k);
        g.beginPath(); g.ellipse(p.x, p.y, p.r * (0.15 + o * 0.85), p.r * (0.15 + o * 0.85) * 0.56, 0, 0, Math.PI * 2); g.stroke();
      } else if (p.kind === 'flash') {
        g.fillStyle = p.color; g.beginPath();
        g.ellipse(p.x, p.y, p.r * o, p.r * o * 0.6, 0, 0, Math.PI * 2); g.fill();
      } else if (p.kind === 'dot') {
        g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.r * k + 0.6, 0, Math.PI * 2); g.fill();
      } else if (p.kind === 'slash') {
        g.strokeStyle = p.color; g.lineWidth = Math.max(1.5, 7 * k);
        g.beginPath();
        g.arc(p.x, p.y, p.r * (0.7 + o * 0.5), -0.9 + o * 0.7, 0.9 + o * 0.7);
        g.stroke();
      }
    }
    for (const t of this.texts) {
      const k = t.life / t.max;
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `700 ${t.size}px "PingFang SC","Microsoft YaHei",sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.72)';
      g.strokeText(t.str, t.x, t.y);
      g.fillStyle = t.color; g.fillText(t.str, t.x, t.y);
    }
    g.globalAlpha = 1;
  }
}

// 警告区域（地面预警）
class Warning {
  constructor(type, opt) {
    this.type = type;               // 'rect' | 'circle' | 'lane'
    Object.assign(this, opt);
    this.t = 0; this.dur = opt.dur || 0.9;
  }
  get done() { return this.t >= this.dur; }
  update(dt) { this.t += dt; }
  draw(g) {
    const k = clamp(this.t / this.dur, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 26);
    const col = this.color || '#ff8a8a';
    g.save();
    g.globalAlpha = 0.12 * pulse + 0.10;
    g.fillStyle = col;
    if (this.type === 'rect') {
      g.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
      g.globalAlpha = 0.75;
      g.strokeStyle = col; g.lineWidth = 2.5;
      g.strokeRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
      g.globalAlpha = 0.5 * (1 - k);
      g.strokeRect(this.x - this.w * k / 2, this.y - this.h * k / 2, this.w * k, this.h * k);
    } else if (this.type === 'circle') {
      g.beginPath(); g.ellipse(this.x, this.y, this.r, this.r * 0.56, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.75; g.strokeStyle = col; g.lineWidth = 3;
      g.beginPath(); g.ellipse(this.x, this.y, this.r, this.r * 0.56, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.55; g.lineWidth = 2;
      g.beginPath(); g.ellipse(this.x, this.y, this.r * k, this.r * k * 0.56, 0, 0, Math.PI * 2); g.stroke();
    } else if (this.type === 'lane') {
      g.fillRect(30, this.y - 56, W - 60, 112);
      g.globalAlpha = 0.68; g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath(); g.moveTo(30, this.y - 56); g.lineTo(W - 30, this.y - 56);
      g.moveTo(30, this.y + 56); g.lineTo(W - 30, this.y + 56); g.stroke();
    }
    g.restore();
  }
}
