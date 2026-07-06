/*
 * 주문 — 앱의 기본 화면. 시간대별로 대기/접수/완료 주문을 확인하고 수락·고객 호출·완료 처리를 한다.
 * 실제 이전 시: features/orders/screens/OrderScreen.tsx
 *
 * 상태 흐름: WAITING(대기, 아직 수락 전) -> RECEIVED(접수, 수락 후 완료 전까지 계속 머무름) ->
 * COMPLETED(완료), CANCELED는 취소(완료 이후에도 가능).
 * 상단 세그먼트 탭: 대기(WAITING) / 접수(RECEIVED) / 완료(COMPLETED+CANCELED)
 * 각 탭 내부는 주문 시각 오름차순으로 정렬한 뒤 5분 단위 시간대로 묶어서 보여준다.
 *
 * ⚠️ 정책 완화 안내: '고객 호출' 버튼은 접수(RECEIVED)/완료 탭에서는 상태와 무관하게 몇 번이든
 * 눌릴 수 있다(대기 탭에서는 아직 수락 전이라 호출 버튼 자체가 없다 — 먼저 '주문 수락'을 눌러야 한다).
 * 카카오 알림 문구(MockApi.buildKakaoMessage)는 여전히 "준비되었습니다"로 고정되어 있어, 접수 단계에서
 * 미리 호출하면 실제 상태와 문구가 어긋날 수 있다는 점을 감안해야 한다(문구 자체는 이번 요청 범위가
 * 아니라 그대로 두었다).
 *
 * 완료 처리 횟수(completedCount): 되돌리기로 접수 탭으로 돌아갔다가 다시 완료 처리하면 누적된다.
 * 카드 앞면에는 노출하지 않고, 펼쳐보기(상세) 안에서만 보여준다.
 *
 * 오프라인 시뮬레이션(설정 > 개발자 옵션에서 켜고 끔): AppState.isOffline이 true면
 * - 마지막으로 받아온 주문 목록(ordersCache 등)을 그대로 보여주고 새로 fetch하지 않는다.
 * - 화면 상단에 "오프라인 — 최신 상태 아님" 배너를 띄운다.
 * - 수락/호출/완료 처리/되돌리기/주문취소/일괄 액션 등 쓰기 작업 버튼을 모두 비활성화한다.
 */
