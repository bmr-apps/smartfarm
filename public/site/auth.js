(() => {
  if (window.__onsilSupabaseEmailLogin) return;
  window.__onsilSupabaseEmailLogin = true;

  const styles = `
    .rail-bottom.rail-leaf[role="button"]{cursor:pointer}
    .rail-bottom.rail-leaf[role="button"]:focus-visible{outline:3px solid #d2e6b6;outline-offset:4px;border-radius:8px}
    .onsil-auth-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:#13281f88;backdrop-filter:blur(5px)}
    .onsil-auth-card{position:relative;box-sizing:border-box;width:min(100%,400px);max-height:calc(100dvh - 32px);overflow-y:auto;padding:24px 26px 22px;border:1px solid #e5ebe2;border-radius:22px;background:#fff;box-shadow:0 28px 90px #15291f36;color:#263c30;font:inherit}
    .onsil-auth-close{position:absolute;right:17px;top:15px;width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:#71816f;font-size:26px;line-height:1;cursor:pointer}
    .onsil-auth-close:hover{background:#f1f5ef}
    .onsil-auth-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:16px;background:#edf4e8;color:#4e7d4a;font-size:24px;margin-bottom:12px}
    .onsil-auth-card h2{margin:0;font-size:23px;letter-spacing:-.7px}
    .onsil-auth-copy{margin:8px 0 18px;color:#80907d;font-size:14px;line-height:1.7}
    .onsil-auth-card label{display:block;margin:0 0 7px;color:#556954;font-size:13px;font-weight:600}
    .onsil-auth-card input{width:100%;height:44px;margin:0 0 12px;padding:0 13px;border:1px solid #dfe7dc;border-radius:9px;background:#fff;color:#263c30;font:inherit;font-size:14px;box-sizing:border-box}
    .onsil-auth-card input:focus{outline:3px solid #80a86e2a;border-color:#83a774}
    .onsil-auth-error,.onsil-auth-success{margin:0 0 13px;padding:11px 13px;border-radius:8px;font-size:13px;line-height:1.55}
    .onsil-auth-error{background:#fff1ed;color:#ad4a39}
    .onsil-auth-success{background:#edf7ed;color:#326442}
    .onsil-auth-submit{width:100%;min-height:44px;border:0;border-radius:9px;background:#326442;color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
    .onsil-auth-submit:disabled{opacity:.65;cursor:wait}
    .onsil-auth-google{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-top:12px;padding:12px;border:1px solid #dbe4d6;border-radius:9px;background:#fff;color:#2f4937;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
    .onsil-auth-divider{display:flex;align-items:center;gap:12px;margin:11px 0;color:#9aa694;font-size:12px}.onsil-auth-divider:before,.onsil-auth-divider:after{content:'';height:1px;flex:1;background:#e6ece2}
    .onsil-auth-reset{display:block;width:100%;margin-top:12px;border:0;background:transparent;color:#326442;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer}
    .onsil-auth-reset:disabled{opacity:.6;cursor:wait}
    .onsil-auth-foot{margin:13px 0 0;color:#879581;text-align:center;font-size:11px;line-height:1.6}
    @media(max-width:520px){.onsil-auth-backdrop{padding:14px}.onsil-auth-card{padding:22px 20px 20px;border-radius:18px}.onsil-auth-card h2{font-size:22px}}
  `;
  const style = document.createElement('style');
  style.dataset.onsilAuthStyle = 'true';
  style.textContent = styles;
  document.head.appendChild(style);

  function closeDialog() {
    document.querySelector('[data-onsil-auth-dialog]')?.remove();
  }

  function openDialog() {
    closeDialog();
    const backdrop = document.createElement('div');
    backdrop.className = 'onsil-auth-backdrop';
    backdrop.dataset.onsilAuthDialog = 'true';
    backdrop.innerHTML = `
      <section class="onsil-auth-card" role="dialog" aria-modal="true" aria-labelledby="onsil-auth-title">
        <button type="button" class="onsil-auth-close" aria-label="닫기">×</button>
        <div class="onsil-auth-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg></div>
        <h2 id="onsil-auth-title">관리자 로그인</h2>
        <p class="onsil-auth-copy">관리자 계정의 이메일과 비밀번호를 입력해 주세요.</p>
        <form novalidate>
          <label for="onsil-auth-email">이메일</label>
          <input id="onsil-auth-email" name="email" type="email" autocomplete="username" placeholder="name@example.com" required maxlength="254">
          <label for="onsil-auth-password">비밀번호</label>
          <input id="onsil-auth-password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호" required maxlength="256">
          <p class="onsil-auth-error" role="alert" hidden></p>
          <p class="onsil-auth-success" role="status" hidden></p>
          <button class="onsil-auth-submit" type="submit">관리자 로그인</button>
          <div class="onsil-auth-divider">또는</div>
          <button class="onsil-auth-google" type="button"><span aria-hidden="true">G</span> Google로 로그인 / 관리자 신청</button>
          <button class="onsil-auth-reset" type="button">비밀번호 재설정 메일 보내기</button>
        </form>
        <p class="onsil-auth-foot">Google 계정으로 로그인하면 최고 관리자 승인 후 농장에 접근할 수 있습니다.<br>이 브라우저에서는 로그인 상태가 유지됩니다.</p>
      </section>`;
    document.body.appendChild(backdrop);
    const form = backdrop.querySelector('form');
    const emailInput = backdrop.querySelector('#onsil-auth-email');
    const passwordInput = backdrop.querySelector('#onsil-auth-password');
    const errorBox = backdrop.querySelector('.onsil-auth-error');
    const successBox = backdrop.querySelector('.onsil-auth-success');
    const submit = backdrop.querySelector('.onsil-auth-submit');
    const reset = backdrop.querySelector('.onsil-auth-reset');
    backdrop.querySelector('.onsil-auth-close').addEventListener('click', closeDialog);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeDialog(); });
    emailInput.focus();

    function clearMessages() {
      errorBox.hidden = true;
      successBox.hidden = true;
    }

    backdrop.querySelector('.onsil-auth-google').addEventListener('click', () => {
      window.sessionStorage.setItem('smartfarm:onsil_oauth_started', String(Date.now()));
      window.smartfarmLoginWithGoogle();
    });

    reset.addEventListener('click', async () => {
      clearMessages();
      const email = emailInput.value.trim();
      if (!email) {
        errorBox.textContent = '먼저 관리자 이메일을 입력해 주세요.';
        errorBox.hidden = false;
        emailInput.focus();
        return;
      }
      reset.disabled = true;
      submit.disabled = true;
      reset.textContent = '메일 보내는 중…';
      try {
        const response = await window.smartfarmFetch('/smartfarm/api/password-reset-request', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || '재설정 메일을 보내지 못했습니다.');
        successBox.textContent = '재설정 메일을 보냈습니다. Gmail에서 가장 최근 메일의 링크를 열어 새 비밀번호를 설정해 주세요.';
        successBox.hidden = false;
      } catch (error) {
        errorBox.textContent = error instanceof Error ? error.message : '재설정 메일을 보내지 못했습니다.';
        errorBox.hidden = false;
      } finally {
        reset.disabled = false;
        submit.disabled = false;
        reset.textContent = '비밀번호 재설정 메일 보내기';
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      clearMessages();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        errorBox.textContent = '이메일과 비밀번호를 모두 입력해 주세요.';
        errorBox.hidden = false;
        return;
      }
      submit.disabled = true;
      reset.disabled = true;
      submit.textContent = '확인 중…';
      try {
        const response = await window.smartfarmFetch('/smartfarm/api/session', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          cache: 'no-store',
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || `로그인 요청에 실패했습니다 (${response.status}).`);
        if (!data?.admin) throw new Error('관리자 로그인을 확인하지 못했습니다.');
        passwordInput.value = '';
        window.location.reload();
      } catch (error) {
        errorBox.textContent = error instanceof Error ? error.message : '로그인에 실패했습니다. 다시 시도해 주세요.';
        errorBox.hidden = false;
        submit.disabled = false;
        reset.disabled = false;
        submit.textContent = '관리자 로그인';
      }
    });
  }

  function activateRailAccount() {
    const logout = document.querySelector('.topbar .header-actions > button.admin-active');
    if (!logout) { openDialog(); return; }
    if (logout.disabled) return;
    if (window.confirm('로그아웃 할까요?')) logout.click();
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const railLogin = target?.closest('.rail-bottom.rail-leaf');
    const button = target?.closest('button');
    // Let the dialog's own buttons reach their local handlers.
    if (target?.closest('[data-onsil-auth-dialog]')) return;
    if (!railLogin && (!button || button.textContent?.trim() !== '관리자 로그인')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (railLogin) activateRailAccount();
    else openDialog();
  }, true);

  // Settings, notification and water controls open the original React login
  // dialog internally. Route that shared dialog to the email login as well.
  function replaceLegacyLogin() {
    // The original bundle renders this icon asynchronously as a decorative span.
    // Keep React's element intact while making it an accessible login control.
    const railLogin = document.querySelector('.rail-bottom.rail-leaf');
    if (railLogin) {
      railLogin.removeAttribute('aria-hidden');
      railLogin.setAttribute('role', 'button');
      railLogin.setAttribute('tabindex', '0');
      const label = document.querySelector('.topbar .header-actions > button.admin-active') ? '로그아웃' : '관리자 로그인 및 Google 관리자 신청';
      railLogin.setAttribute('aria-label', label);
      railLogin.setAttribute('title', label);
    }
    const legacy = document.querySelector('dialog[open] #admin-code')?.closest('dialog');
    if (!legacy) return;
    // Notify React so its modal state is cleared, then leave the browser's
    // top layer before displaying the email dialog.
    legacy.dispatchEvent(new Event('cancel', { cancelable: true }));
    if (legacy.open) legacy.close();
    if (!document.querySelector('[data-onsil-auth-dialog]')) openDialog();
  }
  const loginObserver = new MutationObserver(replaceLegacyLogin);
  loginObserver.observe(document.body, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'class'],
  });
  replaceLegacyLogin();

  const authResult = new URLSearchParams(window.location.search).get('auth');
  const authMessages = { pending: 'Google 로그인이 완료됐어요. 최고 관리자가 승인하면 관리자 권한이 열립니다.', approved: '관리자 승인이 완료됐어요. 이제 사이트를 사용할 수 있습니다.', rejected: '관리자 요청이 거절됐습니다. 최고 관리자에게 문의해 주세요.', error: 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  if (authMessages[authResult]) { const n=document.createElement('div'); n.setAttribute('role','status'); n.textContent=authMessages[authResult]; n.style.cssText='position:fixed;z-index:10001;top:18px;left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 32px));padding:14px 18px;border:1px solid #dbe4d6;border-radius:12px;background:#fff;color:#31513b;box-shadow:0 8px 30px #203a2920;font:14px/1.5 system-ui,sans-serif;text-align:center'; document.body.appendChild(n); window.setTimeout(()=>n.remove(),authResult === 'pending' || authResult === 'approved' ? 3500 : 6500); const u=new URL(location.href); u.searchParams.delete('auth'); history.replaceState(null,'',u.pathname+u.search+u.hash); }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDialog();
    const target = event.target instanceof Element ? event.target : null;
    if ((event.key === 'Enter' || event.key === ' ') && target?.closest('.rail-bottom.rail-leaf')) {
      event.preventDefault();
      activateRailAccount();
    }
  });
})();
