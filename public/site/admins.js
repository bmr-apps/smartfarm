(() => {
  if (window.__onsilAdminManagement) return;
  window.__onsilAdminManagement = true;
  let owner = false, dialog, opener, refreshing = false;
  const icon = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const style = document.createElement('style');
  style.textContent = `
  .onsil-admin-dialog{width:min(680px,calc(100% - 28px));max-height:calc(100dvh - 40px);padding:0;border:1px solid #e0e8dc;border-radius:22px;color:#263c30;background:#fafcf8;box-shadow:0 28px 90px #15291f36;overflow:auto}
  .onsil-admin-dialog::backdrop{background:#13281f88;backdrop-filter:blur(5px)}
  .onsil-admin-inner{padding:30px}.onsil-admin-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.onsil-admin-heading h2{font-size:25px;margin:0}.onsil-admin-heading button{border:0;background:transparent;font-size:26px;color:#62755d;cursor:pointer;min-width:44px;min-height:44px}
  .onsil-admin-desc{font-size:14px;color:#71816b;line-height:1.7;margin:8px 0 22px}.onsil-admin-form{background:#fff;border:1px solid #e1e8dc;border-radius:14px;padding:18px;margin-bottom:18px}.onsil-admin-form label{display:block;font-size:13px;font-weight:600;margin-bottom:8px}.onsil-admin-fields{display:flex;gap:8px}.onsil-admin-fields input{flex:1;min-width:0;padding:12px;border:1px solid #dbe4d6;border-radius:8px;font:inherit;font-size:14px}.onsil-admin-dialog button:focus-visible,.onsil-admin-dialog input:focus-visible{outline:3px solid #82a775;outline-offset:3px}
  .onsil-admin-button{border:1px solid #d8e3d3;border-radius:8px;padding:10px 13px;font:inherit;font-size:13px;cursor:pointer;background:#fff;color:#365c3e;min-height:40px}.onsil-admin-button.primary{background:#326442;color:#fff;border-color:#326442}.onsil-admin-button.danger{color:#a34d3a}.onsil-admin-button:disabled{opacity:.55;cursor:wait}
  .onsil-admin-message{margin:12px 0;font-size:14px;line-height:1.6;color:#326442}.onsil-admin-message.error{color:#aa4938}.onsil-admin-list{display:grid;gap:10px}.onsil-admin-row{background:#fff;border:1px solid #e1e8dc;border-radius:12px;padding:16px;display:flex;gap:12px;align-items:center;justify-content:space-between}.onsil-admin-email{font-size:14px;font-weight:600;overflow-wrap:anywhere}.onsil-admin-meta{font-size:12px;color:#7a8974;margin-top:7px}.onsil-admin-actions{display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0}.onsil-admin-empty{color:#7a8974;font-size:14px;padding:20px 0}.rail-link[data-onsil-admin-menu]{cursor:pointer}.rail-link[data-onsil-admin-menu] .rail-label{font-size:10px;white-space:nowrap}
  @media(max-width:560px){.onsil-admin-inner{padding:20px}.onsil-admin-fields{flex-direction:column}.onsil-admin-row{align-items:stretch;flex-direction:column}.onsil-admin-actions{justify-content:flex-end}.onsil-admin-heading h2{font-size:22px}}
  `;
  document.head.appendChild(style);
  async function api(body) {
    const response = await window.smartfarmFetch('/smartfarm/api/admins', { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { if (response.status === 403) { owner = false; syncMenu(); } throw new Error(data?.error || '관리자 목록을 불러오지 못했습니다.'); }
    return data;
  }
  function close() { if (dialog) { dialog.close(); dialog.remove(); dialog = undefined; opener?.focus(); } }
  function syncMenu() {
    const nav = document.querySelector('.rail-nav');
    const existing = document.querySelector('[data-onsil-admin-menu]');
    if (!owner) { existing?.remove(); close(); return; }
    if (!nav || existing) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'rail-link'; button.dataset.onsilAdminMenu = 'true';
    button.setAttribute('aria-label', '관리자 관리'); button.title = '관리자 관리';
    button.innerHTML = icon + '<span class="rail-label">관리자 관리</span>';
    button.addEventListener('click', () => open(button)); nav.appendChild(button);
  }
  async function refreshSession() {
    if (refreshing) return; refreshing = true;
    try { const response = await window.smartfarmFetch('/smartfarm/api/session', { credentials: 'same-origin', cache: 'no-store' }); const data = await response.json(); owner = response.ok && data.owner === true; }
    catch { owner = false; }
    finally { refreshing = false; syncMenu(); }
  }
  async function open(button) {
    if (!owner) return;
    close(); opener = button;
    const panel = document.createElement('dialog'); dialog = panel; panel.className = 'onsil-admin-dialog';
    panel.setAttribute('aria-labelledby', 'onsil-admin-title');
    panel.innerHTML = `<div class="onsil-admin-inner"><div class="onsil-admin-heading"><h2 id="onsil-admin-title">관리자 관리</h2><button type="button" aria-label="닫기" data-close>×</button></div><p class="onsil-admin-desc">Google 로그인으로 관리자 신청한 계정을 검토하고, 필요하면 이메일로 초대하세요.<br>승인한 관리자는 펌프 조작과 기준값·알림 설정을 변경할 수 있습니다.</p><form class="onsil-admin-form"><label for="onsil-admin-email">초대할 관리자 이메일</label><div class="onsil-admin-fields"><input id="onsil-admin-email" type="email" required maxlength="254" placeholder="name@example.com" autocomplete="email"><button class="onsil-admin-button primary" type="submit">+ 관리자 초대</button></div></form><p class="onsil-admin-message" role="status" aria-live="polite"></p><div class="onsil-admin-list" aria-busy="true"><p class="onsil-admin-empty">관리자 목록을 불러오는 중…</p></div></div>`;
    document.body.appendChild(panel); panel.showModal();
    const message = panel.querySelector('.onsil-admin-message'), list = panel.querySelector('.onsil-admin-list'), form = panel.querySelector('form');
    panel.querySelector('[data-close]').addEventListener('click', close);
    panel.addEventListener('cancel', event => { event.preventDefault(); close(); });
    function show(text, error = false) { message.textContent = text; message.classList.toggle('error', error); }
    async function load() {
      const data = await api(); if (!panel.isConnected) return;
      list.replaceChildren(); list.setAttribute('aria-busy', 'false');
      for (const member of data.members) {
        const row = document.createElement('div'); row.className = 'onsil-admin-row';
        const details = document.createElement('div'), email = document.createElement('div'), meta = document.createElement('div');
        email.className = 'onsil-admin-email'; email.textContent = member.email;
        meta.className = 'onsil-admin-meta';
        meta.textContent = `${member.role === 'owner' ? '최고 관리자 · 나' : '일반 관리자'} · ${{ active: '사용 중', invited: '초대 중', pending: '승인 대기', rejected: '거절됨', revoked: '권한 회수됨' }[member.status] || '확인 중'}`;
        details.append(email, meta); row.append(details);
        if (member.role !== 'owner' && member.status === 'pending') {
          const actions = document.createElement('div'); actions.className = 'onsil-admin-actions';
          for (const [action, label, className] of [['approve', '승인', 'primary'], ['reject', '거절', 'danger']]) {
            const control = document.createElement('button'); control.type = 'button'; control.className = `onsil-admin-button ${className}`; control.textContent = label;
            control.addEventListener('click', async () => { await mutate({ action, userId: member.user_id }); }); actions.append(control);
          }
          row.append(actions);
        } else if (member.role !== 'owner' && member.active) {
          const actions = document.createElement('div'); actions.className = 'onsil-admin-actions';
          for (const [action, label] of member.status === 'invited' ? [['resend', '초대 재전송'], ['revoke', '권한 회수']] : [['revoke', '권한 회수']]) {
            const control = document.createElement('button'); control.type = 'button'; control.className = `onsil-admin-button ${action === 'revoke' ? 'danger' : ''}`; control.textContent = label;
            control.addEventListener('click', async () => {
              if (action === 'revoke' && !window.confirm(`${member.email}님의 관리자 권한을 회수할까요?\n이후 농장 설정과 펌프를 조작할 수 없습니다.`)) return;
              await mutate({ action, userId: member.user_id });
            }); actions.append(control);
          }
          row.append(actions);
        }
        list.append(row);
      }
    }
    let busy = false;
    async function mutate(body) {
      if (busy) return; busy = true;
      panel.querySelectorAll('button:not([data-close]),input').forEach(el => el.disabled = true);
      show('처리 중…');
      try { const data = await api(body); if (!panel.isConnected) return; show(data.message); if (body.action === 'invite') form.reset(); await load(); }
      catch (error) { show(error.message, true); }
      finally { busy = false; panel.querySelectorAll('button,input').forEach(el => el.disabled = false); }
    }
    form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) mutate({ action: 'invite', email: form.querySelector('input').value.trim() }); });
    try { await load(); } catch (error) { list.replaceChildren(); list.setAttribute('aria-busy', 'false'); show(error.message, true); const retry = document.createElement('button'); retry.className = 'onsil-admin-button'; retry.textContent = '다시 불러오기'; retry.onclick = () => open(opener); list.append(retry); }
  }
  new MutationObserver(syncMenu).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('focus', refreshSession);
  document.addEventListener('click', event => { const button = event.target instanceof Element ? event.target.closest('button') : null; if (button?.textContent?.includes('관리자 나가기')) { owner = false; syncMenu(); } }, true);
  setInterval(refreshSession, 60000);
  refreshSession();
})();
