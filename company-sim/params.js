/* 公司经营模拟 · 行业参数（全部来自真实财报）
 * 数据源：东方财富 datacenter 接口，15 家上市公司年报
 * 生成时间：2026-10-24  作者：肥鱼
 * 口径说明见 docs/01-数据基准与参数换算.md
 */
const SEGMENTS = {
  zhengcan: {
    name: '正餐', icon: '🍽️',
    desc: '家常菜 / 地方菜 / 老字号',
    // 单店基准（月）
    revenue: 600000,          // 月营收 60 万
    foodCostRate: 0.42,       // 食材 42%
    staffRate: 0.30,          // 人工 30%
    rentFixed: 120000,        // 固定房租：200㎡ 商圈月租 12 万
    utilFixed: 24000,         // 固定水电 2.4 万
    miscRate: 0.03,           // 杂费 3%
    setupCost: 1200000,       // 开店投入 120 万
    arDays: 7,                // 应收账期
    apDays: 45,               // 应付账期
    invDays: 10,              // 存货天数
    volatility: 0.18,         // 营收波动率（正餐最不稳）
    realData: '全聚德17.0%毛利/39.6%人工 · 同庆楼19.3%/27.0% · 西安饮食-0.9%/44.3%',
    difficulty: '★★★☆☆'
  },
  huoguo: {
    name: '火锅', icon: '🍲',
    desc: '火锅 / 川渝 / 潮汕',
    revenue: 800000,
    foodCostRate: 0.40,
    staffRate: 0.33,
    rentFixed: 96000,         // 固定房租 9.6 万
    utilFixed: 40000,         // 火锅耗能高，固定水电 4 万
    miscRate: 0.04,
    setupCost: 1500000,
    arDays: 3,
    apDays: 40,
    invDays: 8,
    volatility: 0.12,
    realData: '海底捞59.5%毛利/32.6%人工 · 呷哺65.0%/34.8% · 九毛九64.5%/29.5%',
    difficulty: '★★☆☆☆'
  },
  kuaican: {
    name: '快餐', icon: '🍔',
    desc: '中式快餐 / 西式连锁',
    revenue: 400000,
    foodCostRate: 0.35,
    staffRate: 0.18,
    rentFixed: 48000,         // 固定房租 4.8 万
    utilFixed: 16000,         // 固定水电 1.6 万
    miscRate: 0.04,
    setupCost: 800000,
    arDays: 3,
    apDays: 35,
    invDays: 5,
    volatility: 0.10,
    realData: '百胜中国21.7%集团毛利/8.5%净利 · 食材成本单店约35%',
    difficulty: '★★☆☆☆'
  },
  chayin: {
    name: '茶饮', icon: '🧋',
    desc: '奶茶 / 果茶 / 加盟模式',
    revenue: 80000,
    foodCostRate: 0.50,
    staffRate: 0.1125,
    rentFixed: 15000,         // 小店固定房租 1.5 万
    utilFixed: 3000,          // 固定水电 0.3 万
    miscRate: 0.00,
    setupCost: 350000,     // 加盟费+保证金+装修
    arDays: 15,
    apDays: 40,
    invDays: 15,
    volatility: 0.15,
    realData: '蜜雪31.1%毛利/17.7%净利 · 古茗33.0%/24.1% · 茶百道32.5%/15.2%',
    difficulty: '★☆☆☆☆'
  }
};

/* 规模阶段：不可复用比例 + 转换成本系数 */
const STAGES = [
  { id: 0, name: '小店',     minStores: 1,  maxStores: 1,   headcount: '1-5',    nonReuse: 0.20 },
  { id: 1, name: '多店',     minStores: 2,  maxStores: 5,   headcount: '10-50',  nonReuse: 0.45 },
  { id: 2, name: '区域公司', minStores: 6,  maxStores: 20,  headcount: '100-500',nonReuse: 0.70 },
  { id: 3, name: '上市',     minStores: 21, maxStores: 999, headcount: '500+',   nonReuse: 0.90 }
];

/* 换赛道折损率（按品类相似度） */
function similarityLoss(fromSeg, toSeg) {
  const same = fromSeg === toSeg;
  if (same) return 0;
  const pairs = {
    'zhengcan-huoguo': 0.25, 'huoguo-zhengcan': 0.25,
    'zhengcan-kuaican': 0.50, 'kuaican-zhengcan': 0.50,
    'huoguo-kuaican': 0.50, 'kuaican-huoguo': 0.50,
    'chayin-kuaican': 0.45, 'kuaican-chayin': 0.45,
    'chayin-huoguo': 0.60, 'huoguo-chayin': 0.60,
    'zhengcan-chayin': 0.65, 'chayin-zhengcan': 0.65
  };
  return pairs[fromSeg + '-' + toSeg] || 0.55;
}

const BASE_SUCCESS = {
  same: 0.70, similar: 0.55, cross: 0.35
};
