/*
 * 직원 계정 관리 — 설정 > '직원 계정 관리'에서 진입. 뒤로가기는 설정 화면으로 돌아간다.
 * 실제 이전 시: features/settings/screens/StaffAccountsScreen.tsx
 *
 * 기능명세서 기준 직원(STAFF) 계정은 항상 고정된 '직원' 권한(주문 처리만 가능)이다 — 화면에서
 * 개별적으로 켜고 끌 수 있는 권한 토글은 없다. 오너(OWNER) 계정은 이 목록에 표시만 되고 항상
 * 모든 권한을 가진 것으로 취급한다. 신규 직원은 이름/로그인 아이디/비밀번호/핸드폰번호/이메일/
 * 계정 사용 기간(상시 또는 기간설정)을 입력해 생성한다(실제 초대 메일 발송 등은 이번 범위 밖 —
 * 목업으로 즉시 계정을 만든다).
 */
(function () {
  var currentUnmount = null;

  function usagePeriodLabel(usagePeriod) {
    if (!usagePeriod || usagePeriod.type !== 'PERIOD') return '상시';
    return usagePeriod.start + ' ~ ' + usagePeriod.end;
  }

  function render() {
    return (
      '<div class="screen">' +
        UI.topBar({ title: '직원 계정 관리', leftIcon: UI.Icons.back, leftAction: 'go-back' }) +
        '<div class="screen-scroll" style="padding: 8px 20px 24px;">' +
          '<div id="owner-row-host"></div>' +
          '<div id="staff-list-host"></div>' +
        '</div>' +
        '<div class="cta-fixed">' + UI.button({ label: '+ 직원 추가', action: 'add-staff', variant: 'primary' }) + '</div>' +
        '<div id="staff-modal-host"></div>' +
      '</div>'
    );
  }

  function renderStaffCard(user) {
    return (
      '<div class="card" style="margin-bottom:12px;" data-user-id="' + user.id + '">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' +
            '<div style="font-weight:800;font-size:15px;">' + UI.escapeHtml(user.name) + (user.isActive ? '' : ' ' + UI.badge('비활성', 'neutral')) + '</div>' +
            '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px;">' + UI.escapeHtml(user.loginId) + (user.phone ? ' · ' + UI.escapeHtml(user.phone) : '') + '</div>' +
            '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px;">계정 사용 기간 · ' + UI.escapeHtml(usagePeriodLabel(user.usagePeriod)) + '</div>' +
          '</div>' +
          UI.button({ label: user.isActive ? '비활성화' : '활성화', action: 'toggle-active', variant: user.isActive ? 'outline' : 'secondary' }).replace(
            'data-action="toggle-active"',
            'data-action="toggle-active" data-user-id="' + user.id + '"'
          ) +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    var storeId = AppState.get().currentStoreId;
    var ownerUser = AppState.get().currentUser;

    root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
      Router.showScreen('settings');
    });

    function renderOwnerRow() {
      var host = root.querySelector('#owner-row-host');
      host.innerHTML =
        '<div class="card" style="margin-bottom:16px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div>' +
              '<div style="font-weight:800;font-size:15px;">' + UI.escapeHtml(ownerUser.name) + '</div>' +
              '<div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px;">사장님 계정(오너)</div>' +
            '</div>' +
            UI.badge('모든 권한', 'dark') +
          '</div>' +
          '<div class="helper-text" style="text-align:left;margin-top:8px;">오너 계정은 항상 모든 권한을 가지며, 이 화면에서 수정할 수 없어요.</div>' +
        '</div>';
    }

    function loadAndRender() {
      MockApi.getStaffUsers(storeId).then(function (res) {
        var listHost = root.querySelector('#staff-list-host');
        if (res.staff.length === 0) {
          listHost.innerHTML = '<div class="helper-text" style="text-align:left;padding:12px 0;">등록된 직원 계정이 없습니다.</div>';
          return;
        }
        listHost.innerHTML = res.staff.map(renderStaffCard).join('');
        wireStaffListEvents(res.staff);
      });
    }

    function wireStaffListEvents(staffList) {
      var listHost = root.querySelector('#staff-list-host');
      listHost.querySelectorAll('[data-action="toggle-active"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var userId = el.getAttribute('data-user-id');
          var user = staffList.find(function (u) { return u.id === userId; });
          var next = !user.isActive;
          MockApi.setStaffActive(userId, next).then(function () {
            UI.showToast(next ? '계정을 활성화했어요' : '계정을 비활성화했어요');
            loadAndRender();
          });
        });
      });
    }

    function closeModal() {
      var host = root.querySelector('#staff-modal-host');
      if (host) host.innerHTML = '';
    }

    function openAddStaffModal() {
      var host = root.querySelector('#staff-modal-host');
      var usagePeriodType = 'ALWAYS';

      function renderModal() {
        host.innerHTML =
          '<div class="modal-overlay modal-overlay-bottom" id="add-staff-overlay">' +
            '<div class="modal-sheet modal-sheet-tall">' +
              '<div class="modal-sheet-header">' +
                '<span class="modal-sheet-title">직원 추가</span>' +
                '<button class="icon-btn" data-action="close-modal">' + UI.Icons.close + '</button>' +
              '</div>' +
              '<div class="modal-sheet-body">' +
                '<div class="card" style="margin-bottom:16px;">' +
                  '<div style="font-weight:700;">🔒 자동 \'직원\' 권한이 부여돼요</div>' +
                  '<div class="helper-text" style="text-align:left;margin-top:4px;">이 계정은 주문 처리만 가능해요. 매출·환불·정산·메뉴 변경 같은 운영 기능은 사장님 본인 계정에서만 쓸 수 있어요.</div>' +
                '</div>' +
                '<div class="input-group">' +
                  '<label class="input-label">이름</label>' +
                  '<input class="input-field" id="staff-form-name" placeholder="예: 이알바" />' +
                '</div>' +
                '<div class="input-group">' +
                  '<label class="input-label">로그인 아이디</label>' +
                  '<input class="input-field" id="staff-form-login-id" placeholder="예: staff3" />' +
                '</div>' +
                '<div class="input-group">' +
                  '<label class="input-label">비밀번호</label>' +
                  '<input class="input-field" id="staff-form-password" type="password" placeholder="예: 0000" />' +
                '</div>' +
                '<div class="input-group">' +
                  '<label class="input-label">핸드폰 번호 (선택)</label>' +
                  '<input class="input-field" id="staff-form-phone" placeholder="010-0000-0000" />' +
                '</div>' +
                '<div class="input-group">' +
                  '<label class="input-label">이메일 (선택)</label>' +
                  '<input class="input-field" id="staff-form-email" type="email" placeholder="staff@example.com" />' +
                  '<div class="char-counter" style="text-align:left;">비밀번호 찾기·계정 안내가 이 이메일로 발송돼요.</div>' +
                '</div>' +
                '<div class="input-group">' +
                  '<label class="input-label">계정 사용 기간</label>' +
                  '<div class="reason-options">' +
                    '<button class="reason-option ' + (usagePeriodType === 'ALWAYS' ? 'selected' : '') + '" data-action="pick-usage-period" data-value="ALWAYS">상시</button>' +
                    '<button class="reason-option ' + (usagePeriodType === 'PERIOD' ? 'selected' : '') + '" data-action="pick-usage-period" data-value="PERIOD">기간 설정</button>' +
                  '</div>' +
                  (usagePeriodType === 'PERIOD'
                    ? '<div class="image-input-row" style="margin-top:8px;">' +
                        '<input class="input-field" id="staff-form-period-start" type="date" />' +
                        '<input class="input-field" id="staff-form-period-end" type="date" />' +
                      '</div>'
                    : '') +
                '</div>' +
                '<div id="staff-form-error" class="input-error" style="display:none;"></div>' +
              '</div>' +
              '<div class="modal-sheet-footer">' +
                UI.button({ label: '추가', action: 'confirm-add-staff', variant: 'primary' }) +
              '</div>' +
            '</div>' +
          '</div>';

        var overlay = host.querySelector('#add-staff-overlay');
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
        host.querySelector('[data-action="close-modal"]').addEventListener('click', closeModal);
        host.querySelectorAll('[data-action="pick-usage-period"]').forEach(function (el) {
          el.addEventListener('click', function () {
            usagePeriodType = el.getAttribute('data-value');
            renderModal();
          });
        });

        host.querySelector('[data-action="confirm-add-staff"]').addEventListener('click', function () {
          var name = host.querySelector('#staff-form-name').value.trim();
          var loginId = host.querySelector('#staff-form-login-id').value.trim();
          var password = host.querySelector('#staff-form-password').value.trim();
          var phone = host.querySelector('#staff-form-phone').value.trim();
          var email = host.querySelector('#staff-form-email').value.trim();
          var errEl = host.querySelector('#staff-form-error');
          if (!name || !loginId || !password) {
            errEl.textContent = '이름, 로그인 아이디, 비밀번호는 필수예요.';
            errEl.style.display = 'block';
            return;
          }
          var usagePeriod = { type: 'ALWAYS' };
          if (usagePeriodType === 'PERIOD') {
            var start = host.querySelector('#staff-form-period-start').value;
            var end = host.querySelector('#staff-form-period-end').value;
            if (!start || !end) {
              errEl.textContent = '계정 사용 기간의 시작일과 종료일을 입력해주세요.';
              errEl.style.display = 'block';
              return;
            }
            usagePeriod = { type: 'PERIOD', start: start, end: end };
          }
          MockApi.addStaffUser(storeId, { name: name, loginId: loginId, phone: phone, email: email, password: password, usagePeriod: usagePeriod }).then(
            function () {
              closeModal();
              UI.showToast('직원 계정을 추가했어요');
              loadAndRender();
            },
            function (err) {
              errEl.textContent = err.message || '추가 중 오류가 발생했어요';
              errEl.style.display = 'block';
            }
          );
        });
      }

      renderModal();
    }

    root.querySelector('[data-action="add-staff"]').addEventListener('click', openAddStaffModal);

    function onStaffChanged() { loadAndRender(); }
    window.addEventListener('mock:staff-changed', onStaffChanged);

    renderOwnerRow();
    loadAndRender();

    currentUnmount = function () {
      window.removeEventListener('mock:staff-changed', onStaffChanged);
    };
  }

  function unmount() {
    if (currentUnmount) currentUnmount();
    currentUnmount = null;
  }

  window.Screens = window.Screens || {};
  window.Screens.staffAccounts = { render: render, mount: mount, unmount: unmount };
})();
