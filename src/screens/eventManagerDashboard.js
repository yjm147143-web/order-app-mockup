/*
 * 행사 담당자 대시보드 (플레이스홀더)
 * 로그인 화면에서 '행사 담당자' 탭을 선택하고 로그인하면 진입한다.
 * 실제 기능은 아직 없으며, 추후 별도로 설계/개발 예정이다.
 */
(function () {
  function render() {
    return (
      '<div class="screen">' +
        '<div class="screen-scroll" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;height:100%;">' +
          '<div style="font-size:44px;margin-bottom:16px;">🛠️</div>' +
          '<div style="font-size:20px;font-weight:800;margin-bottom:8px;">행사 담당자 대시보드</div>' +
          '<div style="font-size:15px;color:var(--color-text-secondary);margin-bottom:32px;">준비 중입니다</div>' +
          UI.button({ label: '로그인 화면으로 돌아가기', action: 'back-to-login', variant: 'outline' }) +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    root.querySelector('[data-action="back-to-login"]').addEventListener('click', function () {
      Router.showScreen('login');
    });
  }

  window.Screens = window.Screens || {};
  window.Screens.eventManagerDashboard = { render: render, mount: mount };
})();
