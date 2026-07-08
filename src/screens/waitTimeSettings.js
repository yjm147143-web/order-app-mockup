/*
 * 예상 대기시간 관리 — 설정 > '예상 대기시간 관리'에서 진입. 뒤로가기는 설정 화면으로 돌아간다.
 * 실제 이전 시: features/settings/screens/WaitTimeSettingsScreen.tsx
 *
 * 사장님이 "대기 메뉴 (N)개당 예상 시간 (M)분" 두 기준값(5단위 선택 드롭다운으로만 조정 가능)을
 * 정해두면, 현재 대기(WAITING)/접수(RECEIVED) 탭에 남아있는 미완료 주문의 메뉴 항목 총
 * 수량을 기준으로 매번 올림(총수량 / N) × M 분으로 자동 계산한다(MockApi.getEstimatedWaitInfo
 * 참고). '최대 예상 대기시간'(역시 5단위 드롭다운)을 정해두면 계산값이 그 값을 넘을 때 그
 * 최댓값으로 고정해서 보여준다(고객에게 비현실적으로 긴 대기시간을 안내하지 않기 위함).
 *
 * '예상 대기시간 안내 사용'을 끄면 이 화면의 나머지 설정 요소(N/M·최대값 선택, 미리보기)를
 * 전부 회색으로 비활성화한다(.wait-settings-disabled) — 이 목업에는 고객 화면이 따로 없어
 * 미리보기로 대신 보여준다.
 *
 * 미리보기: 한때 "설정값 → 가상 예시 → 계산 과정 → 고객 문구" 4단계로 풀어서 보여주는 버전을
 * 만들었는데, 사장님 피드백으로 일단 원복하고 '지금 실제 예상 대기시간' 박스만 남겼다(추후
 * 다시 다듬을 예정 — 이 화면을 다시 만질 때 4단계 버전을 완전히 지운 건 아니라는 점 참고).
 */
