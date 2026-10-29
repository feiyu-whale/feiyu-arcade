/* 勇者奶蛙传 · 肥鱼复刻版 — 敌人 AI（照原版逻辑） */

// 追加到 Scene 对象上的方法
Object.assign(Scene, {

  // ---------- 连携：配对 ----------
  tryCombo(a) {
    if (this.comboCD > 0 || a.cooldown > 0 || !['idle', 'run'].includes(a.state)) return false;
    const partners = { shield: ['shooter'], scribe: ['hammer'], bell: ['jester', 'chaser'] }[a.kind];
    if (!partners) return false;
    const mate = this.actors.find(b => !b.dead && b.hp > 0 && partners.includes(b.kind)
      && ['idle', 'run'].includes(b.state) && b.z < 2
      && dist(a, b) < 330 && dist(b, this.hero) < 650);
    if (!mate) return false;

    a.comboPartnerId = mate.id; mate.comboPartnerId = a.id;
    a.cooldown = mate.cooldown = 5.2;
    this.comboCD = 6.5;

    const hp = { x: this.hero.x, y: this.hero.y };
    for (const m of [a, mate]) {
      m.targetX = hp.x; m.targetY = hp.y;
      m.face = Math.sign(hp.x - m.x) || m.face;
    }

    if (a.kind === 'shield') {
      a.state = 'comboShieldWarn'; a.timer = 1.1;
      mate.state = 'comboShotWarn'; mate.timer = 1.1;
      this.tell(a, '连携 · 盾阵齐射', '#8ee6ef', 140);
      this.warnings.push(new Warning('lane', { x: W / 2, y: a.y, color: '#8ee6ef', dur: 1.1 }));
    } else if (a.kind === 'scribe') {
      a.state = 'comboFrostWarn'; a.timer = 1;
      mate.state = 'comboQuakeWarn'; mate.timer = 2.15;
      this.tell(a, '连携 · 霜印碎击', '#8ddeff', 140);
      this.warnings.push(new Warning('circle', { x: hp.x, y: hp.y, r: 140, color: '#8ddeff', dur: 2.15 }));
    } else {
      a.state = 'comboRingWarn'; a.timer = 1.05;
      mate.state = 'comboRallyWarn'; mate.timer = 1.15;
      this.tell(a, '连携 · 鸣铃突击', '#ffe4a0', 130);
      this.warnings.push(new Warning('circle', { x: hp.x, y: hp.y, r: 100, color: '#ffe4a0', dur: 1.15 }));
    }
    this.fx.burst(a.x, a.y - 60, a.kind === 'bell' ? '#ffd88a' : '#9ab8ff', 10, 160, 0.5);
    return true;
  },

  // ---------- 连携：执行 ----------
  updateCombo(a, dt) {
    if (!a.state.startsWith('combo')) return false;

    const mate = this.actors.find(b => b.id === a.comboPartnerId && !b.dead);
    if (!mate || a.hit > 0) {
      a.state = 'recover'; a.timer = 0.8; a.comboPartnerId = 0;
      this.fx.text('连携打断！', a.x, a.y - 95, '#c9f0ff', 20, 0.9);
      return true;
    }

    a.timer -= dt;
    if (a.timer > 0) return true;

    const st = a.state;

    if (st === 'comboShieldWarn' || st === 'comboRallyWarn') {
      a.state = a.kind === 'jester' ? 'pounce' : 'lunge';
      a.timer = 0.6;
      const d = Math.max(1, Math.hypot(a.targetX - a.x, a.targetY - a.y));
      a.vx = (a.targetX - a.x) / d * 540;
      a.vy = (a.targetY - a.y) / d * 310;
      if (a.state === 'pounce') a.vz = 450;
      this.fx.slash(a.x, a.y - 40, 100, '#9fdcff', 0.35);
      return true;
    }

    if (st === 'comboShotWarn') {
      for (const off of [-0.3, -0.15, 0, 0.15, 0.3]) this.enemyShot(a, a.targetX, a.targetY, 315, off);
      this.fx.burst(a.x, a.y - 60, '#a7b8ff', 12, 200, 0.5);
    } else if (st === 'comboFrostWarn') {
      this.fx.ring(a.targetX, a.targetY, 140, '#8ddeff', 0.6);
      if (dist(this.hero, { x: a.targetX, y: a.targetY }) < 140 && this.hero.z < 70) {
        if (this.hurtHero(this.enemyDamage(a, 8), a.x)) this.slowTime = 1.35;
      }
    } else if (st === 'comboQuakeWarn') {
      this.fx.ring(a.targetX, a.targetY, 140, '#c9f0ff', 0.7);
      this.fx.shake(200, 5);
      if (dist(this.hero, { x: a.targetX, y: a.targetY }) < 140 && this.hero.z < 80)
        this.hurtHero(this.enemyDamage(a, 25), a.x);
    } else if (st === 'comboRingWarn') {
      for (const b of this.actors) {
        if (!b.dead && b.kind !== 'hero' && !DIGUI.includes(b.kind) && dist(a, b) < 320) b.buffTime = 4;
      }
      this.fx.ring(a.x, a.y, 320, '#ffe4a0', 0.7);
      this.fx.text('铃声鼓舞！', a.x, a.y - 90, '#ffe4a0', 20, 1);
    }

    a.state = 'recover'; a.timer = 0.85;
    return true;
  },

  // ---------- 普怪 AI（照原版） ----------
  updateEnemy(a, dt) {
    const h = this.hero;
    const n = h.x - a.x, s = h.y - a.y;
    const dd = Math.hypot(n, s * 1.6);
    const spd = a.speedMul * (a.isBoss ? 1 : 1.08);

    if (['idle', 'run'].includes(a.state)) a.face = Math.sign(n) || a.face;

    if (this.updateCombo(a, dt)) return;
    if (this.tryCombo(a)) return;

    // 硬直恢复
    if (a.state === 'recover') {
      a.timer -= dt;
      if (a.timer <= 0) { a.state = 'idle'; a.cooldown = Math.max(a.cooldown, 0.5); }
      return;
    }

    // 摇铃鼓舞
    if (a.state === 'ringWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        for (const b of this.actors) {
          if (!b.dead && b.id !== a.id && dist(a, b) < 340 && !DIGUI.includes(b.kind)) b.buffTime = 4;
        }
        this.fx.ring(a.x, a.y, 340, '#ffe4a0', 0.7);
        this.fx.text('铃声鼓舞！', a.x, a.y - 80, '#ffe4a0', 20, 1);
        a.state = 'recover'; a.timer = 0.6; a.cooldown = 5;
      }
      return;
    }

    // 远程预警 -> 射击
    if (a.state === 'shotWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        const angles = a.elite ? [-0.64, -0.32, 0, 0.32, 0.64] : [-0.36, 0, 0.36];
        const spdShot = a.kind === 'scribe' ? 215 : 240;
        for (const off of angles) this.enemyShot(a, a.targetX, a.targetY, spdShot, off);
        this.fx.burst(a.x, a.y - 60, a.kind === 'scribe' ? '#9ad4ff' : '#c9a6ff', 8, 150, 0.4);
        a.state = 'recover'; a.timer = 0.6; a.cooldown = a.kind === 'scribe' ? 3.3 : 2.9;
      }
      return;
    }

    // 突进预警
    if (['pounceWarn', 'lungeWarn', 'slideWarn'].includes(a.state)) {
      a.timer -= dt;
      if (a.timer <= 0) {
        const prev = a.state;
        a.state = prev === 'pounceWarn' ? 'pounce' : prev === 'slideWarn' ? 'slide' : 'lunge';
        a.timer = a.state === 'pounce' ? 0.6 : 0.52;
        if (a.state === 'pounce') { a.vz = 450; this.fx.ring(a.x, a.y, 90, '#ffb08a', 0.4); }
        const d = Math.max(1, Math.hypot(a.targetX - a.x, a.targetY - a.y));
        const sp = (a.state === 'lunge' ? 580 : 470) * spd;
        a.vx = (a.targetX - a.x) / d * sp;
        a.vy = (a.targetY - a.y) / d * sp * 0.7;
      }
      return;
    }

    // 突进中
    if (['pounce', 'lunge', 'slide'].includes(a.state)) {
      a.timer -= dt;
      if (a.state === 'pounce') {
        a.x += (a.targetX - a.x) * Math.min(1, dt * 6);
        a.y += (a.targetY - a.y) * Math.min(1, dt * 6);
      } else {
        a.x += a.vx * dt; a.y += a.vy * dt;
        if (Math.abs(h.x - a.x) < 65 && Math.abs(h.y - a.y) < 36 && h.z < 80)
          this.hurtHero(this.enemyDamage(a, 15), a.x);
      }
      const bs = this.arenaScale;
      a.x = clamp(a.x, 48 * bs, 1235 * bs);
      a.y = clamp(a.y, 417, 624);
      if (a.timer <= 0) {
        if (a.state === 'pounce') {
          this.fx.ring(a.x, a.y, 100, '#e0b08a', 0.5);
          this.fx.shake(180, 4);
          if (dist(a, h) < 105 && h.z < 75) this.hurtHero(this.enemyDamage(a, 15), a.x);
          a.z = 0; a.vz = 0;
        }
        a.state = 'recover';
        a.timer = a.kind === 'penguin' && a.rageTime > 0 ? 0.45 : 1;
        a.vx = a.vy = 0; a.cooldown = 1.4;
      }
      return;
    }

    // 近战攻击预警/出招
    if (['warn', 'hammerWarn', 'cleaveWarn'].includes(a.state)) {
      a.timer -= dt;
      if (a.timer <= 0) {
        if (a.kind === 'bomber') {
          this.fx.ring(a.x, a.y, 135, '#ff8a5c', 0.6);
          this.fx.shake(240, 5);
          if (dd < 140 && h.z < 70) this.hurtHero(this.enemyDamage(a, 24), a.x);
          a.dead = true; a.timer = 0.15;
          this.kills++;
          this.energy = Math.min(100, this.energy + 6);
        } else {
          const heavy = a.kind === 'hammer' || a.kind === 'dog';
          const reach = a.kind === 'hammer' ? 150 : heavy ? 115 : 76;
          if ((Math.sign(n) === a.face || Math.abs(n) < 18) && Math.abs(n) < reach
            && Math.abs(s) < (heavy ? 55 : 37) && h.z < 70)
            this.hurtHero(this.enemyDamage(a, a.kind === 'hammer' ? 22 : 10), a.x);
          this.fx.slash(a.x + a.face * 45, a.y - 40, reach, heavy ? '#ffc88a' : '#ffb0a0', 0.4);
          this.fx.shake(heavy ? 200 : 120, heavy ? 5 : 3);
          a.state = 'recover'; a.timer = heavy ? 0.85 : 0.25; a.cooldown = heavy ? 1.8 : 1.5;
        }
      }
      return;
    }

    // 远程怪：保持距离
    if (a.kind === 'shooter' || a.kind === 'scribe' || a.kind === 'bell') {
      if (dd < 210) {
        a.x -= Math.sign(n) * 65 * spd * dt;
        a.y -= Math.sign(s) * 30 * spd * dt;
      } else if (dd > 570) {
        a.x += Math.sign(n) * 85 * spd * dt;
        a.y += Math.sign(s) * 38 * spd * dt;
      }
      if (a.cooldown <= 0) {
        this.enemyWarning(a, a.kind === 'bell' ? 'ringWarn' : 'shotWarn',
          a.kind === 'bell' ? 1.15 : 0.8, a.kind === 'bell' ? 220 : 60);
        this.tell(a, a.kind === 'bell' ? '摇铃鼓舞' : a.kind === 'scribe' ? '霜卷三封' : '紫帽连星',
          a.kind === 'scribe' ? '#9ad4ff' : '#c9a6ff', 80);
      }
      return;
    }

    // 跳跃怪
    if (['jester', 'mimic', 'penguin'].includes(a.kind) && dd < 420 && a.cooldown <= 0) {
      this.enemyWarning(a, a.kind === 'jester' ? 'pounceWarn' : a.kind === 'mimic' ? 'lungeWarn' : 'slideWarn',
        a.rageTime > 0 ? 0.65 : 0.85, a.kind === 'jester' ? 100 : 75, a.kind === 'jester');
      if (a.kind !== 'penguin')
        this.tell(a, a.kind === 'jester' ? '弹簧空降' : '贪财咬合', a.kind === 'jester' ? '#ffb08a' : '#ffd28a', 80);
      return;
    }

    // 近战怪：接近
    const mv = (a.kind === 'bomber' ? 100 : a.kind === 'hammer' ? 52 : a.kind === 'shield' ? 58
      : a.kind === 'dog' ? 82 : 73) * spd;
    const stopAt = a.kind === 'hammer' ? 120 : a.kind === 'dog' ? 90 : 55;
    if (dd > stopAt) {
      const d = Math.max(1, Math.hypot(n, s));
      a.x += n / d * mv * dt;
      a.y += s / d * mv * 0.72 * dt;
      a.state = 'run';
    } else if (a.cooldown <= 0) {
      this.enemyWarning(a,
        a.kind === 'hammer' ? 'hammerWarn' : a.kind === 'dog' ? 'cleaveWarn' : a.kind === 'shield' ? 'lungeWarn' : 'warn',
        a.kind === 'bomber' ? 0.85 : a.kind === 'hammer' ? 1 : a.kind === 'dog' ? 0.65 : 0.48,
        a.kind === 'bomber' ? 135 : a.kind === 'hammer' ? 150 : a.kind === 'dog' ? 115 : 65);
      this.tell(a,
        a.kind === 'bomber' ? '发条倒数' : a.kind === 'hammer' ? '重锤裂地' : a.kind === 'shield' ? '盾卫猛进'
        : a.kind === 'dog' ? '刀盾横斩' : '憋笑重拳',
        a.kind === 'bomber' ? '#ffb05c' : '#ffc88a', 80);
    }

    // 边界 + 互相推开
    const bs = this.arenaScale;
    a.x = clamp(a.x, 48 * bs, 1235 * bs);
    a.y = clamp(a.y, 417, 624);
    for (const b of this.actors) {
      if (b.id < a.id && !b.dead && !DIGUI.includes(b.kind)) {
        const c = a.x - b.x, d2 = a.y - b.y;
        if (Math.abs(c) < 38 && Math.abs(d2) < 22) {
          a.x += Math.sign(c || 1) * 25 * dt;
          a.y += Math.sign(d2 || 1) * 16 * dt;
        }
      }
    }
  },

  // ---------- 预警注册 ----------
  enemyWarning(a, state, dur, radius, atTarget) {
    a.state = state;
    a.timer = Math.max(0.65, dur);
    a.targetX = this.hero.x; a.targetY = this.hero.y;
    a.face = Math.sign(this.hero.x - a.x) || a.face;
    const col = a.kind === 'scribe' ? '#9ad4ff' : '#ff9c9c';
    if (['warn', 'hammerWarn', 'cleaveWarn'].includes(state) && a.kind !== 'bomber') {
      const wd = a.kind === 'hammer' ? 150 : a.kind === 'dog' ? 115 : 76;
      this.warnings.push(new Warning('rect', {
        x: a.x + a.face * (wd - 18) / 2, y: a.y - 40,
        w: wd + 18, h: (a.kind === 'hammer' || a.kind === 'dog') ? 110 : 74,
        color: col, dur: a.timer
      }));
    } else {
      this.warnings.push(new Warning('circle', {
        x: atTarget ? a.targetX : a.x, y: atTarget ? a.targetY : a.y - 40,
        r: a.kind === 'bomber' ? 140 : state === 'pounceWarn' ? 105 : radius,
        color: col, dur: a.timer + (state === 'pounceWarn' ? 0.6 : 0)
      }));
    }
  },

  tell(a, text, color, r) {
    this.fx.text(text, a.x, a.y - 110, color || '#ffc88a', 20, Math.min(1.2, a.timer || 0.9));
  },

  // ---------- 敌人子弹 ----------
  enemyShot(a, tx, ty, speed, off = 0) {
    if (this.superT > 0) return;
    if (this.shots.filter(s => s.enemy).length >= 85) return;
    const ang = Math.atan2(ty - a.y, tx - a.x) + off;
    const isBoss = a.isBoss;
    this.shots.push({
      x: a.x + a.face * 35, y: a.y - (isBoss ? 110 : 58), z: 0,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed * 0.72,
      life: 5, enemy: true,
      damage: isBoss ? this.bossPower(a, a.kind === 'boss' ? 28 : a.kind === 'general' ? 20 : a.kind === 'marshal' ? 19 : 18)
        : this.enemyDamage(a, 12),
      slow: a.kind === 'scribe', ownerId: a.id, pierce: 1, hits: new Set(), size: isBoss ? 19 : 13
    });
  }
});
