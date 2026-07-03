/*
 * 신규 주문 실시간 시뮬레이터 (개발/데모 목적)
 * 5~15초 간격으로 무작위 신규 주문을 목업 DB에 추가한다.
 * 영업상태가 CLOSED면 주문 생성은 건너뛰고 다음 틱에 다시 확인한다(자동 재개).
 * 실제 이전 시: 이 파일을 삭제하고 실서버의 실시간 채널(WebSocket/SSE/FCM 등) 구독으로 교체.
 */
(function () {
  var MIN_INTERVAL_MS = 5000;
  var MAX_INTERVAL_MS = 15000;
  var timerId = null;
  var running = false;

  function randomInterval() {
    return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
  }

  function tick() {
    if (!running) return;
    var state = AppState.get();
    if (!state.currentStoreId) {
      scheduleNext();
      return;
    }
    MockApi.getStore(state.currentStoreId).then(
      function (res) {
        if (res.store.operatingStatus === 'OPEN') {
          MockApi.createRandomOrder(state.currentStoreId).catch(function () {
            /* 영업 종료로 막 전환된 경우 등 — 무시하고 다음 틱 */
          });
        }
        scheduleNext();
      },
      function () {
        scheduleNext();
      }
    );
  }

  function scheduleNext() {
    if (!running) return;
    timerId = setTimeout(tick, randomInterval());
  }

  function start() {
    if (running) return;
    running = true;
    scheduleNext();
  }

  function stop() {
    running = false;
    clearTimeout(timerId);
    timerId = null;
  }

  window.OrderSimulator = { start: start, stop: stop };
})();