(function () {
  var SEGMENTS = [
    { key: 'WAITING', label: '대기' },
    { key: 'RECEIVED', label: '접수' },
    { key: 'DONE', label: '완료' },
  ];
  var CANCEL_REASONS = ['품절', '고객요청', '오류'];
  var CUSTOM_REASON_KEY = 'CUSTOM';
  var REFRESH_INTERVAL_MS = 20000;

  var activeSegment = 'WAITING';
  var expandedIds = {};
  var selectedIds = {};
  var groupCollapsed = {};
  var allExpandedIntent = true;
  var ordersCache = [];
  var itemsCache = [];
  var logsCache = [];
  var selectedCancelReason = null;
  var customCancelReasonText = '';
  var searchOpen = false;
  var searchQuery = '';
  var currentUnmount = null;

  function itemsOf(orderId) {
    return itemsCache.filter(function (it) {
      return it.orderId === orderId;
    });
  }

  function historyOf(orderId) {
    return logsCache
      .filter(function (l) {
        return l.orderId === orderId;
      })
      .sort(function (a, b) {
        return new Date(b.sentAt) - new Date(a.sentAt);
      });
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
    return 'DONE'; // COMPLETED | CANCELED
  }

  function actionButtonsFor(order, segment) {
    var offline = AppState.get().isOffline;
    var callCount = historyOf(order.id).length;
    var callBtn = {
      label: '고객 호출' + (callCount > 0 ? ' (' + callCount + '회)' : ''),
      action: 'call-btn',
      variant: 'primary',
      disabled: offline || order.status === 'CANCELED',
    };
    var cancelBtn = { label: '주문 취소', action: 'cancel-btn', variant: 'danger-solid', disabled: offline || order.status === 'CANCELED' };

    if (segment === 'WAITING') {
      var acceptBtn = { label: '주문 수락', action: 'accept-btn', variant: 'success', disabled: offline };
      return [acceptBtn, cancelBtn];
    }
    if (segment === 'DONE') {
      var revertBtn = { label: '되돌리기', action: 'revert-btn', variant: 'outline', disabled: offline || order.status !== 'COMPLETED' };
      return [callBtn, revertBtn, cancelBtn];
    }
    // RECEIVED
    var completeBtn = { label: '완료 처리', action: 'complete-btn', variant: 'success', disabled: offline || order.status === 'COMPLETED' || order.status === 'CANCELED' };
    return [callBtn, completeBtn, cancelBtn];
  }

  function render() {
    return (
      '<div class="screen">' +
        UI.topBar({ title: '주문', rightIcon: UI.Icons.settings, rightAction: 'go-settings' }) +
        '<div id="order-info-bar-host"></div>' +
        '<div id="order-search-host"></div>' +
        '<div id="offline-banner-host"></div>' +
        '<div id="closed-banner-host"></div>' +
        '<div id="segment-tabs-host"></div>' +
        '<div class="screen-scroll"><div class="order-list" id="order-list"></div></div>' +
        '<div id="customer-modal-host"></div>' +
      '</div>'
    );
  }

  function renderCard(order, segment) {
    var expanded = !!expandedIds[order.id];
    var isCanceled = order.status === 'CANCELED';
    var buttons = actionButtonsFor(order, segment);

    var expandBody = '';
    if (expanded) {
      var items = itemsOf(order.id);
      var history = historyOf(order.id);
      var failedHistory = history.filter(function (h) { return h.status === 'FAIL'; });
      var callNoticeHtml;
      if (history.length === 0) {
        callNoticeHtml = '<div class="helper-text" style="text-align:left;">호출 이력이 없습니다.</div>';
      } else if (failedHistory.length > 0) {
        callNoticeHtml = failedHistory
          .map(function (h) {
            return (
              '<div class="call-history-item"><span>' + UI.badge('발송 실패', 'danger-soft') +
              '</span><span>' + UI.clockLabel(h.sentAt) + ' · 재발송이 필요해요</span></div>'
            );
          })
          .join('');
      } else {
        callNoticeHtml = '<div class="helper-text" style="text-align:left;">모든 호출이 정상 발송되었습니다.</div>';
      }
      expandBody =
        '<div class="order-card-expand">' +
          items
            .map(function (it) {
              return (
                '<div class="order-item-row"><span>' + UI.escapeHtml(it.menuName) +
                (it.optionsSummary ? ' (' + UI.escapeHtml(it.optionsSummary) + ')' : '') +
                ' x ' + it.quantity + '</span><span>' + UI.formatWon(it.unitPrice * it.quantity) + '</span></div>'
              );
            })
            .join('') +
          '<div class="order-item-row" style="font-weight:800;"><span>결제금액</span><span>' + UI.formatWon(order.totalAmount) + '</span></div>' +
          '<div class="order-item-row"><span>완료 처리 횟수</span><span>' + (order.completedCount || 0) + '회</span></div>' +
          callNoticeHtml +
        '</div>';
    }

    return (
      '<div class="order-card ' + (isCanceled ? 'canceled ' : '') + (expanded ? 'expanded' : '') + '" data-order-id="' + order.id + '">' +
        '<div class="order-card-header-row">' +
          '<label class="order-checkbox-label"><input type="checkbox" class="order-select-checkbox" data-order-id="' + order.id + '" ' +
            (selectedIds[order.id] ? 'checked' : '') + ' /></label>' +
          UI.channelBadgeHtml(order) +
          '<span class="order-card-pgno">' + UI.escapeHtml(order.pgOrderNo) + '</span>' +
        '</div>' +
        '<div class="order-card-main" data-action="toggle-expand" data-order-id="' + order.id + '">' +
          '<div class="order-card-content-row">' +
            '<div class="order-card-menu-main">' + UI.escapeHtml(menuSummary(order.id)) + '</div>' +
            UI.pickupBlockHtml(order) +
          '</div>' +
          UI.phoneRowHtml(order) +
          '<div class="order-card-time">' + UI.clockLabel(order.orderedAt) + ' 주문 · ' + UI.timeAgoLabel(order.orderedAt) + '</div>' +
          '<div class="order-card-amount">' + UI.formatWon(order.totalAmount) + '</div>' +
          (isCanceled ? '<div class="order-card-cancel-reason">취소 사유: ' + UI.escapeHtml(order.cancelReason || '-') + '</div>' : '') +
        '</div>' +
        '<div class="order-card-actions">' +
          buttons
            .map(function (btn) {
              return UI.button({ label: btn.label, action: btn.action, variant: btn.variant, disabled: btn.disabled });
            })
            .join('') +
        '</div>' +
        '<div class="order-card-expand-toggle" data-action="toggle-expand" data-order-id="' + order.id + '">' +
          '<span>' + (expanded ? '접기' : '펼쳐보기') + '</span>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
        '</div>' +
        expandBody +
      '</div>'
    );
  }

  function mount(root) {
    activeSegment = 'WAITING';
    expandedIds = {};
    selectedIds = {};
    groupCollapsed = {};
    allExpandedIntent = true;
    searchOpen = false;
    searchQuery = '';
    var refreshTimer = null;
    var storeCache = null;
    var hasLoadedOnce = false;

    root.querySelector('[data-action="go-settings"]').addEventListener('click', function () {
      Router.showScreen('settings');
    });

    function matchesSearch(order) {
      if (!searchQuery) return true;
      var pickup = (order.tableOrPickupNo || '').toString();
      return pickup.indexOf(searchQuery.trim()) !== -1;
    }

    function getGroupsForActiveSegment() {
      var filtered = ordersCache.filter(function (o) {
        return segmentOf(o) === activeSegment && matchesSearch(o);
      });
      // 기본 정렬은 주문 시각 오름차순(먼저 주문한 고객이 위)
      var sorted = filtered.slice().sort(function (a, b) {
        return new Date(a.orderedAt) - new Date(b.orderedAt);
      });
      return UI.groupByBucket(sorted);
    }

    function renderOfflineBanner() {
      var host = root.querySelector('#offline-banner-host');
      host.innerHTML = AppState.get().isOffline
        ? '<div class="offline-banner"><span>📡</span><span>오프라인 — 최신 상태 아님</span></div>'
        : '';
    }

    function loadAndRender() {
      renderOfflineBanner();
      // 오프라인 상태고 이미 한 번 받아온 데이터가 있으면 다시 fetch하지 않고 마지막 캐시로만 다시 그린다.
      if (AppState.get().isOffline && hasLoadedOnce) {
        renderSegmentTabsAndList();
        return;
      }
      var state = AppState.get();
      Promise.all([
        MockApi.getStore(state.currentStoreId),
        MockApi.getOrders(state.currentStoreId),
        MockApi.getNotificationLogs(state.currentStoreId),
      ]).then(function (results) {
        hasLoadedOnce = true;
        storeCache = results[0].store;
        ordersCache = results[1].orders;
        itemsCache = results[1].orderItems;
        logsCache = results[2].notificationLogs;
        renderInfoBar();
        renderSearchRow();
        renderClosedBanner(storeCache.operatingStatus);
        renderSegmentTabsAndList();
      });
    }

    function renderInfoBar() {
      var host = root.querySelector('#order-info-bar-host');
      var user = AppState.get().currentUser;
      var accountLabel = user && user.role === 'OWNER' ? '관리자 계정' : '직원 계정';
      var meta =
        {
          OPEN: { label: '영업 중', dotClass: 'open' },
          PAUSED: { label: '일시중지', dotClass: 'paused' },
          CLOSED: { label: '영업 마감', dotClass: 'closed' },
        }[storeCache ? storeCache.operatingStatus : ''] || { label: '-', dotClass: '' };

      host.innerHTML =
        '<div class="order-info-bar">' +
          '<button class="order-status-pill" data-action="go-settings-status">' +
            '<span class="operating-status-dot ' + meta.dotClass + '"></span>' +
            '<span>' + meta.label + '</span>' +
          '</button>' +
          '<span class="order-account-type">' + UI.escapeHtml(accountLabel) + '</span>' +
        '</div>' +
        '<div class="order-toolbar">' +
          '<button class="icon-btn" data-action="toggle-search">' + UI.Icons.search + '</button>' +
          '<button class="btn-text-sm" data-action="toggle-expand-all">' + (allExpandedIntent ? '전체 접기' : '전체 펼치기') + '</button>' +
        '</div>';

      host.querySelector('[data-action="go-settings-status"]').addEventListener('click', function () {
        Router.showScreen('settings');
      });
      host.querySelector('[data-action="toggle-expand-all"]').addEventListener('click', function () {
        allExpandedIntent = !allExpandedIntent;
        if (allExpandedIntent) {
          groupCollapsed = {};
        } else {
          getGroupsForActiveSegment().forEach(function (g) {
            groupCollapsed[g.key] = true;
          });
        }
        renderInfoBar();
        renderList();
      });
      host.querySelector('[data-action="toggle-search"]').addEventListener('click', function () {
        searchOpen = !searchOpen;
        if (!searchOpen) searchQuery = '';
        renderSearchRow();
        renderList();
      });
    }

    function renderSearchRow() {
      var host = root.querySelector('#order-search-host');
      if (!searchOpen) {
        host.innerHTML = '';
        return;
      }
      host.innerHTML =
        '<div class="order-search-row">' +
          '<input id="pickup-search-input" placeholder="픽업번호/테이블번호로 검색" value="' + UI.escapeHtml(searchQuery) + '" />' +
        '</div>';
      var input = host.querySelector('#pickup-search-input');
      input.focus();
      input.addEventListener('input', function () {
        searchQuery = input.value;
        renderList();
      });
    }

    function renderClosedBanner(operatingStatus) {
      var host = root.querySelector('#closed-banner-host');
      if (operatingStatus === 'OPEN') {
        host.innerHTML = '';
        return;
      }
      var text = operatingStatus === 'PAUSED' ? '일시중지 상태입니다' : '영업 마감 상태입니다';
      host.innerHTML =
        '<div class="closed-banner"><span>🔕</span><span>' + text + ' · 신규 주문이 접수되지 않아요</span></div>';
    }

    function renderSegmentTabsAndList() {
      var counts = { WAITING: 0, RECEIVED: 0, DONE: 0 };
      ordersCache.forEach(function (o) {
        counts[segmentOf(o)]++;
      });
      var tabsHost = root.querySelector('#segment-tabs-host');
      tabsHost.innerHTML = UI.segmentTabs(
        SEGMENTS.map(function (s) {
          return { key: s.key, label: s.label, count: counts[s.key] };
        }),
        activeSegment
      );
      tabsHost.querySelectorAll('[data-action="segment-tab"]').forEach(function (el) {
        el.addEventListener('click', function () {
          activeSegment = el.getAttribute('data-key');
          selectedIds = {};
          groupCollapsed = {};
          renderSegmentTabsAndList();
        });
      });
      renderList();
    }

    function renderList() {
      var listEl = root.querySelector('#order-list');
      var groups = getGroupsForActiveSegment();
      if (groups.length === 0) {
        listEl.innerHTML =
          '<div class="center-empty" style="padding-top:60px;"><div class="emoji">📭</div><div class="title">주문이 없어요</div></div>';
        return;
      }
      listEl.innerHTML = groups
        .map(function (g) {
          var collapsed = !!groupCollapsed[g.key];
          var selectedCount = g.orders.filter(function (o) {
            return selectedIds[o.id];
          }).length;
          var allSelected = g.orders.length > 0 && selectedCount === g.orders.length;
          var header =
            '<div class="time-bucket-header-row">' +
              '<label class="group-select-all-label"><input type="checkbox" data-action="select-all-group" data-bucket="' + g.key + '" ' +
                (allSelected ? 'checked' : '') + ' /></label>' +
              '<span class="time-bucket-title" data-action="toggle-group" data-bucket="' + g.key + '">' +
                UI.bucketLabel(g.key) + ' · ' + g.orders.length + '건' +
                '<svg class="bucket-chevron ' + (collapsed ? '' : 'open') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
              '</span>' +
            '</div>';
          if (collapsed) return header;
          var offline = AppState.get().isOffline;
          var bulkButtonsHtml = '';
          if (selectedCount > 0) {
            if (activeSegment === 'WAITING') {
              bulkButtonsHtml = '<button class="btn-text-sm" data-action="bulk-accept" data-bucket="' + g.key + '" ' + (offline ? 'disabled' : '') + '>일괄 수락</button>';
            } else if (activeSegment === 'RECEIVED') {
              bulkButtonsHtml =
                '<button class="btn-text-sm" data-action="bulk-call" data-bucket="' + g.key + '" ' + (offline ? 'disabled' : '') + '>일괄 호출</button>' +
                '<button class="btn-text-sm" data-action="bulk-complete" data-bucket="' + g.key + '" ' + (offline ? 'disabled' : '') + '>일괄 완료처리</button>';
            } else {
              bulkButtonsHtml = '<button class="btn-text-sm" data-action="bulk-call" data-bucket="' + g.key + '" ' + (offline ? 'disabled' : '') + '>일괄 호출</button>';
            }
          }
          var bulkBar = selectedCount > 0 ? '<div class="group-bulk-bar"><span>' + selectedCount + '건 선택됨</span>' + bulkButtonsHtml + '</div>' : '';
          return header + bulkBar + g.orders.map(function (o) { return renderCard(o, activeSegment); }).join('');
        })
        .join('');
      wireListEvents(listEl, groups);
    }

    function wireListEvents(listEl, groups) {
      listEl.querySelectorAll('[data-action="toggle-group"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var key = el.getAttribute('data-bucket');
          groupCollapsed[key] = !groupCollapsed[key];
          renderList();
        });
      });
      listEl.querySelectorAll('[data-action="select-all-group"]').forEach(function (el) {
        el.addEventListener('change', function () {
          var key = el.getAttribute('data-bucket');
          var group = groups.find(function (g) { return String(g.key) === key; });
          group.orders.forEach(function (o) { selectedIds[o.id] = el.checked; });
          renderList();
        });
      });
      listEl.querySelectorAll('.order-select-checkbox').forEach(function (el) {
        el.addEventListener('change', function () {
          selectedIds[el.getAttribute('data-order-id')] = el.checked;
          renderList();
        });
      });
      listEl.querySelectorAll('[data-action="bulk-accept"]').forEach(function (el) {
        el.addEventListener('click', function () {
          if (AppState.get().isOffline) return;
          var key = el.getAttribute('data-bucket');
          var group = groups.find(function (g) { return String(g.key) === key; });
          var ids = group.orders
            .filter(function (o) { return selectedIds[o.id]; })
            .map(function (o) { return o.id; });
          if (ids.length === 0) return;
          Promise.all(ids.map(function (id) { return MockApi.advanceOrderStatus(id, 'RECEIVED'); })).then(function () {
            ids.forEach(function (id) { delete selectedIds[id]; });
            UI.showToast(ids.length + '건 일괄 수락했습니다');
            loadAndRender();
          });
        });
      });
      listEl.querySelectorAll('[data-action="bulk-call"]').forEach(function (el) {
        el.addEventListener('click', function () {
          if (AppState.get().isOffline) return;
          var key = el.getAttribute('data-bucket');
          var group = groups.find(function (g) { return String(g.key) === key; });
          var ids = group.orders
            .filter(function (o) { return selectedIds[o.id] && o.status !== 'CANCELED'; })
            .map(function (o) { return o.id; });
          if (ids.length === 0) return;
          Promise.all(ids.map(function (id) { return MockApi.sendKakaoAlert(id); })).then(function () {
            ids.forEach(function (id) { delete selectedIds[id]; });
            UI.showToast(ids.length + '건 일괄 호출했습니다');
            loadAndRender();
          });
        });
      });
      listEl.querySelectorAll('[data-action="bulk-complete"]').forEach(function (el) {
        el.addEventListener('click', function () {
          if (AppState.get().isOffline) return;
          var key = el.getAttribute('data-bucket');
          var group = groups.find(function (g) { return String(g.key) === key; });
          var ids = group.orders
            .filter(function (o) { return selectedIds[o.id] && o.status !== 'COMPLETED' && o.status !== 'CANCELED'; })
            .map(function (o) { return o.id; });
          if (ids.length === 0) return;
          Promise.all(ids.map(function (id) { return MockApi.advanceOrderStatus(id, 'COMPLETED'); })).then(function () {
            ids.forEach(function (id) { delete selectedIds[id]; });
            UI.showToast(ids.length + '건 일괄 완료 처리했습니다');
            loadAndRender();
          });
        });
      });

      listEl.querySelectorAll('[data-action="toggle-expand"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-order-id');
          expandedIds[id] = !expandedIds[id];
          renderList();
        });
      });
      listEl.querySelectorAll('.order-card').forEach(function (cardEl) {
        var orderId = cardEl.getAttribute('data-order-id');
        var acceptBtn = cardEl.querySelector('[data-action="accept-btn"]');
        if (acceptBtn) acceptBtn.addEventListener('click', function () { onAcceptClick(orderId); });
        var callBtn = cardEl.querySelector('[data-action="call-btn"]');
        if (callBtn) callBtn.addEventListener('click', function () { doSendKakao(orderId); });
        var completeBtn = cardEl.querySelector('[data-action="complete-btn"]');
        if (completeBtn) completeBtn.addEventListener('click', function () { onCompleteClick(orderId); });
        var revertBtn = cardEl.querySelector('[data-action="revert-btn"]');
        if (revertBtn) revertBtn.addEventListener('click', function () { onRevertClick(orderId); });
        var cancelBtn = cardEl.querySelector('[data-action="cancel-btn"]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { openCancelModal(orderId); });
      });
    }

    function closeModal() {
      var host = root.querySelector('#customer-modal-host');
      if (host) host.innerHTML = '';
    }

    function onAcceptClick(orderId) {
      MockApi.advanceOrderStatus(orderId, 'RECEIVED').then(
        function () {
          UI.showToast('주문을 수락했습니다');
          loadAndRender();
        },
        function (err) {
          UI.showToast(err.code === 'ALREADY_PROCESSED' ? '이미 처리된 주문입니다' : err.message || '처리 중 오류가 발생했습니다');
          loadAndRender();
        }
      );
    }

    function doSendKakao(orderId) {
      MockApi.sendKakaoAlert(orderId).then(
        function (res) {
          UI.showToast(res.success ? '고객 호출 알림을 보냈어요' : '발송 실패');
          loadAndRender();
        },
        function (err) {
          UI.showToast(err.message || '오류가 발생했습니다');
          loadAndRender();
        }
      );
    }

    function onCompleteClick(orderId) {
      MockApi.advanceOrderStatus(orderId, 'COMPLETED').then(
        function () {
          UI.showToast('완료 처리되었습니다');
          loadAndRender();
        },
        function (err) {
          UI.showToast(err.code === 'ALREADY_PROCESSED' ? '이미 처리된 주문입니다' : err.message || '처리 중 오류가 발생했습니다');
          loadAndRender();
        }
      );
    }

    function onRevertClick(orderId) {
      MockApi.revertCompletedToReceived(orderId).then(
        function () {
          UI.showToast('접수 상태로 되돌렸습니다');
          loadAndRender();
        },
        function (err) {
          UI.showToast(err.message || '되돌리기 중 오류가 발생했습니다');
          loadAndRender();
        }
      );
    }

    function openInfoModal(title, message) {
      var host = root.querySelector('#customer-modal-host');
      host.innerHTML =
        '<div class="modal-overlay" id="info-modal-overlay">' +
          '<div class="modal-sheet">' +
            '<div class="modal-sheet-header">' +
              '<span class="modal-sheet-title">' + UI.escapeHtml(title) + '</span>' +
            '</div>' +
            '<div class="modal-sheet-body"><div class="helper-text" style="text-align:left;">' + UI.escapeHtml(message) + '</div></div>' +
            '<div class="modal-sheet-footer">' +
              UI.button({ label: '확인', action: 'close-info-modal', variant: 'primary' }) +
            '</div>' +
          '</div>' +
        '</div>';
      var overlay = host.querySelector('#info-modal-overlay');
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
      host.querySelector('[data-action="close-info-modal"]').addEventListener('click', closeModal);
    }

    function openCancelModal(orderId) {
      selectedCancelReason = null;
      customCancelReasonText = '';
      var host = root.querySelector('#customer-modal-host');

      function renderCancelModal() {
        var isCustom = selectedCancelReason === CUSTOM_REASON_KEY;
        var canConfirm = selectedCancelReason && (!isCustom || customCancelReasonText.trim());
        host.innerHTML =
          '<div class="modal-overlay" id="cancel-modal-overlay">' +
            '<div class="modal-sheet">' +
              '<div class="modal-sheet-header">' +
                '<span class="modal-sheet-title">주문을 취소할까요?</span>' +
                '<button class="icon-btn" data-action="close-modal">' + UI.Icons.close + '</button>' +
              '</div>' +
              '<div class="modal-sheet-body">' +
                '<div class="reason-options">' +
                  CANCEL_REASONS.map(function (r) {
                    return '<button class="reason-option ' + (selectedCancelReason === r ? 'selected' : '') + '" data-action="pick-reason" data-reason="' + r + '">' + r + '</button>';
                  }).join('') +
                  '<button class="reason-option ' + (isCustom ? 'selected' : '') + '" data-action="pick-reason" data-reason="' + CUSTOM_REASON_KEY + '">직접입력</button>' +
                '</div>' +
                (isCustom
                  ? '<input class="input-field" id="cancel-custom-reason" placeholder="직접입력" value="' + UI.escapeHtml(customCancelReasonText) + '" />'
                  : '') +
              '</div>' +
              '<div class="modal-sheet-footer">' +
                UI.button({ label: '취소 확정', action: 'confirm-cancel', variant: 'primary', disabled: !canConfirm }) +
              '</div>' +
            '</div>' +
          '</div>';

        var overlay = host.querySelector('#cancel-modal-overlay');
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
        host.querySelector('[data-action="close-modal"]').addEventListener('click', closeModal);

        host.querySelectorAll('[data-action="pick-reason"]').forEach(function (el) {
          el.addEventListener('click', function () {
            selectedCancelReason = el.getAttribute('data-reason');
            renderCancelModal();
          });
        });

        var customInput = host.querySelector('#cancel-custom-reason');
        if (customInput) {
          customInput.focus();
          customInput.addEventListener('input', function () {
            customCancelReasonText = customInput.value;
            host.querySelector('[data-action="confirm-cancel"]').disabled = !customCancelReasonText.trim();
          });
        }

        host.querySelector('[data-action="confirm-cancel"]').addEventListener('click', function () {
          var reason = isCustom ? customCancelReasonText.trim() : selectedCancelReason;
          if (!reason) return;
          MockApi.cancelOrder(orderId, reason).then(
            function () {
              closeModal();
              openInfoModal('취소 완료', '취소 처리가 완료되었습니다');
              loadAndRender();
            },
            function (err) {
              closeModal();
              UI.showToast(err.code === 'ALREADY_PROCESSED' ? '이미 처리된 주문입니다' : err.message || '취소 중 오류가 발생했습니다');
              loadAndRender();
            }
          );
        });
      }

      renderCancelModal();
    }

    function onOrdersChanged() {
      loadAndRender();
    }
    function onNewOrder(e) {
      var order = e.detail.order;
      UI.showBanner('새 주문이 접수되었습니다 · #' + order.orderNo, function () {
        activeSegment = 'WAITING';
        selectedIds = {};
        groupCollapsed = {};
        renderSegmentTabsAndList();
      });
    }

    window.addEventListener('mock:orders-changed', onOrdersChanged);
    window.addEventListener('mock:new-order', onNewOrder);
    refreshTimer = setInterval(loadAndRender, REFRESH_INTERVAL_MS);

    loadAndRender();

    currentUnmount = function () {
      clearInterval(refreshTimer);
      window.removeEventListener('mock:orders-changed', onOrdersChanged);
      window.removeEventListener('mock:new-order', onNewOrder);
    };
  }

  function unmount() {
    if (currentUnmount) currentUnmount();
    currentUnmount = null;
  }

  window.Screens = window.Screens || {};
  window.Screens.customers = { render: render, mount: mount, unmount: unmount };
})();
