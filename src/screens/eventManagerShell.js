/*
 * 행사 담당자 전용 네비게이션 셸.
 * 사장님 쪽 화면(주문 화면 단일 구조)과는 완전히 분리된, 행사 담당자만의 하단 탭 구조를 가진다.
 * 4개 탭(홈/매장 현황/매출 현황/설정) 전부 각각 eventManagerHome.js/eventManagerStores.js/
 * eventManagerSales.js/eventManagerSettings.js 모듈에 위임한다(셸이 render/mount/unmount를
 * 직접 호출) — 이 파일 자체는 탭 전환만 담당하는 얇은 셸이다. 탭 전환은 sales.js의 허브/상세
 * 패턴과 마찬가지로 전역 Router를 거치지 않고 이 화면 내부에서 직접 다시 그린다.
 *
 * '매장별 주문조회'(eventManagerStoreOrders.js)는 이 탭들과 달리 전역 Router 화면으로 등록되어
 * 있다 — 매장 현황/매출현황 탭에서 드릴다운으로 들어가는 화면이라 하단 탭 소속이 아니기 때문.
 * 뒤로가기를 누르면 Router.showScreen('eventManagerShell')로 돌아오며, 이때 셸은 새로
 * mount되어 항상 '홈' 탭에서 다시 시작한다(사장님 앱의 설정→주문 복귀와 같은 패턴).
 *
 * 홈 대시보드 카드(매장 현황/매출 현황)를 누르면 자식 모듈이 'em:goto-tab' 커스텀 이벤트를
 * 쏘고, 이 셸이 그걸 듣고 실제 탭을 전환한다(자식은 셸의 activeTab 상태를 직접 건드리지 않는다).
 *
 * EventDashboardSimulator(홈 대시보드 실시간 흉내용)는 이 셸이 떠 있는 동안 계속 돌아간다 —
 * 어느 탭을 보고 있든 매장 데이터가 계속 갱신되어야 하므로 셸 mount/unmount에 생명주기를 맞췄다.
 *
 * 접근 범위: AppState.get().currentEventId 가 이 화면 전체의 컨텍스트다.
 * 실제 이전 시: features/eventManager/screens/EventManagerShellScreen.tsx (+ 하단 탭 4개는
 * 각각 features/eventManager/screens/{Home,Stores,Sales,Settings}Screen.tsx 로 분리)
 */
(function () {
  var TABS = [
    { key: 'HOME', label: '홈', icon: 'home' },
    { key: 'STORES', label: '매장 현황', icon: 'store' },
    { key: 'SALES', label: '매출 현황', icon: 'chart' },
    { key: 'SETTINGS', label: '설정', icon: 'settings' },
  ];
  var TAB_TITLES = { HOME: '홈', STORES: '매장 현황', SALES: '매출 현황', SETTINGS: '설정' };
  var TAB_MODULES = {
    HOME: function () { return window.EventManagerHome; },
    STORES: function () { return window.EventManagerStores; },
    SALES: function () { return window.EventManagerSales; },
    SETTINGS: function () { return window.EventManagerSettings; },
  };

  var activeTab = 'HOME';
  var currentUnmount = null;

  function contentHtml(tab) {
    return TAB_MODULES[tab]().render();
  }

  function tabBarHtml() {
    return (
      '<div class="em-tabbar">' +
        TABS.map(function (t) {
          return (
            '<button class="em-tab-item ' + (t.key === activeTab ? 'active' : '') + '" data-action="em-tab" data-key="' + t.key + '">' +
              '<span class="em-tab-icon">' + UI.Icons[t.icon] + '</span>' +
              '<span class="em-tab-label">' + t.label + '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>'
    );
  }

  function render() {
    return (
      '<div class="screen">' +
        UI.topBar({ title: TAB_TITLES[activeTab] }) +
        '<div class="screen-scroll" id="em-content">' + contentHtml(activeTab) + '</div>' +
        tabBarHtml() +
      '</div>'
    );
  }

  function mount(root) {
    activeTab = 'HOME';
    EventDashboardSimulator.start();

    function unmountActiveTabModule() {
      TAB_MODULES[activeTab]().unmount();
    }

    function mountActiveTabModule() {
      TAB_MODULES[activeTab]().mount(root.querySelector('#em-content'));
    }

    function rerender() {
      root.innerHTML = render();
      wire();
      mountActiveTabModule();
    }

    function switchTab(nextTab) {
      if (nextTab === activeTab) return;
      unmountActiveTabModule();
      activeTab = nextTab;
      rerender();
    }

    function wire() {
      root.querySelectorAll('[data-action="em-tab"]').forEach(function (el) {
        el.addEventListener('click', function () {
          switchTab(el.getAttribute('data-key'));
        });
      });
    }

    function onGotoTab(e) {
      switchTab(e.detail.key);
    }

    wire();
    mountActiveTabModule();
    window.addEventListener('em:goto-tab', onGotoTab);

    currentUnmount = function () {
      unmountActiveTabModule();
      window.removeEventListener('em:goto-tab', onGotoTab);
      EventDashboardSimulator.stop();
      activeTab = 'HOME';
    };
  }

  function unmount() {
    if (currentUnmount) currentUnmount();
    currentUnmount = null;
  }

  window.Screens = window.Screens || {};
  window.Screens.eventManagerShell = { render: render, mount: mount, unmount: unmount };
})();
