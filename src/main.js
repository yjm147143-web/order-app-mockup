/*
 * 앱 부트스트랩 — 로그인 여부/역할/매장(또는 행사) 선택 여부에 따라 시작 화면을 결정한다.
 * 사장님(OWNER) 계정은 로그인(및 매장 선택)이 끝나면 '주문' 화면(customers)이 기본 화면이다.
 * 행사 담당자(EVENT_MANAGER) 계정은 로그인(및 행사 선택)이 끝나면 별도 네비게이션 구조인
 * eventManagerShell로 진입한다 — 사장님 쪽 화면과는 완전히 분리되어 있다.
 *
 * 신규 주문 시뮬레이터(OrderSimulator)는 기본적으로 자동 시작하지 않는다(요청에 따라 비활성화).
 * 실시간 반영 데모가 필요하면 브라우저 콘솔에서 OrderSimulator.start() 를 직접 호출하면 되고,
 * 멈추려면 OrderSimulator.stop() 을 호출하면 된다.
 */
(function () {
  function enterEventManager(userId) {
    if (AppState.hasSelectedEvent()) {
      Router.showScreen('eventManagerShell');
      return;
    }
    MockApi.getMyEvents(userId).then(function (res) {
      if (res.events.length === 1) {
        AppState.selectEvent(res.events[0].id);
        Router.showScreen('eventManagerShell');
      } else {
        Router.showScreen('eventSelect', { events: res.events });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!AppState.isLoggedIn()) {
      Router.showScreen('login');
      return;
    }
    var user = AppState.get().currentUser;
    if (user.role === 'EVENT_MANAGER') {
      enterEventManager(user.id);
      return;
    }
    if (!AppState.hasSelectedStore()) {
      MockApi.getMyStores(user.id).then(function (res) {
        if (res.stores.length === 1) {
          AppState.selectStore(res.stores[0].id);
          Router.showScreen('customers');
        } else {
          Router.showScreen('storeSelect', { stores: res.stores });
        }
      });
      return;
    }
    Router.showScreen('customers');
  });
})();
