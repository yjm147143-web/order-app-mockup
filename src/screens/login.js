/*
 * 로그인 화면
 * 실제 이전 시: features/auth/screens/LoginScreen.tsx
 */
(function () {
  var ROLE_TABS = [
    { key: 'OWNER', label: '사장님' },
    { key: 'EVENT_MANAGER', label: '행사 담당자' },
  ];

  function render() {
    return (
      '<div class="screen">' +
        '<div class="screen-scroll" style="padding: 64px 24px 24px;">' +
          '<div style="margin-bottom:32px;">' +
            '<div style="font-size:26px;font-weight:800;margin-bottom:8px;">ORDER APP</div>' +
            '<div style="font-size:15px;color:var(--color-text-secondary);">아이디와 비밀번호로 로그인해주세요</div>' +
          '</div>' +
          '<div class="role-tabs" id="login-role-tabs">' +
            ROLE_TABS.map(function (r, idx) {
              return '<button class="role-tab ' + (idx === 0 ? 'active' : '') + '" data-role="' + r.key + '">' + r.label + '</button>';
            }).join('') +
          '</div>' +
          '<div class="input-group">' +
            '<label class="input-label" for="login-id">아이디</label>' +
            '<input class="input-field" id="login-id" type="text" placeholder="아이디를 입력하세요" autocomplete="username" />' +
          '</div>' +
          '<div class="input-group">' +
            '<label class="input-label" for="login-pw">비밀번호</label>' +
            '<input class="input-field" id="login-pw" type="password" placeholder="비밀번호를 입력하세요" autocomplete="current-password" />' +
          '</div>' +
          '<label class="login-checkbox-row" for="login-auto">' +
            '<input type="checkbox" id="login-auto" />' +
            '<span>자동 로그인</span>' +
          '</label>' +
          '<div id="login-error" class="input-error" style="display:none;margin-top:8px;"></div>' +
          '<div class="helper-text" id="login-demo-hint" style="margin-top:24px;">데모 계정 · 아이디 owner / 비밀번호 1234</div>' +
          '<button class="find-account-link" data-action="find-account">아이디/비밀번호 찾기</button>' +
        '</div>' +
        '<div class="cta-fixed">' +
          UI.button({ label: '로그인', action: 'login-submit', variant: 'primary' }) +
        '</div>' +
      '</div>'
    );
  }

  var DEMO_HINTS = {
    OWNER: '데모 계정 · 아이디 owner / 비밀번호 1234',
    EVENT_MANAGER: '데모 계정 · manager1(담당 행사 1개) 또는 manager2(담당 행사 2개) · 비밀번호 1234',
  };

  function mount(root) {
    var idInput = root.querySelector('#login-id');
    var pwInput = root.querySelector('#login-pw');
    var autoLoginCheckbox = root.querySelector('#login-auto');
    var errorEl = root.querySelector('#login-error');
    var helperEl = root.querySelector('#login-demo-hint');
    var selectedRole = 'OWNER';
    idInput.value = 'owner';
    pwInput.value = '1234';

    root.querySelectorAll('#login-role-tabs .role-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        selectedRole = tab.getAttribute('data-role');
        root.querySelectorAll('#login-role-tabs .role-tab').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        errorEl.style.display = 'none';
        helperEl.textContent = DEMO_HINTS[selectedRole];
        idInput.value = selectedRole === 'EVENT_MANAGER' ? 'manager1' : 'owner';
        pwInput.value = '1234';
      });
    });

    root.querySelector('[data-action="find-account"]').addEventListener('click', function () {
      window.open(AppConfig.FIND_ACCOUNT_URL, '_blank');
    });

    function routeEventManager(user) {
      MockApi.getMyEvents(user.id).then(function (eventRes) {
        if (eventRes.events.length === 1) {
          AppState.selectEvent(eventRes.events[0].id);
          Router.showScreen('eventManagerShell');
        } else {
          Router.showScreen('eventSelect', { events: eventRes.events });
        }
      });
    }

    function routeOwner(user) {
      // 기능명세서 기준 사장님/직원 계정은 매장 1곳에 소속되므로 별도 매장 선택 화면 없이 바로 진입한다.
      MockApi.getMyStores(user.id).then(function (storeRes) {
        AppState.selectStore(storeRes.stores[0].id);
        Router.showScreen('customers');
      });
    }

    function submit() {
      var loginId = idInput.value.trim();
      var password = pwInput.value;
      var autoLogin = autoLoginCheckbox.checked;
      errorEl.style.display = 'none';

      MockApi.login(loginId, password).then(
        function (res) {
          var user = res.user;
          if (selectedRole === 'EVENT_MANAGER' && user.role !== 'EVENT_MANAGER') {
            errorEl.textContent = '행사 담당자 계정이 아닙니다.';
            errorEl.style.display = 'block';
            return;
          }
          // '사장님' 탭은 OWNER 계정뿐 아니라 그 매장 소속 STAFF(직원) 계정도 로그인 대상이다 —
          // 로그인 화면에는 별도의 '직원' 탭이 없다.
          if (selectedRole === 'OWNER' && user.role !== 'OWNER' && user.role !== 'STAFF') {
            errorEl.textContent = '사장님 계정이 아닙니다.';
            errorEl.style.display = 'block';
            return;
          }
          AppState.login(user, autoLogin);
          if (user.role === 'EVENT_MANAGER') {
            routeEventManager(user);
          } else {
            routeOwner(user);
          }
        },
        function (err) {
          errorEl.textContent = err.message;
          errorEl.style.display = 'block';
        }
      );
    }

    root.querySelector('[data-action="login-submit"]').addEventListener('click', submit);
    [idInput, pwInput].forEach(function (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submit();
      });
    });
  }

  window.Screens = window.Screens || {};
  window.Screens.login = { render: render, mount: mount };
})();
