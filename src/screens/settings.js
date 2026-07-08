/*
 * 설정 화면 — 앱 어디서든(현재는 '주문' 화면 상단 고정 아이콘) 같은 위치에서 진입한다.
 * 실제 이전 시: features/settings/screens/SettingsScreen.tsx
 *
 * 목록 순서(고정): 영업상태 카드 → 메뉴 추가 및 수정 → 예상 대기시간 관리 → 매출 조회 →
 * 직원 계정 관리 → QR 메뉴판 보기 → 재고 소진 시 자동 품절 → 자동 수락 → 매장 정보 → 로그아웃.
 * '재고 소진 시 자동 품절'/'자동 수락'은 각각 다른 화면에 묻혀있던 토글이 아니라 이 화면
 * 리스트에 눈에 보이는 독립 항목으로 승격되어 있다 — 리스트 행 그대로에 토글을 붙인 형태
 * (`.settings-list-item`에서 트레일링 요소만 chevron 대신 토글로 바꿈, 행 전체를 눌러도
 * 토글되도록 클릭 핸들러를 행에 붙였다).
 * (카테고리 관리는 여기 두지 않는다 — 메뉴 관리 화면 자체의 상단에 있음. menu.js 참고)
 *
 * 개발자 옵션(오프라인 시뮬레이션 토글, 테스트 주문 생성 버튼)은 이 리스트에서 완전히 뺐다 —
 * 화면 어디서든 항상 떠 있는 우하단 핀 버튼으로 옮겼다(src/components/devOptionsPanel.js 참고).
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
          '<div class="settings-list-item" data-action="go-menu">' +
            '<span class="settings-list-icon">' + UI.Icons.menu + '</span>' +
            '<span class="settings-list-label">메뉴 추가 및 수정</span>' +
            '<span class="settings-list-chevron">' + UI.Icons.chevronRight + '</span>' +
          '</div>' +
          '<div class="settings-list-item" data-action="go-wait-time">' +
            '<span class="settings-list-icon">' + UI.Icons.clock + '</span>' +
            '<span class="settings-list-label">예상 대기시간 관리</span>' +
            '<span class="settings-list-chevron">' + UI.Icons.chevronRight + '</span>' +
          '</div>' +
          '<div class="settings-list-item" data-action="go-sales">' +
            '<span class="settings-list-icon">' + UI.Icons.chart + '</span>' +
            '<span class="settings-list-label">매출 조회</span>' +
            '<span class="settings-list-chevron">' + UI.Icons.chevronRight + '</span>' +
          '</div>' +
          '<div class="settings-list-item" data-action="go-staff">' +
            '<span class="settings-list-icon">' + UI.Icons.customers + '</span>' +
            '<span class="settings-list-label">직원 계정 관리</span>' +
            '<span class="settings-list-chevron">' + UI.Icons.chevronRight + '</span>' +
          '</div>' +
          '<div class="settings-list-item" data-action="go-qr-menu">' +
            '<span class="settings-list-icon">' + UI.Icons.qr + '</span>' +
            '<span class="settings-list-label">QR 메뉴판 보기</span>' +
            '<span class="settings-list-chevron">' + UI.Icons.chevronRight + '</span>' +
          '</div>' +
          '<div class="settings-list-item" data-action="toggle-auto-soldout-row">' +
            '<span class="settings-list-icon">' + UI.Icons.box + '</span>' +
            '<span class="settings-list-label">재고 소진 시 자동 품절</span>' +
            UI.toggle(true, 'toggle-auto-soldout') +
          '</div>' +
          '<div class="settings-list-item" data-action="toggle-auto-accept-row">' +
            '<span class="settings-list-icon">' + UI.Icons.bolt + '</span>' +
            '<span class="settings-list-label">자동 수락</span>' +
            UI.toggle(false, 'toggle-auto-accept') +
          '</div>' +
          '<div class="card" id="store-info-card" style="margin-bottom:16px;">' +
            '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px;">매장 정보</div>' +
            '<div id="store-info-body" style="font-size:15px;line-height:1.7;">불러오는 중...</div>' +
          '</div>' +
          '<hr class="divider" />' +
          '<div style="display:flex;justify-content:center;margin-bottom:24px;">' +
            UI.button({ label: '로그아웃', action: 'logout', variant: 'outline' }) +
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
      root.querySelector('[data-action="toggle-auto-soldout-row"]').addEventListener('click', function () {
        var next = !autoSoldoutToggle.classList.contains('on');
        MockApi.setAutoSoldoutOnZeroStock(state.currentStoreId, next).then(function (r) {
          autoSoldoutToggle.classList.toggle('on', r.store.autoSoldoutOnZeroStock);
          UI.showToast(r.store.autoSoldoutOnZeroStock ? '재고 소진 시 자동 품절을 켰어요' : '재고 소진 시 자동 품절을 껐어요');
        });
      });

      var autoAcceptToggle = root.querySelector('[data-action="toggle-auto-accept"]');
      autoAcceptToggle.classList.toggle('on', !!s.autoAcceptOrders);
      root.querySelector('[data-action="toggle-auto-accept-row"]').addEventListener('click', function () {
        var next = !autoAcceptToggle.classList.contains('on');
        MockApi.setAutoAcceptOrders(state.currentStoreId, next).then(function (r) {
          autoAcceptToggle.classList.toggle('on', r.store.autoAcceptOrders);
          UI.showToast(r.store.autoAcceptOrders ? '자동 수락을 켰어요' : '자동 수락을 껐어요 · 수동 수락으로 바뀌었어요');
        });
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

    root.querySelector('[data-action="go-wait-time"]').addEventListener('click', function () {
      Router.showScreen('waitTimeSettings');
    });

    root.querySelector('[data-action="go-staff"]').addEventListener('click', function () {
      Router.showScreen('staffAccounts');
    });

    root.querySelector('[data-action="go-qr-menu"]').addEventListener('click', function () {
      Router.showScreen('qrMenu');
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
