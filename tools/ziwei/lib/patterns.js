/**
 * 格局识别（移植自 Renhuai123/ziwei-doushu patterns.ts）
 *
 * 输入：排盘结果 chart（由 buildChart 从 iztro 的盘转换而来）
 * 输出：识别出的格局列表（含等级、说明、古籍出处）
 *
 * chart 结构：
 *   { mingGongBranch: number, shenGongBranch: number,
 *     palaces: [{ branch, name, stars: [{name, type}] }] }
 *   branch 0=子 1=丑 … 11=亥
 *   star.type: major(主星) / minor(辅星) / lucky(吉星) / sha(煞星)
 */
(function (root) {
  'use strict';

  var SHA_NAMES = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
  var SHA_HARD = ['擎羊', '陀罗', '火星', '铃星'];
  var SHA_KONG = ['地空', '地劫'];
  var ZUO_YOU = ['左辅', '右弼'];
  var CHANG_QU = ['文昌', '文曲'];
  var KUI_YUE = ['天魁', '天钺'];

  var mod12 = function (b) { return ((b % 12) + 12) % 12; };

  function getMajorStarNames(p) {
    return p.stars.filter(function (s) { return s.type === 'major'; }).map(function (s) { return s.name; });
  }
  function hasStar(p, n) {
    return p.stars.some(function (s) { return s.name === n; });
  }
  function hasAny(p, arr) {
    return arr.some(function (n) { return hasStar(p, n); });
  }
  function countAny(p, arr) {
    return arr.filter(function (n) { return hasStar(p, n); }).length;
  }
  function findStarPalace(chart, name) {
    for (var i = 0; i < chart.palaces.length; i++) {
      if (chart.palaces[i].stars.some(function (s) { return s.name === name; })) return chart.palaces[i];
    }
    return null;
  }
  function getPalaceByBranch(chart, branch) {
    var b = mod12(branch);
    for (var i = 0; i < chart.palaces.length; i++) if (chart.palaces[i].branch === b) return chart.palaces[i];
    return null;
  }
  function getMing(chart) { return getPalaceByBranch(chart, chart.mingGongBranch); }

  /** 三方四正：本宫 + 对宫 + 两个三合宫 */
  function sanFangSiZheng(chart, branch) {
    var b = mod12(branch);
    var list = [b, mod12(b + 4), mod12(b + 6), mod12(b + 8)];
    var out = [];
    list.forEach(function (x) {
      var p = getPalaceByBranch(chart, x);
      if (p) out.push(p);
    });
    return out;
  }
  function starsIn(palaces) {
    var out = [];
    palaces.forEach(function (p) {
      p.stars.forEach(function (s) { out.push(s.name); });
    });
    return out;
  }
  function hasAnyIn(palaces, arr) {
    var all = starsIn(palaces);
    return arr.some(function (n) { return all.indexOf(n) >= 0; });
  }
  function countAnyIn(palaces, arr) {
    var all = starsIn(palaces);
    return arr.filter(function (n) { return all.indexOf(n) >= 0; }).length;
  }

  function mk(name, level, desc, palaces, source) {
    return { name: name, level: level, description: desc, palaces: palaces || [], source: source || '' };
  }

  // ── 上格 ──────────────────────────────────────────────
  function junChenQingHui(chart, ming, out) {
    if (!ming) return;
    var tianji = findStarPalace(chart, '天机');
    var tianliang = findStarPalace(chart, '天梁');
    var zuofu = findStarPalace(chart, '左辅');
    var youbi = findStarPalace(chart, '右弼');
    var shi = hasStar(ming, '紫微') || hasStar(ming, '天府');
    if (shi && tianji && tianliang && (zuofu || youbi)) {
      out.push(mk('君臣庆会格', 'excellent',
        '紫微/天府坐命，天机天梁同会，辅弼相助。主得贵人扶持，事业有成，宜从政或掌权之职。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function ziFu(chart, ming, out) {
    if (!ming) return;
    if (hasStar(ming, '紫微') && hasStar(ming, '天府')) {
      out.push(mk('紫府同宫格', 'excellent',
        '紫微天府同守命宫。帝星与库星相会，主一生富贵双全，气度宽宏，能容人，亦能聚财。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function fuXiangChaoYuan(chart, ming, out) {
    if (!ming) return;
    var mingHas = getMajorStarNames(ming);
    var dui = getPalaceByBranch(chart, mod12(ming.branch + 6));
    var duiHas = dui ? getMajorStarNames(dui) : [];
    var fuOk = (mingHas.indexOf('天府') >= 0 && duiHas.indexOf('天相') >= 0);
    var xiangOk = (mingHas.indexOf('天相') >= 0 && duiHas.indexOf('天府') >= 0);
    if (fuOk || xiangOk) {
      out.push(mk('府相朝垣格', 'excellent',
        '天府天相在三方拱照命宫。主为人稳重踏实，得人敬重，适合管理、财务、行政之职。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function yangLiangChangLu(chart, ming, out) {
    if (!ming) return;
    var sz = sanFangSiZheng(chart, ming.branch);
    if (hasStar(ming, '天梁') && hasAnyIn(sz, ['文昌']) && hasAnyIn(sz, ['禄存', '化禄'])) {
      out.push(mk('阳梁昌禄格', 'excellent',
        '天梁坐命，文昌与禄存/化禄会照。主聪明好学，考试顺遂，宜文教、学术、公务。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function huoTanLingTan(chart, ming, out) {
    if (!ming) return;
    var c = countAny(ming, ['火星', '铃星', '擎羊', '陀罗']);
    if (c >= 2) {
      out.push(mk('火铃夹命格', 'caution',
        '命宫同见火星铃星（或羊陀）。主性情急躁，行事冲动，易有突发变故，宜修心养性。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function wuTan(chart, ming, out) {
    if (!ming) return;
    var sz = sanFangSiZheng(chart, ming.branch);
    if (hasStar(ming, '武曲') && hasAnyIn(sz, ['贪狼'])) {
      out.push(mk('武贪格', 'good',
        '武曲贪狼同会命宫。主先贫后富，中年发迹，宜经商或技术兴业，忌少年得志。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function shaPoLang(chart, ming, out) {
    if (!ming) return;
    var sz = sanFangSiZheng(chart, ming.branch);
    var c = countAnyIn(sz, ['七杀', '破军', '贪狼']);
    if (c >= 2) {
      out.push(mk('杀破狼格', 'good',
        '七杀、破军、贪狼三星于三方会照。主一生变动大，宜开拓创新、武职或创业，忌守成。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function jiYueTongLiang(chart, ming, out) {
    if (!ming) return;
    var sz = sanFangSiZheng(chart, ming.branch);
    var c = countAnyIn(sz, ['天机', '太阴', '天同', '天梁']);
    if (c >= 2 && hasAnyIn(sz, ['天机'])) {
      out.push(mk('机月同梁格', 'good',
        '天机太阴天同天梁会照命宫。主心思细腻，宜公职、文教、企划，凡事按部就班则吉。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  // ── 中格 ──────────────────────────────────────────────
  function lianXiang(chart, out) {
    var lian = findStarPalace(chart, '廉贞');
    var xiang = findStarPalace(chart, '天相');
    if (lian && xiang && lian.branch === xiang.branch) {
      out.push(mk('廉相格', 'good',
        '廉贞天相同宫。主为人有原则，重情义，宜政法、公职，忌从小处争利。',
        [lian.name], '《紫微斗数全书》'));
    }
  }

  function wuQiSha(chart, out) {
    var wu = findStarPalace(chart, '武曲');
    var qi = findStarPalace(chart, '七杀');
    if (wu && qi && wu.branch === qi.branch) {
      out.push(mk('武曲七杀格', 'good',
        '武曲七杀同宫。主果决刚毅，能吃苦，宜技术、军警、创业，忌优柔寡断。',
        [wu.name], '《紫微斗数全书》'));
    }
  }

  function tongLiang(chart, out) {
    var tong = findStarPalace(chart, '天同');
    var liang = findStarPalace(chart, '天梁');
    if (tong && liang && tong.branch === liang.branch) {
      out.push(mk('同梁格', 'good',
        '天同天梁同宫。主温和有福，宜文职、教育、服务，忌懒散。',
        [tong.name], '《紫微斗数全书》'));
    }
  }

  function riYueTongGong(chart, out) {
    var ri = findStarPalace(chart, '太阳');
    var yue = findStarPalace(chart, '太阴');
    if (ri && yue && ri.branch === yue.branch) {
      out.push(mk('日月同宫格', 'neutral',
        '太阳太阴同宫。主阴阳调和但亦主心思反复，宜修身定志，忌三心二意。',
        [ri.name], '《紫微斗数全书》'));
    }
  }

  function riYueJiaMing(chart, out) {
    var ming = getMing(chart);
    if (!ming) return;
    var ri = findStarPalace(chart, '太阳');
    var yue = findStarPalace(chart, '太阴');
    if (!ri || !yue) return;
    var b = ming.branch;
    var adj = [mod12(b - 1), mod12(b + 1)];
    if (adj.indexOf(ri.branch) >= 0 && adj.indexOf(yue.branch) >= 0) {
      out.push(mk('日月夹命格', 'good',
        '太阳太阴夹命宫。主得父母或长辈双向扶持，一生少大凶。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function juRiTongGong(chart, out) {
    var ju = findStarPalace(chart, '巨门');
    var ri = findStarPalace(chart, '太阳');
    if (ju && ri && ju.branch === ri.branch) {
      out.push(mk('巨日同宫格', 'neutral',
        '巨门太阳同宫。主口才佳但易招是非，宜以言立业，忌口舌争胜。',
        [ju.name], '《紫微斗数全书》'));
    }
  }

  function shiZhongYinYu(chart, ming, out) {
    if (!ming) return;
    if (hasStar(ming, '巨门') && hasAny(ming, ['天刑', '陀罗'])) {
      out.push(mk('石中隐玉格', 'neutral',
        '巨门坐命逢刑陀。主早年辛劳，才华为环境所掩，中年后方显。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function mingZhuChuHai(chart, ming, out) {
    if (!ming) return;
    if (hasStar(ming, '天同') && hasAny(ming, SHA_NAMES)) {
      out.push(mk('明珠出海格', 'neutral',
        '天同坐命逢煞。主心性善良但易受挫，宜远离是非之地，遇贵人则转吉。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function ziWeiInMing(chart, ming, out) {
    if (!ming) return;
    if (hasStar(ming, '紫微')) {
      out.push(mk('紫微入命格', 'good',
        '紫微帝星坐命。主气度不凡，有领导力，宜掌权任事，忌孤高自傲。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  // ── 助力格 ────────────────────────────────────────────
  function fuBiJiaMing(chart, ming, out) {
    if (!ming) return;
    var zuo = findStarPalace(chart, '左辅');
    var you = findStarPalace(chart, '右弼');
    if (!zuo || !you) return;
    var adj = [mod12(ming.branch - 1), mod12(ming.branch + 1)];
    if (adj.indexOf(zuo.branch) >= 0 && adj.indexOf(you.branch) >= 0) {
      out.push(mk('辅弼夹命格', 'excellent',
        '左辅右弼夹命宫。主一生多得助力，遇难有贵人，宜团队合作。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function changQuJiaMing(chart, ming, out) {
    if (!ming) return;
    var c = findStarPalace(chart, '文昌');
    var q = findStarPalace(chart, '文曲');
    if (!c || !q) return;
    var adj = [mod12(ming.branch - 1), mod12(ming.branch + 1)];
    if (adj.indexOf(c.branch) >= 0 && adj.indexOf(q.branch) >= 0) {
      out.push(mk('昌曲夹命格', 'good',
        '文昌文曲夹命宫。主聪明有文采，宜学术、文书、考试，一生近贵。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function kuiYueJiaMing(chart, ming, out) {
    if (!ming) return;
    var k = findStarPalace(chart, '天魁');
    var y = findStarPalace(chart, '天钺');
    if (!k || !y) return;
    var adj = [mod12(ming.branch - 1), mod12(ming.branch + 1)];
    if (adj.indexOf(k.branch) >= 0 && adj.indexOf(y.branch) >= 0) {
      out.push(mk('魁钺夹命格', 'excellent',
        '天魁天钺夹命宫。主逢凶化吉，一生多得提携，科名顺遂。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function shuangLuChaoYuan(chart, ming, out) {
    if (!ming) return;
    var sz = sanFangSiZheng(chart, ming.branch);
    var n = 0;
    sz.forEach(function (p) {
      p.stars.forEach(function (s) { if (s.siHua === '禄') n++; });
    });
    if (hasStar(ming, '禄存')) n++;
    if (n >= 2) {
      out.push(mk('双禄朝垣格', 'excellent',
        '两重禄星会照命宫。主财源广进，衣食无缺，宜理财经营。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function sanQiJiaHui(chart, ming, out) {
    if (!ming) return;
    var sz = sanFangSiZheng(chart, ming.branch);
    var c = 0;
    sz.forEach(function (p) {
      p.stars.forEach(function (s) { if (s.siHua === '禄' || s.siHua === '权' || s.siHua === '科') c++; });
    });
    if (c >= 3) {
      out.push(mk('三奇加会格', 'excellent',
        '禄权科三奇会照命宫。主一生顺遂，名利双收，格局清贵。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function huaLuRuMing(chart, ming, out) {
    if (!ming) return;
    var has = ming.stars.some(function (s) {
      return s.siHua === '禄' && s.type === 'major';
    });
    if (has) {
      out.push(mk('化禄入命格', 'good',
        '主星化禄入命宫。主一生衣食丰足，人缘佳，善经营。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  // ── 恶格 ──────────────────────────────────────────────
  function huaJiRuMingQian(chart, ming, out) {
    if (!ming) return;
    var qian = getPalaceByBranch(chart, mod12(ming.branch + 6));
    var inMing = ming.stars.some(function (s) { return s.siHua === '忌'; });
    var inQian = qian && qian.stars.some(function (s) { return s.siHua === '忌'; });
    if (inMing || inQian) {
      out.push(mk('化忌入命/迁格', 'caution',
        '化忌落命宫或迁移宫。主一生多阻滞，宜守不宜攻，忌恃强冒进。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function yangTuoJiaJi(chart, ming, out) {
    if (!ming) return;
    if (hasAny(ming, ['擎羊', '陀罗']) && ming.stars.some(function (s) { return s.siHua === '忌'; })) {
      out.push(mk('羊陀夹忌格', 'caution',
        '羊陀与化忌同缠命宫。主刑伤破耗，宜修身避祸，忌贪快钱。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function huoLingJiaMing(chart, ming, out) {
    if (!ming) return;
    if (hasAny(ming, ['火星', '铃星'])) {
      out.push(mk('火铃入命格', 'caution',
        '火星或铃星入命宫。主性急易怒，行事突变，宜修心养性，忌冲动决策。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function kongJieJiaMing(chart, ming, out) {
    if (!ming) return;
    var c = countAny(ming, SHA_KONG);
    if (c >= 1) {
      out.push(mk('空劫入命格', 'caution',
        '地空地劫入命宫。主钱财易散，宜务实不宜投机，学玄学宗教反有缘。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function lianShaYang(chart, out) {
    var lian = findStarPalace(chart, '廉贞');
    if (!lian) return;
    var c = countAny(lian, ['擎羊', '陀罗', '火星', '铃星']);
    if (c >= 1 && hasStar(lian, '廉贞')) {
      out.push(mk('廉贞逢煞格', 'caution',
        '廉贞与煞星同宫。主性情刚烈，易生是非官非，宜守法守分。',
        [lian.name], '《紫微斗数全书》'));
    }
  }

  function juHuoYang(chart, out) {
    var ju = findStarPalace(chart, '巨门');
    if (!ju) return;
    if (hasAny(ju, ['火星', '擎羊'])) {
      out.push(mk('巨火羊格', 'caution',
        '巨门逢火羊。主口舌是非极重，易招官非，宜慎言。',
        [ju.name], '《紫微斗数全书》'));
    }
  }

  function lingChangTuoWu(chart, out) {
    var ling = findStarPalace(chart, '铃星');
    var chang = findStarPalace(chart, '文昌');
    var tuo = findStarPalace(chart, '陀罗');
    var wu = findStarPalace(chart, '武曲');
    if (ling && (chang || tuo || wu)) {
      out.push(mk('铃昌陀武格', 'caution',
        '铃星会昌陀武。古书云主意外之灾，宜谨慎行事，忌涉险地。',
        [ling.name], '《紫微斗数全书》'));
    }
  }

  function maTouDaiJian(chart, ming, out) {
    var ma = findStarPalace(chart, '天马');
    if (!ma) return;
    var c = countAny(ma, SHA_KONG);
    if (c >= 1) {
      out.push(mk('马头带箭格', 'neutral',
        '天马逢空劫。主奔波劳碌，宜动中求财，忌盲目远行。',
        [ma.name], '《紫微斗数全书》'));
    }
  }

  // ── 基础格局（提升覆盖率）──────────────────────────────
  function luCunShouShen(chart, out) {
    var lu = findStarPalace(chart, '禄存');
    if (lu && chart.shenGongBranch !== undefined && lu.branch === chart.shenGongBranch) {
      out.push(mk('禄存守身格', 'good',
        '禄存坐身宫。主晚年安定，衣食不缺，宜稳健理财。',
        [lu.name], '《紫微斗数全书》'));
    }
  }

  function tianMaRuMing(chart, ming, out) {
    if (!ming) return;
    if (hasStar(ming, '天马')) {
      out.push(mk('天马入命格', 'good',
        '天马入命宫。主一生多变，宜外出发展、贸易运输，忌原地守成。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function huaLuRuCai(chart, out) {
    var cai = null;
    chart.palaces.forEach(function (p) { if (p.name === '财帛') cai = p; });
    if (cai && cai.stars.some(function (s) { return s.siHua === '禄'; })) {
      out.push(mk('化禄入财帛格', 'good',
        '化禄入财帛宫。主财源顺遂，宜经营理财。',
        [cai.name], '《紫微斗数全书》'));
    }
  }

  function huaQuanRuGuan(chart, out) {
    var guan = null;
    chart.palaces.forEach(function (p) { if (p.name === '官禄') guan = p; });
    if (guan && guan.stars.some(function (s) { return s.siHua === '权'; })) {
      out.push(mk('化权入官禄格', 'good',
        '化权入官禄宫。主事业心强，能掌权任事，宜管理职位。',
        [guan.name], '《紫微斗数全书》'));
    }
  }

  function huaKeRuMingShen(chart, ming, out) {
    if (!ming) return;
    var shen = getPalaceByBranch(chart, chart.shenGongBranch);
    var ok = ming.stars.some(function (s) { return s.siHua === '科'; });
    if (shen) ok = ok || shen.stars.some(function (s) { return s.siHua === '科'; });
    if (ok) {
      out.push(mk('化科入命身格', 'good',
        '化科入命宫或身宫。主一生有声誉，宜学术文教，得人尊重。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function jiYueTongLiangPartial(chart, ming, out) {
    if (!ming) return;
    var sz = sanFangSiZheng(chart, ming.branch);
    var c = countAnyIn(sz, ['天机', '太阴', '天同', '天梁']);
    if (c === 2) {
      out.push(mk('机月同梁·半格', 'neutral',
        '四星中两星会照。主思路清晰，适合技术、企划，宜稳扎稳打。',
        [ming.name], '《紫微斗数全书》'));
    }
  }

  function changQuTongHui(chart, out) {
    var c;

    c = countAnyIn(chart.palaces, CHANG_QU);
    if (c >= 2) {
      out.push(mk('昌曲同会格', 'good',
        '文昌文曲同现盘中。主聪明有文采，宜考试、文书、学术。',
        [], '《紫微斗数全书》'));
    }
  }

  function fuBiTongHui(chart, out) {
    if (countAnyIn(chart.palaces, ZUO_YOU) >= 2) {
      out.push(mk('辅弼同会格', 'good',
        '左辅右弼同现盘中。主得人助力，宜团队协作、领导统御。',
        [], '《紫微斗数全书》'));
    }
  }

  function kuiYueTongHui(chart, out) {
    if (countAnyIn(chart.palaces, KUI_YUE) >= 2) {
      out.push(mk('魁钺同会格', 'good',
        '天魁天钺同现盘中。主一生多得贵人提携，遇难呈祥。',
        [], '《紫微斗数全书》'));
    }
  }

  function keQuanShuangHui(chart, out) {
    var n = 0;
    chart.palaces.forEach(function (p) {
      p.stars.forEach(function (s) { if (s.siHua === '科' || s.siHua === '权') n++; });
    });
    if (n >= 2) {
      out.push(mk('科权双会格', 'good',
        '科权双星会照。主名利兼顾，宜专业领域扬名。',
        [], '《紫微斗数全书》'));
    }
  }

  /** 主入口：识别全部格局 */
  function detectPatterns(chart) {
    var out = [];
    if (!chart || !chart.palaces) return out;
    var ming = getMing(chart);
    if (!ming) return out;

    junChenQingHui(chart, ming, out);
    ziFu(chart, ming, out);
    fuXiangChaoYuan(chart, ming, out);
    yangLiangChangLu(chart, ming, out);
    huoTanLingTan(chart, ming, out);
    wuTan(chart, ming, out);
    shaPoLang(chart, ming, out);
    jiYueTongLiang(chart, ming, out);

    lianXiang(chart, out);
    wuQiSha(chart, out);
    tongLiang(chart, out);
    riYueTongGong(chart, out);
    riYueJiaMing(chart, out);
    juRiTongGong(chart, out);
    shiZhongYinYu(chart, ming, out);
    mingZhuChuHai(chart, ming, out);
    ziWeiInMing(chart, ming, out);

    fuBiJiaMing(chart, ming, out);
    changQuJiaMing(chart, ming, out);
    kuiYueJiaMing(chart, ming, out);
    shuangLuChaoYuan(chart, ming, out);
    sanQiJiaHui(chart, ming, out);
    huaLuRuMing(chart, ming, out);

    huaJiRuMingQian(chart, ming, out);
    yangTuoJiaJi(chart, ming, out);
    huoLingJiaMing(chart, ming, out);
    kongJieJiaMing(chart, ming, out);
    lianShaYang(chart, out);
    juHuoYang(chart, out);
    lingChangTuoWu(chart, out);
    maTouDaiJian(chart, ming, out);

    luCunShouShen(chart, out);
    tianMaRuMing(chart, ming, out);
    huaLuRuCai(chart, out);
    huaQuanRuGuan(chart, out);
    huaKeRuMingShen(chart, ming, out);
    jiYueTongLiangPartial(chart, ming, out);
    changQuTongHui(chart, out);
    fuBiTongHui(chart, out);
    kuiYueTongHui(chart, out);
    keQuanShuangHui(chart, out);

    // 去重（同名只留一个）
    var seen = {};
    return out.filter(function (p) {
      if (seen[p.name]) return false;
      seen[p.name] = 1;
      return true;
    });
  }

  root.ZW = root.ZW || {};
  root.ZW.patterns = { detectPatterns: detectPatterns };
})(window);
