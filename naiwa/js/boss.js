/* 勇者奶蛙传 · 肥鱼复刻版 — BOSS 招式（简化版，先跑通） */

Object.assign(Scene, {

  bossRecover(a, t = 1.25) {
    a.state = 'recover'; a.timer = t * 0.78;
    a.vx = a.vy = a.vz = 0; a.z = 0;
  },

  bossPhaseChange(a, th, title, color) {
    if (a.combatPhase !== 1 || a.hp > a.maxHp * th || a.state === 'intro') return false;
    a.combatPhase = 2;
    a.state = 'roar'; a.timer = a.kind === 'boss' ? 1.7 : 1.35;
    a.vx = a.vy = a.vz = 0; a.z = 0;
    this.shots = this.shots.filter(s => s.ownerId !== a.id);
    this.fx.ring(a.x, a.y, a.kind === 'boss' ? 510 : 250, color, 1.2);
    this.fx.text(title, a.x, a.y - 170, color, 36, 1.7);
    this.fx.shake(400, 7);
    if (a.kind === 'boss') {
      this.bossPhase = 2;
      if (this.actors.filter(x => !x.dead && x.kind !== 'boss').length < 3) {
        this.spawn('shield'); this.spawn('shooter');
      }
    }
    return true;
  },

  startBossTell(a, state, label, dur, radius, color, atTarget) {
    a.state = state;
    a.timer = Math.max(0.65, dur * 0.9);
    a.targetX = this.hero.x; a.targetY = this.hero.y;
    a.face = Math.sign(this.hero.x - a.x) || a.face;
    this.tell(a, label, color, radius);
    if (state === 'doubleWarn' || state === 'royalSweepWarn') {
      const wd = state === 'royalSweepWarn' ? 320 : 205;
      this.warnings.push(new Warning('rect', {
        x: a.x + a.face * wd * 0.45, y: a.y - 50,
        w: wd, h: state === 'royalSweepWarn' ? 142 : 122, color, dur: a.timer
      }));
    } else {
      this.warnings.push(new Warning('circle', {
        x: atTarget ? a.targetX : a.x, y: atTarget ? a.targetY : a.y - 50,
        r: radius, color, dur: a.timer + (state === 'slamWarn' ? 0.55 : 0)
      }));
    }
  },

  // ---------- 中 BOSS ----------
  updateMiniboss(a, dt) {
    const h = this.hero;
    const n = h.x - a.x, s = h.y - a.y;
    const col = { captain: '#87d8ff', general: '#ffa25a', marshal: '#c26bff' }[a.kind];

    this.bossPhaseChange(a, 0.4,
      a.kind === 'captain' ? '铁桶队长 · 不破堡垒'
        : a.kind === 'general' ? '裂甲将军 · 赤刃解放' : '缄默大将军 · 无声领域', col);

    if (['intro', 'recover', 'roar'].includes(a.state)) {
      a.timer -= dt;
      if (a.timer <= 0) { a.state = 'idle'; a.cooldown = a.combatPhase === 2 ? 0.4 : 0.6; }
      return;
    }

    // 冲锋
    if (a.state === 'brace') {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.state = 'chargeWarn'; a.timer = 0.95;
        a.targetY = a.y;
        a.face = Math.sign(h.x - a.x) || a.face;
        this.warnings.push(new Warning('lane', { x: W / 2, y: a.y, color: col, dur: a.timer }));
      }
      return;
    }
    if (a.state === 'chargeWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.state = 'charge'; a.timer = 0.85;
        a.vx = a.face * (a.combatPhase === 2 ? 980 : 850);
        this.fx.slash(a.x, a.y - 50, 150, col, 0.35);
      }
      return;
    }
    if (a.state === 'charge') {
      a.timer -= dt;
      a.x += a.vx * dt;
      if (Math.abs(h.x - a.x) < 95 && Math.abs(h.y - a.y) < 49 && h.z < 90)
        this.hurtHero(this.bossPower(a, 21), a.x);
      if (a.timer <= 0 || a.x < 105 || a.x > 1170) {
        a.x = clamp(a.x, 105, 1170);
        this.bossRecover(a, 1.5);
        this.fx.ring(a.x, a.y, 115, col, 0.5);
      }
      return;
    }

    // 回旋
    if (a.state === 'spinWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        this.fx.ring(a.x, a.y, 170, col, 0.6);
        if (dist(a, h) < 170 && h.z < 85) this.hurtHero(this.bossPower(a, 23), a.x);
        this.bossRecover(a, 1.2);
      }
      return;
    }

    // 连斩
    if (['doubleWarn', 'secondWarn', 'thirdWarn'].includes(a.state)) {
      a.timer -= dt;
      if (a.timer <= 0) {
        const isSecond = a.state === 'secondWarn', isThird = a.state === 'thirdWarn';
        const reach = isThird ? 285 : isSecond ? 250 : 205;
        this.fx.slash(a.x + a.face * reach * 0.45, a.y - 40, reach, col, 0.4);
        if (Math.abs(n) < reach && Math.abs(s) < 61 && h.z < 80 && (Math.sign(n) === a.face || Math.abs(n) < 15))
          this.hurtHero(this.bossPower(a, isThird ? 27 : isSecond ? 25 : 22), a.x);
        if (isThird || (isSecond && a.combatPhase === 1)) this.bossRecover(a, 1.65);
        else {
          a.state = isSecond ? 'thirdWarn' : 'secondWarn';
          a.timer = isSecond ? 0.85 : 0.75;
          const nr = isSecond ? 285 : 250;
          this.warnings.push(new Warning('rect', {
            x: a.x + a.face * (nr - 15) / 2, y: a.y - 50, w: nr + 15, h: 122, color: col, dur: a.timer
          }));
        }
      }
      return;
    }

    // 扇形弹幕
    if (['waveWarn', 'fanWarn', 'volleyWarn'].includes(a.state)) {
      a.timer -= dt;
      if (a.timer <= 0) {
        const angles = a.state === 'waveWarn' ? [-0.22, 0, 0.22]
          : a.state === 'volleyWarn' ? [-0.16, 0, 0.16] : [-0.42, -0.21, 0, 0.21, 0.42];
        for (const off of angles) this.enemyShot(a, a.targetX, a.targetY, a.kind === 'general' ? 345 : 300, off);
        this.fx.burst(a.x, a.y - 100, col, 12, 180, 0.45);
        this.bossRecover(a, 1.3);
      }
      return;
    }

    // 落地标记
    if (a.state === 'markWarn' || a.state === 'guillotineWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        if (a.state === 'guillotineWarn') {
          a.state = 'guillotine'; a.timer = 0.5; a.vz = 590;
        } else {
          this.fx.ring(a.targetX, a.targetY, 175, col, 0.7);
          this.fx.shake(240, 6);
          if (dist(h, { x: a.targetX, y: a.targetY }) < 175 && h.z < 90)
            this.hurtHero(this.bossPower(a, 26), a.x);
          this.bossRecover(a, 1.45);
        }
      }
      return;
    }
    if (a.state === 'guillotine') {
      a.timer -= dt;
      a.x += (a.targetX - a.x) * Math.min(1, dt * 8);
      a.y += (a.targetY - a.y) * Math.min(1, dt * 8);
      if (a.timer <= 0) {
        this.fx.ring(a.targetX, a.targetY, 165, col, 0.7);
        this.fx.shake(280, 7);
        if (dist(h, { x: a.targetX, y: a.targetY }) < 165 && h.z < 85)
          this.hurtHero(this.bossPower(a, 27), a.x);
        this.bossRecover(a, 1.6);
      }
      return;
    }

    // 法杖回旋
    if (a.state === 'staffWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        this.fx.ring(a.x, a.y, 205, col, 0.6);
        if (dist(a, h) < 205 && h.z < 85) this.hurtHero(this.bossPower(a, 24), a.x);
        this.bossRecover(a, 1.35);
      }
      return;
    }

    // 出招循环
    a.face = Math.sign(n) || a.face;
    if (a.cooldown <= 0) {
      const seq = [0, 3, 1, 4, 2];
      const pickIdx = seq[a.aiCycle++ % 5];
      if (a.kind === 'captain') {
        if (pickIdx === 0) this.startBossTell(a, 'brace', '铁桶防线 · 盾城冲锋', 1, 115, col);
        else if (pickIdx === 1) this.startBossTell(a, 'spinWarn', '回旋铁壁', 0.95, 170, col);
        else if (pickIdx === 2) this.startBossTell(a, 'volleyWarn', '铁桶炮阵', 1.05, 120, col);
        else this.startBossTell(a, 'waveWarn', '铁壁推进', 1, 150, col);
      } else if (a.kind === 'general') {
        if (pickIdx === 0) this.startBossTell(a, 'doubleWarn', a.combatPhase === 2 ? '赤刃三连斩' : '裂甲双斩', 1, 205, col);
        else if (pickIdx === 1) this.startBossTell(a, 'waveWarn', '断桥斧浪', 1, 150, col);
        else if (pickIdx === 2) this.startBossTell(a, 'guillotineWarn', '裂地处决', 1.1, 165, col, true);
        else this.startBossTell(a, 'markWarn', '破阵地裂', 1, 175, col, true);
      } else {
        if (pickIdx === 0) this.startBossTell(a, 'fanWarn', '缄默星阵', 1.05, 145, col);
        else if (pickIdx === 1) this.startBossTell(a, 'markWarn', '禁声敕令', 1.2, 175, col, true);
        else if (pickIdx === 2) this.startBossTell(a, 'staffWarn', '双首断音', 1.05, 205, col);
        else this.startBossTell(a, 'volleyWarn', '缄默回旋', 1.15, 145, col);
      }
    } else {
      const keep = a.kind === 'marshal' ? 300 : a.kind === 'general' ? 150 : 240;
      if (Math.abs(n) > keep) a.x += Math.sign(n) * (a.kind === 'captain' ? 97.2 : 81) * dt;
      a.y += Math.sign(s) * Math.min(Math.abs(s), 50 * dt);
      a.x = clamp(a.x, 100, 1180);
      a.y = clamp(a.y, 432, 617);
    }
  },

  // ---------- 最终 BOSS ----------
  updateBoss(a, dt) {
    // 被超级大笑定身
    if (this.bossLaugh > 0) {
      this.bossLaugh = Math.max(0, this.bossLaugh - dt);
      a.vx = a.vy = a.vz = 0; a.z = 0; a.hit = 0;
      a.state = 'superLaugh';
      if (this.bossLaugh <= 0) { a.state = 'idle'; a.cooldown = 1.3; }
      return;
    }

    const h = this.hero;
    const col = a.combatPhase === 2 ? '#ff7ad9' : '#f0a0ff';

    this.bossPhaseChange(a, 0.45, '憋笑魔王 · 灭笑君临', '#ffd0ff');

    if (['intro', 'roar', 'recover'].includes(a.state)) {
      a.timer -= dt;
      if (a.timer <= 0) { a.state = 'idle'; a.cooldown = a.combatPhase === 2 ? 0.42 : 0.65; }
      return;
    }

    // 天坠
    if (a.state === 'slamWarn') {
      a.timer -= dt;
      if (a.timer <= 0) { a.state = 'slam'; a.timer = 0.55; a.vz = 660; }
      return;
    }
    if (a.state === 'slam') {
      a.timer -= dt;
      a.x += (a.targetX - a.x) * Math.min(1, dt * 9);
      a.y += (a.targetY - a.y) * Math.min(1, dt * 9);
      if (a.timer <= 0) {
        this.fx.ring(a.targetX, a.targetY, 220, col, 0.8);
        this.fx.shake(420, 10);
        if (dist(h, { x: a.targetX, y: a.targetY }) < 220 && h.z < 85)
          this.hurtHero(this.bossPower(a, 32), a.x);
        if (a.combatPhase === 2) {
          a.state = 'afterquakeWarn'; a.timer = 0.85;
          this.warnings.push(new Warning('circle', {
            x: a.targetX, y: a.targetY, r: 275, color: '#ff9c9c', dur: a.timer
          }));
          this.tell(a, '王座余震', '#ffb0a0', 180);
        } else this.bossRecover(a, 1.35);
      }
      return;
    }
    if (a.state === 'afterquakeWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        this.fx.ring(a.targetX, a.targetY, 275, col, 0.8);
        this.fx.shake(360, 9);
        if (dist(h, { x: a.targetX, y: a.targetY }) < 275 && h.z < 80)
          this.hurtHero(this.bossPower(a, 29), a.x);
        this.bossRecover(a, 1.6);
      }
      return;
    }

    // 冲锋
    if (a.state === 'chargeWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.state = 'charge'; a.timer = 0.82;
        a.vx = a.face * (a.combatPhase === 2 ? 1210 : 1030);
        this.fx.slash(a.x, a.y - 60, 165, col, 0.35);
      }
      return;
    }
    if (a.state === 'charge') {
      a.timer -= dt;
      a.x += a.vx * dt;
      if (Math.abs(h.x - a.x) < 115 && Math.abs(h.y - a.y) < 53 && h.z < 100)
        this.hurtHero(this.bossPower(a, 30), a.x);
      const bs = this.arenaScale;
      if (a.timer <= 0 || a.x < 100 * bs || a.x > 1170 * bs) {
        a.x = clamp(a.x, 100 * bs, 1170 * bs);
        this.fx.ring(a.x, a.y, 145, col, 0.5);
        this.bossRecover(a, 1.45);
      }
      return;
    }

    // 弹幕连发
    if (a.state === 'barrageWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.state = 'shoot'; a.timer = a.combatPhase === 2 ? 1.15 : 0.85;
        a.cooldown = 0; a.attack = 0;
      }
      return;
    }
    if (a.state === 'shoot') {
      a.timer -= dt;
      if (a.cooldown <= 0) {
        a.cooldown = 0.36; a.attack++;
        const angles = a.combatPhase === 2 ? [-0.32, -0.16, 0, 0.16, 0.32] : [-0.22, 0, 0.22];
        for (const off of angles)
          this.enemyShot(a, a.targetX, a.targetY, a.combatPhase === 2 ? 380 : 340, off);
        this.fx.burst(a.x, a.y - 110, col, 8, 160, 0.35);
      }
      if (a.timer <= 0) this.bossRecover(a, 1.3);
      return;
    }

    // 王冠敕令（多点落地）
    if (a.state === 'crownWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        const p = a.attackPoints[a.attack];
        if (p) {
          this.fx.ring(p.x, p.y, 145, col, 0.6);
          this.fx.shake(240, 6);
          if (dist(h, p) < 145 && h.z < 90) this.hurtHero(this.bossPower(a, 31), a.x);
        }
        a.attack++;
        if (a.attack >= a.attackPoints.length) this.bossRecover(a, 1.65);
        else {
          const nx = a.attackPoints[a.attack];
          a.timer = 0.8;
          this.warnings.push(new Warning('circle', { x: nx.x, y: nx.y, r: 145, color: col, dur: a.timer }));
        }
      }
      return;
    }

    // 横扫
    if (a.state === 'royalSweepWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        this.fx.slash(a.x + a.face * 125, a.y - 50, 295, col, 0.45);
        this.fx.shake(300, 7);
        if (Math.sign(h.x - a.x) === a.face && Math.abs(h.x - a.x) < 320 && Math.abs(h.y - a.y) < 71 && h.z < 90)
          this.hurtHero(this.bossPower(a, 34), a.x);
        this.bossRecover(a, 1.35);
      }
      return;
    }

    // 终式
    if (a.state === 'eclipseWarn') {
      a.timer -= dt;
      if (a.timer <= 0) {
        this.fx.ring(a.targetX, a.targetY, 285, '#9b6bff', 0.9);
        this.fx.ring(a.targetX, a.targetY, 360, '#9b6bff', 0.7);
        this.fx.shake(520, 11);
        if (dist(h, { x: a.targetX, y: a.targetY }) < 285 && h.z < 110)
          this.hurtHero(this.bossPower(a, 42), a.x);
        this.bossRecover(a, 2);
      }
      return;
    }

    // 出招循环
    a.face = Math.sign(h.x - a.x) || a.face;
    if (a.cooldown <= 0) {
      const seq = a.combatPhase === 2 ? [0, 5, 2, 6, 1, 3, 4, 7] : [0, 5, 2, 6, 1, 3, 4];
      const move = seq[a.aiCycle++ % seq.length];

      if (move === 0) this.startBossTell(a, 'slamWarn', '王座天坠', 1.15, 220, col, true);
      else if (move === 1) {
        this.startBossTell(a, 'chargeWarn', '君王碾压', 1, 150, col);
        this.warnings.push(new Warning('lane', { x: W / 2, y: a.y, color: col, dur: a.timer }));
      } else if (move === 2) this.startBossTell(a, 'barrageWarn', '禁笑连星', 1, 145, col);
      else if (move === 3) {
        a.state = 'crownWarn'; a.timer = 1.1; a.attack = 0;
        const b = this.bounds;
        const offs = a.combatPhase === 2 ? [0, -195, 195] : [0, 200];
        a.attackPoints = offs.map((o, i) => ({
          x: clamp(h.x + o, b.minX + 70, b.maxX - 70),
          y: clamp(h.y + (i % 2 ? 65 : -25), b.minY + 20, b.maxY - 20)
        }));
        this.tell(a, '王冠敕令', col, 170);
        a.attackPoints.forEach((p, i) => this.warnings.push(new Warning('circle', {
          x: p.x, y: p.y, r: 145, color: col, dur: a.timer + i * 0.8
        })));
      }
      else if (move === 4) this.startBossTell(a, 'royalSweepWarn', '暴君横扫', 1, 295, col);
      else if (move === 5) {
        // 王权十字审判：十字两刀
        this.startBossTell(a, 'royalSweepWarn', '王权十字审判', 1.2, 295, col);
      }
      else if (move === 6) this.startBossTell(a, 'crownWarn', '敕令 · 禁笑国度', 1.1, 145, col);
      else this.startBossTell(a, 'eclipseWarn', '终式 · 万籁俱寂', 1.55, 285, '#9b6bff', true);
    } else {
      if (Math.abs(a.x - h.x) > 280) a.x += Math.sign(h.x - a.x) * 75 * dt;
      a.y += (h.y - a.y) * dt * 0.375;
      const bs = this.arenaScale;
      a.x = clamp(a.x, 100 * bs, 1170 * bs);
      a.y = clamp(a.y, this.bounds.minY, this.bounds.maxY);
    }
  }
});
