/* 公司经营模拟 · 核心引擎
 * 设计原则：规则来自真实商业逻辑，随机只决定"什么时候来"，不决定"合不合理"
 * 2026-10-24 肥鱼  v1.0.0
 */

const G = {
  cash: 300000,          // 起始现金 30 万
  debt: 0,               // 负债
  month: 0,              // 已过月数（0 = 第1月）
  stores: 1,             // 门店数
  seg: 'zhengcan',       // 当前品类
  reputation: 50,        // 口碑 0-100
  morale: 70,            // 士气 0-100
  staff: 5,              // 员工数
  receivables: [],       // 应收账：{amount, dueMonth}
  payables: [],          // 应付账：{amount, dueMonth}
  inventory: 0,          // 存货（元）
  history: [],           // 每月记录
  status: 'running',     // running / bankrupt / quit
  events: [],            // 本月事件日志
  totalInvested: 0,
  monthsNegProfit: 0,    // 连续亏损月数
  revenueLast: 0,        // 上月营收（事件用）
  mods: [],              // 生效中的事件修饰器 {type, value, until}
  usedEvents: [],        // 本月已出事件
  pendingChoice: null    // 等待玩家选择的事件
};

function P() { return SEGMENTS[G.seg]; }

/* 修饰器：事件造成的影响，按月生效 */
function addMod(type, value, months) {
  G.mods.push({ type, value, until: G.month + months });
}
function modSum(type) {
  return G.mods.filter(m => m.type === type && m.until > G.month)
               .reduce((s, m) => s + m.value, 0);
}
function expireMods() {
  G.mods = G.mods.filter(m => m.until > G.month);
}

/* 月度结算：核心循环
 * 顺序不可调整 —— 这是真实企业的死法
 */
