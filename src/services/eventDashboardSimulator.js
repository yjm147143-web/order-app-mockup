/*
 * 행사 담당자 홈 대시보드용 실시간 시뮬레이터 (개발/데모 목적)
 * 10~20초 간격으로 영업중인 매장들의 오늘 매출/주문건수/최근 주문시각을 조금씩 흔들어
 * 대시보드가 실시간으로 살아있는 것처럼 보이게 한다. (src/services/orderSimulator.js와 같은 패턴)
 * 실제 이전 시: 이 파일을 삭제하고 실서버의 실시간 채널(WebSocket/SSE 등) 구독으로 교체.
 */
(function () {
  var MIN_INTERVAL_MS = 10000;
  var MAX_INTERVAL_MS = 20000;
  var timerId = null;
  var running = false;

  function randomInterval() {
    return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
  }

  function tick() {
    if (!running) return;
    MockApi.simulateStoreActivity();
    scheduleNext();
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

  window.EventDashboardSimulator = { start: start, stop: stop };
})();
