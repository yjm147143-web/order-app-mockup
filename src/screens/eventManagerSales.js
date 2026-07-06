/*
 * 행사 담당자 '매출현황 및 분석' 화면 — eventManagerShell.js의 'SALES' 탭 안에서 렌더링되는
 * 모듈(Router 화면이 아니라 셸이 render/mount/unmount를 직접 호출하는 하위 컴포넌트 —
 * eventManagerHome.js/eventManagerStores.js와 동일한 패턴).
 *
 * 사장님 앱의 '매출 조회' 화면(src/screens/sales.js)과 같은 허브(카드형 타일) + 상세(차트/랭킹)
 * 구조로 재구성했다 — 탭 전환처럼 전역 Router를 거치지 않고 이 화면 내부에서 직접 다시 그린다
 * (sales.js의 HUB/DETAIL 패턴과 동일). 차트 SVG(barChartSvg/donutChartSvg 등)와 랭킹 목록
 * (breakdownListHtml)은 모두 ui.js의 공유 함수를 그대로 쓴다 — 사장님 앱과 코드 중복 없음.
 *
 * 상단 요약 카드의 "주문경로 비중"/"총 주문·취소 건수"는 오늘 하루 기준으로 계산한다
 * (MockApi.getEventOrderStats) — 매출과 달리 완료 여부와 무관하게 건수를 센다.
 * 'AI 분석' 버튼은 목업이다 — 실제 AI/LLM 연동은 MockApi.getAiSalesInsight() 함수 하나만
 * 교체하면 되도록 만들어뒀다(README 참고).
 *
 * '매장별 매출 랭킹'과 '메뉴별 매출 랭킹' 카드를 누르면 상세 화면으로 들어가고, 매장별 랭킹의
 * 각 행을 누르면 Router.showScreen('eventManagerStoreOrders', {storeId})로 이동한다(읽기 전용
 * 주문조회 화면 — eventManagerStores.js의 매장 카드 클릭과 동일한 진입점을 쓴다).
 */
