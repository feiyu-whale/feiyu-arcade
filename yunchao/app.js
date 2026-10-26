/* ============================================================
   云巢电竞 · 公共逻辑
   ============================================================ */

const YCApp = {
  state: null,

  init() {
    // 只有第一次才从 localStorage 读；之后复用同一个引用，
    // 否则页面拿到的 S 和 this.state 是两份对象，save() 会存回旧数据
    if (!this.state) this.state = YCStore.load();
    this.renderRoleBar();
    this.renderWallet();
    return this.state;
  },

  save() {
    YCStore.save(this.state);
    this.renderWallet();
  },

  /* ---------- 角色切换 ---------- */
  renderRoleBar() {
    const bar = document.getElementById('rolebar');
    if (!bar) return;
    const roles = [
      { k: 'boss',   n: '👤 老板' },
      { k: 'worker', n: '🎮 打手' },
      { k: 'admin',  n: '🛡️ 管理员' }
    ];
    bar.innerHTML = roles.map(r =>
      `<button class="${this.state.role === r.k ? 'on' : ''}" data-role="${r.k}">${r.n}</button>`
    ).join('');
    bar.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        this.state.role = b.dataset.role;
        this.save();
        location.reload();
      };
    });
  },

  /* ---------- 钱包 ---------- */
  renderWallet() {
    const el = document.getElementById('wallet');
    if (!el) return;
    if (this.state.role === 'boss') {
      el.innerHTML = `🍚 <b>${Number(this.state.baofan).toLocaleString('zh-CN')}</b>`;
    } else if (this.state.role === 'worker') {
      const w = YC.WORKERS.find(x => x.id === this.state.workerId);
      el.innerHTML = `⭐ <b>${YCUtil.creditOf(this.state, this.state.workerId)}</b> 信用`;
      if (w) el.title = w.name;
    } else {
      el.innerHTML = `🛡️ <b>管理员</b>`;
    }
  },

  /* ---------- 提示 ---------- */
  toast(msg, isErr) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const d = document.createElement('div');
    d.className = 'toast' + (isErr ? ' err' : '');
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2200);
  },

  /* ---------- 底部导航 ---------- */
  renderTabbar(active) {
    const el = document.getElementById('tabbar');
    if (!el) return;
    const role = this.state.role;
    let items;
    if (role === 'boss') {
      items = [
        { k: 'index',  i: '🏠', n: '首页',   href: 'index.html' },
        { k: 'orders', i: '📋', n: '我的订单', href: 'orders.html' },
        { k: 'report', i: '🚨', n: '举报',   href: 'report.html' },
        { k: 'me',     i: '👤', n: '我的',   href: 'me.html' }
      ];
    } else if (role === 'worker') {
      items = [
        { k: 'worker', i: '🎮', n: '接单台', href: 'worker.html' },
        { k: 'orders', i: '📋', n: '订单',   href: 'orders.html' },
        { k: 'me',     i: '👤', n: '我的',   href: 'me.html' }
      ];
    } else {
      items = [
        { k: 'admin',  i: '🛡️', n: '后台',   href: 'admin.html' },
        { k: 'orders', i: '📋', n: '订单',   href: 'orders.html' },
        { k: 'me',     i: '👤', n: '我的',   href: 'me.html' }
      ];
    }
    el.innerHTML = items.map(x =>
      `<a href="${x.href}" class="${active === x.k ? 'on' : ''}">
         <span class="ti">${x.i}</span>${x.n}
       </a>`
    ).join('');
  },

  /* ---------- 权限守卫 ---------- */
  guard(allow) {
    if (!allow.includes(this.state.role)) {
      document.body.innerHTML =
        `<div class="empty" style="padding-top:120px">
           <span class="icon">🚫</span>
           当前身份（${this.state.role}）无法访问此页面<br><br>
           <a href="index.html" class="btn" style="display:inline-block;margin-top:10px">回到首页</a>
         </div>`;
      return false;
    }
    return true;
  },

  /* ---------- 弹层 ---------- */
  modal(title, bodyHtml, actions) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `<div class="modal">
      <h3>${title}</h3>
      ${bodyHtml}
      <div class="modal-foot"></div>
    </div>`;
    const foot = mask.querySelector('.modal-foot');
    (actions || [{ t: '关闭', cls: 'btn-ghost' }]).forEach(a => {
      const b = document.createElement('button');
      b.className = a.cls || 'btn';
      b.textContent = a.t;
      b.onclick = () => {
        if (a.fn && a.fn() === false) return;
        mask.remove();
      };
      foot.appendChild(b);
    });
    mask.onclick = e => { if (e.target === mask) mask.remove(); };
    document.body.appendChild(mask);
    return mask;
  }
};

/* 演示横幅自动插入 */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('.demo-banner')) {
    const b = document.createElement('div');
    b.className = 'demo-banner';
    b.textContent = '演示系统 · 无真实交易 · 白饭为虚拟积分，不可充值/提现/转让';
    document.body.insertBefore(b, document.body.firstChild);
  }
  YCApp.init();
  if (document.getElementById('tabbar')) {
    YCApp.renderTabbar(document.body.dataset.tab || '');
  }
});

/* 挂到 window，供各页面内联脚本使用 */
window.YCApp = YCApp;
