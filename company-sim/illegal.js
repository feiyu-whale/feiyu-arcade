/* 公司经营模拟 · 违法操作系统  v2.1.0 2026-10-24 肥鱼
 *
 * 现实规则：
 *  餐饮业违法手段真实存在：地沟油、偷税、黑工、刷单
 *  短期确实省钱，但风险月月累积
 *  一旦被查：罚款、吊照、关停，情节严重的直接出局
 *
 *  本模块不评判对错，只呈现真实后果。
 */

const ILLEGAL_ACTS = [
  {
    id: 'oil', name: '用劣质油/回收油', icon: '🛢️',
    desc: '食材成本降 30%，但一旦查出就是刑事案',
    savingRate: 0.30,        // 降的是食材成本
    baseRisk: 0.002,         // 首月被查概率（很低，给侥幸心理留空间）
    riskGrowth: 0.00022,     // 每月累积（一年后约+2.6%，两年后约+5.3%）
    riskCurve: 2.2,          // 风险曲线指数（越久涨越快）
    catchPenalty: { fine: 0.5, shut: true, criminal: true },
    news: '地沟油案：当事人被判刑入狱，营业执照吊销，企业永久关闭'
  },
  {
    id: 'tax', name: '偷税漏税', icon: '📄',
    desc: '省下 6%~10% 的营收，但税务大数据比对越来越准',
    savingRate: 0.08,
    baseRisk: 0.0015,
    riskGrowth: 0.00018,
    riskCurve: 2.4,
    catchPenalty: { fine: 1.2, shut: false, criminal: true },
    news: '偷税案：补缴+罚款+滞纳金，数额巨大可追究刑责（真实案例：范冰冰被罚 8.8 亿）'
  },
  {
    id: 'labor', name: '用黑工/童工', icon: '👷',
    desc: '人工成本降 40%，但劳动监察一旦上门就是重罚',
    savingRate: 0.40,
    baseRisk: 0.0025,
    riskGrowth: 0.00025,
    riskCurve: 2.0,
    catchPenalty: { fine: 0.6, shut: true, criminal: false },
    news: '非法用工：责令停产停业、罚款，情节严重的吊销执照'
  },
  {
    id: 'fake', name: '虚假宣传/刷单', icon: '⭐',
    desc: '短期客流涨 15%，但平台处罚和市监约谈随时来',
    savingRate: 0,
    revenueBoost: 0.15,
    baseRisk: 0.0030,
    riskGrowth: 0.00022,
    riskCurve: 2.0,
    catchPenalty: { fine: 0.3, shut: false, criminal: false },
    news: '刷单虚假宣传：市场监管罚款，平台降权或下架'
  }
];

/* 玩家当前启用的违法操作（存 id 数组） */
function toggleIllegal(id) {
  if (!G.illegalActs) G.illegalActs = {};
  if (!G.illegalRisk) G.illegalRisk = {};
  if (G.illegalActs[id]) {
    delete G.illegalActs[id];
    // 停了，风险不立刻归零，但不再增长
    return { ok: true, msg: '已停止「' + ILLEGAL_ACTS.find(a => a.id === id).name + '」' };
  }
  const act = ILLEGAL_ACTS.find(a => a.id === id);
  if (!act) return { ok: false, msg: '没有这个操作' };
  G.illegalActs[id] = true;
  if (G.illegalRisk[id] === undefined) G.illegalRisk[id] = 0;
  return { ok: true, msg: '已启用「' + act.name + '」——' + act.desc };
}

/* 每月结算：应用收益、累积风险、检查是否被查 */
function illegalMonthly(rev, foodCost, staffCost) {
  const out = { foodSave: 0, staffSave: 0, taxSave: 0, revBoost: 0, caught: null, warnings: [] };
  if (!G.illegalActs) return out;

  ILLEGAL_ACTS.forEach(act => {
    if (!G.illegalActs[act.id]) return;

    // ① 收益
    if (act.id === 'oil') out.foodSave += foodCost * act.savingRate;
    if (act.id === 'labor') out.staffSave += staffCost * act.savingRate;
    if (act.id === 'tax') out.taxSave += rev * act.savingRate;
    if (act.id === 'fake') out.revBoost += rev * act.revenueBoost;

    // ② 风险累积（曲线：用得越久涨得越快）
    G.illegalRisk[act.id] = (G.illegalRisk[act.id] || 0) + 1;   // 存的是使用月数
    const months = G.illegalRisk[act.id];
    const risk = act.baseRisk + act.riskGrowth * Math.pow(months, act.riskCurve);

    // ③ 抽查判定
    if (Math.random() < risk) {
      out.caught = act;
      G.caughtBy = act.id;
      return;
    }
    // ④ 风险高时的风声预警（给一次跑的机会）
    if (risk > 0.08 && Math.random() < 0.15) {
      out.warnings.push('📡 风声越来越紧：' + act.name + '这块，有人开始打听了');
    }
  });

  return out;
}

/* 被查处的后果 */
function handleCaught(act) {
  const rev = G.revenueLast || 1;
  const fine = rev * act.catchPenalty.fine * 12;   // 按年化营收罚
  G.cash -= fine;
  G.reputation = Math.max(0, G.reputation - 45);
  G.morale = Math.max(0, G.morale - 30);

  // 运气：小概率"查得不深"，只罚款关停整改，不吊照（真实：有人确实躲过去了）
  if ((act.catchPenalty.shut || act.catchPenalty.criminal) && Math.random() < 0.18) {
    G.cash -= fine;
    G.reputation = Math.max(0, G.reputation - 30);
    G.morale = Math.max(0, G.morale - 20);
    // 停业整改：营收砍半两个月
    if (typeof addMod === 'function') addMod('revenueDelta', -0.5, 2);
    const act2 = ILLEGAL_ACTS.find(a => a.id === act.id);
    if (G.illegalActs) delete G.illegalActs[act.id];
    if (act2) G.illegalRisk[act.id] = Math.max(0, (G.illegalRisk[act.id] || 0) - 6);
    return {
      text: '😰 被查了！' + act.name + '——但查得不算深，罚款 ' + (fine / 1e4).toFixed(0) +
            ' 万，责令停业整改两个月。这条线断了，但公司还在。',
      detail: '运气救了你一次。下次未必。'
    };
  }

  if (act.catchPenalty.shut || act.catchPenalty.criminal) {
    G.status = 'caught';   // 新状态：被查处，游戏结束
    return {
      text: '🚨 被查处！' + act.name + '——罚款 ' + (fine / 1e4).toFixed(0) + ' 万，' +
            (act.catchPenalty.criminal ? '已移交司法机关，' : '') + '公司即刻关停。游戏结束。',
      detail: act.news
    };
  }
  // 只是罚款，还能继续
  return {
    text: '⚠️ 被查处：' + act.name + '，罚款 ' + (fine / 1e4).toFixed(0) + ' 万，口碑 -45，士气 -30。',
    detail: act.news
  };
}
