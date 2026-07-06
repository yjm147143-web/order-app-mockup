/*
 * 행사 담당자 '매출현황 및 분석' 화면 — eventManagerShell.js의 'SALES' 탭 안에서 렌더링되는
 * 모듈(Router 화면이 아니라 셸이 render/mount/unmount를 직접 호출하는 하위 컴포넌트 —
 * eventManagerHome.js/eventManagerStores.js와 동일한 패턴).
 *
 * 사장님 앱의 '매출 조회' 화면(src/screens/sales.js)과 완전히 같은 차트 컴포넌트를 쓴다 —
 * 막대/도넛 차트 SVG 생성 로직(barChartSvg/donutChartSvg/donutLegendHtml/salesChartHtml)을
 * ui.js로 옮겨서 두 화면이 그 함수를 그대로 공유하도록 리팩터링했다(코드 중복 없음).
 * 데이터 집계도 mockApi.js의 computeBreakdown()을 sales.js의 getSalesBreakdown(매장 하나)과
 * 함께 공유하는 getEventSalesBreakdown(행사 전체 또는 매장 필터)으로 가져온다.
 *
 * '매장별 매출 랭킹' 항목을 누르면 Router.showScreen('eventManagerStoreOrders', {storeId})로
 * 이동한다(읽기 전용 주문조회 화면 — eventManagerStores.js의 매장 카드 클릭과 동일한 진입점을 쓴다).
 */
