/* 勇者奶蛙传 · 肥鱼复刻版 — 引擎（第 2 部分：世界/角色/战斗）
 * 追加到 game.js 末尾
 */

// ==================== 角色 ====================
class Actor {
  constructor(kind, x, y) {
    const base = ENEMY[kind];
    this.kind = kind;
    this.x = x; this.y = y; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.hp = base.hp; this.maxHp = base.hp;
    this.face = 1;
    this.hit = 0;                       // 受击闪白
    this.state = 'idle';
    this.timer = 0;
    this.cooldown = rand(0.8, 1.6);
    this.age = 0;
    this.dead = false;
    this.radius = base.radius;
    this.waveTier = 0;
    this.elite = false;
    this.combatPhase = 1;
    this.buffTime = 0;
    this.rageTime = 0;
    this.rageTriggered = false;
    this.dogNodes = [];
    this.attack = 0;
    this.attackPoints = [];
    this.attackAreas = [];
    this.targetX = x; this.targetY = y;
    this.aiCycle = 0;
    this.squash = 0;                    // 压扁系数（视觉）
    this.comboPartnerId = 0;
    this.dashHits = new Set();
  }
  get isBoss() { return !!ENEMY[this.kind].boss; }
  get speedMul() {
    return (this.rageTime > 0 ? 1.5 : 1) * (this.buffTime > 0 ? 1.15 : 1) * (1 + this.waveTier * 0.06);
  }
  get damageReduction() {
    if (this.isBoss) {
      if (['superLaugh', 'laugh'].includes(this.state)) return 0;
      const b = { captain: 0.18, general: 0.22, marshal: 0.26, boss: 0.32 }[this.kind] || 0;
      const t = b + (this.combatPhase === 2 ? 0.08 : 0);
      return this.state === 'recover' ? t * 0.5 : t;
    }
    if (this.elite) return 0.08;
    return Scene.zone >= 3 ? 0.05 : 0;
  }
  hurt(amount, fromX) {
    if (this.dead) return 0;
    // 弹能护盾（正面减伤）
    const shielded = ENEMY[this.kind].front && ['idle', 'run', 'brace'].includes(this.state)
      && Math.sign(fromX - this.x) === this.face;
    let dmg = amount;
    if (shielded) dmg *= 0.25;
    dmg *= (1 - this.damageReduction);
    this.hp = Math.max(0, this.hp - dmg);
    this.hit = 0.16;
    this.squash = 1;
    // 企鹅狂暴
    if (this.kind === 'penguin' && !this.rageTriggered && this.hp <= this.maxHp * 0.25) {
      this.rageTriggered = true; this.rageTime = 10;
      this.hp = this.maxHp * 0.25;
      Scene.fx.text('咕咕嘎嘎！', this.x, this.y - 130, '#ffadc6', 34, 1.4);
      Scene.fx.ring(this.x, this.y, 170, '#ff8fac', 0.7);
      Sound.play('penguinRage', 0.7);
    }
    // 刀盾狗分体
    if (this.kind === 'dog' && this.hp > 0) {
      [0.75, 0.5, 0.25].forEach(th => {
        if (this.hp <= this.maxHp * th && !this.dogNodes.includes(th)) {
          this.dogNodes.push(th);
          Scene.convertToDog();
          Sound.play('dog', 0.6);
        }
      });
    }
    return dmg;
  }
}

