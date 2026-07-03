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
  }

  window.Router = { showScreen: showScreen };
})();
