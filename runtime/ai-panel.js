/* ai-panel.js — the "AI 设置" box at the bottom of the import page (standalone build only).
 *
 * Shows how much of the free trial is left, and lets a visitor switch to their own API key.
 * The page calls window.CR_AI.mount(el) every time it re-renders the import view; this file
 * owns everything inside that element. Depends on window.CR_AI from local-runtime.js.
 */
(() => {
  const A = window.CR_AI;
  if (!A) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = `
  .crai{margin-top:28px;padding:18px 20px;border:1px solid var(--rule,#bfc6be);border-radius:6px;background:var(--sheet,#fff);font:400 14px/1.6 var(--f-zh,serif);color:var(--ink,#14181b)}
  .crai h3{margin:0 0 6px;font:600 15px var(--f-zh,serif)}
  .crai .q{margin:0 0 12px;color:var(--ink-2,#434d55)}
  .crai .q b{color:var(--pencil,#2340b0);font-weight:600}
  .crai details{margin-top:4px}
  .crai summary{cursor:pointer;color:var(--pencil,#2340b0);width:max-content;max-width:100%}
  .crai .row{display:grid;gap:10px;margin-top:12px}
  .crai label{display:grid;gap:4px;font-size:13px;color:var(--ink-2,#434d55)}
  .crai input,.crai select{font:400 14px var(--f-zh,serif);padding:8px 10px;border:1px solid var(--rule,#bfc6be);border-radius:4px;background:var(--paper,#fff);color:var(--ink,#14181b);width:100%;box-sizing:border-box}
  .crai .hint{font-size:12px;color:var(--ink-3,#77828a)}
  .crai .btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}
  .crai .note{font-size:12px;color:var(--ink-3,#77828a);margin:12px 0 0}
  .crai .msg{font-size:13px;margin:8px 0 0;color:var(--ok,#1d7548)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  let box = null, msg = '';

  function quotaLine() {
    const c = A.get(), q = A.quota();
    if (c) {
      const p = A.providers.find(x => x.id === c.provider);
      return `正在使用<b>你自己的 ${esc(p ? p.name : c.provider)} Key</b>，不占免费额度，费用由你的账户承担。`;
    }
    if (q.enabled === false) return '免费试用暂时没有开放。可以在下面填入你自己的 API Key 使用 AI 功能。';
    if (q.importsLeft == null) return '正在查询免费额度…';
    if (!q.importsLeft && !q.smallLeft) return '免费试用已经用完了。在下面填入你自己的 API Key 就能继续使用。';
    return `免费试用剩余：文章导入 <b>${q.importsLeft}</b> 篇 · 查词释义、讲解、翻译批改 <b>${q.smallLeft}</b> 次。用完后可以填入自己的 API Key 继续用。`;
  }

  function html() {
    const c = A.get() || {};
    const prov = c.provider || 'deepseek';
    const P = A.providers.find(x => x.id === prov) || A.providers[0];
    return `<section class="crai" aria-label="AI 设置">
      <h3>AI 设置</h3>
      <p class="q">${quotaLine()}</p>
      <details ${A.get() ? 'open' : ''}><summary>${A.get() ? '修改我的 API Key' : '使用我自己的 API Key'}</summary>
        <div class="row">
          <label>平台<select id="crAiProv">${A.providers.map(p => `<option value="${p.id}" ${p.id === prov ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
          <label>模型<input id="crAiModel" type="text" autocomplete="off" spellcheck="false" value="${esc(c.model || '')}" placeholder="${esc(P.model || '模型名')}"><span class="hint" id="crAiHint">${esc(P.hint)}</span></label>
          <label>API Key<input id="crAiKey" type="password" autocomplete="off" spellcheck="false" value="${esc(c.key || '')}" placeholder="sk-…"></label>
          <div class="btns"><button type="button" class="pbtn primary" id="crAiSave">保存</button>${A.get() ? '<button type="button" class="pbtn ghost" id="crAiClear">清除，改回免费试用</button>' : ''}</div>
          ${msg ? `<p class="msg">${esc(msg)}</p>` : ''}
          <p class="note">Key 只保存在这台设备的浏览器里。每次调用时经本站接口转发给你选的平台，本站不会保存或记录它。换浏览器或清除网站数据后需要重新填写。</p>
        </div>
      </details>
    </section>`;
  }

  function paint() {
    if (!box || !box.isConnected) return;
    const open = box.querySelector('details') && box.querySelector('details').open;
    box.innerHTML = html();
    if (open) box.querySelector('details').open = true;
    wire();
  }

  function wire() {
    const sel = box.querySelector('#crAiProv');
    sel.addEventListener('change', () => {
      const P = A.providers.find(x => x.id === sel.value);
      box.querySelector('#crAiHint').textContent = P.hint;
      box.querySelector('#crAiModel').placeholder = P.model || '模型名';
    });
    box.querySelector('#crAiSave').addEventListener('click', () => {
      const provider = sel.value;
      const key = box.querySelector('#crAiKey').value.trim();
      const model = box.querySelector('#crAiModel').value.trim();
      const P = A.providers.find(x => x.id === provider);
      if (!key) { msg = '请先填入 API Key。'; paint(); return; }
      if (!P.model && !model) { msg = `${P.name} 需要填写模型名。`; paint(); return; }
      A.set({ provider, key, model }); msg = '已保存。之后的 AI 调用会使用你的 Key。'; paint();
    });
    const clr = box.querySelector('#crAiClear');
    if (clr) clr.addEventListener('click', () => { A.set(null); msg = '已清除，改回免费试用。'; paint(); A.refresh(); });
  }

  A.mount = el => {
    if (!el) return;
    box = el; msg = '';
    paint();
    A.refresh();
  };
  window.addEventListener('cr-ai-change', paint);
})();
