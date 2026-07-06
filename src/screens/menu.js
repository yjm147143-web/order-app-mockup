/*
 * 메뉴 관리 — 설정 화면의 '메뉴 추가 및 수정' 항목에서 진입하는 하위 화면(더 이상 하단 탭이 아님).
 * 뒤로가기는 설정 화면으로 돌아간다.
 * 실제 이전 시: features/menu/screens/MenuManageScreen.tsx
 *
 * 재사용: UI.segmentTabs()(카테고리 가로 탭), '펼쳐보기'류 패턴 대신 여기서는 폼 모달 +
 * 실시간 미리보기 패턴을 사용한다. 주문 데이터의 menuName/unitPrice는 OrderItem에 주문 시점
 * 스냅샷으로 저장되어 있으므로(STEP1~3), 이 화면에서 메뉴를 수정/삭제해도 과거 주문 표시는
 * 절대 바뀌지 않는다 — 이 화면은 MenuItem 원본만 다룬다.
 *
 * 예상 대기시간 설정은 이 화면에 없다 — 설정 > '예상 대기시간 관리'(waitTimeSettings.js)로
 * 옮겨서, 실시간 주문량 기반 자동 계산식으로 바뀌었다.
 *
 * 같은 카테고리 안 메뉴 순서는 카테고리 순서 변경과 동일하게 위/아래 이동 버튼으로 sortOrder를
 * 맞바꾼다(MockApi.moveMenuItem) — '전체' 탭에서는 순서를 바꿀 수 없고, 특정 카테고리 탭에서만
 * 가능하다(무엇을 기준으로 순서를 매길지 애매해지는 것을 피하기 위함).
 */
