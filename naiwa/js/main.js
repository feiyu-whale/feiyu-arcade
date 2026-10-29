/* 勇者奶蛙传 · 肥鱼复刻版 — 输入 + 主循环 + UI */

// ==================== 输入 ====================
const Input = {
  keys: {},
  stick: { x: 0, y: 0, active: false },
  attackHeld: false,
  init() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.onDown(e.code);
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      this.onUp(e.code);
    });
    window.addEventListener('blur', () => { this.keys = {}; this.attackHeld = false; Scene.setDefending(false); });
  },
  onDown(code) {
    if (Scene.phase === 'title' || Scene.phase === 'upgrade' || Scene.phase === 'defeat'
      || Scene.phase === 'won' || Scene.phase === 'paused') {
      if (code === 'Escape' && Scene.phase === 'paused') UI.resume();
      return;
    }
    switch (code) {
      case 'KeyF': this.attackHeld = true; Scene.attack(); break;
      case 'Space': Scene.setDefending(true); break;
      case 'ShiftLeft': case 'ShiftRight': Scene.dash(); break;
      case 'KeyE': Scene.laugh(); break;
      case 'KeyC': Scene.usePeach(); break;
      case 'KeyV': Scene.summonNaidan(); break;
      case 'KeyQ': Scene.jokeAction && Scene.jokeAction(); break;
      case 'KeyR': Scene.superTap && Scene.superTap(); break;
      case 'Escape': UI.pause(); break;
    }
  },
  onUp(code) {
    if (code === 'KeyF') this.attackHeld = false;
    if (code === 'Space') Scene.setDefending(false);
  },
  axis() {
    let x = 0, y = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
    if (this.stick.active) { x = this.stick.x; y = this.stick.y; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, mag: Math.min(1, m) };
  }
};

