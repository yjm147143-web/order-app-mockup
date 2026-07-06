/*
 * 행사 선택 화면
 * 행사 담당자 계정이 담당 행사(eventIds)를 2개 이상 가지고 있을 때만 보인다.
 * 담당 행사가 1개면 로그인 직후 자동 스킵된다 (login.js / main.js 참고).
 * 실제 이전 시: features/eventManager/screens/EventSelectScreen.tsx
 */
(function () {
  var events = [];

  function render(params) {
    events = (params && params.events) || [];
    return (
      '<div class="screen">' +
        '<div class="screen-scroll" style="padding: 48px 24px 24px;">' +
          '<div style="font-size:22px;font-weight:800;margin-bottom:24px;">담당 행사를 선택해주세요</div>' +
          '<ul id="event-list">' +
            events
              .map(function (e) {
                return (
                  '<li class="card" data-action="select-event" data-event-id="' + e.id + '" style="cursor:pointer;margin-bottom:12px;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
                      '<div style="font-size:17px;font-weight:700;">' + UI.escapeHtml(e.name) + '</div>' +
                      UI.badge(e.status, e.status === '진행중' ? 'dark' : 'neutral') +
                    '</div>' +
                    '<div style="font-size:13px;color:var(--color-text-secondary);">' + UI.escapeHtml(e.location) + '</div>' +
                    '<div style="font-size:13px;color:var(--color-text-secondary);">' + UI.escapeHtml(e.startDate) + ' ~ ' + UI.escapeHtml(e.endDate) + '</div>' +
                  '</li>'
                );
              })
              .join('') +
          '</ul>' +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    root.querySelectorAll('[data-action="select-event"]').forEach(function (el) {
      el.addEventListener('click', function () {
        AppState.selectEvent(el.getAttribute('data-event-id'));
        Router.showScreen('eventManagerShell');
      });
    });
  }

  window.Screens = window.Screens || {};
  window.Screens.eventSelect = { render: render, mount: mount };
})();
