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
  $('debt').textContent = money(G.debt);
  $('month').textContent = G.month;
  $('stores').textContent = G.stores;
  $('seg').textContent = p.icon + ' ' + p.name;
  $('rep').textContent = G.reputation.toFixed(0);
  $('morale').textContent = G.morale.toFixed(0);
  $('staff').textContent = G.staff;

  const stage = STAGES.find(s => G.stores >= s.minStores && G.stores <= s.maxStores) || STAGES[0];
  $('stage').textContent = stage.name;

  // 现金为负变红
  $('cash').className = G.cash < 0 ? 'v bad' : 'v';
  $('debt').className = G.debt > 0 ? 'v warn' : 'v';

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

function doBorrow() {
  const r = borrow(200000);
  $('log').innerHTML = `<div class="evresult ${r.ok ? 'good' : 'bad'}">${r.msg}</div>`;
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
  G.debt = 0;
  G.staff = Math.max(3, Math.round(p.revenue * p.staffRate / 6000 / 10));
  $('setup').style.display = 'none';
  $('game').style.display = 'block';
  render();
  $('log').innerHTML = `<div class="evresult good">开局：一家${p.name}店，现金 ${money(G.cash)}，员工 ${G.staff} 人。<br>真实基准：${p.realData}</div>`;
}
