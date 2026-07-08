/*
 * 개발자 옵션 — 예전엔 사장님 앱 '설정' 화면 맨 아래에 묻혀 있었는데(다른 설정 항목 정리하며
 * 화면에서 완전히 뺐음), 이제는 화면 어디에 있든(어떤 탭/화면이든) 항상 떠 있는 우하단 핀
 * 버튼으로 접근한다. 핀을 누르면 바텀시트가 열리고 그 안에 기존 기능(오프라인 시뮬레이션
 * 토글, 테스트 주문 생성)을 그대로 담는다.
 *
 * Router가 관리하는 화면(#app-root) 밖에 있는 전역 오버레이라서 화면 전환과 무관하게 계속
 * 떠 있다 — router.js가 화면을 바꿀 때마다 refreshVisibility()를 호출해 지금 로그인 상태/
 * 역할에 맞게 보이거나 숨겨지도록 한다. 사장님(OWNER) 계정이 매장을 선택한 뒤에만 의미가
 * 있는 기능들이라(오프라인 시뮬레이션은 주문 화면 전용, 테스트 주문은 특정 매장 전용),
 * 로그인 전/행사 담당자 화면에서는 숨긴다.
 */
(function () {
  function shouldShow() {
    var state = AppState.get();
    return !!(state.currentUser && state.currentUser.role === 'OWNER' && state.currentStoreId);
  }

  function closePanel() {
    var host = document.getElementById('dev-panel-modal-host');
    if (host) host.innerHTML = '';
  }

  function openPanel() {
    var host = document.getElementById('dev-panel-modal-host');
    if (!host) return;
    var storeId = AppState.get().currentStoreId;

    host.innerHTML =
      '<div class="modal-overlay modal-overlay-bottom" id="dev-panel-overlay">' +
        '<div class="modal-sheet">' +
          '<div class="modal-sheet-header">' +
            '<span class="modal-sheet-title">개발자 옵션</span>' +
            '<button class="icon-btn" data-action="close-dev-panel">' + UI.Icons.close + '</button>' +
          '</div>' +
          '<div class="modal-sheet-body">' +
            '<div class="card" style="margin-bottom:12px;">' +
              '<div class="toggle-row">' +
                '<div>' +
                  '<div style="font-weight:700;font-size:14px;">오프라인 시뮬레이션</div>' +
                  '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">주문 화면에서 연결이 끊긴 상태를 흉내내요(디버그용)</div>' +
                '</div>' +
                UI.toggle(AppState.get().isOffline, 'toggle-offline-sim') +
              '</div>' +
            '</div>' +
            '<div class="card">' +
              '<div style="font-weight:700;font-size:14px;margin-bottom:4px;">테스트 주문 생성</div>' +
              '<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:10px;">무작위 신규 주문 5건을 즉시 만들어요(영업 중일 때만 생성돼요)</div>' +
              UI.button({ label: '주문 넣기', action: 'add-test-orders', variant: 'secondary' }) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var overlay = host.querySelector('#dev-panel-overlay');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closePanel(); });
    host.querySelector('[data-action="close-dev-panel"]').addEventListener('click', closePanel);

    var offlineToggle = host.querySelector('[data-action="toggle-offline-sim"]');
    offlineToggle.addEventListener('click', function () {
      var next = !offlineToggle.classList.contains('on');
      AppState.setOffline(next);
      offlineToggle.classList.toggle('on', next);
      UI.showToast(next ? '오프라인 상태를 흉내내기 시작했어요' : '온라인 상태로 돌아왔어요');
    });

    host.querySelector('[data-action="add-test-orders"]').addEventListener('click', function () {
      var btn = this;
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
  }

  function refreshVisibility() {
    var pinHost = document.getElementById('dev-pin-host');
    if (!pinHost) return;
    if (shouldShow()) {
      if (!pinHost.querySelector('.dev-pin-btn')) {
        pinHost.innerHTML = '<button class="dev-pin-btn" data-action="open-dev-panel" title="개발자 옵션">🛠️</button>';
        pinHost.querySelector('[data-action="open-dev-panel"]').addEventListener('click', openPanel);
      }
    } else {
      pinHost.innerHTML = '';
      closePanel();
    }
  }

  window.DevOptionsPanel = { refreshVisibility: refreshVisibility };
})();
