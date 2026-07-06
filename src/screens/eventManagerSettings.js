/*
 * 행사 담당자 '설정' 탭 — eventManagerShell.js의 'SETTINGS' 탭 안에서 렌더링되는 모듈
 * (다른 탭 모듈들과 동일한 패턴: 셸이 render/mount/unmount를 직접 호출).
 *
 * 행사 정보(읽기 전용) + 계정 정보 + (담당 행사 2개 이상이면) 행사 전환 + 로그아웃을 제공한다.
 * '행사 전환'은 STEP 1(로그인/행사 선택)에서 만든 eventSelect.js 화면을 그대로 재사용한다 —
 * MockApi.getMyEvents()로 담당 행사 목록을 다시 가져와 Router.showScreen('eventSelect', ...)로
 * 넘기기만 하면 되고, eventSelect.js 자체는 한 줄도 손대지 않는다.
 */
(function () {
  function render() {
    return (
      '<div style="padding: 8px 20px 24px;">' +
        '<div class="card" style="margin-bottom:16px;">' +
          '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:10px;">행사 정보</div>' +
          '<div id="em-settings-event-info" style="font-size:15px;line-height:1.8;">불러오는 중...</div>' +
        '</div>' +
        '<div class="card" style="margin-bottom:16px;">' +
          '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:10px;">계정 정보</div>' +
          '<div id="em-settings-account-info" style="font-size:15px;line-height:1.8;">불러오는 중...</div>' +
        '</div>' +
        '<div id="em-settings-switch-event-host"></div>' +
        '<hr class="divider" />' +
        '<div style="display:flex;justify-content:center;margin-top:16px;">' +
          UI.button({ label: '로그아웃', action: 'em-settings-logout', variant: 'outline' }) +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    var user = AppState.get().currentUser;
    var eventId = AppState.get().currentEventId;

    root.querySelector('#em-settings-account-info').innerHTML =
      '<div><strong>' + UI.escapeHtml(user.name) + '</strong></div>' +
      '<div style="color:var(--color-text-secondary);">역할: 행사 담당자</div>';

    MockApi.getEvent(eventId).then(function (res) {
      var e = res.event;
      root.querySelector('#em-settings-event-info').innerHTML =
        '<div><strong>' + UI.escapeHtml(e.name) + '</strong> ' + UI.badge(e.status, e.status === '진행중' ? 'dark' : 'neutral') + '</div>' +
        '<div style="color:var(--color-text-secondary);">' + UI.escapeHtml(e.location) + '</div>' +
        '<div style="color:var(--color-text-secondary);">' + UI.escapeHtml(e.startDate) + ' ~ ' + UI.escapeHtml(e.endDate) + '</div>';
    });

    MockApi.getMyEvents(user.id).then(function (res) {
      if (res.events.length <= 1) return; // 담당 행사가 1개면 전환할 곳이 없으니 메뉴 자체를 숨긴다
      var host = root.querySelector('#em-settings-switch-event-host');
      host.innerHTML =
        '<div class="settings-list-item" data-action="em-switch-event">' +
          '<span class="settings-list-icon">' + UI.Icons.store + '</span>' +
          '<span class="settings-list-label">행사 전환</span>' +
          '<span class="settings-list-chevron">' + UI.Icons.chevronRight + '</span>' +
        '</div>';
      host.querySelector('[data-action="em-switch-event"]').addEventListener('click', function () {
        MockApi.getMyEvents(user.id).then(function (r) {
          Router.showScreen('eventSelect', { events: r.events });
        });
      });
    });

    root.querySelector('[data-action="em-settings-logout"]').addEventListener('click', function () {
      AppState.logout();
      Router.showScreen('login');
    });
  }

  function unmount() {}

  window.EventManagerSettings = { render: render, mount: mount, unmount: unmount };
})();
