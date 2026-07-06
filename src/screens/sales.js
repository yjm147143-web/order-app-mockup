/*
 * 매출 조회 — 설정 화면의 '매출 조회' 항목에서 진입하는 하위 화면.
 * 허브 화면(5개 기준 타일) + 공통 기간 필터를 가진 기준별 상세 화면을 한 파일에서 다룬다.
 * 화면 전환은 전역 Router를 거치지 않고 내부에서 직접 다시 그린다(허브 <-> 상세를 오갈 때
 * 스크롤/필터 상태를 잃지 않기 위함). 뒤로가기만 허브에서는 설정으로, 상세에서는 허브로 이동.
 *
 * 매출 데이터는 MockApi.getSalesBreakdown()으로 실제 주문 데이터에서 집계한다(결제수단만 예외적으로
 * 목업 — mockApi.js 주석 참고). 이모티콘은 임시이며 추후 참고 이미지를 받으면 톤앤매너를 다시 맞춘다.
 */
(function () {
  var DIMENSIONS = [
    { key: 'PERIOD', label: '기간별 매출', emoji: '📊' },
    { key: 'HOUR', label: '시간대별 매출', emoji: '🕒' },
    { key: 'MENU', label: '메뉴별 매출', emoji: '🍽️' },
    { key: 'PAYMENT', label: '결제수단별 매출', emoji: '💳' },
    { key: 'CHANNEL', label: '주문경로별 매출', emoji: '🧾' },
  ];
  var PRESETS = [
    { key: 'TODAY', label: '오늘' },
    { key: '7D', label: '최근 7일' },
    { key: '30D', label: '최근 30일' },
    { key: 'CUSTOM', label: '직접 선택' },
  ];

  var currentView = 'HUB';
  var currentDimension = null;
  var currentPreset = 'TODAY';
  var customFrom = '';
  var customTo = '';

  function dimensionMeta(key) {
    return DIMENSIONS.find(function (d) { return d.key === key; });
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function presetRange(preset) {
    var now = new Date();
    var to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    var from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    if (preset === '7D') from.setDate(from.getDate() - 6);
    if (preset === '30D') from.setDate(from.getDate() - 29);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  function currentRange() {
    if (currentPreset === 'CUSTOM' && customFrom && customTo) {
      return { from: customFrom + 'T00:00:00', to: customTo + 'T23:59:59' };
    }
    return presetRange(currentPreset === 'CUSTOM' ? 'TODAY' : currentPreset);
  }

  function renderHub() {
    return (
      '<div class="screen">' +
        UI.topBar({ title: '매출 조회', leftIcon: UI.Icons.back, leftAction: 'go-back' }) +
        '<div class="screen-scroll" style="padding:8px 20px 24px;">' +
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
        '</div>' +
      '</div>'
    );
  }

  function renderDetail() {
    var meta = dimensionMeta(currentDimension);
    return (
      '<div class="screen">' +
        UI.topBar({ title: meta.label, leftIcon: UI.Icons.back, leftAction: 'go-back' }) +
        '<div class="screen-scroll" style="padding:8px 20px 24px;">' +
          '<div class="date-range-bar" id="date-range-bar">' +
            PRESETS.map(function (p) {
              return '<button class="date-range-preset ' + (currentPreset === p.key ? 'active' : '') + '" data-action="pick-preset" data-key="' + p.key + '">' + p.label + '</button>';
            }).join('') +
          '</div>' +
          (currentPreset === 'CUSTOM'
            ? '<div class="date-range-custom">' +
                '<input type="date" id="custom-from" value="' + UI.escapeHtml(customFrom || todayStr()) + '" max="' + todayStr() + '" />' +
                '<span class="helper-text">~</span>' +
                '<input type="date" id="custom-to" value="' + UI.escapeHtml(customTo || todayStr()) + '" max="' + todayStr() + '" />' +
                UI.button({ label: '조회', action: 'apply-custom', variant: 'secondary' }) +
              '</div>'
            : '') +
          '<div class="card sales-total-card">' +
            '<span class="summary-label">총 매출</span>' +
            '<span class="summary-value" id="sales-total">-</span>' +
            '<div class="helper-text" style="text-align:left;margin-top:4px;" id="sales-order-count"></div>' +
          '</div>' +
          '<div id="sales-chart-host"></div>' +
          '<div id="sales-breakdown-list"></div>' +
        '</div>' +
      '</div>'
    );
  }

  function render(params) {
    if (params && params.reset) {
      currentView = 'HUB';
      currentDimension = null;
      currentPreset = 'TODAY';
    }
    return currentView === 'HUB' ? renderHub() : renderDetail();
  }

  function renderBreakdownList(root, data) {
    root.querySelector('#sales-total').textContent = UI.formatWon(data.totalAmount);
    root.querySelector('#sales-order-count').textContent = '주문 ' + data.orderCount + '건 기준';
    root.querySelector('#sales-chart-host').innerHTML = UI.salesChartHtml(currentDimension, data);
    root.querySelector('#sales-breakdown-list').innerHTML = UI.breakdownListHtml(data, '해당 기간의 매출이 없어요');
  }

  function mount(root) {
    if (currentView === 'HUB') {
      root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
        Router.showScreen('settings');
      });
      root.querySelectorAll('[data-action="open-dimension"]').forEach(function (el) {
        el.addEventListener('click', function () {
          currentDimension = el.getAttribute('data-key');
          currentPreset = 'TODAY';
          currentView = 'DETAIL';
          rerender(root);
        });
      });
      return;
    }

    // DETAIL view
    root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
      currentView = 'HUB';
      rerender(root);
    });
    root.querySelectorAll('[data-action="pick-preset"]').forEach(function (el) {
      el.addEventListener('click', function () {
        currentPreset = el.getAttribute('data-key');
        rerender(root);
      });
    });
    var applyBtn = root.querySelector('[data-action="apply-custom"]');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        customFrom = root.querySelector('#custom-from').value;
        customTo = root.querySelector('#custom-to').value;
        loadBreakdown(root);
      });
    }
    loadBreakdown(root);
  }

  function loadBreakdown(root) {
    var state = AppState.get();
    var range = currentRange();
    MockApi.getSalesBreakdown(state.currentStoreId, currentDimension, range).then(function (data) {
      renderBreakdownList(root, data);
    });
  }

  function rerender(root) {
    root.innerHTML = render();
    mount(root);
  }

  window.Screens = window.Screens || {};
  window.Screens.sales = { render: render, mount: mount };
})();