function settleMonth() {
  const p = P();
  const log = { month: G.month + 1, items: [], events: [] };
  G.month++;
  G.events = [];

  const stores = G.stores;

  // ── 1. 营收（含波动）──
  let baseRev = p.revenue * stores;
  // 口碑影响营收（40-60 为基准，越高越好）
  const repFactor = 0.7 + (G.reputation / 100) * 0.6;   // 0.7 ~ 1.3
  // 士气影响（士气低 → 服务差 → 客流降）
  const morFactor = 0.85 + (G.morale / 100) * 0.3;      // 0.85 ~ 1.15
  // 季节波动（正餐冬季旺、茶饮夏季旺）
  const seasonFactor = seasonFactorFor(G.seg, G.month);
  // 随机波动
  const rand = 1 + (Math.random() * 2 - 1) * p.volatility;

  const revMod = 1 + modSum('revenueDelta');
  const rev = Math.max(0, baseRev * repFactor * morFactor * seasonFactor * rand * revMod);
  G.revenueLast = rev;
  log.items.push(['营业收入', rev, 'in']);

  // ── 2. 成本 ──
  const foodCost = rev * (p.foodCostRate + modSum('foodCostDelta'));
  const staffCost = rev * (p.staffRate + modSum('staffRateDelta')) + modSum('staffDelta');
  // 房租按门店数固定（真实：房租是固定成本，不随营收变动）
  const rentCost = p.rentFixed * stores * (1 + modSum('rentDelta'));
  const utilCost = p.utilFixed * stores;
  const miscCost = rev * p.miscRate;
  const grossProfit = rev - foodCost - staffCost - rentCost - utilCost - miscCost;

  log.items.push(['食材成本', foodCost, 'out']);
  log.items.push(['人工成本', staffCost, 'out']);
  log.items.push(['房租', rentCost, 'out']);
  log.items.push(['水电', utilCost, 'out']);
  log.items.push(['杂费', miscCost, 'out']);

  // ── 3. 利息 ──
  let interest = 0;
  if (G.debt > 0) {
    interest = G.debt * 0.008;   // 月息 0.8%（年化约 10%）
    log.items.push(['贷款利息', interest, 'out']);
  }

  const netProfit = grossProfit - interest;

  // ── 4. 现金流：营收不是当月全到账 ──
  //    按账期排队
  G.receivables.forEach(r => {
    if (r.dueMonth <= G.month) {
      G.cash += r.amount;
      log.items.push(['收到应收账', r.amount, 'in']);
      r.paid = true;
    }
  });
  G.receivables = G.receivables.filter(r => !r.paid);
  // 本月营收到账：餐饮 85% 当月到账（C端现结为主），余下按账期
  const cashNow = rev * 0.85;
  G.cash += cashNow;
  const deferred = rev - cashNow;
  if (deferred > 0) {
    const delay = Math.max(1, Math.round(p.arDays / 30));
    G.receivables.push({ amount: deferred, dueMonth: G.month + delay, paid: false });
    log.items.push(['营收挂账（未到账）', -deferred, 'memo']);
  }

  // ── 5. 付钱（雷打不动的部分）──
  // 工资、房租必须当月付
  const mustPay = staffCost + rentCost + utilCost + miscCost;
  log.items.push(['支付工资房租等', mustPay, 'out']);
  G.cash -= mustPay;

  // 货款按应付账期
  if (p.apDays > 0) {
    const delay = Math.max(1, Math.round(p.apDays / 30));
    G.payables.push({ amount: foodCost, dueMonth: G.month + delay, paid: false });
  } else {
    G.cash -= foodCost;
  }
  G.payables.forEach(a => {
    if (a.dueMonth <= G.month) {
      G.cash -= a.amount;
      log.items.push(['支付货款', a.amount, 'out']);
      a.paid = true;
    }
  });
  G.payables = G.payables.filter(a => !a.paid);

  // 利息必须当月付
  if (interest > 0) G.cash -= interest;

  // ── 6. 破产判定 ──
  if (G.cash < 0) {
    // 现金断了 → 看能不能紧急借
    if (G.debt < 3000000 && Math.random() < 0.4) {
      const borrow = 200000;
      G.debt += borrow;
      G.cash += borrow;
      log.events.push({ type: 'warn', text: '现金断裂，紧急借入 ' + (borrow / 1e4) + ' 万（月息 0.8%）' });
    } else {
      G.status = 'bankrupt';
      log.events.push({ type: 'bad', text: '💀 现金耗尽，供应商停供，公司破产' });
    }
  }

  // ── 7. 士气 / 口碑自然变化 ──
  if (netProfit < 0) {
    G.monthsNegProfit++;
    G.morale = Math.max(0, G.morale - 3);
    if (G.monthsNegProfit >= 3 && G.events.length < 3) {
      log.events.push({ type: 'warn', text: '连续 ' + G.monthsNegProfit + ' 个月亏损，员工开始人心浮动' });
    }
  } else {
    G.monthsNegProfit = 0;
    G.morale = Math.min(100, G.morale + 1);
  }
  G.reputation = Math.max(0, Math.min(100, G.reputation + (netProfit > 0 ? 0.3 : -0.5)));

  // 士气太低 → 员工流失
  if (G.morale < 30 && Math.random() < 0.3) {
    const leave = 1;
    G.staff = Math.max(1, G.staff - leave);
    log.events.push({ type: 'bad', text: '骨干离职（士气过低），员工减至 ' + G.staff + ' 人' });
  }

  expireMods();
  G.usedEvents = [];
  log.netProfit = netProfit;
  log.revenue = rev;
  log.cashAfter = G.cash;
  G.history.push(log);
  return log;
}

function seasonFactorFor(seg, month) {
  const m = ((month - 1) % 12) + 1;
  if (seg === 'chayin') {
    // 茶饮夏季旺
    return [0.85, 0.9, 1.0, 1.1, 1.2, 1.25, 1.25, 1.2, 1.05, 0.95, 0.85, 0.85][m - 1];
  }
  const winter = [1.15, 1.2, 1.05, 0.95, 0.9, 0.85, 0.85, 0.9, 1.0, 1.1, 1.15, 1.2];
  return winter[m - 1];
}

