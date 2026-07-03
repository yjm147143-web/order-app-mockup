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

  /*
   * 차트: 별도 라이브러리 없이 순수 SVG 문자열로 직접 그린다(이 프로젝트에 이미 Icons도 같은
   * 방식으로 하드코딩되어 있어 톤이 일관됨 — 브라우저 목업이라 npm 설치가 불가능했던 것과 별개로,
   * 이 정도 단순한 차트는 의존성 없이 충분히 구현 가능하다는 판단). 색상은 그레이스케일 위주,
   * 강조가 필요한 지점(최댓값 막대)에만 앱의 포인트 컬러인 블랙을 사용한다.
   * 실제 React Native 전환 시에는 react-native-svg + victory-native(또는 react-native-chart-kit)
   * 조합으로 옮기는 것을 권장한다 — 아래 barChartSvg/donutChartSvg의 입력 데이터 형태(rows: [{label,amount}])는
   * 그대로 각 라이브러리의 데이터 prop으로 넘기면 된다.
   */
  var DONUT_COLORS = ['#111111', '#666666', '#a0a0a0', '#cfcfcf', '#e5e5e5'];

  function barChartSvg(rows, shortLabelFn) {
    var w = 320, h = 170, padBottom = 24, padTop = 8;
    var maxAmount = rows.reduce(function (mx, r) { return Math.max(mx, r.amount); }, 0);
    var barGap = 6;
    var barWidth = rows.length ? (w - barGap * (rows.length + 1)) / rows.length : 0;
    var bars = rows
      .map(function (r, i) {
        var barH = maxAmount > 0 ? ((r.amount / maxAmount) * (h - padBottom - padTop)) : 0;
        var x = barGap + i * (barWidth + barGap);
        var y = h - padBottom - barH;
        var isMax = r.amount === maxAmount && maxAmount > 0;
        return (
          '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + Math.max(barH, 1).toFixed(1) + '" rx="3" fill="' + (isMax ? 'var(--color-text-primary)' : 'var(--color-disabled)') + '" />' +
          '<text x="' + (x + barWidth / 2).toFixed(1) + '" y="' + (h - 8) + '" font-size="9" text-anchor="middle" fill="var(--color-text-secondary)">' + UI.escapeHtml(shortLabelFn(r, i)) + '</text>'
        );
      })
      .join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '">' + bars + '</svg>';
  }

  function donutChartSvg(rows, totalAmount) {
    var size = 160, radius = 54, stroke = 22, cx = size / 2, cy = size / 2;
    var circumference = 2 * Math.PI * radius;
    var offset = 0;
    if (totalAmount <= 0) {
      return (
        '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="var(--color-disabled)" stroke-width="' + stroke + '" /></svg>'
      );
    }
    var segments = rows
      .map(function (r, i) {
        var frac = r.amount / totalAmount;
        var dash = frac * circumference;
        var seg =
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + DONUT_COLORS[i % DONUT_COLORS.length] + '" stroke-width="' + stroke + '" ' +
          'stroke-dasharray="' + dash.toFixed(1) + ' ' + (circumference - dash).toFixed(1) + '" stroke-dashoffset="' + (-offset).toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" />';
        offset += dash;
        return seg;
      })
      .join('');
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' + segments + '</svg>';
  }

  function donutLegendHtml(rows, totalAmount) {
    return (
      '<div class="donut-legend">' +
      rows
        .map(function (r, i) {
          var pct = totalAmount > 0 ? Math.round((r.amount / totalAmount) * 100) : 0;
          return (
            '<div class="donut-legend-item">' +
              '<span class="donut-legend-dot" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></span>' +
              '<span class="donut-legend-label">' + UI.escapeHtml(r.label) + '</span>' +
              '<span class="donut-legend-pct">' + pct + '%</span>' +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderChartHtml(dimension, data) {
    if (dimension === 'HOUR') {
      if (data.rows.length === 0) return '';
      return (
        '<div class="card chart-card">' +
          '<div class="chart-card-title">시간대별 매출 흐름</div>' +
          '<div class="bar-chart-wrap">' + barChartSvg(data.rows, function (r) { return r.label.slice(0, 2) + '시'; }) + '</div>' +
        '</div>'
      );
    }
    if (dimension === 'PAYMENT' || dimension === 'CHANNEL') {
      if (data.rows.length === 0) return '';
      return (
        '<div class="card chart-card">' +
          '<div class="chart-card-title">' + (dimension === 'PAYMENT' ? '결제수단별 비중' : '주문경로별 비중') + '</div>' +
          '<div class="donut-chart-wrap">' +
            donutChartSvg(data.rows, data.totalAmount) +
            donutLegendHtml(data.rows, data.totalAmount) +
          '</div>' +
        '</div>'
      );
    }
    return '';
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
    root.querySelector('#sales-chart-host').innerHTML = renderChartHtml(currentDimension, data);
    var listEl = root.querySelector('#sales-breakdown-list');
    if (data.rows.length === 0) {
      listEl.innerHTML = '<div class="center-empty" style="padding-top:40px;"><div class="emoji">🗂️</div><div class="title">해당 기간의 매출이 없어요</div></div>';
      return;
    }
    listEl.innerHTML =
      '<div class="card">' +
      data.rows
        .map(function (row, idx) {
          var pct = data.totalAmount > 0 ? Math.round((row.amount / data.totalAmount) * 100) : 0;
          return (
            '<div class="sales-breakdown-row">' +
              '<span class="sales-breakdown-rank">' + (idx + 1) + '</span>' +
              '<span class="sales-breakdown-label">' + UI.escapeHtml(row.label) + (row.sub ? '<div class="sales-breakdown-sub">' + UI.escapeHtml(row.sub) + '</div>' : '') + '</span>' +
              '<span class="sales-breakdown-amount">' + UI.formatWon(row.amount) + ' <span class="sales-breakdown-sub">(' + pct + '%)</span></span>' +
            '</div>'
          );
        })
        .join('') +
      '</div>';
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
