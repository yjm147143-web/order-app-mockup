/*
 * 설정 화면 — 앱 어디서든(현재는 '주문' 화면 상단 고정 아이콘) 같은 위치에서 진입한다.
 * 실제 이전 시: features/settings/screens/SettingsScreen.tsx
 *
 * 최상단: 영업상태 카드(CLOSED/OPEN/PAUSED 3단계, 버튼 클릭 시 확인 팝업 후 전환).
 * 그 아래: 매장 정보, 재고 소진 시 자동 품절 토글, 메뉴 추가 및 수정(→ menu 화면),
 * 매출 조회(→ sales 화면), 직원 계정 관리, 로그아웃.
 * (카테고리 관리는 여기 두지 않는다 — 메뉴 관리 화면 자체의 상단에 있음. menu.js 참고)
 * 맨 아래: 개발자 옵션(디버그) — 오프라인 시뮬레이션 토글 + 테스트 주문 5건 생성 버튼.
 * AppState.isOffline 은 세션 간 유지되지 않고 새로고침하면 항상 false로 초기화된다
 * (테스트 중 켜둔 채 잊어버리는 것 방지).
 */
(function () {
  var STATUS_META = {
    CLOSED: { label: '영업 마감', desc: '새 주문을 받지 않고 있어요', dotClass: 'closed' },
    OPEN: { label: '영업 중', desc: '고객이 QR/태블릿으로 주문할 수 있어요', dotClass: 'open' },
    PAUSED: { label: '일시중지', desc: '일시적으로 새 주문을 받지 않고 있어요', dotClass: 'paused' },
  };

  function actionsFor(status) {
    if (status === 'CLOSED') {
      return [
        { label: '개점', variant: 'success', target: 'OPEN', confirm: '영업을 시작할까요? 시작하면 고객의 새 주문을 받을 수 있어요.' },
      ];
    }
    if (status === 'OPEN') {
      return [
        { label: '일시중지', variant: 'warning', target: 'PAUSED', confirm: '영업을 일시중지할까요? 일시중지하면 새 주문을 받을 수 없어요.' },
        { label: '마감', variant: 'danger-solid', target: 'CLOSED', confirm: '영업을 마감할까요? 마감하면 새 주문을 받을 수 없어요.' },
      ];
    }
    // PAUSED
    return [
      { label: '일시중지 해제', variant: 'success', target: 'OPEN', confirm: '일시중지를 해제할까요? 해제하면 다시 새 주문을 받을 수 있어요.' },
      { label: '마감', variant: 'danger-solid', target: 'CLOSED', confirm: '영업을 마감할까요? 마감하면 새 주문을 받을 수 없어요.' },
    ];
  }

  function render() {
    return (
      '<div class="screen">' +
        UI.topBar({ title: '설정', leftIcon: UI.Icons.back, leftAction: 'go-back' }) +
        '<div class="screen-scroll" style="padding: 8px 20px 24px;">' +
          '<div class="card operating-status-card" id="operating-status-card">' +
            '<div class="operating-status-header">' +
              '<span class="operating-status-dot" id="operating-status-dot"></span>' +
              '<span class="operating-status-label" id="operating-status-label">-</span>' +
            '</div>' +
            '<div class="operating-status-desc" id="operating-status-desc"></div>' +
            '<div class="operating-status-actions" id="operating-status-actions"></div>' +
          '</div>' +
          '<div class="card" id="store-info-card" style="margin-bottom:16px;">' +
            '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px;">매장 정보</div>' +
            '<div id="store-info-body" style="font-size:15px;line-height:1.7;">불러오는 중...</div>' +
          '</div>' +
          '<div class="card" style="margin-bottom:16px;">' +
            '<div class="toggle-row">' +
              '<div>' +
                '<div style="font-weight:700;font-size:15px;">재고 소진 시 자동 품절</div>' +
                '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px;">메뉴 재고가 0개가 되면 자동으로 품절 처리해요</div>' +
              '</div>' +
              UI.toggle(true, 'toggle-auto-soldout') +
            '</div>' +
          '</div>' +
          '<div class="settings-list-item" data-action="go-menu">' +
            '<span class="settings-list-icon">' + UI.Icons.menu + '</span>' +
            '<span class="settings-list-label">메뉴 추가 및 수정</span>' +
            '<span class="settings-list-chevron">' + UI.Icons.chevronRight + '</span>' +
          '</div>' +
          '<div class="settings-list-item" data-action="go-sales">' +
            '<span class="settings-list-icon">' + UI.Icons.chart + '</span>' +
            '<span class="settings-list-label">매출 조회</span>' +
            '<span class="settings-list-chevron">' + UI.Icons.chevronRight + '</span>' +
          '</div>' +
          '<div class="settings-list-item" data-action="noop">' +
            '<span class="settings-list-icon">' + UI.Icons.customers + '</span>' +
            '<span class="settings-list-label">직원 계정 관리</span>' +
            UI.badge('다음 단계 예정', 'neutral') +
          '</div>' +
          '<hr class="divider" />' +
          '<div style="display:flex;justify-content:center;margin-bottom:32px;">' +
            UI.button({ label: '로그아웃', action: 'logout', variant: 'outline' }) +
          '</div>' +
          '<div class="debug-section">' +
            '<div class="debug-section-title">개발자 옵션</div>' +
            '<div class="card" style="margin-bottom:12px;">' +
              '<div class="toggle-row">' +
                '<div>' +
                  '<div style="font-weight:700;font-size:14px;">오프라인 시뮬레이션</div>' +
                  '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">주문 화면에서 연결이 끊긴 상태를 흉내내요(디버그용)</div>' +
                '</div>' +
                UI.toggle(false, 'toggle-offline-sim') +
              '</div>' +
            '</div>' +
            '<div class="card">' +
              '<div style="font-weight:700;font-size:14px;margin-bottom:4px;">테스트 주문 생성</div>' +
              '<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:10px;">무작위 신규 주문 5건을 즉시 만들어요(영업 중일 때만 생성돼요)</div>' +
              UI.button({ label: '주문 넣기', action: 'add-test-orders', variant: 'secondary' }) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="settings-modal-host"></div>' +
      '</div>'
    );
  }

  function mount(root) {
    var state = AppState.get();
    var currentActions = [];

    function closeModal() {
      var host = root.querySelector('#settings-modal-host');
      if (host) host.innerHTML = '';
    }

    function openConfirmModal(message, onConfirm) {
      var host = root.querySelector('#settings-modal-host');
      host.innerHTML = UI.confirmModalHtml({
        overlayId: 'settings-confirm-overlay',
        title: '영업상태 변경',
        message: message,
        confirmLabel: '확인',
        confirmAction: 'confirm-yes',
        closeAction: 'close-modal',
      });
      var overlay = host.querySelector('#settings-confirm-overlay');
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
      host.querySelectorAll('[data-action="close-modal"]').forEach(function (el) {
        el.addEventListener('click', closeModal);
      });
      host.querySelector('[data-action="confirm-yes"]').addEventListener('click', function () {
        closeModal();
        onConfirm();
      });
    }

    function renderOperatingStatus(status) {
      var meta = STATUS_META[status] || STATUS_META.OPEN;
      currentActions = actionsFor(status);
      root.querySelector('#operating-status-dot').className = 'operating-status-dot ' + meta.dotClass;
      root.querySelector('#operating-status-label').textContent = meta.label;
      root.querySelector('#operating-status-desc').textContent = meta.desc;
      var actionsHost = root.querySelector('#operating-status-actions');
      actionsHost.innerHTML = currentActions
        .map(function (a, idx) {
          return UI.button({ label: a.label, action: 'operating-action', variant: a.variant }).replace(
            'data-action="operating-action"',
            'data-action="operating-action" data-idx="' + idx + '"'
          );
        })
        .join('');
      actionsHost.querySelectorAll('[data-action="operating-action"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var action = currentActions[Number(el.getAttribute('data-idx'))];
          openConfirmModal(action.confirm, function () {
            MockApi.updateStoreOperatingStatus(state.currentStoreId, action.target).then(function (res) {
              UI.showToast(STATUS_META[res.store.operatingStatus].label + ' 상태로 변경했어요');
              renderOperatingStatus(res.store.operatingStatus);
            });
          });
        });
      });
    }

    MockApi.getStore(state.currentStoreId).then(function (res) {
      var s = res.store;
      renderOperatingStatus(s.operatingStatus);
      root.querySelector('#store-info-body').innerHTML =
        '<div><strong>' + UI.escapeHtml(s.name) + '</strong></div>' +
        '<div style="color:var(--color-text-secondary);">' + UI.escapeHtml(s.address) + '</div>' +
        '<div style="color:var(--color-text-secondary);">' + UI.escapeHtml(s.phone) + ' · ' + UI.escapeHtml(s.businessHours) + '</div>';

      var autoSoldoutToggle = root.querySelector('[data-action="toggle-auto-soldout"]');
      autoSoldoutToggle.classList.toggle('on', s.autoSoldoutOnZeroStock !== false);
      autoSoldoutToggle.addEventListener('click', function () {
        var next = !this.classList.contains('on');
        MockApi.setAutoSoldoutOnZeroStock(state.currentStoreId, next).then(function (r) {
          autoSoldoutToggle.classList.toggle('on', r.store.autoSoldoutOnZeroStock);
          UI.showToast(r.store.autoSoldoutOnZeroStock ? '재고 소진 시 자동 품절을 켰어요' : '재고 소진 시 자동 품절을 껐어요');
        });
      });
    });

    var offlineToggle = root.querySelector('[data-action="toggle-offline-sim"]');
    offlineToggle.classList.toggle('on', AppState.get().isOffline);
    offlineToggle.addEventListener('click', function () {
      var next = !this.classList.contains('on');
      AppState.setOffline(next);
      this.classList.toggle('on', next);
      UI.showToast(next ? '오프라인 상태를 흉내내기 시작했어요' : '온라인 상태로 돌아왔어요');
    });

    root.querySelector('[data-action="add-test-orders"]').addEventListener('click', function () {
      var btn = this;
      var storeId = state.currentStoreId;
      btn.disabled = true;

      function createOne(remaining, successCount) {
        if (remaining <= 0) return Promise.resolve(successCount);
        return MockApi.createRandomOrder(storeId).then(
          function () { return createOne(remaining - 1, successCount + 1); },
          function () { return createOne(remaining - 1, successCount); }
        );
      }

      createOne(5, 0).then(function (successCount) {
        btn.disabled = false;
        if (successCount === 5) {
          UI.showToast('신규 주문 5건을 넣었어요');
        } else if (successCount > 0) {
          UI.showToast(successCount + '건만 생성했어요 · 영업 중이 아니면 생성되지 않아요');
        } else {
          UI.showToast('주문을 생성하지 못했어요 · 영업 중 상태에서만 가능해요');
        }
      });
    });

    root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
      Router.showScreen('customers');
    });

    root.querySelector('[data-action="go-menu"]').addEventListener('click', function () {
      Router.showScreen('menu');
    });

    root.querySelector('[data-action="go-sales"]').addEventListener('click', function () {
      Router.showScreen('sales', { reset: true });
    });

    root.querySelector('[data-action="logout"]').addEventListener('click', function () {
      OrderSimulator.stop();
      AppState.logout();
      Router.showScreen('login');
    });
  }

  window.Screens = window.Screens || {};
  window.Screens.settings = { render: render, mount: mount };
})();
