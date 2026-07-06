/*
 * 행사 담당자 홈 대시보드 — eventManagerShell.js의 '홈' 탭 안에서 렌더링되는 모듈.
 * Router에 등록된 화면이 아니라 셸이 직접 render()/mount()/unmount()를 호출하는 하위 컴포넌트다.
 *
 * 설계 원칙: 행사 총괄관리자가 앱을 열자마자 "① 행사가 잘 돌아가고 있는가, ② 지금 개입해야 할
 * 곳이 있는가, ③ 매출은 어느 정도인가"에 답할 수 있는 정보만 담는다. 개별 매장의 메뉴/재고 같은
 * 세부 운영 정보는 다루지 않는다(그건 '매장 현황' 화면 몫).
 *
 * 데이터는 MockApi.getEventDashboardSummary()/getAttentionStores()로 가져오고,
 * EventDashboardSimulator가 주기적으로 값을 흔들 때마다 'mock:dashboard-changed' 이벤트를 듣고
 * 다시 불러온다. '매장 현황'/'매출 현황' 카드를 누르면 셸에게 탭 전환을 요청하는
 * 'em:goto-tab' 커스텀 이벤트를 쏜다(셸이 하단 탭 상태를 갖고 있으므로 직접 바꾸지 않는다).
 */
(function () {
  function formatEventPeriod(startStr, endStr) {
    var start = startStr.replace(/-/g, '.');
    var startYear = startStr.split('-')[0];
    var endParts = endStr.split('-');
    var end = endParts[0] === startYear ? endParts[1] + '.' + endParts[2] : endStr.replace(/-/g, '.');
    return start + ' ~ ' + end;
  }

  function dayCountLabel(startStr, endStr) {
    var start = new Date(startStr + 'T00:00:00');
    var end = new Date(endStr + 'T00:00:00');
    var today = new Date();
    var todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (todayMid < start) return '시작 전';
    if (todayMid > end) return '종료';
    var diffDays = Math.floor((todayMid - start) / 86400000) + 1;
    return diffDays + '일차';
  }

  function storeSummaryInnerHtml(summary) {
    var c = summary.storeCounts;
    return (
      '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px;">매장 현황</div>' +
      '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:12px;">' +
        '<span style="font-size:28px;font-weight:800;">' + (c.OPEN || 0) + '</span>' +
        '<span style="font-size:13px;color:var(--color-text-secondary);">/ ' + summary.totalStores + '개 매장 영업중</span>' +
      '</div>' +
      '<div style="display:flex;gap:16px;font-size:13px;flex-wrap:wrap;">' +
        '<span><span class="operating-status-dot open"></span> 영업중 ' + (c.OPEN || 0) + '</span>' +
        '<span><span class="operating-status-dot paused"></span> 일시중지 ' + (c.PAUSED || 0) + '</span>' +
        '<span><span class="operating-status-dot closed"></span> 마감 ' + (c.CLOSED || 0) + '</span>' +
      '</div>'
    );
  }

  function salesSummaryInnerHtml(summary) {
    return (
      '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px;">매출 요약</div>' +
      '<div style="display:flex;justify-content:space-between;">' +
        '<div><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">오늘 누적</div>' +
          '<div style="font-size:19px;font-weight:800;">' + UI.formatWon(summary.todaySales) + '</div></div>' +
        '<div style="text-align:right;"><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:2px;">행사 시작 이후 누적</div>' +
          '<div style="font-size:19px;font-weight:800;">' + UI.formatWon(summary.totalSales) + '</div></div>' +
      '</div>'
    );
  }

  function orderCountInnerHtml(summary) {
    return (
      '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:4px;">오늘 총 주문건수</div>' +
      '<div style="font-size:24px;font-weight:800;">' + summary.todayOrderCount + '건</div>'
    );
  }

  function attentionListHtml(items) {
    if (items.length === 0) {
      return '<div class="helper-text" style="text-align:left;">지금은 주의가 필요한 매장이 없어요.</div>';
    }
    return items
      .map(function (it) {
        return (
          '<div class="card" style="margin-bottom:8px;">' +
            '<div style="font-weight:700;font-size:14px;">' + UI.escapeHtml(it.storeName) + (it.boothNumber ? ' · ' + UI.escapeHtml(it.boothNumber) : '') + '</div>' +
            '<div style="font-size:13px;color:var(--color-accent-red);margin-top:2px;">' + UI.escapeHtml(it.reason) + '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function render() {
    return (
      '<div style="padding: 8px 20px 24px;">' +
        '<div style="margin-bottom:16px;">' +
          '<div style="font-size:20px;font-weight:800;" id="em-home-event-name">불러오는 중...</div>' +
          '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px;" id="em-home-event-period"></div>' +
          '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px;" id="em-home-manager"></div>' +
        '</div>' +
        '<div class="card" data-action="goto-stores" id="em-store-summary-card" style="cursor:pointer;margin-bottom:12px;">불러오는 중...</div>' +
        '<div class="card" data-action="goto-sales" id="em-sales-summary-card" style="cursor:pointer;margin-bottom:12px;">불러오는 중...</div>' +
        '<div class="card" id="em-order-count-card" style="margin-bottom:20px;">불러오는 중...</div>' +
        '<div style="font-weight:800;font-size:15px;margin-bottom:8px;">주의가 필요한 매장</div>' +
        '<div id="em-attention-list"></div>' +
        '<div style="display:flex;gap:8px;margin-top:20px;">' +
          '<div style="flex:1;">' + UI.button({ label: '전체 매장 마감', action: 'em-close-all', variant: 'danger-solid' }) + '</div>' +
          '<div style="flex:1;">' + UI.button({ label: '전체 매장 개점', action: 'em-open-all', variant: 'success' }) + '</div>' +
        '</div>' +
        '<div id="em-home-modal-host"></div>' +
      '</div>'
    );
  }

  var onDashboardChanged = null;

  function mount(root) {
    var eventId = AppState.get().currentEventId;

    function load() {
      Promise.all([
        MockApi.getEvent(eventId),
        MockApi.getEventDashboardSummary(eventId),
        MockApi.getAttentionStores(eventId),
      ]).then(function (results) {
        var event = results[0].event;
        var summary = results[1];
        var attentionItems = results[2].items;

        root.querySelector('#em-home-event-name').textContent = event.name;
        root.querySelector('#em-home-event-period').textContent =
          formatEventPeriod(event.startDate, event.endDate) + ' · ' + dayCountLabel(event.startDate, event.endDate);
        var user = AppState.get().currentUser;
        root.querySelector('#em-home-manager').textContent = (user ? user.name : '') + ' 담당자님';
        root.querySelector('#em-store-summary-card').innerHTML = storeSummaryInnerHtml(summary);
        root.querySelector('#em-sales-summary-card').innerHTML = salesSummaryInnerHtml(summary);
        root.querySelector('#em-order-count-card').innerHTML = orderCountInnerHtml(summary);
        root.querySelector('#em-attention-list').innerHTML = attentionListHtml(attentionItems);
      });
    }

    root.querySelector('#em-store-summary-card').addEventListener('click', function () {
      window.dispatchEvent(new CustomEvent('em:goto-tab', { detail: { key: 'STORES' } }));
    });
    root.querySelector('#em-sales-summary-card').addEventListener('click', function () {
      window.dispatchEvent(new CustomEvent('em:goto-tab', { detail: { key: 'SALES' } }));
    });
    // '매장 현황' 화면(eventManagerStores.js)의 일괄 조치 로직을 그대로 재사용한다 —
    // 확인 팝업 → 처리(부분 실패 허용) → 결과 요약 → 감사 로그 기록까지 완전히 동일하게 동작한다.
    root.querySelector('[data-action="em-close-all"]').addEventListener('click', function () {
      window.EventManagerStores.runBulkAction({
        eventId: eventId,
        scopeType: 'ALL',
        storeIds: null,
        targetStatus: 'CLOSED',
        hostEl: root.querySelector('#em-home-modal-host'),
        onDone: load,
      });
    });
    root.querySelector('[data-action="em-open-all"]').addEventListener('click', function () {
      window.EventManagerStores.runBulkAction({
        eventId: eventId,
        scopeType: 'ALL',
        storeIds: null,
        targetStatus: 'OPEN',
        hostEl: root.querySelector('#em-home-modal-host'),
        onDone: load,
      });
    });

    onDashboardChanged = function () {
      load();
    };
    window.addEventListener('mock:dashboard-changed', onDashboardChanged);
    window.addEventListener('mock:orders-changed', onDashboardChanged);

    load();
  }

  function unmount() {
    if (onDashboardChanged) {
      window.removeEventListener('mock:dashboard-changed', onDashboardChanged);
      window.removeEventListener('mock:orders-changed', onDashboardChanged);
      onDashboardChanged = null;
    }
  }

  window.EventManagerHome = { render: render, mount: mount, unmount: unmount };
})();