// ==================== UI ====================
const UI = {
  el(id) { return document.getElementById(id); },
  init() {
    this.hpfill = this.el('hpfill'); this.hptxt = this.el('hptxt');
    this.enfill = this.el('enfill');
    this.zoneTag = this.el('zoneTag'); this.waveTag = this.el('waveTag');
    this.peachTag = this.el('peachTag'); this.objTag = this.el('objTag');
    this.bossWrap = this.el('bossWrap'); this.bossName = this.el('bossName');
    this.bossfill = this.el('bossfill'); this.bossStatus = this.el('bossStatus');

    this.ov = {
      title: this.el('ovTitle'), help: this.el('ovHelp'), upgrade: this.el('ovUpgrade'),
      defeat: this.el('ovDefeat'), win: this.el('ovWin'), pause: this.el('ovPause')
    };

    this.el('btnStart').onclick = () => { Sound.setOn(true); this.hideAll(); this.showHud(true); Scene.startRun(); };
    this.el('btnHelp').onclick = () => { this.ov.help.classList.add('on'); };
    this.el('btnHelpBack').onclick = () => { this.ov.help.classList.remove('on'); };
    this.el('btnSound').onclick = (e) => {
      Sound.setOn(!Sound.on);
      e.target.textContent = Sound.on ? '🔊 声音开' : '🔇 声音关';
    };
    this.el('btnRetry').onclick = () => { this.hideAll(); Scene.retryZone(); };
    this.el('btnQuit').onclick = () => { this.hideAll(); this.toTitle(); };
    this.el('btnAgain').onclick = () => { this.hideAll(); this.showHud(true); Scene.startRun(); };
    this.el('btnResume').onclick = () => this.resume();
    this.el('btnPauseQuit').onclick = () => { this.hideAll(); this.toTitle(); };

    // 触屏
    this.initTouch();

    // 横屏检测
    this.checkOrientation();
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => setTimeout(() => this.checkOrientation(), 200));
  },

  hideAll() {
    Object.values(this.ov).forEach(o => o.classList.remove('on'));
  },
  showHud(v) {
    const h = this.el('hud');
    if (h) h.classList.toggle('on', !!v);
  },
  toTitle() {
    this.showHud(false);
    Scene.phase = 'title';
    Scene.paused = false;
    Sound.stopMusic();
    this.hideAll();
    this.ov.title.classList.add('on');
  },

  showUpgrade(opts) {
    const box = this.el('upCards');
    box.innerHTML = '';
    for (const o of opts) {
      const d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = `<div class="ico">${o.icon}</div><div class="nm">${o.name}</div><div class="ds">${o.description}</div>`;
      d.onclick = () => Scene.chooseUpgrade(o.id);
      box.appendChild(d);
    }
    this.ov.upgrade.classList.add('on');
  },
  hideUpgrade() { this.ov.upgrade.classList.remove('on'); },

  pause() {
    if (Scene.phase !== 'playing') return;
    Scene.paused = true;
    Scene.pendingPhase = Scene.phase;
    Scene.phase = 'paused';
    this.ov.pause.classList.add('on');
  },
  resume() {
    if (Scene.phase !== 'paused') return;
    Scene.phase = Scene.pendingPhase || 'playing';
    Scene.paused = false;
    this.ov.pause.classList.remove('on');
  },

  showDefeat() {
    const s = Scene;
    this.el('defeatStat').textContent =
      `坚持 ${s.elapsed.toFixed(1)} 秒 · 击败 ${s.kills} 个 · 最高连击 ${s.maxCombo}`;
    this.ov.defeat.classList.add('on');
  },
  showWin() {
    const s = Scene;
    this.el('winStat').innerHTML =
      `营救用时 <b>${s.elapsed.toFixed(1)}</b> 秒<br>击败敌人 <b>${s.kills}</b> · 最高连击 <b>${s.maxCombo}</b>`;
    this.ov.win.classList.add('on');
  },

  updateHud() {
    const s = Scene, h = s.hero;
    if (!h) return;
    const pct = clamp(h.hp / h.maxHp, 0, 1);
    this.hpfill.style.width = (pct * 100) + '%';
    this.hpfill.style.background = pct > 0.5 ? 'linear-gradient(90deg,#4be08a,#a9ffd1)'
      : pct > 0.25 ? 'linear-gradient(90deg,#ffcf5c,#ffe9a8)' : 'linear-gradient(90deg,#ff5f6d,#ffa8a8)';
    this.hptxt.textContent = `${Math.ceil(h.hp)}/${Math.round(h.maxHp)}`;
    this.enfill.style.width = s.energy + '%';

    const z = ZONES[s.zone] || ZONES[0];
    this.zoneTag.textContent = z.name;
    this.waveTag.textContent = s.zone === FINAL_ZONE ? '最终决战'
      : `第 ${Math.max(1, s.wave)}/${z.waves.length} 波`;
    if (s.peaches > 0) { this.peachTag.style.display = ''; this.peachTag.textContent = '🍑 ' + s.peaches; }
    else this.peachTag.style.display = 'none';

    this.objTag.textContent = s.zone === FINAL_ZONE
      ? (s.bossPhase === 1 ? '击败憋笑魔王 · 留意地面预警' : '灭笑君临 · 躲开终式，抓住收招反击')
      : (s.wave === 0 ? '向前走，把禁笑令撕碎' : `击退守卫 · 剩余 ${s.waveRemaining}`);

    // BOSS 血条
    const boss = s.actors.find(a => a.isBoss && !a.dead);
    if (boss) {
      this.bossWrap.classList.add('on');
      this.bossName.textContent = ENEMY[boss.kind].name + (boss.combatPhase === 2 ? ' · 第二形态' : ' · 第一形态');
      this.bossfill.style.width = clamp(boss.hp / boss.maxHp, 0, 1) * 100 + '%';
      this.bossStatus.textContent = boss.rageTime > 0 ? `咕咕嘎嘎！锁血 ${Math.ceil(boss.rageTime)} 秒`
        : boss.kind === 'dog' ? '我的刀盾！ · 血量下降会转化同伴'
        : s.bossLaugh > 0 ? `哈哈大笑 ${Math.ceil(s.bossLaugh)} 秒`
        : boss.combatPhase === 2 ? '第二形态 · 躲开重击后反击' : '留意地面预警，寻找攻击破绽';
    } else {
      this.bossWrap.classList.remove('on');
    }
  },

  checkOrientation() {
    const rot = this.el('rotate');
    if (!rot) return;
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    rot.classList.toggle('on', portrait);
    if (portrait && Scene.phase === 'playing' && !Scene.paused) {
      this.pause();
      this.autoPausedByRotate = true;
    } else if (!portrait && this.autoPausedByRotate) {
      this.autoPausedByRotate = false;
      this.resume();
    }
  },

  initTouch() {
    const touchEl = this.el('touch');
    // 触屏按钮一律显示（PC 上也能点，免得找不到攻击键）
    touchEl.classList.add('on');

    const stick = this.el('stick'), knob = this.el('knob');
    const zoneEl = this.el('stickZone');   // 左半屏感应区
    let sid = null, cx = 0, cy = 0;
    const R = 44;

    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      sid = t.identifier !== undefined ? t.identifier : 'mouse';
      // 摇杆圆心跟随手指按下的位置（手感更好）
      const stageR = stage.getBoundingClientRect();
      cx = t.clientX; cy = t.clientY;
      // 把视觉摇杆挪到按下处
      const lx = cx - stageR.left, ly = cy - stageR.top;
      stick.style.left = (lx - 56) + 'px';
      stick.style.top = (ly - 56) + 'px';
      stick.style.bottom = 'auto';
      knob.style.transform = '';
      Input.stick.active = true;
      move(e);
    };
    const move = (e) => {
      const list = e.changedTouches ? Array.from(e.changedTouches) : [e];
      const t = list.find(x => (x.identifier !== undefined ? x.identifier : 'mouse') === sid);
      if (!t) return;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy), lim = R * (window.devicePixelRatio > 1 ? 1 : 1);
      const k = d > lim ? lim / d : 1;
      dx *= k; dy *= k;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      Input.stick.x = dx / lim; Input.stick.y = dy / lim;
      e.preventDefault();
    };
    const end = (e) => {
      sid = null;
      Input.stick.active = false; Input.stick.x = 0; Input.stick.y = 0;
      knob.style.transform = '';
    };
    const zEl = zoneEl || stick;
    zEl.addEventListener('touchstart', start, { passive: false });
    zEl.addEventListener('touchmove', move, { passive: false });
    zEl.addEventListener('touchend', end);
    zEl.addEventListener('touchcancel', end);
    // PC 鼠标也能拖
    zEl.addEventListener('mousedown', start);
    window.addEventListener('mousemove', (e) => { if (Input.stick.active && sid === 'mouse') move(e); });
    window.addEventListener('mouseup', () => { if (sid === 'mouse') end(); });

    const bind = (id, down, up) => {
      const el = this.el(id);
      el.addEventListener('touchstart', e => { e.preventDefault(); down(); }, { passive: false });
      if (up) el.addEventListener('touchend', e => { e.preventDefault(); up(); }, { passive: false });
      el.addEventListener('mousedown', e => { e.preventDefault(); down(); });
      if (up) el.addEventListener('mouseup', () => up());
    };

    bind('btnAtk', () => { Input.attackHeld = true; Scene.attack(); }, () => { Input.attackHeld = false; });
    bind('btnDef', () => Scene.setDefending(true), () => Scene.setDefending(false));
    bind('btnDash', () => Scene.dash());
    bind('btnLaugh', () => Scene.laugh());
    bind('btnPeach', () => Scene.usePeach());
    bind('btnNaidan', () => Scene.summonNaidan());
    bind('btnPause', () => UI.pause());
  }
};

