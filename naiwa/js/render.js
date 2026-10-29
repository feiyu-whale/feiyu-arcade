/* 勇者奶蛙传 · 肥鱼复刻版 — 渲染 */

Object.assign(Scene, {

  // ---------- 绘制角色 ----------
  drawActor(g, a) {
    const isHero = a.kind === 'hero';
    const spr = this.getSprite(a);
    if (!spr) return;

    const baseY = a.y;
    const z = a.z || 0;
    const drawY = baseY - z;

    // 影子
    const shScale = 1 - Math.min(0.55, z / 260);
    g.globalAlpha = 0.30 * shScale;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(a.x, baseY + 6, (a.radius || 24) * 1.15 * shScale, (a.radius || 24) * 0.42 * shScale, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;

    // 受击白闪
    const flashing = a.hit > 0;

    g.save();
    g.translate(a.x, drawY);
    // 朝向
    if (a.face < 0) g.scale(-1, 1);

    // 压扁（受击/落地）
    if (a.squash > 0) {
      const k = 1 + a.squash * 0.14;
      g.scale(1 / k, k);
    }

    if (isHero) {
      this.drawHeroSprite(g, spr);
    } else {
      this.drawEnemySprite(g, spr, a);
    }

    // 白闪叠加
    if (flashing) {
      g.globalAlpha = Math.min(0.85, a.hit * 5);
      g.globalCompositeOperation = 'lighter';
      if (isHero) this.drawHeroSprite(g, spr, true);
      else this.drawEnemySprite(g, spr, a, true);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }

    g.restore();

    // 血条（普通怪）
    if (!isHero && !a.isBoss && a.hp < a.maxHp && a.hp > 0) {
      const w = Math.max(30, a.radius * 1.6);
      const hx = a.x - w / 2, hy = drawY - (a.radius * 1.5) - 14;
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillRect(hx, hy, w, 4.5);
      g.fillStyle = '#ff7a8a';
      g.fillRect(hx, hy, w * (a.hp / a.maxHp), 4.5);
    }
  },

  getSprite(a) {
    if (a.kind === 'hero') {
      const nam = this.heroAnimName();
      const anim = HERO_ANIM[nam] || HERO_ANIM.idle;
      return { anim, nam };
    }
    // BOSS 形态切换
    if (a.isBoss) {
      const key = a.kind;
      if (a.combatPhase === 2) return { img: IMG[`${key}-phase2`] || IMG[key] };
      if (['warn', 'doubleWarn', 'secondWarn', 'thirdWarn', 'charge', 'chargeWarn',
        'royalSweepWarn', 'slam', 'slamWarn', 'guillotine', 'staffWarn', 'spinWarn'].includes(a.state))
        return { img: IMG[`${key}-attack`] || IMG[key] };
      return { img: IMG[key] };
    }
    if (a.kind === 'penguin' && a.rageTime > 0) return { img: IMG['penguin-rage'] || IMG.penguin };
    if (a.kind === 'boss' && a.state === 'laugh') return { img: IMG['boss-laugh'] || IMG.boss };
    return { img: IMG[a.kind] };
  },

  heroAnimName() {
    if (this.superT > 0 || this.heroLaugh > 0) return 'laugh';
    if (this.hero.dashTimer > 0) return 'run';
    if (this.defending) return 'guardHold';
    if (this.hero.moving) return 'run';
    return 'idle';
  },

  drawHeroSprite(g, spr, white) {
    const anim = spr.anim;
    const im = IMG[anim.img];
    if (!im) return;
    // 帧宽按实际图片宽度/帧数推算，避免图集尺寸与常量不一致时切错帧
    const fw = Math.floor(im.width / anim.frames) || HERO_FW;
    const fh = im.height || HERO_FH;

    // 动画时间步进
    const ha = this.heroAnim;
    if (ha.key !== spr.nam) { ha.key = spr.nam; ha.t = 0; ha.frame = 0; }
    ha.frame += 0; // 由 update 推进

    const f = Math.min(anim.frames - 1, ha.frame);
    const sx = f * fw;

    // 显示（脚底对齐）
    const scaleK = 0.62;
    const dw = fw * scaleK, dh = fh * scaleK;
    g.drawImage(im, sx, 0, fw, fh, -dw / 2, -dh, dw, dh);
  },

  drawEnemySprite(g, spr, a, white) {
    const im = spr.img;
    if (!im) return;
    // 统一显示高度
    const targetH = a.isBoss ? (a.kind === 'boss' ? 200 : 175) : (a.radius > 30 ? 120 : 92);
    const ratio = im.width / im.height;
    const dh = targetH, dw = targetH * ratio;

    // 摇摆（跑动）
    let tilt = 0;
    if (a.state === 'run') tilt = Math.sin(a.age * 14) * 0.05;
    g.rotate(tilt);

    g.drawImage(im, -dw / 2, -dh, dw, dh);
  },

  // ---------- 主渲染 ----------
  render(g) {
    // 每帧先整屏清空，防止任何残留叠加
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#171321';
    g.fillRect(0, 0, W, H);

    g.save();

    // 抖动（限幅，防止极端值把画面推出屏幕）
    if (this.shakeT > 0) {
      const m = Math.min(14, this.shakeM) * Math.min(1, this.shakeT / 0.4);
      if (m > 0.05) g.translate(rand(-m, m), rand(-m, m));
    }

    // 背景
    const z = ZONES[this.zone] || ZONES[0];
    const bg = IMG['bg-' + z.bg];
    if (bg) g.drawImage(bg, 0, 0, W, H);
    else { g.fillStyle = '#171321'; g.fillRect(0, 0, W, H); }

    // 地面暗角
    const grd = g.createLinearGradient(0, 400, 0, H);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = grd; g.fillRect(0, 400, W, H - 400);

    // 预警
    for (const w of this.warnings) w.draw(g);

    // 按 y 排序绘制（伪深度）
    const list = this.actors.filter(a => !(a.dead && a.timer <= 0));
    list.push(this.hero);
    list.sort((p, q) => (p.y + (p.z || 0)) - (q.y + (q.z || 0)));
    for (const a of list) {
      if (a.dead) {
        // 死亡淡出
        g.globalAlpha = Math.max(0, a.timer / 0.65);
        this.drawActor(g, a);
        g.globalAlpha = 1;
      } else {
        this.drawActor(g, a);
      }
    }

    // 子弹
    for (const s of this.shots) {
      if (s.enemy) {
        g.fillStyle = s.slow ? '#9ad4ff' : '#ff9ec4';
        g.shadowBlur = 12; g.shadowColor = g.fillStyle;
      } else {
        g.fillStyle = '#f2ecff';
        g.shadowBlur = 14; g.shadowColor = '#b9a6ff';
      }
      g.beginPath();
      g.arc(s.x, s.y - (s.z || 0), s.size * 0.5, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }

    // 特效
    this.fx.draw(g);

    g.restore();
  }
});
