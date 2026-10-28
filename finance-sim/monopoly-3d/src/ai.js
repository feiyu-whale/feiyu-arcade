// 肥鱼 · 3D 大富翁 —— AI 大脑
// 2026-10-18：本地启发式 AI（不依赖大模型，零成本、零延迟）
// 参考 hencter/monopoly-3d-ai 的人格设定，简化为咱们自己的版本

export const PERSONAS = [
  { id: 'shenyi',  name: '沈毅', style: '精明保守', buyReserve: 3000, risk: 0.40 },
  { id: 'ahao',    name: '阿豪', style: '激进派',   buyReserve: 500,  risk: 0.90 },
  { id: 'linda',   name: '琳达', style: '科技新贵', buyReserve: 1800, risk: 0.70 },
  { id: 'laozhou', name: '老周', style: '老江湖',   buyReserve: 2000, risk: 0.55 },
  { id: 'xiaomeng',name: '小萌', style: '创业萌新', buyReserve: 1200, risk: 0.65 },
];

/**
 * 给某块地打分：正数=值得买，越大越值
 */
export function scoreTile(t, player, TILES) {
  if (!t) return -999;
  if (t.type !== 'property' && t.type !== 'railroad' && t.type !== 'utility') {
    if (t.type === 'tax' || t.type === 'gotojail') return -5;
    return 0;
  }
  if (t.owner === player.id) return 0.4;
  if (t.owner != null) return -2;      // 别人的地，负分

  // 无主地
  let s = 2;
  // 同色组收集度加成
  if (t.type === 'property' && t.color) {
    const same = TILES.filter((x) => x.type === 'property' && x.color === t.color);
    const mine = same.filter((x) => x.owner === player.id).length;
    if (mine > 0) s += mine * 1.4;
  }
  // 交通/公用组合
  if (t.type === 'railroad' || t.type === 'utility') {
    const mine = TILES.filter((x) => x.type === t.type && x.owner === player.id).length;
    s += mine * 1.1;
  }
  return s;
}

/**
 * 决定是否买地
 * @returns {boolean}
 */
export function shouldBuy(player, tile, TILES) {
  if (!tile || tile.owner != null) return false;
  const persona = PERSONAS.find((p) => p.id === player.persona) || PERSONAS[player.id % PERSONAS.length];
  const price = tile.price || 0;
  if (player.money < price + persona.buyReserve) return false;
  const s = scoreTile(tile, player, TILES);
  return s * persona.risk > 0.8;
}

/**
 * 决定是否升级（盖房）
 */
export function shouldBuild(player, tile) {
  if (!tile || tile.owner !== player.id) return false;
  if (tile.type !== 'property') return false;
  const lv = tile.houses || 0;
  if (lv >= 5) return false;
  const persona = PERSONAS.find((p) => p.id === player.persona) || PERSONAS[player.id % PERSONAS.length];
  const cost = tile.houseCost || Math.round((tile.price || 0) * 0.5);
  // 保守派留更多现金
  return player.money > cost + persona.buyReserve * 2;
}

/**
 * 选一个要升级的地块（优先级别最高的）
 */
export function pickBuildTile(player, TILES) {
  const owned = [];
  for (let i = 0; i < TILES.length; i++) {
    const t = TILES[i];
    if (t.owner === player.id && t.type === 'property' && (t.houses || 0) < 5) {
      owned.push({ i, lv: t.houses || 0, price: t.price || 0 });
    }
  }
  if (!owned.length) return -1;
  // 优先升级等级低、地价高的
  owned.sort((a, b) => (a.lv - b.lv) || (b.price - a.price));
  return owned[0].i;
}