// ==================== 主循环 ====================
let lastT = 0;
let acc = 0;
const STEP = 1 / 60;

function tick(now) {
  requestAnimationFrame(tick);
  if (!lastT) { lastT = now; return; }
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.25) dt = 0.25;

  // 固定步长物理
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard++ < 6) {
    step(STEP);
    acc -= STEP;
  }

  // 渲染
  Scene.render(ctx);
  UI.updateHud();
}

function step(dt) {
  const s = Scene;
  s.clock += dt;

  // 特效与抖动始终推进
  s.fx.update(dt);
  if (s.shakeT > 0) {
    s.shakeT = Math.max(0, s.shakeT - dt);
    if (s.shakeT <= 0) s.shakeM = 0;
  }
  s.warnings = s.warnings.filter(w => { w.update(dt); return !w.done; });

  if (s.phase === 'title') return;

  // 动画帧推进
  const ha = s.heroAnim;
  const anim = HERO_ANIM[ha.key] || HERO_ANIM.idle;
  ha.t += dt;
  const fIdx = Math.floor(ha.t * anim.fps);
  ha.frame = anim.loop ? fIdx % anim.frames : Math.min(anim.frames - 1, fIdx);

  if (s.phase === 'rescue') {
    s.rescueT -= dt;
    if (s.rescueT <= 0) { s.phase = 'won'; UI.showWin(); }
    return;
  }
  if (s.phase !== 'playing' || s.paused) return;

  s.elapsed += dt;
  if (s.heroLaugh > 0) s.heroLaugh -= dt;

  // 冷却
  s.invuln = Math.max(0, s.invuln - dt);
  s.slowTime = Math.max(0, s.slowTime - dt);
  s.naidanCD = Math.max(0, s.naidanCD - dt);
  s.comboCD = Math.max(0, s.comboCD - dt);
  s.comboTimer = Math.max(0, s.comboTimer - dt);
  if (s.comboTimer <= 0) s.combo = 0;

  // 冲撞充能
  if (s.dashCharges < s.dashMax) {
    s.dashCD -= dt;
    if (s.dashCD <= 0) {
      s.dashCharges++;
      if (s.dashCharges < s.dashMax) s.dashCD = 2;
    }
  }

  // 玩家移动
  const ax = Input.axis();
  s.moveHero(ax.x, ax.y, dt);

  // 玩家冲刺位移
  const h = s.hero;
  if (h.dashTimer > 0) {
    h.dashTimer -= dt;
    const tgt = h.dashTarget;
    h.x += (tgt.x - h.x) * Math.min(1, dt * 18);
    if (h.dashTimer <= 0) {
      h.dashTimer = 0;
      h.x = tgt.x;
      if (s.pendingAftershock) {
        s.pendingAftershock = false;
        s.fx.ring(h.x, h.y, 150, '#ffe9a8', 0.5);
        for (const a of s.actors) {
          if (a.dead) continue;
          if (dist(h, a) < 150) { const d = a.hurt(30, h.x); s.checkKill(a, d); }
        }
      }
    }
    // 冲撞碰撞
    for (const a of s.actors) {
      if (a.dead || a.state === 'intro' || h.dashHits.has(a.id)) continue;
      if (dist(h, a) < (a.radius + 30)) {
        h.dashHits.add(a.id);
        const d = a.hurt(28, h.x);
        s.checkKill(a, d);
        s.fx.burst(a.x, a.y - 50, '#ffe9a8', 8, 180, 0.4);
      }
    }
  }

  // 自动攻击
  if (s.has('auto') && !s.naidanActive) {
    h.atkCD = (h.atkCD || 0) - dt;
    if (h.atkCD <= 0) {
      const rate = s.has('rapid') ? 0.42 : 0.59;
      let best = null, bd = 690;
      for (const a of s.actors) {
        if (a.dead || a.state === 'intro') continue;
        const d = dist(h, a);
        if (d < bd) { bd = d; best = a; }
      }
      if (best) { s.fireAt(best, h); h.atkCD = rate; }
      else h.atkCD = 0.15;
    }
  }
  // 手动连发
  if (Input.attackHeld) {
    h.manualCD = (h.manualCD || 0) - dt;
    if (h.manualCD <= 0) {
      s.attack();
      h.manualCD = s.has('rapid') ? 0.42 : 0.59;
    }
  }

  // 奶蛋序列
  if (s.naidanT >= 0) {
    s.naidanT += dt;
    if (s.naidanT >= 10.2) { s.naidanT = -1; s.naidanCD = 30; }
  }

  // 防御过渡
  if (s.defenseTrans > 0) s.defenseTrans -= dt;

  // 敌人
  for (const a of s.actors) {
    if (a.dead) { a.timer -= dt; continue; }
    a.age += dt;
    a.hit = Math.max(0, a.hit - dt);
    if (a.squash > 0) a.squash = Math.max(0, a.squash - dt * 6);
    if (a.buffTime > 0) a.buffTime = Math.max(0, a.buffTime - dt);
    if (a.rageTime > 0) {
      a.rageTime = Math.max(0, a.rageTime - dt);
      if (a.rageTime <= 0) a.cooldown = 0.5;
    }
    if (a.cooldown > 0) a.cooldown -= dt;

    // 重力
    if (a.z > 0 || a.vz > 0) {
      a.vz -= 1500 * dt;
      a.z = Math.max(0, a.z + a.vz * dt);
      if (a.z === 0) a.vz = 0;
    }

    if (a.isBoss) {
      if (a.kind === 'boss') s.updateBoss(a, dt);
      else s.updateMiniboss(a, dt);
    } else {
      s.updateEnemy(a, dt);
    }
  }

  // 清理死者
  s.actors = s.actors.filter(a => !a.dead || a.timer > 0);

  // 子弹
  s.updateShots(dt);

  // 波次
  if (s.zone < FINAL_ZONE || s.zone === FINAL_ZONE) s.progressWaves(dt);
}