(function () {
  var PERIODS = [
    { key: 'TODAY', label: '오늘' },
    { key: 'EVENT', label: '행사 전체 기간' },
    { key: 'CUSTOM', label: '직접 선택' },
  ];

  var periodPreset = 'TODAY';
  var customFrom = '';
  var customTo = '';
  var storeFilter = 'ALL';

  var eventCache = null;
  var storesCache = [];
  var rootEl = null;

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function currentRange() {
    if (periodPreset === 'EVENT' && eventCache) {
      return { from: eventCache.startDate + 'T00:00:00', to: eventCache.endDate + 'T23:59:59' };
    }
    if (periodPreset === 'CUSTOM' && customFrom && customTo) {
      return { from: customFrom + 'T00:00:00', to: customTo + 'T23:59:59' };
    }
    var now = new Date();
    var from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    var to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  /* ---------------- 상단 요약 ---------------- */

  function overviewCardHtml(summary) {
    var avgPerStore = summary.totalStores > 0 ? Math.round(summary.totalSales / summary.totalStores) : 0;
    return (
      '<div class="card" style="margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
          '<div><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">행사 전체 누적 매출</div>' +
            '<div style="font-size:19px;font-weight:800;">' + UI.formatWon(summary.totalSales) + '</div></div>' +
          '<div style="text-align:right;"><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">오늘 매출</div>' +
            '<div style="font-size:19px;font-weight:800;">' + UI.formatWon(summary.todaySales) + '</div></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<div><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">참여 매장 수</div>' +
            '<div style="font-size:17px;font-weight:800;">' + summary.totalStores + '개</div></div>' +
          '<div style="text-align:right;"><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">매장당 평균 매출(누적)</div>' +
            '<div style="font-size:17px;font-weight:800;">' + UI.formatWon(avgPerStore) + '</div></div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ---------------- 매장별 매출 랭킹 (막대 상대 비교) ---------------- */

  function rankingHtml(stores) {
    var useToday = periodPreset === 'TODAY';
    var ranked = stores
      .slice()
      .map(function (s) {
        return { id: s.id, name: s.name, boothNumber: s.boothNumber, amount: useToday ? (s.todaySalesAmount || 0) : (s.totalSalesAmount || 0) };
      })
      .sort(function (a, b) { return b.amount - a.amount; });
    var maxAmount = ranked.reduce(function (mx, r) { return Math.max(mx, r.amount); }, 0);
    if (ranked.length === 0) {
      return '<div class="helper-text" style="text-align:left;">매장이 없어요.</div>';
    }
    return ranked
      .map(function (r, idx) {
        var pct = maxAmount > 0 ? Math.round((r.amount / maxAmount) * 100) : 0;
        var isTop = idx === 0 && r.amount > 0;
        return (
          '<div class="store-rank-row" data-action="open-store-detail" data-store-id="' + r.id + '">' +
            '<div class="store-rank-header">' +
              '<span class="store-rank-name">' + (idx + 1) + '. ' + UI.escapeHtml(r.name) + (r.boothNumber ? ' · ' + UI.escapeHtml(r.boothNumber) : '') + '</span>' +
              '<span class="store-rank-amount">' + UI.formatWon(r.amount) + '</span>' +
            '</div>' +
            '<div class="store-rank-bar-track"><div class="store-rank-bar-fill" style="width:' + pct + '%;background:' + (isTop ? 'var(--color-text-primary)' : 'var(--color-disabled)') + ';"></div></div>' +
          '</div>'
        );
      })
      .join('');
  }

  /* ---------------- 렌더링 ---------------- */

  function renderMain() {
    var storeOptions = '<option value="ALL">전체 합산</option>' +
      storesCache.map(function (s) { return '<option value="' + s.id + '" ' + (s.id === storeFilter ? 'selected' : '') + '>' + UI.escapeHtml(s.name) + '</option>'; }).join('');

    return (
      '<div style="padding: 8px 20px 24px;">' +
        '<div id="em-sales-overview-host">불러오는 중...</div>' +
        '<div class="date-range-bar" id="em-sales-period-bar">' +
          PERIODS.map(function (p) {
            return '<button class="date-range-preset ' + (periodPreset === p.key ? 'active' : '') + '" data-action="pick-period" data-key="' + p.key + '">' + p.label + '</button>';
          }).join('') +
        '</div>' +
        (periodPreset === 'CUSTOM'
          ? '<div class="date-range-custom">' +
              '<input type="date" id="em-sales-custom-from" value="' + UI.escapeHtml(customFrom || todayStr()) + '" max="' + todayStr() + '" />' +
              '<span class="helper-text">~</span>' +
              '<input type="date" id="em-sales-custom-to" value="' + UI.escapeHtml(customTo || todayStr()) + '" max="' + todayStr() + '" />' +
              UI.button({ label: '조회', action: 'apply-custom-range', variant: 'secondary' }) +
            '</div>'
          : '') +
        '<div class="card" style="margin:14px 0;">' +
          '<div style="font-weight:800;font-size:14px;margin-bottom:10px;">매장별 매출 랭킹</div>' +
          '<div id="em-sales-ranking-host">불러오는 중...</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:10px;">' +
          '<select id="em-sales-store-filter" class="input-field" style="width:auto;">' + storeOptions + '</select>' +
        '</div>' +
        '<div id="em-sales-chart-host"></div>' +
      '</div>'
    );
  }

  function render() {
    return renderMain();
  }

  /* ---------------- 데이터 로드 ---------------- */

  function loadOverviewAndRanking(eventId) {
    Promise.all([
      MockApi.getEventDashboardSummary(eventId),
      MockApi.getStoresByEvent(eventId),
    ]).then(function (results) {
      storesCache = results[1].stores;
      rootEl.querySelector('#em-sales-overview-host').innerHTML = overviewCardHtml(results[0]);
      rootEl.querySelector('#em-sales-ranking-host').innerHTML = rankingHtml(storesCache);
      wireRankingClicks();
      // 매장 필터 옵션도 매장 목록이 도착한 뒤에 다시 그려야 정확하다
      var filterHost = rootEl.querySelector('#em-sales-store-filter');
      if (filterHost) {
        filterHost.innerHTML = '<option value="ALL">전체 합산</option>' +
          storesCache.map(function (s) { return '<option value="' + s.id + '" ' + (s.id === storeFilter ? 'selected' : '') + '>' + UI.escapeHtml(s.name) + '</option>'; }).join('');
      }
    });
  }

  function loadCharts(eventId) {
    var range = currentRange();
    var host = rootEl.querySelector('#em-sales-chart-host');
    Promise.all([
      MockApi.getEventSalesBreakdown(eventId, storeFilter, 'HOUR', range),
      MockApi.getEventSalesBreakdown(eventId, storeFilter, 'PAYMENT', range),
      MockApi.getEventSalesBreakdown(eventId, storeFilter, 'CHANNEL', range),
    ]).then(function (results) {
      var hourHtml = UI.salesChartHtml('HOUR', results[0]) || emptyChartCard('시간대별 매출 흐름');
      var paymentHtml = UI.salesChartHtml('PAYMENT', results[1]) || emptyChartCard('결제수단별 비중');
      var channelHtml = UI.salesChartHtml('CHANNEL', results[2]) || emptyChartCard('주문경로별 비중');
      host.innerHTML = hourHtml + paymentHtml + channelHtml;
    });
  }

  function emptyChartCard(title) {
    return (
      '<div class="card chart-card">' +
        '<div class="chart-card-title">' + UI.escapeHtml(title) + '</div>' +
        '<div class="helper-text" style="text-align:left;">해당 기간의 매출이 없어요.</div>' +
      '</div>'
    );
  }

  function wireRankingClicks() {
    rootEl.querySelectorAll('[data-action="open-store-detail"]').forEach(function (el) {
      el.addEventListener('click', function () {
        Router.showScreen('eventManagerStoreOrders', { storeId: el.getAttribute('data-store-id') });
      });
    });
  }

  function rerender() {
    rootEl.innerHTML = render();
    wireCurrentView();
  }

  function wireCurrentView() {
    var eventId = AppState.get().currentEventId;

    rootEl.querySelectorAll('[data-action="pick-period"]').forEach(function (el) {
      el.addEventListener('click', function () {
        periodPreset = el.getAttribute('data-key');
        rerender();
      });
    });
    var applyBtn = rootEl.querySelector('[data-action="apply-custom-range"]');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        customFrom = rootEl.querySelector('#em-sales-custom-from').value;
        customTo = rootEl.querySelector('#em-sales-custom-to').value;
        loadCharts(eventId);
      });
    }
    rootEl.querySelector('#em-sales-store-filter').addEventListener('change', function (e) {
      storeFilter = e.target.value;
      loadCharts(eventId);
    });

    loadOverviewAndRanking(eventId);
    loadCharts(eventId);
  }

  function mount(root) {
    rootEl = root;

    var eventId = AppState.get().currentEventId;
    MockApi.getEvent(eventId).then(function (res) {
      eventCache = res.event;
      wireCurrentView();
    });
  }

  function unmount() {
    rootEl = null;
  }

  window.EventManagerSales = { render: render, mount: mount, unmount: unmount };
})();
