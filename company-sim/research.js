/* 公司经营模拟 · 新品研发  v3.4.0 2026-10-31 肥鱼
 *
 * 老爹原话：「玩家可以自己研发新品，越美味的通常越困难越费钱，并且有概率研制失败」
 *
 * 设计逻辑：
 *   ① 美味度 1~10 级，越高越难
 *   ② 研发要投钱（研发预算），钱多见效快但风险也高
 *   ③ 每次尝试有失败概率，失败 = 钱打水漂，可能还扣士气
 *   ④ 成功后有「招牌菜」：长期营收加成 + 口碑加成
 *   ⑤ 研发期间团队分心，可能影响当月运营（人才成本）
 *
 * 现实参照：餐饮新品研发要反复试菜、报废食材、请人试吃，周期 2~6 个月
 */

/* 美味等级配置 */
const TASTE_TIERS = [
  { lvl: 1,  name: '家常水平', cost: 15000,   baseChance: 0.92, revBonus: 0.02, repBonus: 1,  months: 1 },
  { lvl: 2,  name: '略胜一筹', cost: 35000,   baseChance: 0.84, revBonus: 0.04, repBonus: 2,  months: 1 },
  { lvl: 3,  name: '小有名气', cost: 70000,   baseChance: 0.74, revBonus: 0.07, repBonus: 3,  months: 2 },
  { lvl: 4,  name: '街坊称赞', cost: 130000,  baseChance: 0.62, revBonus: 0.10, repBonus: 5,  months: 2 },
  { lvl: 5,  name: '网红爆款', cost: 240000,  baseChance: 0.50, revBonus: 0.14, repBonus: 7,  months: 3 },
  { lvl: 6,  name: '区域招牌', cost: 420000,  baseChance: 0.38, revBonus: 0.19, repBonus: 10, months: 3 },
  { lvl: 7,  name: '口耳相传', cost: 750000,  baseChance: 0.28, revBonus: 0.25, repBonus: 13, months: 4 },
  { lvl: 8,  name: '一店难求', cost: 1300000, baseChance: 0.19, revBonus: 0.32, repBonus: 17, months: 4 },
  { lvl: 9,  name: '远近闻名', cost: 2200000, baseChance: 0.11, revBonus: 0.40, repBonus: 22, months: 5 },
  { lvl: 10, name: '传世名菜', cost: 4000000, baseChance: 0.05, revBonus: 0.52, repBonus: 28, months: 6 }
];

/* 研发投入加成：多花钱能提高成功率（但边际递减） */
function budgetChanceBonus(budget, baseCost) {
  const ratio = budget / Math.max(1, baseCost);
  // 投 1 倍钱 = 基础；投 2 倍 = +12%；投 3 倍 = +18%；封顶 +25%
  if (ratio <= 1) return 0;
  const extra = Math.min(0.25, Math.log(ratio) * 0.18);
  return extra;
}

/* 团队水平加成：口碑 + 士气影响研发能力 */
function teamChanceBonus() {
  const rep = (G.reputation || 50) / 100;   // 0~1
  const mor = (G.morale || 70) / 100;       // 0~1
  return (rep * 0.10) + (mor * 0.08);       // 最多 +18%
}

/* 发起研发：返回 { ok, msg } */
function startResearch(level, budget) {
  const tier = TASTE_TIERS.find(t => t.lvl === Number(level));
  if (!tier) return { ok: false, msg: '没有这个美味等级' };
  if (G.research && G.research.length >= 2) {
    return { ok: false, msg: '团队精力有限，同时最多研发 2 道新品' };
  }
  const spend = Math.max(tier.cost, Number(budget) || tier.cost);
  if (G.cash < spend) {
    return { ok: false, msg: '现金不够，这道菜要投 ' + (tier.cost / 1e4).toFixed(0) + ' 万起步' };
  }

  G.cash -= spend;
  G.research = G.research || [];
  const bonus = budgetChanceBonus(spend, tier.cost) + teamChanceBonus();
  const chance = Math.min(0.95, tier.baseChance + bonus);

  G.research.push({
    id: 'D' + Date.now() + Math.floor(Math.random() * 1000),
    lvl: tier.lvl,
    name: tier.name,
    cost: spend,
    chance: chance,
    revBonus: tier.revBonus,
    repBonus: tier.repBonus,
    months: tier.months,
    left: tier.months,
    startMonth: G.month
  });

  return { ok: true,
    msg: '开始研发「' + tier.name + '」（' + tier.lvl + ' 级），投入 ' + (spend / 1e4).toFixed(0) +
         ' 万，预计 ' + tier.months + ' 个月，成功率约 ' + (chance * 100).toFixed(0) + '%' };
}

/* 每月推进研发（在 settle 里调用）：返回事件列表 */
function tickResearch() {
  if (!G.research || !G.research.length) return [];
  const events = [];
  const keep = [];

  G.research.forEach(r => {
    r.left--;
    if (r.left > 0) { keep.push(r); return; }

    // 出结果
    const roll = Math.random();
    if (roll < r.chance) {
      // 成功
      G.dishes = G.dishes || [];
      G.dishes.push({
        name: r.name, lvl: r.lvl,
        revBonus: r.revBonus, repBonus: r.repBonus,
        createdMonth: G.month
      });
      G.reputation = Math.min(100, (G.reputation || 50) + r.repBonus);
      events.push({ type: 'good',
        text: '🎉 新品「' + r.name + '」研发成功！（' + r.lvl + ' 级）口碑 +' + r.repBonus +
              '，长期营收 +' + (r.revBonus * 100).toFixed(0) + '%' });
    } else {
      // 失败
      G.morale = Math.max(0, (G.morale || 70) - 3);
      events.push({ type: 'bad',
        text: '💨 「' + r.name + '」研发失败——反复试验做不出那个味，投入的钱打了水漂，士气 -3' });
    }
  });

  G.research = keep;

  // 研发期间团队分心（有人手在试菜），轻微影响运营
  if (G.research.length > 0) {
    events.push({ type: 'info',
      text: '🧪 研发进行中（' + G.research.length + ' 道），团队分心试菜，当月效率略降' });
  }

  return events;
}

/* 招牌菜总加成 */
function dishRevBonus() {
  if (!G.dishes || !G.dishes.length) return 0;
  // 多道菜加成递减：取最高 + 其余折半，封顶 80%
  const sorted = G.dishes.map(d => d.revBonus).sort((a, b) => b - a);
  let total = sorted[0] || 0;
  for (let i = 1; i < sorted.length; i++) {
    total += sorted[i] * Math.pow(0.5, i);
  }
  return Math.min(0.80, total);
}

/* 研发分心导致的经营惩罚 */
function researchDistraction() {
  const n = (G.research || []).length;
  return 1 - Math.min(0.06, n * 0.03);   // 每道菜 -3%，最多 -6%
}

if (typeof module !== 'undefined') module.exports = {
  TASTE_TIERS, startResearch, tickResearch, dishRevBonus, researchDistraction,
  budgetChanceBonus, teamChanceBonus
};