// ==================== 启动 ====================
Scene.updateShots = function (dt) {
  const h = this.hero;
  for (const s of this.shots) {
    if (s.life <= 0) continue;
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (s.enemy) {
      // 命中玩家（椭圆判定）
      const dx = (s.x - h.x) / 26, dy = (s.y - (h.y - 60 - (h.z || 0))) / 30;
      if (dx * dx + dy * dy < 1) {
        if (this.hurtHero(s.damage, s.x) && s.slow) this.slowTime = 1.5;
        s.life = 0;
        this.fx.burst(s.x, s.y, '#ff9ec4', 5, 140, 0.35);
      }
    } else {
      for (const a of this.actors) {
        if (a.dead || s.hits.has(a.id) || a.state === 'intro') continue;
        const hit = Math.abs(s.x - a.x) < a.radius + 20
          && Math.abs(s.y - (a.y - (a.isBoss ? 110 : 55) + (a.z || 0))) < a.radius * 0.72 + 30;
        if (hit) {
          s.hits.add(a.id);
          const d = a.hurt(s.damage, s.x - s.vx * 0.01);
          this.checkKill(a, d);
          // 能量
          this.energy = Math.min(100, this.energy + (a.isBoss ? d * 0.15 : d * 0.08));
          // 连击
          this.combo++; this.comboTimer = 3.2;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.fx.burst(s.x, s.y, '#ffffff', 4, 130, 0.3);
          s.pierce--;
          if (s.pierce <= 0) { s.life = 0; break; }
        }
      }
    }
  }
  this.shots = this.shots.filter(s => s.life > 0 && s.x > -100 && s.x < 1400 && s.y > 250 && s.y < 800);
  if (this.shots.length > 110) this.shots.splice(0, this.shots.length - 110);
};