/* 开店：从 1 家扩到 2 家，成本 = setupCost */
function openStore() {
  const p = P();
  const cost = p.setupCost * 0.8;   // 第二家起规模效应，省 20%
  if (G.cash < cost) return { ok: false, msg: '现金不足，需要 ' + (cost / 1e4).toFixed(0) + ' 万' };
  G.cash -= cost;
  G.stores++;
  G.staff += Math.round(p.revenue * p.staffRate / 6000 / 1);  // 按工资换算加人
  return { ok: true, msg: '新开一家' + p.name + '店，投入 ' + (cost / 1e4).toFixed(0) + ' 万' };
}

/* 贷款 */
function borrow(amount) {
  const limit = 3000000 - G.debt;
  if (amount > limit) return { ok: false, msg: '超过授信额度（剩余 ' + (limit / 1e4).toFixed(0) + ' 万）' };
  G.debt += amount;
  G.cash += amount;
  return { ok: true, msg: '借入 ' + (amount / 1e4).toFixed(0) + ' 万' };
}

/* 换赛道：老爹要求的核心机制 */
function switchSegment(toSeg) {
  const from = P();
  const to = SEGMENTS[toSeg];
  if (!to) return { ok: false, msg: 'no such segment' };

  const stage = STAGES.find(s => G.stores >= s.minStores && G.stores <= s.maxStores) || STAGES[0];
  const lossRate = similarityLoss(G.seg, toSeg);
  const assets = G.stores * from.setupCost * 0.7;   // 现有资产（折旧后）
  const nonReuseAssets = assets * stage.nonReuse * lossRate;

  // 遣散费：裁员 20%，每人 2 个月工资
  const avgWage = 6000;
  const layoff = Math.round(G.staff * 0.2);
  const severance = layoff * avgWage * 2;

  // 租约违约金：每店 3 万
  const penalty = G.stores * 30000;

  const totalCost = nonReuseAssets + severance + penalty;
  if (G.cash < totalCost) {
    return { ok: false, msg: '转换成本 ' + (totalCost / 1e4).toFixed(1) + ' 万，现金不够' };
  }

  // 成功率
  const baseRate = lossRate <= 0.25 ? BASE_SUCCESS.same :
                   lossRate <= 0.5 ? BASE_SUCCESS.similar : BASE_SUCCESS.cross;
  const cashRatio = totalCost / G.cash;
  const fundCoef = cashRatio < 0.3 ? 1.0 : cashRatio < 0.6 ? 0.85 : cashRatio < 0.9 ? 0.6 : 0.3;
  const expCoef = Math.min(1.3, 1 + G.month * 0.003);      // 经验
  const teamCoef = G.morale / 100;                          // 士气即团队系数
  const timingCoef = 1.0;                                   // 平期

  const successRate = baseRate * fundCoef * expCoef * teamCoef * timingCoef;

  return {
    ok: true, canAfford: true,
    cost: totalCost, successRate,
    detail: { lossRate, stage: stage.name, nonReuseAssets, severance, penalty,
              baseRate, fundCoef, expCoef, teamCoef },
    msg: '转换需 ' + (totalCost / 1e4).toFixed(1) + ' 万，成功率 ' + (successRate * 100).toFixed(1) + '%'
  };
}

function executeSwitch(toSeg, preview) {
  G.cash -= preview.cost;
  if (Math.random() < preview.successRate) {
    G.seg = toSeg;
    G.reputation = Math.max(20, G.reputation - 10);
    return { success: true, msg: '✅ 转型成功，现在是' + SEGMENTS[toSeg].name };
  } else {
    // 失败：额外损失
    const extra = preview.cost * 0.5;
    G.cash -= extra;
    G.reputation = Math.max(0, G.reputation - 25);
    G.morale = Math.max(0, G.morale - 20);
    if (G.cash < 0) G.status = 'bankrupt';
    return { success: false, msg: '❌ 转型失败，额外损失 ' + (extra / 1e4).toFixed(1) + ' 万' };
  }
}

if (typeof module !== 'undefined') module.exports = { G, settleMonth, openStore, borrow, switchSegment, executeSwitch, seasonFactorFor };