(function () {
  var categories = [];
  var menuItems = [];
  var activeCategoryId = null;
  var draftMenu = null;
  var editingMenuId = null;
  var currentUnmount = null;
  var rootEl = null;
  var storeCache = null;

  function visibleCategories() {
    return categories.filter(function (c) { return !c.isHidden; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  function itemsOfCategory(categoryId) {
    if (categoryId === 'ALL') {
      var catOrder = {};
      visibleCategories().forEach(function (c, idx) { catOrder[c.id] = idx; });
      return menuItems.slice().sort(function (a, b) {
        var ao = catOrder[a.categoryId] !== undefined ? catOrder[a.categoryId] : 999;
        var bo = catOrder[b.categoryId] !== undefined ? catOrder[b.categoryId] : 999;
        return ao !== bo ? ao - bo : a.sortOrder - b.sortOrder;
      });
    }
    return menuItems
      .filter(function (m) { return m.categoryId === categoryId; })
      .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  function render() {
    return (
      '<div class="screen">' +
        UI.topBar({
          title: '메뉴 추가 및 수정',
          leftIcon: UI.Icons.back,
          leftAction: 'go-back',
          rightIcon: UI.Icons.menu,
          rightAction: 'manage-categories',
        }) +
        '<div id="category-tabs-host"></div>' +
        '<div class="screen-scroll"><div class="menu-list" id="menu-list"></div></div>' +
        '<div class="cta-fixed">' + UI.button({ label: '메뉴 추가', action: 'add-menu', variant: 'primary' }) + '</div>' +
        '<div id="menu-modal-host"></div>' +
      '</div>'
    );
  }

  function renderMenuCard(item, idx, total) {
    var category = categories.find(function (c) { return c.id === item.categoryId; });
    var thumb = item.imageUrl
      ? '<img src="' + UI.escapeHtml(item.imageUrl) + '" class="menu-thumb" />'
      : '<div class="menu-thumb menu-thumb-empty">🍽️</div>';
    var metaBits = [];
    if (item.stockQuantity !== null && item.stockQuantity !== undefined) metaBits.push('재고 ' + item.stockQuantity + '개');
    if (item.origin) metaBits.push('원산지 ' + item.origin);
    var moveButtonsHtml = isAllView()
      ? ''
      : '<div class="menu-order-buttons">' +
          '<button class="icon-btn-sm" data-action="move-menu-up" data-menu-id="' + item.id + '" ' + (idx === 0 ? 'disabled' : '') + '>▲</button>' +
          '<button class="icon-btn-sm" data-action="move-menu-down" data-menu-id="' + item.id + '" ' + (idx === total - 1 ? 'disabled' : '') + '>▼</button>' +
        '</div>';
    return (
      '<div class="menu-card ' + (item.isSoldout ? 'soldout' : '') + '" data-menu-id="' + item.id + '">' +
        moveButtonsHtml +
        '<div class="menu-card-main" data-action="edit-menu" data-menu-id="' + item.id + '">' +
          thumb +
          '<div class="menu-card-body">' +
            '<div class="menu-card-name">' + UI.escapeHtml(item.name) + (item.isVisible ? '' : ' ' + UI.badge('숨김', 'neutral')) +
            (isAllView() ? ' ' + UI.badge(category ? category.name : '-', 'neutral') : '') + '</div>' +
            '<div class="menu-card-price">' + UI.formatWon(item.price) + '</div>' +
            (item.description ? '<div class="menu-card-desc">' + UI.escapeHtml(item.description) + '</div>' : '') +
            (metaBits.length ? '<div class="menu-card-meta">' + UI.escapeHtml(metaBits.join(' · ')) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="menu-card-side">' +
          '<div class="soldout-toggle-wrap">' +
            '<span class="soldout-toggle-caption ' + (item.isSoldout ? 'active' : '') + '">품절</span>' +
            UI.toggle(item.isSoldout, 'toggle-soldout', 'data-menu-id="' + item.id + '"') +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function isAllView() {
    return activeCategoryId === 'ALL';
  }

  function mount(root) {
    rootEl = root;
    activeCategoryId = null;

    root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
      Router.showScreen('settings');
    });

    function loadAndRender() {
      var state = AppState.get();
      Promise.all([
        MockApi.getStore(state.currentStoreId),
        MockApi.getMenuCategories(state.currentStoreId),
        MockApi.getMenuItems(state.currentStoreId),
      ]).then(function (results) {
        storeCache = results[0].store;
        categories = results[1].menuCategories;
        menuItems = results[2].menuItems;
        renderCategoryTabs();
      });
    }

    function renderCategoryTabs() {
      var visCats = visibleCategories();
      var host = root.querySelector('#category-tabs-host');
      var addBtn = root.querySelector('[data-action="add-menu"]');

      if (visCats.length === 0) {
        host.innerHTML = '<div class="helper-text" style="padding:0 20px 12px;text-align:left;">등록된 카테고리가 없습니다. 우측 상단 아이콘에서 카테고리를 먼저 추가해주세요.</div>';
        addBtn.disabled = true;
        renderMenuListEmpty('먼저 카테고리를 추가해주세요.');
        return;
      }
      addBtn.disabled = false;
      if (!activeCategoryId || (activeCategoryId !== 'ALL' && !visCats.some(function (c) { return c.id === activeCategoryId; }))) {
        activeCategoryId = 'ALL';
      }
      var tabsData = [{ key: 'ALL', label: '전체', count: menuItems.length }].concat(
        visCats.map(function (c) { return { key: c.id, label: c.name, count: itemsOfCategory(c.id).length }; })
      );
      host.innerHTML = UI.segmentTabs(tabsData, activeCategoryId);
      host.querySelectorAll('[data-action="segment-tab"]').forEach(function (el) {
        el.addEventListener('click', function () {
          activeCategoryId = el.getAttribute('data-key');
          renderCategoryTabs();
        });
      });
      renderMenuList();
    }

    function renderMenuListEmpty(message) {
      root.querySelector('#menu-list').innerHTML =
        '<div class="center-empty" style="padding-top:60px;"><div class="emoji">☕</div><div class="title">메뉴가 없어요</div><div>' + UI.escapeHtml(message) + '</div></div>';
    }

    function renderMenuList() {
      var items = itemsOfCategory(activeCategoryId);
      var listEl = root.querySelector('#menu-list');
      if (items.length === 0) {
        renderMenuListEmpty('이 카테고리에 메뉴를 추가해보세요.');
        return;
      }
      listEl.innerHTML = items.map(function (item, idx) { return renderMenuCard(item, idx, items.length); }).join('');
      listEl.querySelectorAll('[data-action="edit-menu"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var item = menuItems.find(function (m) { return m.id === el.getAttribute('data-menu-id'); });
          if (item) openMenuForm(item);
        });
      });
      listEl.querySelectorAll('[data-action="toggle-soldout"]').forEach(function (el) {
        el.addEventListener('click', function () { onToggleSoldout(el.getAttribute('data-menu-id')); });
      });
      listEl.querySelectorAll('[data-action="move-menu-up"], [data-action="move-menu-down"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var direction = el.getAttribute('data-action') === 'move-menu-up' ? 'up' : 'down';
          MockApi.moveMenuItem(el.getAttribute('data-menu-id'), direction).then(function () {
            loadAndRender();
          });
        });
      });
    }

    function onToggleSoldout(menuId) {
      var item = menuItems.find(function (m) { return m.id === menuId; });
      if (!item) return;
      var nextValue = !item.isSoldout;
      MockApi.setMenuSoldout(menuId, nextValue).then(function () {
        loadAndRender();
        UI.showToast(nextValue ? '품절 처리했습니다' : '판매를 재개했습니다', {
          actionLabel: '되돌리기',
          duration: 3000,
          onAction: function () {
            MockApi.setMenuSoldout(menuId, !nextValue).then(function () {
              loadAndRender();
              UI.showToast(!nextValue ? '품절 처리했습니다' : '판매를 재개했습니다');
            });
          },
        });
      });
    }

    function closeModal() {
      var host = root.querySelector('#menu-modal-host');
      if (host) host.innerHTML = '';
    }

    /* ---------------- 카테고리 관리 ---------------- */

    function openCategoryManageModal() {
      var host = root.querySelector('#menu-modal-host');
      host.innerHTML =
        '<div class="modal-overlay" id="category-modal-overlay">' +
          '<div class="modal-sheet">' +
            '<div class="modal-sheet-header">' +
              '<span class="modal-sheet-title">카테고리 관리</span>' +
              '<button class="icon-btn" data-action="close-modal">' + UI.Icons.close + '</button>' +
            '</div>' +
            '<div class="modal-sheet-body">' +
              '<div class="add-category-row">' +
                '<input id="new-category-input" placeholder="새 카테고리명" maxlength="20" />' +
                UI.button({ label: '추가', action: 'add-category', variant: 'secondary' }) +
              '</div>' +
              '<div id="category-manage-list"></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      var overlay = host.querySelector('#category-modal-overlay');
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
      host.querySelector('[data-action="close-modal"]').addEventListener('click', closeModal);
      host.querySelector('[data-action="add-category"]').addEventListener('click', function () {
        var input = host.querySelector('#new-category-input');
        var name = input.value.trim();
        if (!name) return;
        MockApi.addMenuCategory(AppState.get().currentStoreId, name).then(function () {
          input.value = '';
          loadAndRender();
          refreshCategoryManageList();
        });
      });

      refreshCategoryManageList();
    }

    function refreshCategoryManageList() {
      var host = root.querySelector('#menu-modal-host');
      var listHost = host.querySelector('#category-manage-list');
      if (!listHost) return;
      var sorted = categories.slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; });
      listHost.innerHTML = sorted
        .map(function (c, idx) {
          var linkedCount = menuItems.filter(function (m) { return m.categoryId === c.id; }).length;
          return (
            '<div class="category-row" data-category-id="' + c.id + '">' +
              '<div class="category-order-buttons">' +
                '<button class="icon-btn-sm" data-action="move-up" data-category-id="' + c.id + '" ' + (idx === 0 ? 'disabled' : '') + '>▲</button>' +
                '<button class="icon-btn-sm" data-action="move-down" data-category-id="' + c.id + '" ' + (idx === sorted.length - 1 ? 'disabled' : '') + '>▼</button>' +
              '</div>' +
              '<input class="category-name-input" data-category-id="' + c.id + '" value="' + UI.escapeHtml(c.name) + '" />' +
              (c.isHidden ? UI.badge('숨김', 'neutral') : '') +
              '<button class="btn-text-sm" data-action="toggle-hide-category" data-category-id="' + c.id + '">' + (c.isHidden ? '표시' : '숨김') + '</button>' +
              '<button class="btn-text-sm danger" data-action="delete-category" data-category-id="' + c.id + '">삭제</button>' +
            '</div>'
          );
        })
        .join('');

      listHost.querySelectorAll('.category-name-input').forEach(function (el) {
        el.addEventListener('change', function () {
          var name = el.value.trim();
          if (!name) { el.value = categories.find(function (c) { return c.id === el.getAttribute('data-category-id'); }).name; return; }
          MockApi.updateMenuCategory(el.getAttribute('data-category-id'), name).then(function () {
            loadAndRender();
          });
        });
      });
      listHost.querySelectorAll('[data-action="move-up"], [data-action="move-down"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var direction = el.getAttribute('data-action') === 'move-up' ? 'up' : 'down';
          MockApi.moveCategory(el.getAttribute('data-category-id'), direction).then(function () {
            loadAndRender();
            refreshCategoryManageList();
          });
        });
      });
      listHost.querySelectorAll('[data-action="toggle-hide-category"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-category-id');
          var cat = categories.find(function (c) { return c.id === id; });
          MockApi.setCategoryHidden(id, !cat.isHidden).then(function () {
            loadAndRender();
            refreshCategoryManageList();
          });
        });
      });
      listHost.querySelectorAll('[data-action="delete-category"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-category-id');
          openConfirmModal('이 카테고리를 삭제할까요? 연결된 메뉴가 있으면 삭제 대신 숨김 처리됩니다.', function () {
            MockApi.deleteMenuCategory(id).then(function (res) {
              UI.showToast(res.hidden ? '연결된 메뉴가 있어 숨김 처리했습니다' : '카테고리를 삭제했습니다');
              loadAndRender();
              openCategoryManageModal();
            });
          });
        });
      });
    }

    function openConfirmModal(message, onConfirm) {
      var host = root.querySelector('#menu-modal-host');
      var wrapper = document.createElement('div');
      wrapper.innerHTML = UI.confirmModalHtml({
        overlayId: 'menu-confirm-overlay',
        title: '확인',
        message: message,
        confirmLabel: '확인',
        confirmAction: 'confirm-yes',
        closeAction: 'close-confirm',
      });
      host.appendChild(wrapper.firstChild);
      var overlay = host.querySelector('#menu-confirm-overlay');
      function dismiss() {
        overlay.remove();
      }
      overlay.addEventListener('click', function (e) { if (e.target === overlay) dismiss(); });
      overlay.querySelectorAll('[data-action="close-confirm"]').forEach(function (el) { el.addEventListener('click', dismiss); });
      overlay.querySelector('[data-action="confirm-yes"]').addEventListener('click', function () {
        dismiss();
        onConfirm();
      });
    }

    /* ---------------- 메뉴 등록/수정 폼 ---------------- */

    function openMenuForm(existing) {
      editingMenuId = existing ? existing.id : null;
      draftMenu = existing
        ? {
            categoryId: existing.categoryId,
            name: existing.name,
            price: String(existing.price),
            description: existing.description || '',
            imageUrl: existing.imageUrl || '',
            isVisible: existing.isVisible,
            stockQuantity: existing.stockQuantity === null || existing.stockQuantity === undefined ? '' : String(existing.stockQuantity),
            origin: existing.origin || '',
            optionGroupsEnabled: (existing.optionGroups || []).length > 0,
            optionGroups: JSON.parse(JSON.stringify(existing.optionGroups || [])),
          }
        : {
            categoryId: (activeCategoryId && activeCategoryId !== 'ALL' ? activeCategoryId : null) || (visibleCategories()[0] && visibleCategories()[0].id) || '',
            name: '',
            price: '',
            description: '',
            imageUrl: '',
            isVisible: true,
            stockQuantity: '',
            origin: '',
            optionGroupsEnabled: false,
            optionGroups: [],
          };
      renderMenuFormModal();
    }

    function renderMenuFormModal() {
      var host = root.querySelector('#menu-modal-host');
      var catOptions = visibleCategories()
        .map(function (c) { return '<option value="' + c.id + '" ' + (c.id === draftMenu.categoryId ? 'selected' : '') + '>' + UI.escapeHtml(c.name) + '</option>'; })
        .join('');
      var noCategoryDisabled = visibleCategories().length === 0 ? 'disabled' : '';

      host.innerHTML =
        '<div class="modal-overlay modal-overlay-bottom" id="menu-form-overlay">' +
          '<div class="modal-sheet modal-sheet-tall">' +
            '<div class="modal-sheet-header">' +
              '<span class="modal-sheet-title">' + (editingMenuId ? '메뉴 수정' : '메뉴 등록') + '</span>' +
              '<button class="icon-btn" data-action="close-modal">' + UI.Icons.close + '</button>' +
            '</div>' +
            '<div class="modal-sheet-body">' +
              '<div class="input-group">' +
                '<label class="input-label">메뉴명</label>' +
                '<input class="input-field" id="menu-form-name" maxlength="30" value="' + UI.escapeHtml(draftMenu.name) + '" placeholder="예: 아메리카노" />' +
                '<div class="char-counter" id="menu-form-name-counter">' + draftMenu.name.length + '/30</div>' +
              '</div>' +
              '<div class="input-group">' +
                '<label class="input-label">카테고리</label>' +
                '<select class="input-field" id="menu-form-category" ' + noCategoryDisabled + '>' + catOptions + '</select>' +
              '</div>' +
              '<div class="input-group">' +
                '<label class="input-label">가격</label>' +
                '<input class="input-field" id="menu-form-price" type="number" min="0" value="' + UI.escapeHtml(draftMenu.price) + '" placeholder="0" />' +
              '</div>' +
              '<div class="input-group">' +
                '<label class="input-label">재고 수량 (선택)</label>' +
                '<input class="input-field" id="menu-form-stock" type="number" min="0" value="' + UI.escapeHtml(draftMenu.stockQuantity) + '" placeholder="무제한" />' +
                '<div class="char-counter" style="text-align:left;">비워두면 재고 관리를 하지 않는 메뉴(무제한)로 처리돼요.</div>' +
              '</div>' +
              '<div class="input-group">' +
                '<label class="input-label">원산지 (선택)</label>' +
                '<input class="input-field" id="menu-form-origin" maxlength="30" value="' + UI.escapeHtml(draftMenu.origin) + '" placeholder="예: 콜롬비아산 원두" />' +
              '</div>' +
              '<div class="input-group">' +
                '<label class="input-label">설명 (선택)</label>' +
                '<textarea class="input-field" id="menu-form-description" maxlength="200">' + UI.escapeHtml(draftMenu.description) + '</textarea>' +
                '<div class="char-counter" id="menu-form-desc-counter">' + draftMenu.description.length + '/200</div>' +
              '</div>' +
              '<div class="input-group">' +
                '<label class="input-label">대표 이미지 (선택)</label>' +
                '<div class="image-input-row">' +
                  '<input class="input-field" id="menu-form-image-url" placeholder="이미지 URL 붙여넣기" value="' + UI.escapeHtml(draftMenu.imageUrl && draftMenu.imageUrl.indexOf('data:') !== 0 ? draftMenu.imageUrl : '') + '" />' +
                  '<input type="file" id="menu-form-image-file" accept="image/*" />' +
                '</div>' +
              '</div>' +
              '<div class="input-group">' +
                '<div class="toggle-row">' +
                  '<label class="input-label" style="margin:0;">노출 여부</label>' +
                  UI.toggle(draftMenu.isVisible, 'toggle-visible') +
                '</div>' +
                '<div class="visibility-hint" id="visibility-hint">' + visibilityHintText(draftMenu.isVisible) + '</div>' +
              '</div>' +

              '<div class="input-group">' +
                '<div class="toggle-row">' +
                  '<label class="input-label" style="margin:0;">옵션 그룹 사용</label>' +
                  UI.toggle(draftMenu.optionGroupsEnabled, 'toggle-option-groups-enabled') +
                '</div>' +
              '</div>' +
              '<div id="option-groups-section">' + renderOptionGroupsSectionHtml() + '</div>' +

              '<div class="form-section-title">고객이 보게 될 카드 미리보기</div>' +
              '<div id="menu-preview-host">' + renderPreviewCardHtml() + '</div>' +

              '<div id="menu-form-error" class="input-error" style="display:none;margin-top:12px;"></div>' +
            '</div>' +
            '<div class="modal-sheet-footer">' +
              UI.button({ label: '저장', action: 'save-menu', variant: 'primary' }) +
              (editingMenuId ? UI.button({ label: '메뉴 삭제', action: 'delete-menu', variant: 'danger-text' }) : '') +
            '</div>' +
          '</div>' +
        '</div>';

      wireMenuFormEvents();
      updateSaveButtonState();
    }

    function visibilityHintText(isVisible) {
      return isVisible
        ? '지금은 고객님 화면에 잘 보이고 있어요.'
        : '꺼두면 고객님 화면에서 잠시 숨겨져요. 나중에 다시 켜면 바로 보여드릴 수 있어요.';
    }

    function renderOptionGroupsSectionHtml() {
      if (!draftMenu.optionGroupsEnabled) return '';
      return (
        '<div class="form-section-title">옵션 그룹</div>' +
        '<div id="option-groups-host">' + renderOptionGroupsHtml() + '</div>' +
        UI.button({ label: '+ 옵션 그룹 추가', action: 'add-group', variant: 'secondary' })
      );
    }

    function renderOptionGroupsHtml() {
      if (draftMenu.optionGroups.length === 0) {
        return '<div class="helper-text" style="text-align:left;margin-bottom:8px;">옵션 그룹이 없습니다.</div>';
      }
      return draftMenu.optionGroups
        .map(function (g) {
          return (
            '<div class="option-group-card" data-group-id="' + g.id + '">' +
              '<div class="option-group-header">' +
                '<input class="option-group-name-input" data-group-id="' + g.id + '" placeholder="옵션 그룹명 (예: 온도 선택)" value="' + UI.escapeHtml(g.name) + '" />' +
                '<button class="icon-btn-sm" data-action="remove-group" data-group-id="' + g.id + '">✕</button>' +
              '</div>' +
              '<div class="option-flag-row"><span>필수 · 1개 선택</span>' + UI.toggle(g.required, 'group-required', 'data-group-id="' + g.id + '"') + '</div>' +
              '<div class="option-flag-row"><span>복수 선택 허용</span>' + UI.toggle(g.multiSelect, 'group-multi', 'data-group-id="' + g.id + '"') + '</div>' +
              g.options
                .map(function (o) {
                  return (
                    '<div class="option-row" data-group-id="' + g.id + '" data-option-id="' + o.id + '">' +
                      '<div class="option-row-main">' +
                        '<input class="option-name-input" data-group-id="' + g.id + '" data-option-id="' + o.id + '" placeholder="옵션명" value="' + UI.escapeHtml(o.name) + '" />' +
                        '<input class="option-price-input" type="number" min="0" data-group-id="' + g.id + '" data-option-id="' + o.id + '" placeholder="추가금액" value="' + o.extraPrice + '" />' +
                        '<button class="icon-btn-sm" data-action="remove-option" data-group-id="' + g.id + '" data-option-id="' + o.id + '">✕</button>' +
                      '</div>' +
                      '<div class="option-row-soldout">' +
                        '<span class="option-soldout-caption">품절</span>' +
                        UI.toggle(!!o.isSoldout, 'option-soldout', 'data-group-id="' + g.id + '" data-option-id="' + o.id + '"') +
                      '</div>' +
                    '</div>'
                  );
                })
                .join('') +
              '<div style="margin-top:8px;">' + UI.button({ label: '+ 옵션 추가', action: 'add-option', variant: 'text' }).replace('data-action="add-option"', 'data-action="add-option" data-group-id="' + g.id + '"') + '</div>' +
            '</div>'
          );
        })
        .join('');
    }

    function renderPreviewCardHtml() {
      var img = draftMenu.imageUrl
        ? '<img src="' + UI.escapeHtml(draftMenu.imageUrl) + '" class="preview-card-img" />'
        : '<div class="preview-card-img preview-card-img-empty">🍽️</div>';
      var priceNum = Number(draftMenu.price);
      var priceLabel = draftMenu.price !== '' && !isNaN(priceNum) ? UI.formatWon(priceNum) : '가격 미입력';
      var groupsHtml = !draftMenu.optionGroupsEnabled
        ? ''
        : draftMenu.optionGroups
            .map(function (g) {
              var chips = g.options
                .map(function (o) {
                  var extra = Number(o.extraPrice) || 0;
                  var label = UI.escapeHtml(o.name || '옵션') + (extra > 0 ? ' +' + UI.formatWon(extra) : '');
                  return '<span class="preview-option-chip ' + (o.isSoldout ? 'soldout' : '') + '">' + label + (o.isSoldout ? ' · 품절' : '') + '</span>';
                })
                .join('');
              return (
                '<div class="preview-option-group">' +
                  '<div class="preview-option-group-title">' + UI.escapeHtml(g.name || '(옵션 그룹명 미입력)') +
                  ' <span style="color:var(--color-text-secondary);font-weight:500;">· ' + (g.required ? '필수' : '선택') + (g.multiSelect ? ' · 복수선택' : ' · 단일선택') + '</span></div>' +
                  '<div class="preview-option-chips">' + chips + '</div>' +
                '</div>'
              );
            })
            .join('');
      return (
        '<div class="preview-card">' +
          img +
          '<div class="preview-card-body">' +
            '<div class="preview-card-name">' + UI.escapeHtml(draftMenu.name || '메뉴명 미입력') + '</div>' +
            '<div class="preview-card-price">' + priceLabel + '</div>' +
            (draftMenu.description ? '<div class="preview-card-desc">' + UI.escapeHtml(draftMenu.description) + '</div>' : '') +
            (draftMenu.origin ? '<div class="preview-card-desc">원산지: ' + UI.escapeHtml(draftMenu.origin) + '</div>' : '') +
            groupsHtml +
          '</div>' +
        '</div>'
      );
    }

    function refreshPreview() {
      var el = root.querySelector('#menu-preview-host');
      if (el) el.innerHTML = renderPreviewCardHtml();
    }

    function refreshOptionGroupsSection() {
      var host = root.querySelector('#menu-modal-host');
      var section = host.querySelector('#option-groups-section');
      if (section) section.innerHTML = renderOptionGroupsSectionHtml();
      wireOptionGroupsEvents();
      wireAddGroupButton();
      refreshPreview();
    }

    function validateDraft() {
      var errors = [];
      if (!draftMenu.name || !draftMenu.name.trim()) errors.push('메뉴명을 입력해주세요.');
      else if (draftMenu.name.length > 30) errors.push('메뉴명은 최대 30자입니다.');
      if (!draftMenu.categoryId) errors.push('카테고리를 선택해주세요.');
      var priceNum = Number(draftMenu.price);
      if (draftMenu.price === '' || draftMenu.price === null || isNaN(priceNum) || priceNum < 0) {
        errors.push('가격을 0 이상 숫자로 입력해주세요.');
      }
      if (draftMenu.description && draftMenu.description.length > 200) errors.push('설명은 최대 200자입니다.');
      if (draftMenu.stockQuantity !== '' && (isNaN(Number(draftMenu.stockQuantity)) || Number(draftMenu.stockQuantity) < 0)) {
        errors.push('재고 수량은 0 이상 숫자로 입력해주세요.');
      }
      return errors;
    }

    function updateSaveButtonState() {
      var host = root.querySelector('#menu-modal-host');
      var saveBtn = host.querySelector('[data-action="save-menu"]');
      if (!saveBtn) return;
      var errors = validateDraft();
      saveBtn.disabled = errors.length > 0;
    }

    function showFormError(message) {
      var el = root.querySelector('#menu-form-error');
      if (!el) return;
      el.textContent = message;
      el.style.display = message ? 'block' : 'none';
    }

    function wireAddGroupButton() {
      var host = root.querySelector('#menu-modal-host');
      var btn = host.querySelector('[data-action="add-group"]');
      if (!btn) return;
      btn.addEventListener('click', function () {
        draftMenu.optionGroups.push({ id: 'og-' + Date.now(), name: '', required: false, multiSelect: false, options: [] });
        refreshOptionGroupsSection();
      });
    }

    function wireMenuFormEvents() {
      var host = root.querySelector('#menu-modal-host');
      var overlay = host.querySelector('#menu-form-overlay');
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
      host.querySelector('[data-action="close-modal"]').addEventListener('click', closeModal);

      var nameInput = host.querySelector('#menu-form-name');
      nameInput.addEventListener('input', function () {
        draftMenu.name = nameInput.value;
        host.querySelector('#menu-form-name-counter').textContent = nameInput.value.length + '/30';
        refreshPreview();
        updateSaveButtonState();
      });

      host.querySelector('#menu-form-category').addEventListener('change', function (e) {
        draftMenu.categoryId = e.target.value;
        updateSaveButtonState();
      });

      var priceInput = host.querySelector('#menu-form-price');
      priceInput.addEventListener('input', function () {
        draftMenu.price = priceInput.value;
        refreshPreview();
        updateSaveButtonState();
      });

      var descInput = host.querySelector('#menu-form-description');
      descInput.addEventListener('input', function () {
        draftMenu.description = descInput.value;
        host.querySelector('#menu-form-desc-counter').textContent = descInput.value.length + '/200';
        refreshPreview();
        updateSaveButtonState();
      });

      var imageUrlInput = host.querySelector('#menu-form-image-url');
      imageUrlInput.addEventListener('input', function () {
        draftMenu.imageUrl = imageUrlInput.value.trim();
        refreshPreview();
      });

      host.querySelector('#menu-form-image-file').addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          draftMenu.imageUrl = ev.target.result;
          imageUrlInput.value = '';
          refreshPreview();
        };
        reader.readAsDataURL(file);
      });

      host.querySelector('[data-action="toggle-visible"]').addEventListener('click', function () {
        draftMenu.isVisible = !draftMenu.isVisible;
        this.classList.toggle('on', draftMenu.isVisible);
        host.querySelector('#visibility-hint').textContent = visibilityHintText(draftMenu.isVisible);
      });

      var stockInput = host.querySelector('#menu-form-stock');
      stockInput.addEventListener('input', function () {
        draftMenu.stockQuantity = stockInput.value;
        updateSaveButtonState();
      });

      var originInput = host.querySelector('#menu-form-origin');
      originInput.addEventListener('input', function () {
        draftMenu.origin = originInput.value;
        refreshPreview();
      });

      host.querySelector('[data-action="toggle-option-groups-enabled"]').addEventListener('click', function () {
        draftMenu.optionGroupsEnabled = !draftMenu.optionGroupsEnabled;
        this.classList.toggle('on', draftMenu.optionGroupsEnabled);
        refreshOptionGroupsSection();
      });

      wireAddGroupButton();

      host.querySelector('[data-action="save-menu"]').addEventListener('click', function () {
        var errors = validateDraft();
        if (errors.length) { showFormError(errors[0]); return; }
        var payload = {
          categoryId: draftMenu.categoryId,
          name: draftMenu.name.trim(),
          price: Number(draftMenu.price),
          description: draftMenu.description.trim(),
          imageUrl: draftMenu.imageUrl || '',
          isVisible: draftMenu.isVisible,
          stockQuantity: draftMenu.stockQuantity === '' ? null : Number(draftMenu.stockQuantity),
          origin: draftMenu.origin.trim(),
          optionGroups: !draftMenu.optionGroupsEnabled
            ? []
            : draftMenu.optionGroups.map(function (g) {
                return {
                  id: g.id,
                  name: g.name.trim(),
                  required: g.required,
                  multiSelect: g.multiSelect,
                  options: g.options.map(function (o) {
                    return { id: o.id, name: o.name.trim(), extraPrice: Number(o.extraPrice) || 0, isSoldout: !!o.isSoldout };
                  }),
                };
              }),
        };
        var promise = editingMenuId ? MockApi.updateMenuItem(editingMenuId, payload) : MockApi.addMenuItem(payload);
        promise.then(
          function () {
            closeModal();
            UI.showToast(editingMenuId ? '메뉴를 수정했습니다' : '메뉴를 등록했습니다');
            loadAndRender();
          },
          function (err) { showFormError(err.message || '저장 중 오류가 발생했습니다'); }
        );
      });

      var deleteBtn = host.querySelector('[data-action="delete-menu"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          openConfirmModal('이 메뉴를 삭제할까요? 삭제된 메뉴는 목록에서 사라지며, 과거 주문 내역에는 영향이 없습니다.', function () {
            MockApi.deleteMenuItem(editingMenuId).then(function () {
              closeModal();
              UI.showToast('메뉴를 삭제했습니다');
              loadAndRender();
            });
          });
        });
      }

      wireOptionGroupsEvents();
    }

    function wireOptionGroupsEvents() {
      var host = root.querySelector('#menu-modal-host');
      var section = host.querySelector('#option-groups-host');
      if (!section) return;

      section.querySelectorAll('.option-group-name-input').forEach(function (el) {
        el.addEventListener('input', function () {
          var group = draftMenu.optionGroups.find(function (g) { return g.id === el.getAttribute('data-group-id'); });
          group.name = el.value;
          refreshPreview();
        });
      });

      section.querySelectorAll('[data-action="group-required"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var group = draftMenu.optionGroups.find(function (g) { return g.id === el.getAttribute('data-group-id'); });
          group.required = !group.required;
          refreshOptionGroupsSection();
        });
      });
      section.querySelectorAll('[data-action="group-multi"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var group = draftMenu.optionGroups.find(function (g) { return g.id === el.getAttribute('data-group-id'); });
          group.multiSelect = !group.multiSelect;
          refreshOptionGroupsSection();
        });
      });
      section.querySelectorAll('[data-action="remove-group"]').forEach(function (el) {
        el.addEventListener('click', function () {
          draftMenu.optionGroups = draftMenu.optionGroups.filter(function (g) { return g.id !== el.getAttribute('data-group-id'); });
          refreshOptionGroupsSection();
        });
      });
      section.querySelectorAll('[data-action="add-option"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var group = draftMenu.optionGroups.find(function (g) { return g.id === el.getAttribute('data-group-id'); });
          group.options.push({ id: 'opt-' + Date.now() + '-' + Math.floor(Math.random() * 1000), name: '', extraPrice: 0, isSoldout: false });
          refreshOptionGroupsSection();
        });
      });
      section.querySelectorAll('[data-action="remove-option"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var group = draftMenu.optionGroups.find(function (g) { return g.id === el.getAttribute('data-group-id'); });
          group.options = group.options.filter(function (o) { return o.id !== el.getAttribute('data-option-id'); });
          refreshOptionGroupsSection();
        });
      });
      section.querySelectorAll('[data-action="option-soldout"]').forEach(function (el) {
        el.addEventListener('click', function () {
          var group = draftMenu.optionGroups.find(function (g) { return g.id === el.getAttribute('data-group-id'); });
          var option = group.options.find(function (o) { return o.id === el.getAttribute('data-option-id'); });
          option.isSoldout = !option.isSoldout;
          refreshOptionGroupsSection();
        });
      });
      section.querySelectorAll('.option-name-input').forEach(function (el) {
        el.addEventListener('input', function () {
          var group = draftMenu.optionGroups.find(function (g) { return g.id === el.getAttribute('data-group-id'); });
          var option = group.options.find(function (o) { return o.id === el.getAttribute('data-option-id'); });
          option.name = el.value;
          refreshPreview();
        });
      });
      section.querySelectorAll('.option-price-input').forEach(function (el) {
        el.addEventListener('input', function () {
          var group = draftMenu.optionGroups.find(function (g) { return g.id === el.getAttribute('data-group-id'); });
          var option = group.options.find(function (o) { return o.id === el.getAttribute('data-option-id'); });
          option.extraPrice = el.value;
          refreshPreview();
        });
      });
    }

    /* ---------------- 화면 진입점 이벤트 ---------------- */

    root.querySelector('[data-action="add-menu"]').addEventListener('click', function () { openMenuForm(null); });
    root.querySelector('[data-action="manage-categories"]').addEventListener('click', openCategoryManageModal);

    function onMenuChanged() { loadAndRender(); }
    window.addEventListener('mock:menu-changed', onMenuChanged);

    loadAndRender();

    currentUnmount = function () {
      window.removeEventListener('mock:menu-changed', onMenuChanged);
    };
  }

  function unmount() {
    if (currentUnmount) currentUnmount();
    currentUnmount = null;
  }

  window.Screens = window.Screens || {};
  window.Screens.menu = { render: render, mount: mount, unmount: unmount };
})();