Scene.hurtHero = function (amount, fromX) {
  if (this.invuln > 0 || this.phase !== 'playing' || this.superT > 0) return false;
  const h = this.hero;
  const dmg = amount * (this.defending ? 1 - this.defenseReduction() : 1);
  h.hp = Math.max(0, h.hp - dmg);
  h.hit = 0.3;
  this.invuln = 0.9;
  h.x = clamp(h.x + Math.sign(h.x - fromX) * 22, this.bounds.minX, this.bounds.maxX);
  this.fx.burst(h.x, h.y - 60, this.defending ? '#9ad4ff' : '#ff8080', 8, 180, 0.4);
  this.fx.text(`-${Math.round(dmg)}`, h.x, h.y - 130, this.defending ? '#9ad4ff' : '#ff9090', 20, 0.7);
  this.fx.shake(160, 4);
  if (h.hp <= 0) {
    this.phase = 'defeat';
    this.paused = false;
    this.setDefending(false);
    Sound.music('death');
    UI.showDefeat();
  }
  return true;
};

Scene.convertToDog = function () {
  const cands = this.actors.filter(a => !a.dead && a.hp > 0 && !a.isBoss && a.kind !== 'penguin'
    && a.kind !== 'dog' && a.kind !== 'hero');
  if (!cands.length) return;
  const t = pick(cands);
  const nd = new Actor('dog', t.x, t.y);
  nd.face = t.face; nd.cooldown = 0.9;
  nd.hp = nd.maxHp = ENEMY.dog.hp;
  t.dead = true; t.timer = 0;
  this.actors.push(nd);
  this.fx.text('我的刀盾！', nd.x, nd.y - 130, '#ffdda0', 26, 1.3);
  this.fx.burst(nd.x, nd.y - 60, '#ffdda0', 12, 200, 0.5);
};

// 页面初始化
window.addEventListener('load', async () => {
  resize();
  UI.init();
  Input.init();
  Scene.init();

  const jobs = [];
  for (const k in IMG_LIST) jobs.push(loadImage(k, IMG_LIST[k]));
  for (const k in AUD_LIST) jobs.push(loadAudio(k, AUD_LIST[k]));
  await Promise.all(jobs);

  requestAnimationFrame(tick);
});
