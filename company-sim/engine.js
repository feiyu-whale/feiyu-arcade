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
  pendingChoice: null,   // 等待玩家选择的事件
  loans: [],             // 每笔贷款：{principal, remain, rate, term, startMonth}
  credit: 100,           // 信用评分 0-100（逾期扣、按时还款加分）
  overdue: 0,            // 累计逾期次数
  lastRBI: 6.0           // 当前基准利率（年化 %）——2026 中国 LPR 水平
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

  // ── 3. 贷款月供（等额本息：本金+利息一起还）──
  let totalPayment = 0, totalInterest = 0;
  G.loans.forEach(ln => {
    if (ln.remain <= 0) return;
    const r = ln.rate / 12;                                     // 月利率
    const n = ln.term;                                          // 总期数
    const pay = ln.principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const intPart = ln.remain * r;
    const priPart = Math.min(pay - intPart, ln.remain);
    ln.remain -= priPart;
    totalPayment += priPart + intPart;
    totalInterest += intPart;
  });
  G.loans = G.loans.filter(l => l.remain > 0.01);
  if (totalPayment > 0) {
    log.items.push(['贷款月供', totalPayment, 'out']);
    log.items.push(['　其中利息', totalInterest, 'memo']);
  }

  const netProfit = grossProfit - totalInterest;

  // 利息不重复扣（已在月供里）——下面现金流只扣 totalPayment

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

  // 月供必须当月还（还不上就是逾期）
  if (totalPayment > 0) {
    if (G.cash >= totalPayment) {
      G.cash -= totalPayment;
      G.credit = Math.min(100, G.credit + 0.5);      // 按时还款加分
    } else {
      // 逾期：罚息 + 扣信用
      const penalty = totalPayment * 0.05;
      G.cash -= (totalPayment + penalty);
      G.overdue++;
      G.credit = Math.max(0, G.credit - 15);
      log.events.push({ type: 'bad',
        text: '⚠️ 贷款逾期！罚息 ' + (penalty / 1e4).toFixed(1) + ' 万，信用评分 -15（现 ' + G.credit.toFixed(0) + '）' });
    }
  }

  // ── 6. 破产判定 ──
  if (G.cash < 0) {
    // 现金断了 → 看能不能紧急借
    // 现金断裂时，银行只肯给高息过桥贷（信用差的人借不到）
    const emergLimit = creditLimit() - totalDebt();
    if (emergLimit > 0 && G.credit >= 30) {
      const amt = Math.min(emergLimit, 200000);
      const rate = loanRate() * 2.5;     // 过桥贷利率极高
      const r = rate / 12, n = 6;
      const pay = amt * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      G.loans.push({ principal: amt, remain: amt, rate, term: n, startMonth: G.month, product: '过桥贷' });
      G.cash += amt;
      G.credit = Math.max(0, G.credit - 5);
      log.events.push({ type: 'warn',
        text: '💸 现金断裂！银行只给过桥贷 ' + (amt / 1e4).toFixed(1) + ' 万，年化 ' + (rate * 100).toFixed(1) + '%，每月还 ' + (pay / 1e4).toFixed(2) + ' 万' });
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

/* ═══ 真实商业借贷系统 ═══
 * 真实规则：
 *  1. 授信额度取决于「信用评分 + 经营能力」，不是想借多少借多少
 *  2. 利率分档：信用越好越便宜；基准利率浮动
 *  3. 还款方式：等额本息，每月固定还，不能选择性不还
 *  4. 逾期代价：罚息 5% + 信用暴跌 15 分，还会连锁影响后续授信
 */

/* 计算当前授信额度（真实银行逻辑：看现金流、看资产、看信用） */
function creditLimit() {
  const p = P();
  // 年化营收规模
  const annualRev = p.revenue * G.stores * 12;
  // 净资产（现金 + 资产 - 负债）
  const assets = G.stores * p.setupCost * 0.7;
  const netWorth = G.cash + assets - totalDebt();
  // 银行最看重：年营收的 30% 为上限，且不超过净资产 2 倍
  const byRev = annualRev * 0.30;
  const byNet = Math.max(0, netWorth) * 2.0;
  // 信用系数 0.3 ~ 1.0
  const creditCoef = 0.3 + (G.credit / 100) * 0.7;
  // 已逾期过 → 授信打折
  const overdueCoef = Math.max(0.3, 1 - G.overdue * 0.15);
  return Math.max(0, Math.min(byRev, byNet) * creditCoef * overdueCoef);
}

function totalDebt() {
  return G.loans.reduce((s, l) => s + Math.max(0, l.remain), 0);
}

/* 利率（年化）：基准 + 信用溢价 */
function loanRate() {
  // 信用 100 分 → 基准；信用 0 分 → 基准 + 12%
  const premium = (100 - G.credit) / 100 * 0.12;
  return G.lastRBI / 100 + premium;
}

/* 贷款产品（真实银行的几类） */
const LOAN_PRODUCTS = [
  { id: 'credit',  name: '信用贷',   term: 12, minCredit: 60,
    desc: '无抵押，看经营流水。额度小、利率高、期限短' },
  { id: 'business',name: '经营贷',   term: 36, minCredit: 40,
    desc: '需经营满 6 个月。额度中等，可用设备/门店抵押' },
  { id: 'longterm',name: '长期贷',   term: 60, minCredit: 70,
    desc: '信用优秀才能申请。额度大、期限长，用于扩张' }
];

/* 申请贷款 */
function applyLoan(productId, amount) {
  const prod = LOAN_PRODUCTS.find(p => p.id === productId);
  if (!prod) return { ok: false, msg: '没有这种贷款' };
  if (G.credit < prod.minCredit) {
    return { ok: false, msg: '信用评分 ' + G.credit.toFixed(0) + ' 分，不够申请' + prod.name + '（要求 ' + prod.minCredit + ' 分）' };
  }
  if (prod.id === 'business' && G.month < 6) {
    return { ok: false, msg: '经营贷要求经营满 6 个月（当前 ' + G.month + ' 个月）' };
  }
  const limit = creditLimit() - totalDebt();
  if (amount > limit) {
    return { ok: false, msg: '超出可贷额度（还能借 ' + (Math.max(0, limit) / 1e4).toFixed(1) + ' 万）' };
  }
  const rate = loanRate();
  // 等额本息月供
  const r = rate / 12, n = prod.term;
  const payment = amount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  G.loans.push({ principal: amount, remain: amount, rate, term: n, startMonth: G.month, product: prod.name });
  G.cash += amount;
  return { ok: true, rate, payment, term: n,
    msg: prod.name + ' ' + (amount / 1e4).toFixed(1) + ' 万，年利率 ' + (rate * 100).toFixed(2) + '%，' +
         n + ' 期，每月还 ' + (payment / 1e4).toFixed(2) + ' 万' };
}

/* 提前还款（真实：可以还，但可能收违约金） */
function repayLoan(idx, amount) {
  const ln = G.loans[idx];
  if (!ln) return { ok: false, msg: '没有这笔贷款' };
  const actual = Math.min(amount, ln.remain, G.cash);
  if (actual <= 0) return { ok: false, msg: '没得还' };
  const penalty = actual * 0.01;    // 提前还款违约金 1%
  G.cash -= (actual + penalty);
  ln.remain -= actual;
  if (ln.remain - actual < 0.01) ln.remain = 0;
  G.loans = G.loans.filter(l => l.remain > 0.01);
  return { ok: true, msg: '提前还款 ' + (actual / 1e4).toFixed(1) + ' 万（违约金 ' + (penalty / 1e4).toFixed(2) + ' 万）' };
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