(function () {
  var currentUnmount = null;
  var STEP = 5;
  var N_MAX = 50;
  var M_MAX = 60;
  var MAX_MINUTES_CAP = 120;

  function optionsHtml(max, selected) {
    var html = '';
    for (var v = STEP; v <= max; v += STEP) {
      html += '<option value="' + v + '" ' + (v === selected ? 'selected' : '') + '>' + v + '</option>';
    }
    return html;
  }

  function render() {
    return (
      '<div class="screen">' +
        UI.topBar({ title: '예상 대기시간 관리', leftIcon: UI.Icons.back, leftAction: 'go-back' }) +
        '<div class="screen-scroll" style="padding: 8px 20px 24px;">' +
          '<div class="card" style="margin-bottom:16px;">' +
            '<div class="toggle-row">' +
              '<div>' +
                '<div style="font-weight:700;font-size:15px;">예상 대기시간 안내 사용</div>' +
                '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px;">꺼두면 고객 화면에 예상 대기시간 문구를 노출하지 않아요</div>' +
              '</div>' +
              UI.toggle(true, 'toggle-guide-enabled') +
            '</div>' +
          '</div>' +
          '<div id="wait-settings-body">' +
            '<div class="card" style="margin-bottom:16px;">' +
              '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:10px;">계산 기준 (5단위로 선택)</div>' +
              '<div class="wait-config-row">' +
                '<span>대기 메뉴</span>' +
                '<select class="input-field wait-select" id="wait-config-n-select">' + optionsHtml(N_MAX, 5) + '</select>' +
                '<span>개당 예상 시간</span>' +
              '</div>' +
              '<div class="wait-config-row">' +
                '<select class="input-field wait-select" id="wait-config-m-select">' + optionsHtml(M_MAX, 10) + '</select>' +
                '<span>분</span>' +
              '</div>' +
              '<div class="helper-text" style="text-align:left;margin-top:8px;">현재 대기·접수 탭에 남아있는 미완료 주문의 메뉴 수량 합계를 기준으로 자동 계산돼요.</div>' +
            '</div>' +
            '<div class="card" style="margin-bottom:16px;">' +
              '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:10px;">최대 예상 대기시간 (5단위로 선택)</div>' +
              '<div class="wait-config-row">' +
                '<select class="input-field wait-select" id="wait-config-max-select">' + optionsHtml(MAX_MINUTES_CAP, 60) + '</select>' +
                '<span>분</span>' +
              '</div>' +
              '<div class="helper-text" style="text-align:left;margin-top:8px;">계산된 예상 대기시간이 이 값을 넘으면, 넘는 값 그대로가 아니라 이 값으로 고정해서 보여줘요.</div>' +
            '</div>' +
            '<div class="form-section-title">고객에게 이렇게 보여요</div>' +
            '<div class="card" id="wait-preview-card"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    var storeId = AppState.get().currentStoreId;
    var state = { guideEnabled: true, menuCountUnit: 5, minutesPerUnit: 10, maxMinutes: 60, activeMenuQty: 0 };

    root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
      Router.showScreen('settings');
    });

    var nSelect = root.querySelector('#wait-config-n-select');
    var mSelect = root.querySelector('#wait-config-m-select');
    var maxSelect = root.querySelector('#wait-config-max-select');
    var guideToggle = root.querySelector('[data-action="toggle-guide-enabled"]');
    var bodyEl = root.querySelector('#wait-settings-body');

    function computeWait(qty, n, m, maxMinutes) {
      var raw = qty === 0 ? 0 : Math.ceil(qty / n) * m;
      var isCapped = !!(maxMinutes && raw > maxMinutes);
      var final = isCapped ? maxMinutes : raw;
      return { qty: qty, raw: raw, capped: isCapped, final: final };
    }

    // 예전에 있던 "설정값 → 가상 예시 → 계산 과정 → 고객 문구" 4단계 미리보기는 사장님 피드백으로
    // 일단 원복하고, '지금 실제 예상 대기시간' 박스만 남겼다(추후 다시 다듬을 예정).
    function renderPreview() {
      var n = state.menuCountUnit;
      var m = state.minutesPerUnit;
      var actual = computeWait(state.activeMenuQty, n, m, state.maxMinutes);
      var previewHost = root.querySelector('#wait-preview-card');
      previewHost.innerHTML =
        '<div class="wait-calc-actual-box">' +
          '<div style="font-weight:800;margin-bottom:4px;">지금 실제 예상 대기시간</div>' +
          '<div class="helper-text" style="text-align:left;">현재 대기·접수 메뉴 수량 ' + state.activeMenuQty + '개 기준</div>' +
          '<div style="font-size:19px;font-weight:800;margin-top:4px;">약 ' + actual.final + '분 이내' + (actual.capped ? ' <span style="font-size:12px;font-weight:700;color:var(--color-text-secondary);">(최대값으로 고정됨)</span>' : '') + '</div>' +
        '</div>';
    }

    function renderValues() {
      nSelect.value = state.menuCountUnit;
      mSelect.value = state.minutesPerUnit;
      maxSelect.value = state.maxMinutes;
      guideToggle.classList.toggle('on', state.guideEnabled);
      bodyEl.classList.toggle('wait-settings-disabled', !state.guideEnabled);
      renderPreview();
    }

    function saveConfig() {
      MockApi.updateWaitTimeConfig(storeId, {
        menuCountUnit: state.menuCountUnit,
        minutesPerUnit: state.minutesPerUnit,
        maxMinutes: state.maxMinutes,
        guideEnabled: state.guideEnabled,
      });
    }

    function loadAndRender() {
      MockApi.getEstimatedWaitInfo(storeId).then(function (res) {
        state = res;
        renderValues();
      });
    }

    nSelect.addEventListener('change', function () {
      state.menuCountUnit = Number(nSelect.value);
      renderValues();
      saveConfig();
    });
    mSelect.addEventListener('change', function () {
      state.minutesPerUnit = Number(mSelect.value);
      renderValues();
      saveConfig();
    });
    maxSelect.addEventListener('change', function () {
      state.maxMinutes = Number(maxSelect.value);
      renderValues();
      saveConfig();
    });

    guideToggle.addEventListener('click', function () {
      state.guideEnabled = !state.guideEnabled;
      renderValues();
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
