/*
 * 행사 담당자 '매장 현황' 화면 — eventManagerShell.js의 'STORES' 탭 안에서 렌더링되는 모듈.
 * Router에 등록된 화면이 아니라 셸이 직접 render()/mount()/unmount()를 호출하는 하위 컴포넌트다
 * (eventManagerHome.js와 동일한 패턴).
 *
 * 이 파일은 window.EventManagerStores.runBulkAction(...)도 함께 노출한다 — 홈 대시보드(STEP 2)의
 * '전체 매장 마감/개점' 빠른 액션 버튼이 바로 이 함수를 호출해서 동일한 확인 팝업 → 처리 →
 * 결과 요약 → 감사 로그 흐름을 그대로 재사용한다(로직을 두 곳에 따로 구현하지 않는다).
 */
(function () {
  var STATUS_META = {
    OPEN: { label: '영업중', dotClass: 'open', actionLabel: '개점', variant: 'success' },
    PAUSED: { label: '일시중지', dotClass: 'paused', actionLabel: '일시중지', variant: 'warning' },
    CLOSED: { label: '마감', dotClass: 'closed', actionLabel: '마감', variant: 'danger-solid' },
  };
  var FILTERS = [
    { key: 'ALL', label: '전체' },
    { key: 'OPEN', label: '영업중' },
    { key: 'PAUSED', label: '일시중지' },
    { key: 'CLOSED', label: '마감' },
  ];
  var SORTS = [
    { key: 'NAME', label: '이름순' },
    { key: 'SALES', label: '매출 높은순' },
    { key: 'STATUS', label: '상태별' },
  ];
  var STATUS_SORT_RANK = { OPEN: 0, PAUSED: 1, CLOSED: 2 };

  var storesCache = [];
  var selectedIds = {};
  var searchQuery = '';
  var statusFilter = 'ALL';
  var sortMode = 'NAME';
  var onDashboardChanged = null;

  /* ---------------- 공용: 일괄 조치 확인 → 처리 → 결과 요약 (홈 대시보드에서도 재사용) ---------------- */

  function buildScopeLabel(scopeType, count) {
    return scopeType === 'ALL' ? '전체 ' + count + '개' : '선택한 ' + count + '개';
  }

  /**
   * opts: { eventId, scopeType('ALL'|'SELECTED'), storeIds(대상, null이면 이벤트 전체), targetStatus, hostEl, onDone }
   * hostEl: 모달을 그려넣을 컨테이너 엘리먼트 — 호출하는 화면(홈 대시보드 / 매장 현황)이 각자 준비한다.
   */
  function runBulkAction(opts) {
    MockApi.getStoresByEvent(opts.eventId).then(function (res) {
      var allStores = res.stores;
      var targetIds = opts.storeIds && opts.storeIds.length ? opts.storeIds : allStores.map(function (s) { return s.id; });
      var targetStores = allStores.filter(function (s) { return targetIds.indexOf(s.id) !== -1; });
      var meta = STATUS_META[opts.targetStatus];
      var alreadyCount = targetStores.filter(function (s) { return s.operatingStatus === opts.targetStatus; }).length;
      var scopeLabel = buildScopeLabel(opts.scopeType, targetStores.length);
      var message =
        scopeLabel + ' 매장을 ' + meta.actionLabel + '할까요?' +
        (alreadyCount > 0 ? ' 이미 ' + meta.label + ' 상태인 매장 ' + alreadyCount + '개는 제외됩니다.' : '');

      openConfirmModal(opts.hostEl, meta.actionLabel + ' 확인', message, meta.actionLabel, function () {
        executeBulkUpdate(targetIds, opts.targetStatus, opts.hostEl, opts.onDone);
      });
    });
  }

  function executeBulkUpdate(storeIds, targetStatus, hostEl, onDone) {
    MockApi.bulkUpdateStoreStatus(storeIds, targetStatus).then(function (result) {
      showResultModal(hostEl, result, targetStatus, onDone);
      if (onDone) onDone();
    });
  }

  function closeHostModal(hostEl) {
    hostEl.innerHTML = '';
  }

  function openConfirmModal(hostEl, title, message, confirmLabel, onConfirm) {
    hostEl.innerHTML =
      '<div class="modal-overlay" id="em-bulk-confirm-overlay">' +
        '<div class="modal-sheet">' +
          '<div class="modal-sheet-header">' +
            '<span class="modal-sheet-title">' + UI.escapeHtml(title) + '</span>' +
            '<button class="icon-btn" data-action="em-bulk-close">' + UI.Icons.close + '</button>' +
          '</div>' +
          '<div class="modal-sheet-body"><div class="helper-text" style="text-align:left;">' + UI.escapeHtml(message) + '</div></div>' +
          '<div class="modal-sheet-footer">' +
            UI.button({ label: confirmLabel, action: 'em-bulk-confirm', variant: 'primary' }) +
            UI.button({ label: '취소', action: 'em-bulk-close', variant: 'outline' }) +
          '</div>' +
        '</div>' +
      '</div>';
    var overlay = hostEl.querySelector('#em-bulk-confirm-overlay');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeHostModal(hostEl); });
    hostEl.querySelectorAll('[data-action="em-bulk-close"]').forEach(function (el) {
      el.addEventListener('click', function () { closeHostModal(hostEl); });
    });
    hostEl.querySelector('[data-action="em-bulk-confirm"]').addEventListener('click', function () {
      closeHostModal(hostEl);
      onConfirm();
    });
  }

  function showResultModal(hostEl, result, targetStatus, onDone) {
    var hasFailed = result.failed.length > 0;
    hostEl.innerHTML =
      '<div class="modal-overlay" id="em-result-overlay">' +
        '<div class="modal-sheet">' +
          '<div class="modal-sheet-header">' +
            '<span class="modal-sheet-title">처리 결과</span>' +
            '<button class="icon-btn" data-action="em-result-close">' + UI.Icons.close + '</button>' +
          '</div>' +
          '<div class="modal-sheet-body">' +
            '<div class="order-item-row"><span>성공</span><span>' + result.succeeded.length + '개</span></div>' +
            '<div class="order-item-row"><span>이미 같은 상태라 제외</span><span>' + result.skipped.length + '개</span></div>' +
            '<div class="order-item-row"><span style="color:var(--color-accent-red);">실패</span><span style="color:var(--color-accent-red);">' + result.failed.length + '개</span></div>' +
            (hasFailed
              ? '<div class="helper-text" style="text-align:left;margin-top:8px;">실패: ' + result.failed.map(function (f) { return UI.escapeHtml(f.storeName); }).join(', ') + '</div>'
              : '') +
          '</div>' +
          '<div class="modal-sheet-footer">' +
            (hasFailed ? UI.button({ label: '실패 건 재시도', action: 'em-result-retry', variant: 'primary' }) : '') +
            UI.button({ label: '확인', action: 'em-result-close', variant: hasFailed ? 'outline' : 'primary' }) +
          '</div>' +
        '</div>' +
      '</div>';
    var overlay = hostEl.querySelector('#em-result-overlay');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeHostModal(hostEl); });
    hostEl.querySelectorAll('[data-action="em-result-close"]').forEach(function (el) {
      el.addEventListener('click', function () { closeHostModal(hostEl); });
    });
    var retryBtn = hostEl.querySelector('[data-action="em-result-retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        var retryIds = result.failed.map(function (f) { return f.storeId; });
        closeHostModal(hostEl);
        executeBulkUpdate(retryIds, targetStatus, hostEl, onDone);
      });
    }
  }

  /* ---------------- 화면 렌더링 ---------------- */

  function render() {
    return (
      '<div style="padding: 8px 20px 24px;">' +
        '<div style="display:flex;gap:6px;margin-bottom:14px;">' +
          '<div style="flex:1;">' + UI.button({ label: '전체 개점', action: 'bulk-all-open', variant: 'success' }) + '</div>' +
          '<div style="flex:1;">' + UI.button({ label: '전체 일시중지', action: 'bulk-all-pause', variant: 'warning' }) + '</div>' +
          '<div style="flex:1;">' + UI.button({ label: '전체 마감', action: 'bulk-all-close', variant: 'danger-solid' }) + '</div>' +
        '</div>' +
        '<div class="order-search-row" style="padding:0;margin-bottom:10px;">' +
          '<input id="em-store-search" placeholder="매장명으로 검색" value="' + UI.escapeHtml(searchQuery) + '" />' +
        '</div>' +
        '<div id="em-store-filter-host" style="margin-bottom:8px;"></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">' +
          '<select id="em-store-sort" class="input-field" style="width:auto;">' +
            SORTS.map(function (s) { return '<option value="' + s.key + '" ' + (s.key === sortMode ? 'selected' : '') + '>' + s.label + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div id="em-store-list"></div>' +
        '<div id="em-store-bulk-bar"></div>' +
        '<div id="em-store-modal-host"></div>' +
      '</div>'
    );
  }

  function timeAgoOrDash(iso) {
    return iso ? UI.timeAgoLabel(iso) : '-';
  }

  function storeCardHtml(store) {
    var meta = STATUS_META[store.operatingStatus];
    var checked = !!selectedIds[store.id];
    var actionButtons = actionButtonsFor(store);
    return (
      '<div class="card" style="margin-bottom:10px;" data-store-id="' + store.id + '">' +
        '<div style="display:flex;gap:10px;">' +
          '<label class="order-checkbox-label" style="padding-top:2px;">' +
            '<input type="checkbox" class="em-store-checkbox" data-store-id="' + store.id + '" ' + (checked ? 'checked' : '') + ' />' +
          '</label>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
              '<span style="font-weight:800;font-size:15px;">' + UI.escapeHtml(store.name) + '</span>' +
              '<span class="operating-status-dot ' + meta.dotClass + '"></span>' +
              '<span style="font-size:12px;font-weight:700;">' + meta.label + '</span>' +
            '</div>' +
            '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">' +
              (store.boothNumber ? UI.escapeHtml(store.boothNumber) + ' · ' : '') + '상태 변경 ' + timeAgoOrDash(store.statusChangedAt) +
            '</div>' +
            '<div style="display:flex;gap:16px;margin-top:6px;font-size:13px;">' +
              '<span>오늘 매출 <strong>' + UI.formatWon(store.todaySalesAmount || 0) + '</strong></span>' +
              '<span>주문 <strong>' + (store.todayOrderCount || 0) + '건</strong></span>' +
            '</div>' +
            '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;">' +
              UI.escapeHtml(store.ownerName || '-') + ' · ' + UI.escapeHtml(store.ownerPhone || '-') +
            '</div>' +
            '<div class="store-row-actions" style="display:flex;gap:6px;margin-top:8px;">' +
              actionButtons
                .map(function (b) {
                  return UI.button({ label: b.label, action: 'store-status-btn', variant: b.variant })
                    .replace('data-action="store-status-btn"', 'data-action="store-status-btn" data-store-id="' + store.id + '" data-target="' + b.target + '"');
                })
                .join('') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function actionButtonsFor(store) {
    if (store.operatingStatus === 'OPEN') {
      return [
        { label: '일시중지', target: 'PAUSED', variant: 'warning' },
        { label: '마감', target: 'CLOSED', variant: 'danger-solid' },
      ];
    }
    if (store.operatingStatus === 'PAUSED') {
      return [
        { label: '개점', target: 'OPEN', variant: 'success' },
        { label: '마감', target: 'CLOSED', variant: 'danger-solid' },
      ];
    }
    return [{ label: '개점', target: 'OPEN', variant: 'success' }];
  }

  function visibleStores() {
    var list = storesCache.slice();
    if (statusFilter !== 'ALL') {
      list = list.filter(function (s) { return s.operatingStatus === statusFilter; });
    }
    if (searchQuery.trim()) {
      var q = searchQuery.trim();
      list = list.filter(function (s) { return s.name.indexOf(q) !== -1; });
    }
    if (sortMode === 'NAME') {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
    } else if (sortMode === 'SALES') {
      list.sort(function (a, b) { return (b.todaySalesAmount || 0) - (a.todaySalesAmount || 0); });
    } else if (sortMode === 'STATUS') {
      list.sort(function (a, b) { return STATUS_SORT_RANK[a.operatingStatus] - STATUS_SORT_RANK[b.operatingStatus]; });
    }
    return list;
  }

  function mount(root) {
    var eventId = AppState.get().currentEventId;
    selectedIds = {};

    function load() {
      MockApi.getStoresByEvent(eventId).then(function (res) {
        storesCache = res.stores;
        renderFilterTabs();
        renderList();
      });
    }

    function renderFilterTabs() {
      var counts = { ALL: storesCache.length, OPEN: 0, PAUSED: 0, CLOSED: 0 };
      storesCache.forEach(function (s) { counts[s.operatingStatus] = (counts[s.operatingStatus] || 0) + 1; });
      var host = root.querySelector('#em-store-filter-host');
      host.innerHTML = UI.segmentTabs(
        FILTERS.map(function (f) { return { key: f.key, label: f.label, count: counts[f.key] || 0 }; }),
        statusFilter
      );
      host.querySelectorAll('[data-action="segment-tab"]').forEach(function (el) {
        el.addEventListener('click', function () {
          statusFilter = el.getAttribute('data-key');
          renderFilterTabs();
          renderList();
        });
      });
    }

    function renderList() {
      var listEl = root.querySelector('#em-store-list');
      var list = visibleStores();
      if (list.length === 0) {
        listEl.innerHTML = '<div class="center-empty" style="padding-top:40px;"><div class="emoji">🏪</div><div class="title">해당하는 매장이 없어요</div></div>';
      } else {
        listEl.innerHTML = list.map(storeCardHtml).join('');
      }
      wireListEvents();
      renderBulkBar();
    }

    function wireListEvents() {
      root.querySelectorAll('.em-store-checkbox').forEach(function (el) {
        el.addEventListener('change', function () {
          var id = el.getAttribute('data-store-id');
          if (el.checked) selectedIds[id] = true;
          else delete selectedIds[id];
          renderBulkBar();
        });
      });
      root.querySelectorAll('[data-action="store-status-btn"]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation(); // 이 버튼은 'view-store-orders' 클릭 영역 안에 있어 버블링을 막아야 매장 상세로 잘못 넘어가지 않는다
          var storeId = el.getAttribute('data-store-id');
          var target = el.getAttribute('data-target');
          // 개별 매장 변경은 즉시 반영되는 가벼운 조작이라 확인 팝업/감사 로그 없이 바로 처리한다
          // (일괄 조치와 의도적으로 다르게 설계 — 상단 파일 주석 및 README 참고).
          MockApi.updateStoreOperatingStatus(storeId, target).then(
            function () {
              UI.showToast(STATUS_META[target].label + ' 상태로 변경했어요');
              load();
            },
            function (err) {
              UI.showToast(err.message || '상태 변경에 실패했습니다');
            }
          );
        });
      });
    }

    function renderBulkBar() {
      var host = root.querySelector('#em-store-bulk-bar');
      var count = Object.keys(selectedIds).length;
      if (count === 0) {
        host.innerHTML = '';
        return;
      }
      host.innerHTML =
        '<div class="group-bulk-bar" style="position:sticky;bottom:0;margin-top:8px;">' +
          '<span>' + count + '개 매장 선택됨</span>' +
          '<button class="btn-text-sm" data-action="bulk-selected-open">개점</button>' +
          '<button class="btn-text-sm" data-action="bulk-selected-pause">일시중지</button>' +
          '<button class="btn-text-sm" data-action="bulk-selected-close">마감</button>' +
        '</div>';
      host.querySelector('[data-action="bulk-selected-open"]').addEventListener('click', function () { runSelectedBulk('OPEN'); });
      host.querySelector('[data-action="bulk-selected-pause"]').addEventListener('click', function () { runSelectedBulk('PAUSED'); });
      host.querySelector('[data-action="bulk-selected-close"]').addEventListener('click', function () { runSelectedBulk('CLOSED'); });
    }

    function modalHost() {
      return root.querySelector('#em-store-modal-host');
    }

    function runAllBulk(targetStatus) {
      runBulkAction({
        eventId: eventId,
        scopeType: 'ALL',
        storeIds: null,
        targetStatus: targetStatus,
        hostEl: modalHost(),
        onDone: function () { load(); },
      });
    }

    function runSelectedBulk(targetStatus) {
      var ids = Object.keys(selectedIds);
      if (ids.length === 0) return;
      runBulkAction({
        eventId: eventId,
        scopeType: 'SELECTED',
        storeIds: ids,
        targetStatus: targetStatus,
        hostEl: modalHost(),
        onDone: function () {
          selectedIds = {};
          load();
        },
      });
    }

    root.querySelector('[data-action="bulk-all-open"]').addEventListener('click', function () { runAllBulk('OPEN'); });
    root.querySelector('[data-action="bulk-all-pause"]').addEventListener('click', function () { runAllBulk('PAUSED'); });
    root.querySelector('[data-action="bulk-all-close"]').addEventListener('click', function () { runAllBulk('CLOSED'); });

    var searchInput = root.querySelector('#em-store-search');
    searchInput.addEventListener('input', function () {
      searchQuery = searchInput.value;
      renderList();
    });

    root.querySelector('#em-store-sort').addEventListener('change', function (e) {
      sortMode = e.target.value;
      renderList();
    });

    onDashboardChanged = function () { load(); };
    window.addEventListener('mock:dashboard-changed', onDashboardChanged);

    load();
  }

  function unmount() {
    if (onDashboardChanged) {
      window.removeEventListener('mock:dashboard-changed', onDashboardChanged);
      onDashboardChanged = null;
    }
    selectedIds = {};
  }

  window.EventManagerStores = { render: render, mount: mount, unmount: unmount, runBulkAction: runBulkAction };
})();
