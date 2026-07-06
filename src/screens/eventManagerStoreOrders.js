/*
 * 행사 담당자 '매장별 주문조회' 화면 — 읽기 전용.
 * 진입 경로: '매장 현황'(eventManagerStores.js)에서 매장 탭 / '매출현황'(eventManagerSales.js)의
 * 매장별 랭킹에서 매장 탭. 전역 Router에 등록된 화면이다(하단 탭 소속이 아니라 드릴다운이라
 * eventManagerShell의 탭 시스템 대신 일반 Router.showScreen으로 오간다 — 뒤로가기는 셸로 복귀).
 *
 * 사장님 앱 '주문' 화면(customers.js)과 같은 탭 구조(대기/접수/완료)·카드 레이아웃(채널 배지,
 * 픽업번호, 대표메뉴, 전화번호, 결제금액)을 그대로 쓴다 — 채널 배지/픽업번호/전화번호/시간대
 * 묶음 로직은 이미 ui.js로 옮겨 공유 중이라(UI.channelBadgeHtml 등) 여기서도 동일하게 가져다
 * 쓰면 두 화면의 카드가 완전히 똑같아진다.
 *
 * 결정적 차이: 이 화면은 읽기 전용이다 — 주문 수락/고객 호출/완료 처리/되돌리기/주문취소 등
 * 상태를 바꾸는 버튼을 전부 렌더링하지 않는다(비활성화가 아니라 아예 마크업에 없음). 대신
 * 카드를 탭하면 상세 정보를 모달로 보여준다(주문 항목/옵션/금액/시각/호출·완료 횟수/취소 사유).
 */
