/* 公司经营模拟 · 界面层 v1.0.0 2026-10-24 肥鱼 */
const $ = id => document.getElementById(id);
const money = v => {
  const w = v / 1e4;
  if (Math.abs(w) >= 10000) return (w / 10000).toFixed(2) + ' 亿';
  return w.toFixed(1) + ' 万';
};
const pct = v => (v * 100).toFixed(1) + '%';

let choiceCtx = null;   // 待选事件

function render() {
  const p = P();
  $('cash').textContent = money(G.cash);
  const _td = totalDebt();
  $('debt').textContent = money(_td);
  $('month').textContent = G.month;
  $('stores').textContent = G.stores;
  $('seg').textContent = p.icon + ' ' + p.name;
  $('rep').textContent = G.reputation.toFixed(0);
  $('morale').textContent = G.morale.toFixed(0);
  $('staff').textContent = G.staff;
  if ($('staff2')) $('staff2').textContent = G.staff;
  if ($('credit')) {
    const c = G.credit;
    $('credit').textContent = c.toFixed(0);
    $('credit').className = 'v ' + (c >= 70 ? 'good' : c >= 40 ? 'warn' : 'bad');
  }
  if ($('avail')) {
    const av = Math.max(0, creditLimit() - totalDebt());
    $('avail').textContent = money(av);
    $('avail').className = 'v' + (av < 50000 ? ' bad' : '');
  }
  if ($('monthlyPay')) {
    let mpay = 0;
    G.loans.forEach(ln => {
      const r = ln.rate / 12, n = ln.term;
      mpay += ln.principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    });
    $('monthlyPay').textContent = mpay > 0 ? money(mpay) : '无';
    $('monthlyPay').className = 'v' + (mpay > 0 ? ' warn' : '');
  }

  const stage = STAGES.find(s => G.stores >= s.minStores && G.stores <= s.maxStores) || STAGES[0];
  $('stage').textContent = stage.name;

  // 现金为负变红
  $('cash').className = G.cash < 0 ? 'v bad' : 'v';
  $('debt').className = _td > 0 ? 'v warn' : 'v';

  // 月度历史
  const tbody = $('history');
  tbody.innerHTML = G.history.slice(-12).reverse().map(l => `
    <tr>
      <td>${l.month}</td>
      <td>${money(l.revenue)}</td>
      <td class="${l.netProfit >= 0 ? 'good' : 'bad'}">${money(l.netProfit)}</td>
      <td class="${l.cashAfter >= 0 ? '' : 'bad'}">${money(l.cashAfter)}</td>
    </tr>`).join('');

  // 状态
  if (G.status === 'bankrupt') {
    $('status').innerHTML = '<div class="over">💀 公司破产</div>';
    $('btnNext').disabled = true;
    $('btnOpen').disabled = true;
  }
}

function doSettle() {
  if (G.status !== 'running') return;
  const log = settleMonth();

  // 展示本月明细
  let html = `<div class="logtitle">第 ${log.month} 个月</div>`;
  html += '<table class="detail">';
  log.items.forEach(([name, amt, kind]) => {
    if (kind === 'memo') return;
    const cls = kind === 'in' ? 'good' : 'bad';
    html += `<tr><td>${name}</td><td class="${cls}">${kind === 'in' ? '+' : '−'}${money(Math.abs(amt))}</td></tr>`;
  });
  html += `<tr class="total"><td>当月净利</td><td class="${log.netProfit >= 0 ? 'good' : 'bad'}">${money(log.netProfit)}</td></tr>`;
  html += '</table>';

  // 随机事件
  const ev = pickEvent(G, new Set(G.usedEvents));
  if (ev) {
    G.usedEvents.push(ev.id);
    html += `<div class="event"><div class="evtitle">⚠ ${ev.title}</div><div class="evtext">${ev.text}</div></div>`;
    if (ev.choice) {
      choiceCtx = ev;
      html += '<div class="choices">';
      ev.options.forEach((o, i) => {
        html += `<button class="choice" onclick="pickChoice(${i})">${o.label}</button>`;
      });
      html += '</div>';
      $('btnNext').disabled = true;
    } else {
      const eff = ev.effect(G);
      applyEffect(eff);
      html += `<div class="evresult">→ ${eff.text}</div>`;
    }
  }

  // 破产提示
  log.events.forEach(e => {
    html += `<div class="evresult ${e.type}">${e.text}</div>`;
  });

  $('log').innerHTML = html;
  render();
}

function applyEffect(eff) {
  if (eff.cash) G.cash += eff.cash;
  if (eff.reputation) G.reputation = Math.max(0, Math.min(100, G.reputation + eff.reputation));
  if (eff.morale) G.morale = Math.max(0, Math.min(100, G.morale + eff.morale));
  if (eff.revenueDelta) addMod('revenueDelta', eff.revenueDelta, eff.months || 1);
  if (eff.foodCostDelta) addMod('foodCostDelta', eff.foodCostDelta, eff.months || 1);
  if (eff.rentDelta) addMod('rentDelta', eff.rentDelta, eff.months || 999);
  if (eff.staffRateDelta) addMod('staffRateDelta', eff.staffRateDelta, eff.months || 999);
  if (eff.staffDelta) addMod('staffDelta', eff.staffDelta, eff.months || 999);
  if (eff.receivables) {
    eff.receivables.forEach(r => G.receivables.push(r));
  }
  if (G.cash < 0) G.status = 'bankrupt';
}

function pickChoice(i) {
  if (!choiceCtx) return;
  const eff = choiceCtx.options[i].effect(G);
  applyEffect(eff);
  const box = document.querySelector('.choices');
  if (box) box.outerHTML = `<div class="evresult">→ ${eff.text}</div>`;
  choiceCtx = null;
  $('btnNext').disabled = false;
  render();
}