// ==================== 场景主体 ====================
const Scene = {
  fx: new FX(),
  warnings: [],
  actors: [],
  shots: [],
  hero: null,
  zone: 0,
  wave: 0,
  waveRemaining: 0,
  spawnTimer: 0,
  nextWaveTimer: 0,
  elapsed: 0,
  kills: 0,
  combo: 0,
  comboTimer: 0,
  maxCombo: 0,
  energy: 30,
  upgrades: [],
  peaches: 0,
  naidanT: -1,          // 奶蛋计时
  naidanCD: 0,
  superCharge: 0,
  superUsed: false,
  superT: 0,            // 超级大笑进行中
  superDur: 7.616,
  superClicks: 0,
  bossLaugh: 0,
  dashCharges: 2,
  dashMax: 2,
  dashCD: 0,
  dashQueued: false,
  dashUnlocked: false,
  defending: false,
  defenseTrans: 0,
  slowTime: 0,
  invuln: 0,
  phase: 'title',       // title|playing|upgrade|defeat|won|paused|rescue
  paused: false,
  shakeT: 0,
  shakeM: 0,
  timeScale: 1,
  bossPhase: 1,
  transitionT: 0,
  rescueT: 0,
  specialSpawned: false,
  minibossSpawned: false,
  comboCD: 0,
  zoneCheckpoint: null,
  clock: 0,
  heroAnim: { name: 'idle', key: 'idle', t: 0, frame: 0 },

  get arenaScale() { return this.zone === FINAL_ZONE ? 1.25 : 1; },
  get bounds() {
    const s = this.arenaScale;
    return { minX: 60 * s, maxX: 1210 * s, minY: 432, maxY: 617 };
  },

  // ---------- 生命周期 ----------
  init() {
    this.hero = new Actor('hero', 265, 552);
    this.hero.face = 1;
    this.hero.hp = this.hero.maxHp = 120;
  },

  startRun() {
    this.zone = -1; this.elapsed = 0; this.kills = 0; this.maxCombo = 0;
    this.upgrades = []; this.energy = 30; this.peaches = 0;
    this.naidanT = -1; this.naidanCD = 0; this.superCharge = 0; this.superUsed = false;
    this.superT = 0; this.bossLaugh = 0; this.dashUnlocked = false;
    this.dashCharges = 0; this.dashMax = 2; this.bossPhase = 1;
    this.hero = new Actor('hero', 265, 552);
    this.hero.hp = this.hero.maxHp = 120;
    this.enterZone(0, true);
  },

  enterZone(idx, reset) {
    const keepHp = this.hero ? this.hero.hp : 120;
    const keepMax = this.hero ? this.hero.maxHp : 120;
    this.zone = idx;
    this.phase = 'playing';
    this.paused = false;
    this.wave = 0; this.waveRemaining = 0; this.spawnTimer = 0; this.nextWaveTimer = 1.8;
    this.actors = []; this.shots = []; this.warnings = []; this.fx.clear();
    this.combo = 0; this.comboTimer = 0;
    this.superT = 0; this.bossLaugh = 0; this.superCharge = 0; this.superUsed = false;
    this.defending = false; this.slowTime = 0; this.invuln = 1.8;
    this.bossPhase = 1; this.specialSpawned = false; this.minibossSpawned = false;
    this.comboCD = 2.5; this.transitionT = 0;
    const s = this.arenaScale;
    this.hero = new Actor('hero', (idx === FINAL_ZONE ? 255 : 265) * s, 552);
    this.hero.maxHp = keepMax;
    this.hero.hp = reset ? keepMax : Math.min(keepMax, keepHp);
    this.dashMax = 2;
    this.dashCharges = this.dashUnlocked ? this.dashMax : 0;
    // 本关检查点（重试用）
    this.zoneCheckpoint = {
      zone: idx, upgrades: [...this.upgrades], kills: this.kills,
      energy: this.energy, peaches: this.peaches, dashUnlocked: this.dashUnlocked
    };
    Sound.music('normal');
    this.fx.text(ZONES[idx].name, W / 2, 250, '#ffe8b4', 46, 1.8);
  },

  retryZone() {
    const cp = this.zoneCheckpoint || { zone: 0, upgrades: [], kills: 0, energy: 30, peaches: 0, dashUnlocked: false };
    this.upgrades = [...cp.upgrades];
    this.kills = cp.kills;
    this.energy = cp.energy;
    this.peaches = cp.peaches;
    this.dashUnlocked = cp.dashUnlocked;
    this.enterZone(cp.zone, true);
  },

  // ---------- 波次 ----------
  progressWaves(dt) {
    const z = ZONES[this.zone];
    const alive = this.actors.filter(a => !a.dead && a.state !== 'intro').length;

    if (this.waveRemaining > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && alive < Math.min(13, 5 + this.zone + this.wave * 2)) {
        const pool = z.pool;
        const idx = (z.waves[this.wave - 1] - this.waveRemaining + this.wave - 1) % pool.length;
        let kind = pool[idx];
        // 特殊嘉宾：第 2、3 关最后一波出现企鹅/刀盾狗
        const isLastWave = this.wave === z.waves.length;
        if (!this.specialSpawned && isLastWave && (z.waves[this.wave - 1] - this.waveRemaining) === 2
            && (this.zone === 1 || this.zone === 2)) {
          kind = this.zone === 1 ? 'penguin' : 'dog';
          this.specialSpawned = true;
          this.fx.text(`${ENEMY[kind].name}登场！`, W / 2, 420, '#ffd09a', 30, 1.6);
        }
        this.spawn(kind);
        this.waveRemaining--;
        this.spawnTimer = Math.max(0.63, (this.zone === 0 ? 1.4 : 1.15) - (this.wave - 1) * 0.16);
      }
    } else if (alive === 0) {
      this.nextWaveTimer -= dt;
      if (this.nextWaveTimer <= 0) {
        if (this.wave === z.waves.length) {
          // 本关中 BOSS
          if (this.zone >= 3 && this.zone <= 5 && !this.minibossSpawned) {
            const bk = BOSS_ORDER[this.zone - 3];
            this.minibossSpawned = true;
            const b = this.spawn(bk, 980, 535);
            b.state = 'intro'; b.timer = 2;
            this.fx.text(ENEMY[bk].name, b.x, b.y - 120, '#ffb46a', 36, 1.8);
            return;
          }
          if (this.zone === FINAL_ZONE) {
            const b = this.spawn('boss', 1030, 555);
            b.state = 'intro'; b.timer = 2;
            this.fx.text('憋笑魔王', b.x, b.y - 140, '#ff9df0', 40, 2);
            return;
          }
          this.offerUpgrade('zone');
          return;
        }
        this.wave++;
        this.waveRemaining = z.waves[this.wave - 1];
        this.spawnTimer = 0.4;
        this.nextWaveTimer = 1.2;
        this.fx.text(`第 ${this.wave} 波`, W / 2, 270, '#ffe8b4', 34, 1.4);
      }
    }
  },

  spawn(kind, fx_, fy_) {
    const s = this.arenaScale;
    const left = Math.random() < 0.5;
    const x = fx_ !== undefined ? fx_ : (left ? 55 : 1225) * s;
    const y = fy_ !== undefined ? fy_ : (438 + Math.random() * 166);
    const a = new Actor(kind, x, y);
    a.face = left ? 1 : -1;
    a.cooldown = rand(1.3, 2.3);
    // 普通怪血随波次成长
    if (!a.isBoss && kind !== 'hero') {
      a.waveTier = Math.max(0, this.wave - 1);
      a.elite = this.zone < FINAL_ZONE && this.wave === ZONES[this.zone].waves.length;
      a.maxHp = Math.round(a.maxHp * (1.08 + a.waveTier * 0.28 + this.zone * 0.065) * 1.2);
      a.hp = a.maxHp;
    }
    this.actors.push(a);
    this.fx.burst(x, y - 20, kind === 'bomber' ? '#ffc263' : '#b9a8e6', 7, 90, 0.45);
    this.fx.ring(x, y, 60, '#b9a8e6', 0.45);
    return a;
  },

  enemyDamage(a, base) {
    const mul = (a.isBoss ? 1 : (1.08 + a.waveTier * 0.18 + this.zone * 0.035) * 1.1)
      * (a.rageTime > 0 ? 1.5 : 1) * (a.buffTime > 0 ? 1.2 : 1);
    return base * mul;
  },
  bossPower(a, base) {
    const mul = { captain: 1.3, general: 1.35, marshal: 1.4, boss: 1.45 }[a.kind] || 1;
    return base * mul * (a.combatPhase === 2 ? 1.25 : 1);
  },

  // ---------- 玩家动作 ----------
  canAct() { return this.phase === 'playing' && !this.paused && this.superT <= 0; },

  moveHero(dx, dy, dt) {
    const h = this.hero;
    if (!h || this.phase !== 'playing' || this.paused) return;
    if (this.superT > 0) return;
    let spd = 250;
    if (this.slowTime > 0) spd *= 0.55;
    if (this.defending) spd *= 0.38;
    h.x += dx * spd * dt;
    h.y += dy * spd * 0.72 * dt;
    const b = this.bounds;
    h.x = clamp(h.x, b.minX, b.maxX);
    h.y = clamp(h.y, b.minY, b.maxY);
    if (dx !== 0) h.face = Math.sign(dx);
    h.moving = (dx !== 0 || dy !== 0);
  },

  attack() {
    if (!this.canAct()) return;
    const h = this.hero;
    // 自动索敌
    if (this.has('auto')) {
      let best = null, bd = 690;
      for (const a of this.actors) {
        if (a.dead || a.state === 'intro') continue;
        const d = dist(h, a);
        if (d < bd) { bd = d; best = a; }
      }
      if (!best) return;
      this.fireAt(best, h);
      return;
    }
    // 手动直射
    const target = { x: h.x + h.face * 600, y: h.y };
    this.fireAt(target, h, true);
  },

  fireAt(target, h, manual) {
    const angles = this.naidanActive ? [-0.42, -0.21, 0, 0.21, 0.42]
      : this.has('spread') ? [-0.15, 0, 0.15] : [0];
    h.face = Math.sign(target.x - h.x) || h.face;
    const baseAngle = Math.atan2(target.y - h.y, target.x - h.x);
    const dmg = (this.has('pierce') ? 14 : 12) * (this.has('spread') ? 0.9 : 1) * (this.naidanActive ? 2 : 1);
    for (const off of angles) {
      const a = baseAngle + off;
      this.shots.push({
        x: h.x + h.face * 36, y: h.y - 62, z: 0,
        vx: Math.cos(a) * 760, vy: Math.sin(a) * 760 * 0.72,
        life: this.naidanActive ? 1.8 : 1.25, enemy: false, damage: dmg,
        pierce: this.has('pierce') ? 3 : 1, hits: new Set(), size: 15
      });
    }
    this.fx.burst(h.x + h.face * 40, h.y - 62, '#d4c6ff', 4, 120, 0.3);
  },

  has(id) { return this.upgrades.includes(id); },
  defenseLevel() { return this.has('defense2') ? 2 : this.has('defense1') ? 1 : 0; },
  defenseReduction() { return [0.30, 0.42, 0.54][this.defenseLevel()]; },

  setDefending(v) {
    if (!this.canAct()) v = false;
    if (this.defending === v) return;
    this.defending = v;
    this.defenseTrans = v ? 0.18 : 0;
  },

  dash() {
    if (!this.canAct() || !this.dashUnlocked || this.dashCharges <= 0 || this.dashCD > 0) return;
    const h = this.hero;
    this.dashCharges--;
    if (this.dashCharges <= 0) this.dashCD = 2;
    h.dashHits.clear();
    const tx = h.x + h.face * 190;
    h.dashTarget = { x: clamp(tx, this.bounds.minX, this.bounds.maxX), y: h.y };
    h.dashTimer = 0.28;
    h.dashDir = h.face;
    this.invuln = Math.max(this.invuln, 0.22);
    this.fx.slash(h.x, h.y - 40, 70, '#ffe9a8', 0.3);
    if (this.has('aftershock')) this.pendingAftershock = true;
  },

  laugh() {
    if (!this.canAct() || this.energy < 100) return;
    this.energy = 0;
    const r = this.has('laugh') ? 330 : 240;
    const dmg = this.has('laugh') ? 55 : 38;
    this.fx.ring(this.hero.x, this.hero.y, r, '#a9ffd1', 0.75, 'flash');
    this.fx.ring(this.hero.x, this.hero.y, r * 1.25, '#a9ffd1', 0.9);
    Sound.play('laugh', 0.55);
    for (const a of this.actors) {
      if (a.dead) continue;
      if (dist(this.hero, a) < r) a.hurt(dmg, this.hero.x), this.checkKill(a, a.hurt(0, this.hero.x));
    }
    this.heroLaugh = 0.6;
  },

  usePeach() {
    if (!this.canAct() || this.peaches <= 0) return;
    if (this.hero.hp >= this.hero.maxHp) return;
    this.peaches--;
    this.hero.hp = this.hero.maxHp;
    this.fx.ring(this.hero.x, this.hero.y, 110, '#ffc86b', 0.6);
    this.fx.text('生命回满', this.hero.x, this.hero.y - 150, '#b4ffd1', 26, 1.2);
  },

  summonNaidan() {
    if (!this.canAct() || this.naidanT >= 0 || this.naidanCD > 0) return;
    this.naidanT = 0;
    this.fx.text('奶蛋助阵！', this.hero.x, this.hero.y - 165, '#ffe0a0', 26, 1.2);
    Sound.play('naidan', 0.7);
  },
  get naidanActive() { return this.naidanT >= 0; },

  // ---------- 结算 ----------
  checkKill(a, dmg) {
    if (a.hp > 0 || a.dead) return;
    a.dead = true;
    a.timer = 0.65;
    this.kills++;
    this.fx.burst(a.x, a.y - 60, '#cdd4ff', 14, 230, 0.6);
    this.energy = Math.min(100, this.energy + 10);
    if (this.kills % 6 === 0) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 8);
    if (a.kind === 'penguin') {
      this.hero.hp = this.hero.maxHp;
      this.peaches += 3;
      this.fx.text('生命回满 · 黄桃罐头 +3', this.hero.x, this.hero.y - 150, '#ffd582', 24, 1.5);
      Sound.play('penguinDeath', 0.6);
    }
    if (a.isBoss && a.kind !== 'boss') {
      // 中 BOSS 倒下：清除弹幕、给护盾、下关
      this.shots = this.shots.filter(s => !s.enemy);
      this.fx.text(`${ENEMY[a.kind].name}已败退`, W / 2, 400, '#ffe8b4', 30, 1.8);
      this.fx.shake(300, 8);
      this.afterBossDefeat();
    }
    if (a.kind === 'boss') this.onFinalBossDead(a);
  },

  afterBossDefeat() {
    this.zoneCheckpoint = {
      zone: this.zone, upgrades: [...this.upgrades], kills: this.kills,
      energy: this.energy, peaches: this.peaches, dashUnlocked: this.dashUnlocked
    };
    this.offerUpgrade('zone');
  },

  onFinalBossDead(a) {
    this.phase = 'rescue';
    this.rescueT = 11;
    this.shots = [];
    this.actors.forEach(x => { if (x.kind !== 'boss') x.dead = true; });
    a.state = 'laugh';
    this.fx.shake(550, 12);
    this.fx.text('魔王：哈哈哈哈！本王……真的憋不住啦！', W / 2, 320, '#ffd0ff', 26, 2.4);
    Sound.music('death');
  },

  // ---------- 升级 ----------
  offerUpgrade(kind) {
    this.phase = 'upgrade';
    this.setDefending(false);
    const pool = UPGRADES.filter(u => !this.upgrades.includes(u.id) ||
      ['defense1'].includes(u.id) && this.has('defense1') && !this.has('defense2'));
    const opts = [];
    const avail = pool.slice();
    while (opts.length < 3 && avail.length) {
      const i = Math.floor(Math.random() * avail.length);
      opts.push(avail.splice(i, 1)[0]);
    }
    this.pendingUpgrades = opts;
    UI.showUpgrade(opts);
  },

  chooseUpgrade(id) {
    if (id === 'defense2' && !this.has('defense1')) id = 'defense1';
    this.upgrades.push(id);
    if (id === 'vitality') { this.hero.maxHp += 12; this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 12); }
    if (id === 'dashstock') { this.extraDash = (this.extraDash || 0) + 1; this.dashMax = 2 + (this.extraDash || 0); this.dashCharges = Math.min(this.dashMax, this.dashCharges + 1); }
    this.phase = 'playing';
    UI.hideUpgrade();
    this.zoneCheckpoint = {
      zone: this.zone, upgrades: [...this.upgrades], kills: this.kills,
      energy: this.energy, peaches: this.peaches, dashUnlocked: this.dashUnlocked
    };
    if (this.zone < FINAL_ZONE && this.minibossSpawned) {
      this.enterZone(this.zone + 1, false);
    } else if (this.minibossSpawned || this.zone === FINAL_ZONE) {
      // 已在本关末尾且 BOSS 打完
      if (this.zone < FINAL_ZONE && ZONES[this.zone].waves.length && this.wave >= ZONES[this.zone].waves.length) {
        this.enterZone(this.zone + 1, false);
      }
    }
  }
};
