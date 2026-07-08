/*
 * 초경량 라우터 — #app-root 안에 화면을 그려넣고 mount() 로 이벤트를 붙인다.
 * 실제 이전 시: @react-navigation 의 Stack/Tab Navigator 로 교체.
 */
(function () {
  var currentScreen = null;

  function showScreen(name, params) {
    var screen = window.Screens[name];
    if (!screen) {
      console.error('Unknown screen:', name);
      return;
    }
    if (currentScreen && typeof currentScreen.unmount === 'function') {
      try {
        currentScreen.unmount();
      } catch (e) {
        console.error(e);
      }
    }

    var root = document.getElementById('app-root');
    root.innerHTML = screen.render(params);
    screen.mount(root);
    currentScreen = screen;

    // 개발자 옵션 핀 버튼은 화면(#app-root) 밖의 전역 오버레이라 화면이 바뀔 때마다 지금
    // 로그인 상태/역할에 맞게 보이거나 숨겨지도록 매번 다시 확인한다.
    if (window.DevOptionsPanel) DevOptionsPanel.refreshVisibility();
  }

  window.Router = { showScreen: showScreen };
})();
