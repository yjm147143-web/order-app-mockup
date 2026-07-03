/*
 * 앱 부트스트랩 — 로그인 여부/매장 선택 여부에 따라 시작 화면을 결정한다.
 * 로그인(및 매장 선택)이 끝나면 항상 '주문' 화면(customers)이 기본 화면으로 표시된다.
 *
 * 신규 주문 시뮬레이터(OrderSimulator)는 기본적으로 자동 시작하지 않는다(요청에 따라 비활성화).
 * 실시간 반영 데모가 필요하면 브라우저 콘솔에서 OrderSimulator.start() 를 직접 호출하면 되고,
 * 멈추려면 OrderSimulator.stop() 을 호출하면 된다.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    if (!AppState.isLoggedIn()) {
      Router.showScreen('login');
      return;
    }
    if (!AppState.hasSelectedStore()) {
      MockApi.getMyStores(AppState.get().currentUser.id).then(function (res) {
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