function doOpen() {
  const r = openStore();
  $('log').innerHTML = `<div class="evresult ${r.ok ? 'good' : 'bad'}">${r.msg}</div>`;
  render();
}

/* 打开贷款面板 */
function showLoan() {
  const panel = $('loanPanel');
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  if (panel.style.display !== 'block') return;
  const limit = creditLimit();
  const debt = totalDebt();
  const avail = Math.max(0, limit - debt);
  const rate = loanRate();

  let html = `<div class="loanhead">信用评分 <b class="${G.credit >= 70 ? 'good' : G.credit >= 40 ? 'warn2' : 'bad'}">${G.credit.toFixed(0)}</b> / 100
    · 可贷余额 <b>${money(avail)}</b> · 基准利率 <b>${(G.lastRBI).toFixed(2)}%</b></div>`;

  // 已有贷款
  if (G.loans.length) {
    html += '<div class="loansub">当前贷款</div>';
    G.loans.forEach((ln, i) => {
      const r = ln.rate / 12, n = ln.term;
      const pay = ln.principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      html += `<div class="loanrow">
        <span>${ln.product} · 余 ${money(ln.remain)} · 年化 ${(ln.rate * 100).toFixed(2)}%</span>
        <span class="pay">月供 ${money(pay)}</span>
        <button class="tiny" onclick="doRepay(${i})">提前还</button>
      </div>`;
    });
  }

  // 可申请的贷款
  html += '<div class="loansub">可申请</div>';
  LOAN_PRODUCTS.forEach(prod => {
    const okCredit = G.credit >= prod.minCredit;
    const okMonth = prod.id !== 'business' || G.month >= 6;
    const okAmount = avail >= 50000;
    const disabled = !okCredit || !okMonth || !okAmount;
    let reason = '';
    if (!okCredit) reason = '信用不足（需 ' + prod.minCredit + ' 分）';
    else if (!okMonth) reason = '需经营满 6 个月';
    else if (!okAmount) reason = '可贷余额不足';

    html += `<div class="loanprod ${disabled ? 'disabled' : ''}">
      <div class="lpname">${prod.name} <span class="lpterm">${prod.term} 期</span></div>
      <div class="lpdesc">${prod.desc}</div>
      ${disabled ? `<div class="lpno">${reason}</div>` : `
        <div class="lprate">年利率 ${(rate * 100).toFixed(2)}%</div>
        <div class="lpbtns">
          ${[5, 10, 20].filter(w => w * 1e4 <= avail).map(w =>
            `<button class="tiny" onclick="doLoan('${prod.id}',${w * 1e4})">借 ${w} 万</button>`).join('')}
        </div>`}
    </div>`;
  });

  html += `<div class="loanwarn">⚠️ 利率随信用浮动：信用越低越贵。逾期一次罚息 5% 并扣 15 分信用。</div>`;
  panel.innerHTML = html;
}

function doLoan(prodId, amount) {
  const r = applyLoan(prodId, amount);
  $('log').innerHTML = `<div class="evresult ${r.ok ? 'good' : 'bad'}">${r.msg}</div>`;
  showLoan(); showLoan();   // 刷新面板
  render();
}

function doRepay(idx) {
  const ln = G.loans[idx];
  if (!ln) return;
  const r = repayLoan(idx, ln.remain);
  $('log').innerHTML = `<div class="evresult ${r.ok ? 'good' : 'bad'}">${r.msg}</div>`;
  showLoan(); showLoan();
  render();
}

function showSwitch() {
  $('switchPanel').style.display = 'block';
  const list = $('switchList');
  list.innerHTML = Object.entries(SEGMENTS).map(([k, v]) => {
    if (k === G.seg) return '';
    const prev = switchSegment(k);
    const cls = prev.ok ? '' : 'disabled';
    return `<div class="switem ${cls}">
      <div class="swname">${v.icon} ${v.name}</div>
      <div class="swdesc">${v.desc}</div>
      ${prev.ok ? `<div class="swcost">转换成本 ${money(prev.cost)} · 成功率 ${pct(prev.successRate)}</div>
      <button class="tbtn" onclick="confirmSwitch('${k}')">转做这个</button>` : `<div class="swcost bad">${prev.msg}</div>`}
    </div>`;
  }).join('');
}

function confirmSwitch(k) {
  const prev = switchSegment(k);
  if (!prev.ok) return;
  const r = executeSwitch(k, prev);
  $('switchPanel').style.display = 'none';
  $('log').innerHTML = `<div class="evresult ${r.success ? 'good' : 'bad'}">${r.msg}</div>`;
  render();
}

function startGame() {
  const seg = document.querySelector('input[name=seg]:checked').value;
  G.seg = seg;
  const p = SEGMENTS[seg];
  // 起始现金按品类调整（小店起步）
  G.cash = 900000;
  G.stores = 1;
  G.month = 0;
  G.history = [];
  G.status = 'running';
  G.mods = [];
  G.receivables = [];
  G.payables = [];
  G.reputation = 50;
  G.morale = 70;
  G.monthsNegProfit = 0;
  G.loans = [];
  G.credit = 100;
  G.overdue = 0;
  G.lastRBI = 6.0;
  G.staff = Math.max(3, Math.round(p.revenue * p.staffRate / 6000 / 10));
  $('setup').style.display = 'none';
  $('game').style.display = 'block';
  render();
  $('log').innerHTML = `<div class="evresult good">开局：一家${p.name}店，现金 ${money(G.cash)}，员工 ${G.staff} 人。<br>真实基准：${p.realData}</div>`;
}
