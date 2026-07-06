/*
 * 예상 대기시간 관리 — 설정 > '예상 대기시간 관리'에서 진입. 뒤로가기는 설정 화면으로 돌아간다.
 * 실제 이전 시: features/settings/screens/WaitTimeSettingsScreen.tsx
 *
 * 예전에는 사장님이 '예상 대기시간(분)' 값 자체를 5분 단위로 직접 입력했지만(menu.js에 있었음),
 * 그러면 주문이 쌓여도 값이 자동으로 반영되지 않는 문제가 있었다. 이제는 사장님이 "대기 메뉴 (N)개당
 * 예상 시간 (M)분" 두 기준값만 정해두면, 현재 대기(WAITING)/접수(RECEIVED) 탭에 남아있는 미완료
 * 주문의 메뉴 항목 총 수량을 기준으로 매번 올림(총수량 / N) × M 분으로 자동 계산한다
 * (MockApi.getEstimatedWaitInfo 참고). '조리 예상 시간 안내 사용'을 끄면 고객 화면에 문구 자체를
 * 노출하지 않는다(이 목업에는 고객 화면이 따로 없어 미리보기 문구로 대신 보여준다).
 */
(function () {
  var currentUnmount = null;

  function render() {
    return (
      '<div class="screen">' +
        UI.topBar({ title: '예상 대기시간 관리', leftIcon: UI.Icons.back, leftAction: 'go-back' }) +
        '<div class="screen-scroll" style="padding: 8px 20px 24px;">' +
          '<div class="card" style="margin-bottom:16px;">' +
            '<div class="toggle-row">' +
              '<div>' +
                '<div style="font-weight:700;font-size:15px;">조리 예상 시간 안내 사용</div>' +
                '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px;">꺼두면 고객 화면에 예상 대기시간 문구를 노출하지 않아요</div>' +
              '</div>' +
              UI.toggle(true, 'toggle-guide-enabled') +
            '</div>' +
          '</div>' +
          '<div class="card" style="margin-bottom:16px;">' +
            '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:10px;">계산 기준</div>' +
            '<div class="wait-config-row">' +
              '<span>대기 메뉴</span>' +
              '<input class="input-field wait-config-input" id="wait-config-n" type="number" min="1" />' +
              '<span>개당 예상 시간</span>' +
              '<input class="input-field wait-config-input" id="wait-config-m" type="number" min="1" />' +
              '<span>분</span>' +
            '</div>' +
            '<div class="helper-text" style="text-align:left;margin-top:8px;">현재 대기·접수 탭에 남아있는 미완료 주문의 메뉴 수량 합계를 기준으로 자동 계산돼요.</div>' +
          '</div>' +
          '<div class="form-section-title">고객에게 이렇게 보여요</div>' +
          '<div class="card" id="wait-preview-card"></div>' +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    var storeId = AppState.get().currentStoreId;
    var config = { guideEnabled: true, menuCountUnit: 5, minutesPerUnit: 10, activeMenuQty: 0 };

    root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
      Router.showScreen('settings');
    });

    var nInput = root.querySelector('#wait-config-n');
    var mInput = root.querySelector('#wait-config-m');
    var guideToggle = root.querySelector('[data-action="toggle-guide-enabled"]');

    function renderPreview() {
      var n = Math.max(1, Number(nInput.value) || 1);
      var m = Math.max(1, Number(mInput.value) || 1);
      var estimatedMinutes = config.activeMenuQty === 0 ? 0 : Math.ceil(config.activeMenuQty / n) * m;
      var previewHost = root.querySelector('#wait-preview-card');
      if (!guideToggle.classList.contains('on')) {
        previewHost.innerHTML = '<div class="helper-text" style="text-align:left;">안내 사용이 꺼져있어 고객 화면에 문구가 뜨지 않아요.</div>';
        return;
      }
      previewHost.innerHTML =
        '<div style="font-size:15px;">현재 예상 대기 시간은 약 ' + estimatedMinutes + '분 이내입니다.</div>' +
        '<div class="helper-text" style="text-align:left;margin-top:6px;">현재 대기·접수 메뉴 수량 ' + config.activeMenuQty + '개 · 올림(' + config.activeMenuQty + ' ÷ ' + n + ') × ' + m + '분</div>';
    }

    function saveConfig() {
      var n = Math.max(1, Number(nInput.value) || 1);
      var m = Math.max(1, Number(mInput.value) || 1);
      MockApi.updateWaitTimeConfig(storeId, {
        menuCountUnit: n,
        minutesPerUnit: m,
        guideEnabled: guideToggle.classList.contains('on'),
      });
    }

    function loadAndRender() {
      MockApi.getEstimatedWaitInfo(storeId).then(function (res) {
        config = res;
        nInput.value = res.menuCountUnit;
        mInput.value = res.minutesPerUnit;
        guideToggle.classList.toggle('on', res.guideEnabled);
        renderPreview();
      });
    }

    nInput.addEventListener('input', function () {
      renderPreview();
    });
    nInput.addEventListener('change', saveConfig);
    mInput.addEventListener('input', function () {
      renderPreview();
    });
    mInput.addEventListener('change', saveConfig);

    guideToggle.addEventListener('click', function () {
      guideToggle.classList.toggle('on');
      renderPreview();
      saveConfig();
    });

    function onOrdersChanged() {
      loadAndRender();
    }
    window.addEventListener('mock:orders-changed', onOrdersChanged);
    window.addEventListener('mock:new-order', onOrdersChanged);

    loadAndRender();

    currentUnmount = function () {
      window.removeEventListener('mock:orders-changed', onOrdersChanged);
      window.removeEventListener('mock:new-order', onOrdersChanged);
    };
  }

  function unmount() {
    if (currentUnmount) currentUnmount();
    currentUnmount = null;
  }

  window.Screens = window.Screens || {};
  window.Screens.waitTimeSettings = { render: render, mount: mount, unmount: unmount };
})();