(function () {
  var PERIODS = [
    { key: 'TODAY', label: '오늘' },
    { key: 'EVENT', label: '행사 전체 기간' },
    { key: 'CUSTOM', label: '직접 선택' },
  ];

  var DIMENSIONS = [
    { key: 'STORE_RANKING', label: '매장별 매출', emoji: '🏪' },
    { key: 'PAYMENT', label: '결제수단별 매출', emoji: '💳' },
    { key: 'HOUR', label: '시간대별 매출', emoji: '🕒' },
    { key: 'CHANNEL', label: '주문경로별 매출', emoji: '🧾' },
    { key: 'MENU_RANKING', label: '메뉴별 매출', emoji: '🍽️' },
  ];

  var currentView = 'HUB';
  var currentDimension = null;
  var periodPreset = 'TODAY';
  var customFrom = '';
  var customTo = '';
  var storeFilter = 'ALL';
  var aiInsightVisible = false;

  var eventCache = null;
  var storesCache = [];
  var rootEl = null;

  function dimensionMeta(key) {
    return DIMENSIONS.find(function (d) { return d.key === key; });
  }

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

  function overviewCardHtml(summary, orderStats) {
    var avgPerStore = summary.totalStores > 0 ? Math.round(summary.totalSales / summary.totalStores) : 0;
    return (
      '<div class="card" style="margin-bottom:14px;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
          '<div><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">행사 전체 누적 매출</div>' +
            '<div style="font-size:19px;font-weight:800;">' + UI.formatWon(summary.totalSales) + '</div></div>' +
          '<div style="text-align:right;"><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">오늘 매출</div>' +
            '<div style="font-size:19px;font-weight:800;">' + UI.formatWon(summary.todaySales) + '</div></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:14px;">' +
          '<div><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">참여 매장 수</div>' +
            '<div style="font-size:17px;font-weight:800;">' + summary.totalStores + '개</div></div>' +
          '<div style="text-align:right;"><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">매장당 평균 매출(누적)</div>' +
            '<div style="font-size:17px;font-weight:800;">' + UI.formatWon(avgPerStore) + '</div></div>' +
        '</div>' +
        '<hr class="divider" style="margin:2px 0 14px;" />' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<div><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">주문경로 비중 (오늘)</div>' +
            '<div style="font-size:15px;font-weight:800;">QR ' + orderStats.qrPct + '% · 태블릿 ' + orderStats.tabletPct + '%</div></div>' +
          '<div style="text-align:right;"><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">총 주문 / 취소 (오늘)</div>' +
            '<div style="font-size:15px;font-weight:800;">총 ' + orderStats.totalOrderCount + '건 / 취소 ' + orderStats.canceledOrderCount + '건</div></div>' +
        '</div>' +
        '<div style="margin-top:14px;">' + UI.button({ label: '✨ AI 분석', action: 'toggle-ai-insight', variant: 'outline' }) + '</div>' +
        '<div id="em-ai-insight-host"></div>' +
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

  function periodBarHtml(barId) {
    return (
      '<div class="date-range-bar" id="' + barId + '">' +
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
        : '')
    );
  }

  function renderHub() {
    return (
      '<div style="padding: 8px 20px 24px;">' +
        '<div id="em-sales-overview-host">불러오는 중...</div>' +
        '<div class="sales-grid">' +
          DIMENSIONS.map(function (d) {
            return (
              '<div class="sales-tile" data-action="open-dimension" data-key="' + d.key + '">' +
                '<div class="sales-tile-emoji">' + d.emoji + '</div>' +
                '<div class="sales-tile-label">' + d.label + '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</div>'
    );
  }

  function renderDetail() {
    var meta = dimensionMeta(currentDimension);
    var isStoreRanking = currentDimension === 'STORE_RANKING';
    var isMenuRanking = currentDimension === 'MENU_RANKING';
    var needsChart = !isStoreRanking && !isMenuRanking;
    var needsTotalCard = !isStoreRanking;
    var storeOptions = '<option value="ALL">전체 합산</option>' +
      storesCache.map(function (s) { return '<option value="' + s.id + '" ' + (s.id === storeFilter ? 'selected' : '') + '>' + UI.escapeHtml(s.name) + '</option>'; }).join('');
    return (
      '<div style="padding: 8px 20px 24px;">' +
        '<div class="detail-header-row">' +
          '<button class="icon-btn" data-action="back-to-hub">' + UI.Icons.back + '</button>' +
          '<span class="detail-header-title">' + meta.emoji + ' ' + meta.label + '</span>' +
        '</div>' +
        periodBarHtml('em-sales-period-bar') +
        (isStoreRanking
          ? ''
          : '<div style="display:flex;justify-content:flex-end;margin:10px 0;">' +
              '<select id="em-sales-store-filter" class="input-field" style="width:auto;">' + storeOptions + '</select>' +
            '</div>') +
        (needsTotalCard ? '<div class="card sales-total-card" id="em-sales-total-card"><span class="summary-label">총 매출</span><span class="summary-value" id="em-sales-total">-</span><div class="helper-text" style="text-align:left;margin-top:4px;" id="em-sales-order-count"></div></div>' : '') +
        (needsChart ? '<div id="em-sales-chart-host"></div>' : '') +
        (isStoreRanking
          ? '<div class="card" style="margin-top:14px;">' +
              '<div style="font-weight:800;font-size:14px;margin-bottom:10px;">매장별 매출 랭킹</div>' +
              '<div id="em-sales-ranking-host">불러오는 중...</div>' +
            '</div>'
          : '') +
        (isMenuRanking ? '<div id="em-sales-menu-ranking-host" style="margin-top:14px;"></div>' : '') +
      '</div>'
    );
  }

  function render() {
    return currentView === 'HUB' ? renderHub() : renderDetail();
  }

  /* ---------------- 데이터 로드 ---------------- */

  function loadOverview(eventId) {
    Promise.all([
      MockApi.getEventDashboardSummary(eventId),
      MockApi.getEventOrderStats(eventId),
      MockApi.getStoresByEvent(eventId),
    ]).then(function (results) {
      storesCache = results[2].stores;
      var host = rootEl.querySelector('#em-sales-overview-host');
      if (host) {
        host.innerHTML = overviewCardHtml(results[0], results[1]);
        wireAiInsightButton();
      }
    });
  }

  function wireAiInsightButton() {
    var btn = rootEl.querySelector('[data-action="toggle-ai-insight"]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var host = rootEl.querySelector('#em-ai-insight-host');
      if (aiInsightVisible) {
        aiInsightVisible = false;
        host.innerHTML = '';
        return;
      }
      host.innerHTML = '<div class="helper-text" style="text-align:left;margin-top:10px;">분석 중...</div>';
      var eventId = AppState.get().currentEventId;
      MockApi.getAiSalesInsight(eventId).then(function (res) {
        aiInsightVisible = true;
        host.innerHTML = '<div class="ai-insight-box">🤖 ' + UI.escapeHtml(res.message) + '</div>';
      });
    });
  }

  function loadRanking() {
    var host = rootEl.querySelector('#em-sales-ranking-host');
    if (host) {
      host.innerHTML = rankingHtml(storesCache);
      wireRankingClicks();
    }
    var filterHost = rootEl.querySelector('#em-sales-store-filter');
    if (filterHost) {
      filterHost.innerHTML = '<option value="ALL">전체 합산</option>' +
        storesCache.map(function (s) { return '<option value="' + s.id + '" ' + (s.id === storeFilter ? 'selected' : '') + '>' + UI.escapeHtml(s.name) + '</option>'; }).join('');
    }
  }

  function loadDetailData(eventId) {
    var range = currentRange();
    if (currentDimension === 'STORE_RANKING') {
      loadRanking();
      return;
    }
    if (currentDimension === 'MENU_RANKING') {
      MockApi.getEventMenuRanking(eventId, storeFilter, range).then(function (data) {
        rootEl.querySelector('#em-sales-total').textContent = UI.formatWon(data.totalAmount);
        rootEl.querySelector('#em-sales-order-count').textContent = '주문 ' + data.orderCount + '건 기준';
        rootEl.querySelector('#em-sales-menu-ranking-host').innerHTML = UI.breakdownListHtml(data, '해당 기간의 메뉴 판매 데이터가 없어요');
      });
      return;
    }
    // PAYMENT | HOUR | CHANNEL
    MockApi.getEventSalesBreakdown(eventId, storeFilter, currentDimension, range).then(function (data) {
      rootEl.querySelector('#em-sales-total').textContent = UI.formatWon(data.totalAmount);
      rootEl.querySelector('#em-sales-order-count').textContent = '주문 ' + data.orderCount + '건 기준';
      rootEl.querySelector('#em-sales-chart-host').innerHTML = UI.salesChartHtml(currentDimension, data);
    });
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

    if (currentView === 'HUB') {
      rootEl.querySelectorAll('[data-action="open-dimension"]').forEach(function (el) {
        el.addEventListener('click', function () {
          currentDimension = el.getAttribute('data-key');
          storeFilter = 'ALL';
          currentView = 'DETAIL';
          rerender();
        });
      });
      loadOverview(eventId);
      return;
    }

    // DETAIL view
    rootEl.querySelector('[data-action="back-to-hub"]').addEventListener('click', function () {
      currentView = 'HUB';
      rerender();
    });
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
        loadDetailData(eventId);
      });
    }
    var storeFilterEl = rootEl.querySelector('#em-sales-store-filter');
    if (storeFilterEl) {
      storeFilterEl.addEventListener('change', function (e) {
        storeFilter = e.target.value;
        loadDetailData(eventId);
      });
    }

    if (currentDimension === 'STORE_RANKING' && storesCache.length === 0) {
      MockApi.getStoresByEvent(eventId).then(function (res) {
        storesCache = res.stores;
        loadDetailData(eventId);
      });
    } else {
      loadDetailData(eventId);
    }
  }

  function mount(root) {
    rootEl = root;
    // 셸은 render() -> mount() 순서로 호출하는데, render()는 mount()가 상태를 리셋하기 전에
    // 이미 실행되어버려(직전까지 보고 있던 DETAIL 화면이 그대로 다시 그려짐) 다른 탭에 갔다가
    // 돌아오면 이전 상세 화면이 잠깐 남아있는 문제가 있었다. 상태를 리셋한 뒤 이 자리에서
    // 한 번 더 그려서(root.innerHTML = render()) 항상 허브에서 시작하도록 보장한다.
    currentView = 'HUB';
    currentDimension = null;
    aiInsightVisible = false;
    storeFilter = 'ALL';
    rootEl.innerHTML = render();

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
