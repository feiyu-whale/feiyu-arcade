// 肥鱼 · 3D 大富翁 —— 最小可玩闭环
// 2026-10-18 v0.3：点格子 → 买地 → 盖房 → 掷骰子
// 说明：这里是「3D 版独立的最小玩法」，不依赖 2D 版的 5800 行逻辑；
//      后续再把 108 星宿 / 赐福 / 奇遇 / 核弹 整套接进来。

import { TILES } from './data/tiles.js';
import { PLAYER_COLORS_CSS, TOKEN_NAMES } from './three/world.js';
import { PERSONAS, shouldBuy, shouldBuild, pickBuildTile } from './ai.js';

export function createGame(world, hooks = {}) {
  const { onLog = () => {}, onUpdate = () => {} } = hooks;

  const state = {
    players: [],
    turn: 0,
    started: false,
    rolling: false,
    dice: [0, 0],
    hasRolled: false,   // 2026-10-18：本回合是否已掷过骰子
  };

  // ---------- 初始化玩家 ----------
  // config: [{ isAI, persona, name }] 或简单人数
  function initPlayers(config = 4) {
    let seats;
    if (Array.isArray(config)) seats = config;
    else seats = Array.from({ length: config }, () => ({ isAI: false }));

    state.players = [];
    seats.forEach((cfg, i) => {
      const persona = cfg.isAI
        ? (cfg.persona || PERSONAS[i % PERSONAS.length].id)
        : null;
      const personaObj = persona ? PERSONAS.find((p) => p.id === persona) : null;
      state.players.push({
        id: i,
        name: cfg.name || (cfg.isAI ? (personaObj?.name || `电脑${i + 1}`) : (TOKEN_NAMES[i] || `玩家${i + 1}`)),
        color: PLAYER_COLORS_CSS[i % PLAYER_COLORS_CSS.length],
        colorHex: PLAYER_COLORS_CSS[i % PLAYER_COLORS_CSS.length],
        money: 10000,
        coins: 5,
        position: 0,
        jail: false,
        isAI: !!cfg.isAI,
        persona,
        human: !cfg.isAI,
        starBankruptShield: 0,
        starShield: 0,
        starReflect: 0,
        starSkip: 0,
        starIsolate: 0,
        starLimitMove: 0,
        starExtraRoll: 0,
        starFreeRent: 0,
        starDoubleDice: 0,
        starHalfPrice: 0,
        starJailCard: 0,
        starJailCompanion: 0,
      });
    });
    state.turn = 0;
    state.started = true;
    onUpdate(state);
  }

  // ---------- AI 决策：本回合该干什么 ----------
  function aiPlan(player) {
    const acts = [];
    // 买地（当前所在格）
    const here = TILES[player.position];
    if (here && shouldBuy(player, here, TILES)) {
      acts.push({ type: 'buy', tile: player.position });
    }
    // 盖房
    if (shouldBuild(player, TILES[pickBuildTile(player, TILES)] || {})) {
      const idx = pickBuildTile(player, TILES);
      if (idx >= 0 && shouldBuild(player, TILES[idx])) acts.push({ type: 'build', tile: idx });
    }
    return acts;
  }

  // ---------- 掷骰子 ----------
  async function roll(force = false) {
    if (!state.started || state.rolling) return null;
    const p = state.players[state.turn];
    if (!p) return null;
    // 2026-10-18：一个回合只能掷一次；卡牌「再掷」走 force=true
    if (state.hasRolled && !force) return null;

    state.rolling = true;
    state.hasRolled = true;
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    state.dice = [d1, d2];
    onLog(`${p.name} 掷出 ${d1} + ${d2} = ${d1 + d2}`);

    if (world?.animateDice) {
      await world.animateDice(d1, d2, 1.0, 0.5);
    }

    const from = p.position;
    const steps = d1 + d2;
    if (world?.moveToken) {
      await world.moveToken(p.id, from, steps);
    }
    const to = ((from + steps) % 40 + 40) % 40;
    p.position = to;

    const t = TILES[to] || {};
    onLog(`${p.name} 走到【${t.name || to}】`);

    // 经过起点领工资 + 赐福「经过起点」钩子
    if (from + steps >= 40) {
      p.money += 10000;
      onLog(`${p.name} 经过起点，领取 $10000`);
      try { if (window.Boon?.onPassStart) window.Boon.onPassStart(p); } catch (e) {}
    }
    // 经过棋盘四角（每 10 格一次）→ 赐福「利滚利」结算
    try {
      const cornerCrossed = Math.floor((from + steps) / 10) > Math.floor(from / 10);
      if (cornerCrossed && window.Boon?.onPassCorner) window.Boon.onPassCorner(p, to);
    } catch (e) {}

    state.rolling = false;
    onUpdate(state);

    // 2026-10-18：卡牌「再掷一次」——读完标记并消耗一次
    let extra = 0;
    if (p.starExtraRoll === true) { p.starExtraRoll = 1; }
    if (typeof p.starExtraRoll === 'number' && p.starExtraRoll > 0) {
      extra = p.starExtraRoll;
      p.starExtraRoll = 0;   // 一次性用掉，由调用方决定是否继续掷
      onLog(`${p.name} 触发「再掷一次」（剩余 ${extra} 次）`);
    }

    // 2026-10-19 老爹定：落格触发机会/命运卡（照 2D 版 land() 的顺序：星宿在前，卡牌在后）
    //   depth 用来防连环：抽到「前进」卡后再落在机会格，最多再触发 1 次
    try {
      await triggerLanding(to, 0);
    } catch (e) {
      onLog('⚠️ 落格事件出错：' + (e && e.message));
    }

    return { player: p, from, to, tile: t, dice: [d1, d2], extraRoll: extra };
  }

  /**
   * 落格事件：星宿 → 机会/命运卡
   * @param {number} tileIdx 落点
   * @param {number} depth 递归深度（0=首次落格；>=1 时不再连锁触发）
   */
  async function triggerLanding(tileIdx, depth = 0) {
    const p = state.players[state.turn];
    if (!p) return;
    const t = TILES[tileIdx];
    if (!t) return;

    // 1) 星宿（2D 版行为：机会格先掷天罡，命运格先掷地煞）
    const isChanceTile = [2, 17, 33].includes(tileIdx);
    const isChestTile = [7, 22, 36].includes(tileIdx);
    if (window.StarEngine && window.StarEngine.trigger) {
      const kind = isChanceTile ? 'gang' : (isChestTile ? 'di' : null);
      if (kind) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 6000);  // 兜底，弹窗卡住也不锁死流程
          window.StarEngine.trigger(kind, p, () => { clearTimeout(timer); resolve(); });
        });
      }
    }

    // 2) 机会 / 命运卡（3D 版新接）
    if (depth === 0 && window.Cards && window.Cards.trigger) {
      const cardKind = isChanceTile ? 'chance' : (isChestTile ? 'chest' : null);
      if (cardKind) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 8000);
          window.Cards.trigger(cardKind, p, () => { clearTimeout(timer); resolve(); });
        });
        // 卡牌可能把玩家挪到新格（前进/后退/进监狱）→ 新落点再判一次（只判一层）
        if (p.position !== tileIdx) {
          await triggerLanding(p.position, depth + 1);
        }
      }
    }
  }

  // ---------- 买地 ----------
  function buy(tileIdx) {
    const p = state.players[state.turn];
    const t = TILES[tileIdx];
    if (!p || !t) return { ok: false, msg: '无效地块' };

    if (t.type !== 'property' && t.type !== 'railroad' && t.type !== 'utility') {
      return { ok: false, msg: '这块地不能买' };
    }
    if (t.owner != null) return { ok: false, msg: '这块地已经有主了' };
    if (p.money < t.price) return { ok: false, msg: `现金不足，还差 $${t.price - p.money}` };

    p.money -= t.price;
    t.owner = p.id;
    if (world?.setOwner) world.setOwner(tileIdx, p.colorHex);
    // 2026-10-18：买地反馈加强——格子升起玩家色小旗
    if (world?.flagTile) world.flagTile(tileIdx, p.colorHex);
    onLog(`🏴 ${p.name} 花 $${t.price} 买下【${t.name}】`);
    onUpdate(state);
    return { ok: true, msg: `🏴 你买下了【${t.name}】，花 $${t.price}`, tile: t, player: p };
  }

  // ---------- 盖房 ----------
  function build(tileIdx) {
    const p = state.players[state.turn];
    const t = TILES[tileIdx];
    if (!p || !t) return { ok: false, msg: '无效地块' };
    if (t.owner !== p.id) return { ok: false, msg: '这块地不是你的' };
    if (t.type !== 'property') return { ok: false, msg: '这块地不能盖房' };

    const lv = t.houses || 0;
    if (lv >= 5) return { ok: false, msg: '已经盖到最高级了' };

    const cost = t.houseCost || Math.round(t.price * 0.5);
    if (p.money < cost) return { ok: false, msg: `现金不足，还差 $${cost - p.money}` };

    p.money -= cost;
    t.houses = lv + 1;
    if (world?.setHouses) world.setHouses(tileIdx, t.houses);
    onLog(`${p.name} 花 $${cost} 把【${t.name}】升到 ${t.houses} 级`);
    onUpdate(state);
    return { ok: true, msg: `【${t.name}】升到 ${t.houses} 级` };
  }

  // ---------- 交租 ----------
  function payRent(tileIdx, diceSum) {
    const t = TILES[tileIdx];
    if (!t || t.owner == null) return null;
    const payer = state.players[state.turn];
    const owner = state.players[t.owner];
    if (!payer || !owner || payer.id === owner.id) return null;

    let rent = 0;
    if (t.type === 'property') {
      const lv = t.houses || 0;
      rent = (t.rents && t.rents[Math.min(lv, t.rents.length - 1)]) || 0;
    } else if (t.type === 'railroad') {
      const n = TILES.filter((x) => x.type === 'railroad' && x.owner === owner.id).length;
      rent = (t.price || 0) * Math.pow(2, Math.max(0, n - 1)) * 0.25;
    } else if (t.type === 'utility') {
      rent = (diceSum || 7) * (t.price || 0) * 0.04;
    }
    rent = Math.round(rent);
    if (rent <= 0) return null;

    payer.money -= rent;
    owner.money += rent;
    onLog(`${payer.name} 向 ${owner.name} 支付租金 $${rent}`);
    onUpdate(state);
    return rent;
  }

  // ---------- 结束回合 ----------
  function endTurn() {
    state.hasRolled = false;   // 2026-10-18：换人 → 可以重新掷
    state.turn = (state.turn + 1) % state.players.length;
    if (world?.setFollow) world.setFollow(state.turn);
    onUpdate(state);
    return state.players[state.turn];
  }

  return { state, initPlayers, roll, buy, build, payRent, endTurn, aiPlan };
}