(function () {
  var SEGMENTS = [
    { key: 'WAITING', label: '대기' },
    { key: 'RECEIVED', label: '접수' },
    { key: 'DONE', label: '완료' },
  ];
  var CALL_FILTERS = [
    { key: 'ALL', label: '전체' },
    { key: 'NOT_CALLED', label: '미호출' },
    { key: 'CALLED', label: '호출됨' },
  ];

  var currentStoreId = null;
  var storesInEvent = [];
  var storeCache = null;
  var activeSegment = 'WAITING';
  var callFilter = 'ALL';
  var searchQuery = '';
  var ordersCache = [];
  var itemsCache = [];
  var logsCache = [];
  var currentUnmount = null;

  function itemsOf(orderId) {
    return itemsCache.filter(function (it) { return it.orderId === orderId; });
  }

  function historyOf(orderId) {
    return logsCache.filter(function (l) { return l.orderId === orderId; });
  }

  function menuSummary(orderId) {
    var items = itemsOf(orderId);
    if (items.length === 0) return '-';
    var extraCount = items.length - 1;
    return extraCount > 0 ? items[0].menuName + ' 외 ' + extraCount + '건' : items[0].menuName;
  }

  function segmentOf(order) {
    if (order.status === 'WAITING') return 'WAITING';
    if (order.status === 'RECEIVED') return 'RECEIVED';
    return 'DONE';
  }

  function render(params) {
    if (params && params.storeId) currentStoreId = params.storeId;
    return (
      '<div class="screen">' +
        UI.topBar({ title: '매장별 주문조회', leftIcon: UI.Icons.back, leftAction: 'go-back' }) +
        '<div id="em-order-store-bar-host"></div>' +
        '<div id="em-order-search-host"></div>' +
        '<div id="em-order-segment-host"></div>' +
        '<div class="screen-scroll"><div class="order-list" id="em-order-list"></div></div>' +
        '<div id="em-order-modal-host"></div>' +
      '</div>'
    );
  }

  function readOnlyCardHtml(order) {
    var isCanceled = order.status === 'CANCELED';
    return (
      '<div class="order-card ' + (isCanceled ? 'canceled' : '') + '" data-action="open-order-detail" data-order-id="' + order.id + '">' +
        '<div class="order-card-header-row">' +
          UI.channelBadgeHtml(order) +
          '<span class="order-card-pgno">' + UI.escapeHtml(order.pgOrderNo) + '</span>' +
        '</div>' +
        '<div class="order-card-main">' +
          '<div class="order-card-content-row">' +
            '<div class="order-card-menu-main">' + UI.escapeHtml(menuSummary(order.id)) + '</div>' +
            UI.pickupBlockHtml(order) +
          '</div>' +
          UI.phoneRowHtml(order) +
          '<div class="order-card-time">' + UI.clockLabel(order.orderedAt) + ' 주문 · ' + UI.timeAgoLabel(order.orderedAt) + '</div>' +
          '<div class="order-card-amount">' + UI.formatWon(order.totalAmount) + '</div>' +
          (isCanceled ? '<div class="order-card-cancel-reason">취소 사유: ' + UI.escapeHtml(order.cancelReason || '-') + '</div>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function orderDetailModalHtml(order) {
    var items = itemsOf(order.id);
    var history = historyOf(order.id);
    return (
      '<div class="modal-overlay" id="em-order-detail-overlay">' +
        '<div class="modal-sheet">' +
          '<div class="modal-sheet-header">' +
            '<span class="modal-sheet-title">주문 상세</span>' +
            '<button class="icon-btn" data-action="close-order-detail">' + UI.Icons.close + '</button>' +
          '</div>' +
          '<div class="modal-sheet-body">' +
            items.map(function (it) {
              return (
                '<div class="order-item-row"><span>' + UI.escapeHtml(it.menuName) +
                (it.optionsSummary ? ' (' + UI.escapeHtml(it.optionsSummary) + ')' : '') +
                ' x ' + it.quantity + '</span><span>' + UI.formatWon(it.unitPrice * it.quantity) + '</span></div>'
              );
            }).join('') +
            '<div class="order-item-row" style="font-weight:800;"><span>결제금액</span><span>' + UI.formatWon(order.totalAmount) + '</span></div>' +
            '<div class="order-item-row"><span>주문 시각</span><span>' + UI.clockLabel(order.orderedAt) + '</span></div>' +
            '<div class="order-item-row"><span>접수 시각</span><span>' + (order.acceptedAt ? UI.clockLabel(order.acceptedAt) : '-') + '</span></div>' +
            '<div class="order-item-row"><span>완료 시각</span><span>' + (order.completedAt ? UI.clockLabel(order.completedAt) : '-') + '</span></div>' +
            '<div class="order-item-row"><span>호출 횟수</span><span>' + history.length + '회</span></div>' +
            '<div class="order-item-row"><span>완료 처리 횟수</span><span>' + (order.completedCount || 0) + '회</span></div>' +
            (order.status === 'CANCELED'
              ? '<div class="order-item-row"><span>취소 사유</span><span>' + UI.escapeHtml(order.cancelReason || '-') + '</span></div>'
              : '') +
          '</div>' +
          '<div class="modal-sheet-footer">' +
            UI.button({ label: '확인', action: 'close-order-detail', variant: 'primary' }) +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    activeSegment = 'WAITING';
    callFilter = 'ALL';
    searchQuery = '';

    root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
      Router.showScreen('eventManagerShell');
    });

    function matchesSearch(order) {
      if (!searchQuery.trim()) return true;
      return (order.tableOrPickupNo || '').toString().indexOf(searchQuery.trim()) !== -1;
    }

    function matchesCallFilter(order) {
      if (callFilter === 'ALL') return true;
      var called = historyOf(order.id).length > 0;
      return callFilter === 'CALLED' ? called : !called;
    }

    function getGroupsForActiveSegment() {
      var filtered = ordersCache.filter(function (o) {
        return segmentOf(o) === activeSegment && matchesSearch(o) && matchesCallFilter(o);
      });
      var sorted = filtered.slice().sort(function (a, b) { return new Date(a.orderedAt) - new Date(b.orderedAt); });
      return UI.groupByBucket(sorted);
    }

    function renderStoreBar() {
      var host = root.querySelector('#em-order-store-bar-host');
      var options = storesInEvent
        .map(function (s) { return '<option value="' + s.id + '" ' + (s.id === currentStoreId ? 'selected' : '') + '>' + UI.escapeHtml(s.name) + '</option>'; })
        .join('');
      var telHref = storeCache && storeCache.ownerPhone ? 'tel:' + storeCache.ownerPhone.replace(/-/g, '') : '';
      host.innerHTML =
        '<div style="padding:8px 20px 4px;">' +
          '<select id="em-order-store-select" class="input-field" style="width:100%;margin-bottom:8px;">' + options + '</select>' +
          '<div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">' +
            '<div>' +
              '<div style="font-weight:800;font-size:14px;">' + (storeCache ? UI.escapeHtml(storeCache.ownerName || '-') : '-') + ' 사장님</div>' +
              '<div style="font-size:12px;color:var(--color-text-secondary);">' + (storeCache ? UI.escapeHtml(storeCache.ownerPhone || '-') : '-') + '</div>' +
            '</div>' +
            (telHref ? '<a href="' + telHref + '" class="btn btn-outline" style="min-height:0;height:auto;padding:8px 14px;font-size:13px;">📞 연락하기</a>' : '') +
          '</div>' +
        '</div>';
      root.querySelector('#em-order-store-select').addEventListener('change', function (e) {
        Router.showScreen('eventManagerStoreOrders', { storeId: e.target.value });
      });
    }

    function renderSearchAndFilter() {
      var host = root.querySelector('#em-order-search-host');
      host.innerHTML =
        '<div class="order-search-row">' +
          '<input id="em-order-search-input" placeholder="픽업번호/테이블번호로 검색" value="' + UI.escapeHtml(searchQuery) + '" />' +
        '</div>' +
        '<div style="padding:0 20px 8px;">' + UI.segmentTabs(CALL_FILTERS.map(function (f) { return { key: f.key, label: f.label, count: '' }; }), callFilter) + '</div>';
      var input = host.querySelector('#em-order-search-input');
      input.addEventListener('input', function () {
        searchQuery = input.value;
        renderList();
      });
      host.querySelectorAll('[data-action="segment-tab"]').forEach(function (el) {
        el.addEventListener('click', function () {
          callFilter = el.getAttribute('data-key');
          renderSearchAndFilter();
          renderList();
        });
      });
    }

    function renderSegmentTabs() {
      var counts = { WAITING: 0, RECEIVED: 0, DONE: 0 };
      ordersCache.forEach(function (o) { counts[segmentOf(o)]++; });
      var host = root.querySelector('#em-order-segment-host');
      host.innerHTML = UI.segmentTabs(SEGMENTS.map(function (s) { return { key: s.key, label: s.label, count: counts[s.key] }; }), activeSegment);
      host.querySelectorAll('[data-action="segment-tab"]').forEach(function (el) {
        el.addEventListener('click', function () {
          activeSegment = el.getAttribute('data-key');
          renderSegmentTabs();
          renderList();
        });
      });
    }

    function renderList() {
      var listEl = root.querySelector('#em-order-list');
      var groups = getGroupsForActiveSegment();
      if (groups.length === 0) {
        listEl.innerHTML = '<div class="center-empty" style="padding-top:60px;"><div class="emoji">📭</div><div class="title">주문이 없어요</div></div>';
        return;
      }
      listEl.innerHTML = groups
        .map(function (g) {
          return (
            '<div class="time-bucket-header-row"><span class="time-bucket-title">' + UI.bucketLabel(g.key) + ' · ' + g.orders.length + '건</span></div>' +
            g.orders.map(readOnlyCardHtml).join('')
          );
        })
        .join('');
      listEl.querySelectorAll('[data-action="open-order-detail"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var order = ordersCache.find(function (o) { return o.id === el.getAttribute('data-order-id'); });
          if (order) openOrderDetail(order);
        });
      });
    }

    function openOrderDetail(order) {
      var host = root.querySelector('#em-order-modal-host');
      host.innerHTML = orderDetailModalHtml(order);
      var overlay = host.querySelector('#em-order-detail-overlay');
      function close() { host.innerHTML = ''; }
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      host.querySelectorAll('[data-action="close-order-detail"]').forEach(function (el) { el.addEventListener('click', close); });
    }

    function load() {
      var eventId = AppState.get().currentEventId;
      Promise.all([
        MockApi.getStoresByEvent(eventId),
        MockApi.getStore(currentStoreId),
        MockApi.getOrders(currentStoreId),
        MockApi.getNotificationLogs(currentStoreId),
      ]).then(function (results) {
        storesInEvent = results[0].stores;
        storeCache = results[1].store;
        ordersCache = results[2].orders;
        itemsCache = results[2].orderItems;
        logsCache = results[3].notificationLogs;
        renderStoreBar();
        renderSearchAndFilter();
        renderSegmentTabs();
        renderList();
      });
    }

    function onOrdersChanged() { load(); }
    window.addEventListener('mock:orders-changed', onOrdersChanged);

    load();

    currentUnmount = function () {
      window.removeEventListener('mock:orders-changed', onOrdersChanged);
    };
  }

  function unmount() {
    if (currentUnmount) currentUnmount();
    currentUnmount = null;
  }

  window.Screens = window.Screens || {};
  window.Screens.eventManagerStoreOrders = { render: render, mount: mount, unmount: unmount };
})();
