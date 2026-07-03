/*
 * 매장 선택 화면
 * 계정이 매장 1곳만 가지고 있으면 로그인 직후 자동 스킵된다 (login.js 참고).
 * 이 화면은 매장이 2곳 이상이거나, ?forceStoreSelect=1 로 강제 진입했을 때 보인다.
 * 실제 이전 시: features/auth/screens/StoreSelectScreen.tsx
 */
(function () {
  var stores = [];

  function render(params) {
    stores = (params && params.stores) || [];
    return (
      '<div class="screen">' +
        '<div class="screen-scroll" style="padding: 48px 24px 24px;">' +
          '<div style="font-size:22px;font-weight:800;margin-bottom:24px;">매장을 선택해주세요</div>' +
          '<ul id="store-list">' +
            stores
              .map(function (s) {
                return (
                  '<li class="card" data-action="select-store" data-store-id="' + s.id + '" style="cursor:pointer;margin-bottom:12px;">' +
                    '<div style="font-size:17px;font-weight:700;margin-bottom:4px;">' + UI.escapeHtml(s.name) + '</div>' +
                    '<div style="font-size:13px;color:var(--color-text-secondary);">' + UI.escapeHtml(s.address) + '</div>' +
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
    root.querySelectorAll('[data-action="select-store"]').forEach(function (el) {
      el.addEventListener('click', function () {
        AppState.selectStore(el.getAttribute('data-store-id'));
        Router.showScreen('customers');
      });
    });
  }

  window.Screens = window.Screens || {};
  window.Screens.storeSelect = { render: render, mount: mount };
})();
