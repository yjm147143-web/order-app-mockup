/*
 * 목업 API 계층
 * -------------------------------------------------------------------------
 * 화면(screens)은 이 파일의 함수만 호출한다. 실제 백엔드가 정해지면
 * 아래 각 함수의 "본문만" fetch(real endpoint) 호출로 교체하면 되고,
 * 함수 시그니처(입력/출력 Promise 모양)는 그대로 유지한다.
 * -> 화면 코드는 한 줄도 손댈 필요가 없다.
 *
 * [예정 실제 REST 엔드포인트 매핑]
 *  login()                      -> POST   /auth/login
 *  getMyStores()                -> GET    /users/:userId/stores
 *  getMyEvents()                -> GET    /users/:userId/events
 *  getStaffUsers()              -> GET    /stores/:storeId/staff
 *  addStaffUser()               -> POST   /stores/:storeId/staff
 *  updateStaffPermissions()     -> PATCH  /users/:userId/permissions
 *  setStaffActive()             -> PATCH  /users/:userId/active
 *  getEvent()                   -> GET    /events/:eventId
 *  updateStoreOperatingStatus() -> PATCH  /stores/:storeId/operating-status
 *  bulkUpdateStoreStatus()      -> POST   /events/:eventId/stores/bulk-status
 *  getAuditLogs()               -> GET    /events/:eventId/audit-logs
 *  setAutoSoldoutOnZeroStock()  -> PATCH  /stores/:storeId/auto-soldout-on-zero-stock
 *  setAutoAcceptOrders()        -> PATCH  /stores/:storeId/auto-accept-orders
 *  updateWaitTimeConfig()       -> PATCH  /stores/:storeId/wait-time-config
 *  getEstimatedWaitInfo()       -> GET    /stores/:storeId/estimated-wait-info
 *  getDashboardSummary()        -> GET    /stores/:storeId/dashboard-summary?date=
 *  getMenuCategories()          -> GET    /stores/:storeId/menu-categories
 *  getMenuItems()                -> GET    /stores/:storeId/menu-items
 *  getOrders()                   -> GET    /stores/:storeId/orders
 *  getNotificationLogs()         -> GET    /stores/:storeId/notification-logs
 *  advanceOrderStatus()          -> PATCH  /orders/:orderId/status
 *  revertCompletedToReceived()   -> PATCH  /orders/:orderId/revert-to-received
 *  cancelOrder()                 -> PATCH  /orders/:orderId/cancel
 *  sendKakaoAlert()               -> POST   /orders/:orderId/kakao-alert  (실연동 시 카카오 알림톡 API로 교체)
 *  addMenuCategory()              -> POST   /stores/:storeId/menu-categories
 *  updateMenuCategory()           -> PATCH  /menu-categories/:categoryId
 *  setCategoryHidden()            -> PATCH  /menu-categories/:categoryId/hidden
 *  deleteMenuCategory()           -> DELETE /menu-categories/:categoryId
 *  moveCategory()                 -> PATCH  /menu-categories/:categoryId/move
 *  moveMenuItem()                 -> PATCH  /menu-items/:menuItemId/move
 *  addMenuItem()                  -> POST   /stores/:storeId/menu-items
 *  updateMenuItem()               -> PATCH  /menu-items/:menuItemId
 *  setMenuSoldout()               -> PATCH  /menu-items/:menuItemId/soldout
 *  deleteMenuItem()               -> DELETE /menu-items/:menuItemId  (소프트 삭제)
 *  getSalesBreakdown()            -> GET   /stores/:storeId/sales?dimension=&from=&to=
 *  getEventSalesBreakdown()       -> GET   /events/:eventId/sales?storeId=&dimension=&from=&to=
 *  getEventMenuRanking()          -> GET   /events/:eventId/menu-ranking?storeId=&from=&to=
 *  getEventOrderStats()           -> GET   /events/:eventId/order-stats
 *  getAiSalesInsight()            -> GET   /events/:eventId/ai-sales-insight (실제 AI 연동 시 이 함수만 교체)
 *
 * 실제 프로젝트(Node 사용 가능 환경)에서는 json-server + 이 함수들 내부를
 * fetch('http://localhost:4000/...') 로 바꾸는 것을 권장한다. (README 참고)
 *
 * 이벤트: 데이터가 바뀔 때마다 window 에 CustomEvent를 발행한다 (실시간성 흉내).
 *  - 'mock:orders-changed'  detail: { reason } — 주문 관련 화면은 이 이벤트를 듣고 새로고침
 *  - 'mock:new-order'       detail: { order }  — 신규 주문 배너 알림용
 *  - 'mock:menu-changed'    detail: {}         — 메뉴/카테고리 화면은 이 이벤트를 듣고 새로고침
 *
 * [행사(Event)/매장(Store) 다중화 안내]
 * 원래는 매장이 하나뿐이라 db.store(단수)로 관리했지만, 행사 담당자 기능 추가로 매장이 여러 개
 * (db.stores, 배열)가 되었다. 매장은 정확히 1개의 행사(Event)에 속하고(Store.eventId), 행사
 * 담당자 계정은 담당 행사 목록(User.eventIds)을 가진다 — 담당 행사에 속한 모든 매장이 그 행사
 * 담당자의 접근 범위다. 사장님(OWNER) 계정은 기존처럼 User.storeIds로 자기 매장만 본다.
 */

(function () {
  var DB_KEY = 'sajang-app-mock-db-v13'; // v11: 주문 화면 상단 재배치 — Order.paymentMethod 실제 필드 추가,
                                          // 매출 집계(PAYMENT)도 해시 흉내 대신 이 필드를 직접 집계하도록 변경
                                          // v12: Order.orderType(포장|다회용기|체험) 추가, Store.autoAcceptOrders 추가
                                          // v13: Store.estimatedWaitMinutes -> waitTimeGuideEnabled/waitTimeMenuCountUnit/
                                          // waitTimeMinutesPerUnit 계산식으로 교체, MenuItem.origin 추가, STAFF 계정
                                          // isActive/permissions 추가
  var LATENCY_MS = 300;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadDB() {
    var raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        // fallthrough to reseed
      }
    }
    return seedDB();
  }

  function seedDB() {
    var db = {
      events: deepClone(window.MockData.EVENTS),
      stores: deepClone(window.MockData.STORES),
      users: deepClone(window.MockData.USERS),
      menuCategories: deepClone(window.MockData.MENU_CATEGORIES),
      menuItems: deepClone(window.MockData.MENU_ITEMS),
      orders: deepClone(window.MockData.ORDERS),
      orderItems: deepClone(window.MockData.ORDER_ITEMS),
      notificationLogs: deepClone(window.MockData.NOTIFICATION_LOGS),
      auditLogs: deepClone(window.MockData.AUDIT_LOGS || []),
      nextOrderNo: window.MockData.NEXT_ORDER_NO,
    };
    saveDB(db);
    return db;
  }

  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  var db = loadDB();
  var ACTIVE_STATUSES = ['WAITING', 'RECEIVED'];
  var STATUS_RANK = { WAITING: 0, RECEIVED: 1, COMPLETED: 2 };

  function withLatency(result, shouldFail) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        if (shouldFail) {
          reject(result);
        } else {
          resolve(deepClone(result));
        }
      }, LATENCY_MS);
    });
  }

  function isToday(isoString) {
    var d = new Date(isoString);
    var now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  /** 한글 단어 끝 받침 유무에 따라 '이'/'가' 조사를 고른다(AI 분석 문장 조합용) */
  function pickIGaParticle(word) {
    if (!word) return '가';
    var code = word.charCodeAt(word.length - 1);
    if (code >= 0xac00 && code <= 0xd7a3) {
      return (code - 0xac00) % 28 !== 0 ? '이' : '가';
    }
    return '가';
  }

  function findStore(storeId) {
    return db.stores.find(function (s) { return s.id === storeId; });
  }

  /**
   * storeIds(배열) + range(inclusive)에 해당하는 주문 중 완료(COMPLETED)된 주문만 걸러낸다 —
   * 매출 집계 공통 전처리. 대기/접수 중인 미완료 주문과 취소된 주문은 아직 매출이 아니므로
   * 반드시 제외한다(매출 계산 기준 통일).
   */
  function ordersInRangeFor(storeIds, range) {
    var storeIdSet = {};
    storeIds.forEach(function (id) { storeIdSet[id] = true; });
    var fromTime = new Date(range.from).getTime();
    var toTime = new Date(range.to).getTime();
    return db.orders.filter(function (o) {
      if (!storeIdSet[o.storeId]) return false;
      if (o.status !== 'COMPLETED') return false;
      var t = new Date(o.orderedAt).getTime();
      return t >= fromTime && t <= toTime;
    });
  }

  /**
   * ordersInRange를 dimension 기준으로 집계한다 — getSalesBreakdown(매장 하나)과
   * getEventSalesBreakdown(행사 전체/특정 매장) 양쪽이 공유하는 핵심 로직.
   * dimension: 'PERIOD'(기간별) | 'HOUR'(시간대별) | 'MENU'(메뉴별) | 'PAYMENT'(결제수단별) | 'CHANNEL'(주문경로별)
   */
  function computeBreakdown(ordersInRange, dimension) {
    var totalAmount = ordersInRange.reduce(function (sum, o) { return sum + o.totalAmount; }, 0);
    var rows = [];

    if (dimension === 'PERIOD') {
      var byDate = {};
      ordersInRange.forEach(function (o) {
        var d = new Date(o.orderedAt);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        byDate[key] = (byDate[key] || 0) + o.totalAmount;
      });
      rows = Object.keys(byDate)
        .sort()
        .map(function (key) { return { label: key, amount: byDate[key] }; });
    } else if (dimension === 'HOUR') {
      var byHour = {};
      ordersInRange.forEach(function (o) {
        var h = new Date(o.orderedAt).getHours();
        byHour[h] = (byHour[h] || 0) + o.totalAmount;
      });
      rows = Object.keys(byHour)
        .map(Number)
        .sort(function (a, b) { return a - b; })
        .map(function (h) {
          return { label: String(h).padStart(2, '0') + '시 ~ ' + String(h).padStart(2, '0') + '시 59분', amount: byHour[h] };
        });
    } else if (dimension === 'MENU') {
      var orderIdsInRange = {};
      ordersInRange.forEach(function (o) { orderIdsInRange[o.id] = true; });
      var byMenu = {};
      db.orderItems.forEach(function (it) {
        if (!orderIdsInRange[it.orderId]) return;
        if (!byMenu[it.menuName]) byMenu[it.menuName] = { amount: 0, qty: 0 };
        byMenu[it.menuName].amount += it.unitPrice * it.quantity;
        byMenu[it.menuName].qty += it.quantity;
      });
      rows = Object.keys(byMenu)
        .map(function (name) { return { label: name, amount: byMenu[name].amount, sub: byMenu[name].qty + '개 판매' }; })
        .sort(function (a, b) { return b.amount - a.amount; });
    } else if (dimension === 'CHANNEL') {
      var byChannel = {};
      ordersInRange.forEach(function (o) {
        var label = o.channel === 'QR' ? 'QR오더' : '태블릿오더';
        byChannel[label] = (byChannel[label] || 0) + o.totalAmount;
      });
      rows = Object.keys(byChannel)
        .map(function (label) { return { label: label, amount: byChannel[label] }; })
        .sort(function (a, b) { return b.amount - a.amount; });
    } else if (dimension === 'PAYMENT') {
      var byMethod = {};
      ordersInRange.forEach(function (o) {
        var method = o.paymentMethod || '기타';
        byMethod[method] = (byMethod[method] || 0) + o.totalAmount;
      });
      rows = Object.keys(byMethod)
        .map(function (label) { return { label: label, amount: byMethod[label] }; })
        .sort(function (a, b) { return b.amount - a.amount; });
    }

    return { totalAmount: totalAmount, orderCount: ordersInRange.length, rows: rows };
  }

  /**
   * 재고 수량이 0으로 설정되고 매장의 autoSoldoutOnZeroStock이 켜져 있으면 자동으로 품절 처리한다.
   * stockQuantity가 null(무제한)이거나 0보다 크면 건드리지 않는다(자동으로 품절 해제하지는 않음 —
   * 품절 해제는 사장님이 직접 토글해야 한다).
   */
  function applyAutoSoldout(menuItem) {
    if (menuItem.stockQuantity !== 0) return;
    var category = db.menuCategories.find(function (c) { return c.id === menuItem.categoryId; });
    var store = category && findStore(category.storeId);
    if (store && store.autoSoldoutOnZeroStock) {
      menuItem.isSoldout = true;
    }
  }

  var MockApi = {
    /** POST /auth/login */
    login: function (loginId, password) {
      var user = db.users.find(function (u) {
        return u.loginId === loginId && u.password === password;
      });
      if (!user) {
        return withLatency({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' }, true);
      }
      if (user.role === 'STAFF' && user.isActive === false) {
        return withLatency({ message: '비활성화된 계정입니다. 사장님께 문의해주세요.' }, true);
      }
      return withLatency({ user: user });
    },

    /** GET /users/:userId/stores */
    getMyStores: function (userId) {
      var user = db.users.find(function (u) {
        return u.id === userId;
      });
      if (!user) {
        return withLatency({ message: '사용자를 찾을 수 없습니다.' }, true);
      }
      var stores = (user.storeIds || [])
        .map(function (storeId) { return findStore(storeId); })
        .filter(Boolean);
      return withLatency({ stores: stores });
    },

    /** GET /users/:userId/events — 행사 담당자가 담당하는 행사 목록 */
    getMyEvents: function (userId) {
      var user = db.users.find(function (u) {
        return u.id === userId;
      });
      if (!user) {
        return withLatency({ message: '사용자를 찾을 수 없습니다.' }, true);
      }
      var events = (user.eventIds || [])
        .map(function (eventId) { return db.events.find(function (e) { return e.id === eventId; }); })
        .filter(Boolean);
      return withLatency({ events: events });
    },

    /** GET /stores/:storeId/staff — 이 매장에 소속된 직원(STAFF) 계정 목록 */
    getStaffUsers: function (storeId) {
      var staff = db.users.filter(function (u) {
        return u.role === 'STAFF' && (u.storeIds || []).indexOf(storeId) !== -1;
      });
      return withLatency({ staff: staff });
    },

    /** POST /stores/:storeId/staff */
    addStaffUser: function (storeId, payload) {
      if (!payload.name || !payload.name.trim()) {
        return withLatency({ message: '이름을 입력해주세요.' }, true);
      }
      if (!payload.loginId || !payload.loginId.trim()) {
        return withLatency({ message: '로그인 아이디를 입력해주세요.' }, true);
      }
      if (db.users.some(function (u) { return u.loginId === payload.loginId; })) {
        return withLatency({ message: '이미 사용 중인 아이디입니다.' }, true);
      }
      var user = {
        id: 'user-staff-' + Date.now(),
        loginId: payload.loginId.trim(),
        password: payload.password || '0000',
        name: payload.name.trim(),
        phone: payload.phone || '',
        role: 'STAFF',
        storeIds: [storeId],
        isActive: true,
        permissions: { orderManage: true, menuManage: false, salesView: false, settingsChange: false },
      };
      db.users.push(user);
      saveDB(db);
      emit('mock:staff-changed', {});
      return withLatency({ user: user });
    },

    /** PATCH /users/:userId/permissions */
    updateStaffPermissions: function (userId, permissions) {
      var user = db.users.find(function (u) { return u.id === userId && u.role === 'STAFF'; });
      if (!user) {
        return withLatency({ message: '직원 계정을 찾을 수 없습니다.' }, true);
      }
      user.permissions = Object.assign({}, user.permissions, permissions);
      saveDB(db);
      emit('mock:staff-changed', {});
      return withLatency({ user: user });
    },

    /** PATCH /users/:userId/active */
    setStaffActive: function (userId, isActive) {
      var user = db.users.find(function (u) { return u.id === userId && u.role === 'STAFF'; });
      if (!user) {
        return withLatency({ message: '직원 계정을 찾을 수 없습니다.' }, true);
      }
      user.isActive = isActive;
      saveDB(db);
      emit('mock:staff-changed', {});
      return withLatency({ user: user });
    },

    /** GET /events/:eventId */
    getEvent: function (eventId) {
      var event = db.events.find(function (e) { return e.id === eventId; });
      if (!event) {
        return withLatency({ message: '행사를 찾을 수 없습니다.' }, true);
      }
      return withLatency({ event: event });
    },

    /** GET /events/:eventId/stores — 그 행사에 속한 매장(부스) 전체 */
    getStoresByEvent: function (eventId) {
      var stores = db.stores.filter(function (s) { return s.eventId === eventId; });
      return withLatency({ stores: stores });
    },

    /** GET /events/:eventId/dashboard-summary — 행사 담당자 홈 대시보드용 매장 상태/매출/주문건수 집계 */
    getEventDashboardSummary: function (eventId) {
      var stores = db.stores.filter(function (s) { return s.eventId === eventId; });
      var storeCounts = { OPEN: 0, PAUSED: 0, CLOSED: 0 };
      var todaySales = 0;
      var totalSales = 0;
      var todayOrderCount = 0;
      stores.forEach(function (s) {
        storeCounts[s.operatingStatus] = (storeCounts[s.operatingStatus] || 0) + 1;
        todaySales += s.todaySalesAmount || 0;
        totalSales += s.totalSalesAmount || 0;
        todayOrderCount += s.todayOrderCount || 0;
      });
      return withLatency({
        totalStores: stores.length,
        storeCounts: storeCounts,
        todaySales: todaySales,
        totalSales: totalSales,
        todayOrderCount: todayOrderCount,
      });
    },

    /**
     * GET /events/:eventId/attention-stores
     * 홈 대시보드의 '주의가 필요한 매장' 섹션 — 아래 3가지 조건을 실시간으로 감지한다.
     *  A. WAITING 상태 주문이 15분 이상 접수(수락)되지 않고 쌓여있는 매장
     *  B. 영업중(OPEN)인데 최근 1시간 이상 신규 주문이 없는 매장 (Store.lastOrderAt 기준)
     *  C. 이 행사가 '진행중'인데 마감(CLOSED) 상태를 30분 이상 유지하고 있는 매장
     *     (Store.statusChangedAt 기준 — 행사가 '예정'이라 아직 시작 전인 매장의 마감은
     *     정상 상태이므로 대상에서 제외한다)
     * 한 매장이 여러 조건에 동시에 걸리면 항목이 여러 개 생길 수 있다.
     */
    getAttentionStores: function (eventId) {
      var event = db.events.find(function (e) { return e.id === eventId; });
      if (!event) {
        return withLatency({ message: '행사를 찾을 수 없습니다.' }, true);
      }
      var stores = db.stores.filter(function (s) { return s.eventId === eventId; });
      var now = Date.now();
      var WAITING_STALE_MS = 15 * 60 * 1000;
      var NO_ORDER_MS = 60 * 60 * 1000;
      var CLOSED_STALE_MS = 30 * 60 * 1000;
      var items = [];

      stores.forEach(function (store) {
        var staleWaitingOrder = db.orders.find(function (o) {
          return o.storeId === store.id && o.status === 'WAITING' && now - new Date(o.orderedAt).getTime() >= WAITING_STALE_MS;
        });
        if (staleWaitingOrder) {
          var waitedMin = Math.floor((now - new Date(staleWaitingOrder.orderedAt).getTime()) / 60000);
          items.push({ storeId: store.id, storeName: store.name, boothNumber: store.boothNumber, reason: '대기 주문이 ' + waitedMin + '분째 접수되지 않고 있어요' });
        }

        if (store.operatingStatus === 'OPEN') {
          var lastOrderTime = store.lastOrderAt ? new Date(store.lastOrderAt).getTime() : null;
          if (!lastOrderTime || now - lastOrderTime >= NO_ORDER_MS) {
            items.push({ storeId: store.id, storeName: store.name, boothNumber: store.boothNumber, reason: '최근 1시간 이상 신규 주문이 없어요' });
          }
        }

        if (event.status === '진행중' && store.operatingStatus === 'CLOSED') {
          var closedTime = store.statusChangedAt ? new Date(store.statusChangedAt).getTime() : null;
          if (closedTime && now - closedTime >= CLOSED_STALE_MS) {
            items.push({ storeId: store.id, storeName: store.name, boothNumber: store.boothNumber, reason: '행사 진행 중인데 마감 상태를 계속 유지하고 있어요' });
          }
        }
      });

      return withLatency({ items: items });
    },

    /**
     * POST /events/:eventId/stores/bulk-status
     * 매장 현황 화면의 전체/선택 일괄 제어 + 홈 대시보드 빠른 액션 버튼이 함께 쓰는 핵심 함수.
     * storeIds 중 이미 targetStatus와 같은 매장은 건드리지 않고 skipped로 분류한다(중복 처리 방지).
     * 나머지는 실제로 상태를 바꾸되, 약 10% 확률로 무작위 실패를 재현한다 — 실제 서비스라면
     * 매장 단말기가 오프라인이거나 네트워크 문제로 개별 매장 처리가 실패할 수 있는 상황을
     * 흉내낸 것이다. 하나가 실패해도 나머지 매장 처리는 계속 진행한다(부분 실패 허용).
     * 처리 후 AuditLog를 한 건 남긴다(요청 1번 = 로그 1건, targetStoreIds에 전체 대상이 담김).
     * actorUser: 조작을 실행한 행사 담당자 계정(AppState.get().currentUser).
     * scopeLabel: 화면에 보여줄 대상 설명(예: '전체 12개', '선택한 3개') — 로그 문장에 그대로 쓰인다.
     */
    bulkUpdateStoreStatus: function (storeIds, targetStatus, actorUser, scopeLabel) {
      var now = new Date().toISOString();
      var succeeded = [];
      var skipped = [];
      var failed = [];

      storeIds.forEach(function (storeId) {
        var store = findStore(storeId);
        if (!store) {
          failed.push({ storeId: storeId, storeName: '(알 수 없는 매장)' });
          return;
        }
        if (store.operatingStatus === targetStatus) {
          skipped.push({ storeId: storeId, storeName: store.name });
          return;
        }
        if (Math.random() < 0.1) {
          failed.push({ storeId: storeId, storeName: store.name });
          return;
        }
        store.operatingStatus = targetStatus;
        store.statusChangedAt = now;
        succeeded.push({ storeId: storeId, storeName: store.name });
      });

      var STATUS_LABEL = { OPEN: '개점', CLOSED: '마감', PAUSED: '일시중지' };
      var statusLabel = STATUS_LABEL[targetStatus] || targetStatus;
      var resultSummary = '성공 ' + succeeded.length + '개 · 이미 같은 상태라 제외 ' + skipped.length + '개 · 실패 ' + failed.length + '개';
      var log = {
        id: 'audit-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        actorUserId: actorUser.id,
        actorRole: actorUser.role,
        action: '행사담당자 ' + actorUser.name + '님이 ' + (scopeLabel || storeIds.length + '개') + ' 매장을 ' + statusLabel + '(으)로 변경',
        targetStoreIds: storeIds,
        beforeStatus: null, // 매장마다 이전 상태가 다를 수 있어 일괄 조치에서는 단일 값으로 표현하지 않는다
        afterStatus: targetStatus,
        resultSummary: resultSummary,
        timestamp: now,
      };
      db.auditLogs.push(log);
      saveDB(db);
      // eslint-disable-next-line no-console
      console.log('[AuditLog]', log.action, '·', log.resultSummary);
      emit('mock:orders-changed', { reason: 'bulk-store-status' }); // 사장님 앱 쪽에서 해당 매장을 보고 있다면 갱신되도록
      emit('mock:dashboard-changed', {});
      emit('mock:audit-log-added', { log: log });

      return withLatency({ succeeded: succeeded, skipped: skipped, failed: failed, log: log });
    },

    /** GET /events/:eventId/audit-logs — 이 행사에 속한 매장을 대상으로 한 조작 이력만 최신순으로 필터링 */
    getAuditLogs: function (eventId) {
      var storeIdSet = {};
      db.stores.forEach(function (s) { if (s.eventId === eventId) storeIdSet[s.id] = true; });
      var logs = db.auditLogs
        .filter(function (log) {
          return log.targetStoreIds.some(function (id) { return storeIdSet[id]; });
        })
        .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
      return withLatency({ auditLogs: logs });
    },

    /**
     * 개발용 실시간 시뮬레이터(EventDashboardSimulator)가 주기적으로 호출 — 영업중인 매장의
     * 오늘 매출/주문건수/최근 주문시각을 조금씩 흔들어 홈 대시보드가 실시간처럼 보이게 한다.
     * 사장님 앱의 실제 주문 생성과는 별개로, 행사 담당자 대시보드 전용의 가벼운 집계값 시뮬레이션이다.
     */
    simulateStoreActivity: function () {
      var now = new Date().toISOString();
      var changed = false;
      db.stores.forEach(function (store) {
        if (store.operatingStatus !== 'OPEN') return;
        // store-4는 '주의가 필요한 매장' 조건 B(1시간 이상 신규 주문 없음)를 보여주기 위한 고정
        // 테스트 픽스처라, 시뮬레이터가 lastOrderAt을 계속 최신으로 되돌리면 데모/확인이 불가능해진다.
        // 실제로는 담당자가 조치해야 없어지는 항목이라는 뜻이므로 시뮬레이터 대상에서 제외한다.
        if (store.id === 'store-4') return;
        if (Math.random() < 0.5) return; // 매 틱마다 전부 바뀌지 않도록
        var bump = 5000 + Math.floor(Math.random() * 20000);
        store.todaySalesAmount = (store.todaySalesAmount || 0) + bump;
        store.totalSalesAmount = (store.totalSalesAmount || 0) + bump;
        store.todayOrderCount = (store.todayOrderCount || 0) + 1;
        store.lastOrderAt = now;
        changed = true;
      });
      if (changed) {
        saveDB(db);
        emit('mock:dashboard-changed', {});
      }
      return withLatency({ ok: true });
    },

    /** GET /stores/:storeId */
    getStore: function (storeId) {
      var store = findStore(storeId);
      if (!store) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      return withLatency({ store: store });
    },

    /** PATCH /stores/:storeId/operating-status */
    updateStoreOperatingStatus: function (storeId, status) {
      var store = findStore(storeId);
      if (!store) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      store.operatingStatus = status;
      store.statusChangedAt = new Date().toISOString();
      saveDB(db);
      return withLatency({ store: store });
    },

    /** PATCH /stores/:storeId/auto-soldout-on-zero-stock */
    setAutoSoldoutOnZeroStock: function (storeId, enabled) {
      var store = findStore(storeId);
      if (!store) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      store.autoSoldoutOnZeroStock = enabled;
      saveDB(db);
      return withLatency({ store: store });
    },

    /** PATCH /stores/:storeId/auto-accept-orders */
    setAutoAcceptOrders: function (storeId, enabled) {
      var store = findStore(storeId);
      if (!store) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      store.autoAcceptOrders = enabled;
      saveDB(db);
      return withLatency({ store: store });
    },

    /** PATCH /stores/:storeId/estimated-wait-minutes — 5분 단위로 사장님이 직접 조정하는 매장 전체 공통 예상 대기시간 */
    updateWaitTimeConfig: function (storeId, config) {
      var store = findStore(storeId);
      if (!store) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      if (config.menuCountUnit !== undefined) store.waitTimeMenuCountUnit = Math.max(1, config.menuCountUnit);
      if (config.minutesPerUnit !== undefined) store.waitTimeMinutesPerUnit = Math.max(1, config.minutesPerUnit);
      if (config.guideEnabled !== undefined) store.waitTimeGuideEnabled = !!config.guideEnabled;
      saveDB(db);
      return withLatency({ store: store });
    },

    /**
     * GET /stores/:storeId/estimated-wait-info
     * 현재 대기(WAITING)/접수(RECEIVED) 탭에 남아있는 미완료 주문의 메뉴 항목 총 수량을 기준으로
     * 올림(총수량 / N) × M 분으로 예상 대기시간을 계산한다. 완료/취소된 주문은 집계에서 제외한다.
     */
    getEstimatedWaitInfo: function (storeId) {
      var store = findStore(storeId);
      if (!store) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      var activeOrderIds = {};
      db.orders.forEach(function (o) {
        if (o.storeId === storeId && (o.status === 'WAITING' || o.status === 'RECEIVED')) activeOrderIds[o.id] = true;
      });
      var activeMenuQty = db.orderItems.reduce(function (sum, it) {
        return activeOrderIds[it.orderId] ? sum + it.quantity : sum;
      }, 0);
      var menuCountUnit = store.waitTimeMenuCountUnit || 1;
      var minutesPerUnit = store.waitTimeMinutesPerUnit || 0;
      var estimatedMinutes = activeMenuQty === 0 ? 0 : Math.ceil(activeMenuQty / menuCountUnit) * minutesPerUnit;
      return withLatency({
        guideEnabled: !!store.waitTimeGuideEnabled,
        menuCountUnit: menuCountUnit,
        minutesPerUnit: minutesPerUnit,
        activeMenuQty: activeMenuQty,
        estimatedMinutes: estimatedMinutes,
      });
    },

    /** GET /stores/:storeId/dashboard-summary */
    getDashboardSummary: function (storeId) {
      var store = findStore(storeId);
      if (!store) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      var storeOrders = db.orders.filter(function (o) { return o.storeId === storeId; });
      var todaysOrders = storeOrders.filter(function (o) {
        return isToday(o.orderedAt) && o.status !== 'CANCELED';
      });
      // 매출(todaysSales)은 완료(COMPLETED)된 주문만 합산한다 — 대기/접수 중인 미완료 주문과
      // 취소된 주문은 매출이 아니다(매출 계산 기준 통일).
      var todaysSales = todaysOrders
        .filter(function (o) { return o.status === 'COMPLETED'; })
        .reduce(function (sum, o) {
          return sum + (o.paymentStatus === 'PAID' ? o.totalAmount : 0);
        }, 0);
      var waitingCustomers = storeOrders.filter(function (o) {
        return ACTIVE_STATUSES.indexOf(o.status) !== -1;
      }).length;

      return withLatency({
        todaysSales: todaysSales,
        todaysOrderCount: todaysOrders.length,
        waitingCustomers: waitingCustomers,
      });
    },

    /** GET /stores/:storeId/menu-categories */
    getMenuCategories: function (storeId) {
      var categories = db.menuCategories
        .filter(function (c) {
          return c.storeId === storeId;
        })
        .sort(function (a, b) {
          return a.sortOrder - b.sortOrder;
        });
      return withLatency({ menuCategories: categories });
    },

    /** GET /stores/:storeId/menu-items (소프트 삭제된 메뉴는 제외) */
    getMenuItems: function () {
      return withLatency({
        menuItems: db.menuItems.filter(function (m) {
          return !m.isDeleted;
        }),
      });
    },

    /** POST /stores/:storeId/menu-categories */
    addMenuCategory: function (storeId, name) {
      var maxSort = db.menuCategories.reduce(function (mx, c) {
        return Math.max(mx, c.sortOrder);
      }, 0);
      var category = { id: 'cat-' + Date.now(), storeId: storeId, name: name, sortOrder: maxSort + 1, isHidden: false };
      db.menuCategories.push(category);
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ category: category });
    },

    /** PATCH /menu-categories/:categoryId */
    updateMenuCategory: function (categoryId, name) {
      var category = db.menuCategories.find(function (c) {
        return c.id === categoryId;
      });
      if (!category) {
        return withLatency({ message: '카테고리를 찾을 수 없습니다.' }, true);
      }
      category.name = name;
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ category: category });
    },

    /** PATCH /menu-categories/:categoryId/hidden */
    setCategoryHidden: function (categoryId, hidden) {
      var category = db.menuCategories.find(function (c) {
        return c.id === categoryId;
      });
      if (!category) {
        return withLatency({ message: '카테고리를 찾을 수 없습니다.' }, true);
      }
      category.isHidden = hidden;
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ category: category });
    },

    /**
     * DELETE /menu-categories/:categoryId
     * 연결된(삭제되지 않은) 메뉴가 있으면 실제 삭제 대신 숨김 처리한다.
     */
    deleteMenuCategory: function (categoryId) {
      var hasLinkedMenus = db.menuItems.some(function (m) {
        return m.categoryId === categoryId && !m.isDeleted;
      });
      if (hasLinkedMenus) {
        var category = db.menuCategories.find(function (c) {
          return c.id === categoryId;
        });
        if (!category) {
          return withLatency({ message: '카테고리를 찾을 수 없습니다.' }, true);
        }
        category.isHidden = true;
        saveDB(db);
        emit('mock:menu-changed', {});
        return withLatency({ hidden: true, category: category });
      }
      db.menuCategories = db.menuCategories.filter(function (c) {
        return c.id !== categoryId;
      });
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ deleted: true });
    },

    /** PATCH /menu-categories/:categoryId/move  direction: 'up'|'down' */
    moveCategory: function (categoryId, direction) {
      var sorted = db.menuCategories.slice().sort(function (a, b) {
        return a.sortOrder - b.sortOrder;
      });
      var idx = sorted.findIndex(function (c) {
        return c.id === categoryId;
      });
      var swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) {
        return withLatency({ message: '이동할 수 없습니다.' }, true);
      }
      var tmp = sorted[idx].sortOrder;
      sorted[idx].sortOrder = sorted[swapIdx].sortOrder;
      sorted[swapIdx].sortOrder = tmp;
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ ok: true });
    },

    /** PATCH /menu-items/:menuItemId/move — 같은 카테고리 안에서만 순서를 바꾼다 */
    moveMenuItem: function (menuItemId, direction) {
      var target = db.menuItems.find(function (m) { return m.id === menuItemId; });
      if (!target) {
        return withLatency({ message: '메뉴를 찾을 수 없습니다.' }, true);
      }
      var sorted = db.menuItems
        .filter(function (m) { return m.categoryId === target.categoryId; })
        .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
      var idx = sorted.findIndex(function (m) { return m.id === menuItemId; });
      var swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) {
        return withLatency({ message: '이동할 수 없습니다.' }, true);
      }
      var tmp = sorted[idx].sortOrder;
      sorted[idx].sortOrder = sorted[swapIdx].sortOrder;
      sorted[swapIdx].sortOrder = tmp;
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ ok: true });
    },

    /** POST /stores/:storeId/menu-items */
    addMenuItem: function (payload) {
      var maxSort = db.menuItems
        .filter(function (m) {
          return m.categoryId === payload.categoryId;
        })
        .reduce(function (mx, m) {
          return Math.max(mx, m.sortOrder);
        }, 0);
      var menuItem = {
        id: 'menu-' + Date.now(),
        categoryId: payload.categoryId,
        name: payload.name,
        description: payload.description || '',
        price: payload.price,
        imageUrl: payload.imageUrl || '',
        isSoldout: false,
        isVisible: payload.isVisible !== false,
        isDeleted: false,
        sortOrder: maxSort + 1,
        stockQuantity: payload.stockQuantity === undefined ? null : payload.stockQuantity,
        origin: payload.origin || '',
        optionGroups: payload.optionGroups || [],
      };
      applyAutoSoldout(menuItem);
      db.menuItems.push(menuItem);
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ menuItem: menuItem });
    },

    /**
     * PATCH /menu-items/:menuItemId
     * 주의: 이미 발생한 주문의 OrderItem은 menuName/unitPrice를 스냅샷으로 별도 저장하므로
     * 여기서 메뉴 정보를 바꿔도 과거 주문 표시에는 영향을 주지 않는다.
     */
    updateMenuItem: function (menuItemId, payload) {
      var menuItem = db.menuItems.find(function (m) {
        return m.id === menuItemId;
      });
      if (!menuItem) {
        return withLatency({ message: '메뉴를 찾을 수 없습니다.' }, true);
      }
      ['categoryId', 'name', 'description', 'price', 'imageUrl', 'isVisible', 'stockQuantity', 'origin', 'optionGroups'].forEach(function (key) {
        if (payload[key] !== undefined) menuItem[key] = payload[key];
      });
      applyAutoSoldout(menuItem);
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ menuItem: menuItem });
    },

    /** PATCH /menu-items/:menuItemId/soldout */
    setMenuSoldout: function (menuItemId, isSoldout) {
      var menuItem = db.menuItems.find(function (m) {
        return m.id === menuItemId;
      });
      if (!menuItem) {
        return withLatency({ message: '메뉴를 찾을 수 없습니다.' }, true);
      }
      menuItem.isSoldout = isSoldout;
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ menuItem: menuItem });
    },

    /** DELETE /menu-items/:menuItemId (소프트 삭제) */
    deleteMenuItem: function (menuItemId) {
      var menuItem = db.menuItems.find(function (m) {
        return m.id === menuItemId;
      });
      if (!menuItem) {
        return withLatency({ message: '메뉴를 찾을 수 없습니다.' }, true);
      }
      menuItem.isDeleted = true;
      saveDB(db);
      emit('mock:menu-changed', {});
      return withLatency({ ok: true });
    },

    /** GET /stores/:storeId/orders */
    getOrders: function (storeId) {
      var orders = db.orders.filter(function (o) { return o.storeId === storeId; });
      var orderIds = {};
      orders.forEach(function (o) { orderIds[o.id] = true; });
      var orderItems = db.orderItems.filter(function (it) { return orderIds[it.orderId]; });
      return withLatency({ orders: orders, orderItems: orderItems });
    },

    /** GET /stores/:storeId/notification-logs */
    getNotificationLogs: function (storeId) {
      var orderIds = {};
      db.orders.forEach(function (o) { if (o.storeId === storeId) orderIds[o.id] = true; });
      var notificationLogs = db.notificationLogs.filter(function (l) { return orderIds[l.orderId]; });
      return withLatency({ notificationLogs: notificationLogs });
    },

    /**
     * PATCH /orders/:orderId/status
     * 허용 전이: WAITING -> RECEIVED | COMPLETED,  RECEIVED -> COMPLETED
     * (WAITING에서 RECEIVED(접수)를 건너뛰고 바로 COMPLETED로 가는 것도 허용됨)
     * COMPLETED로 전이될 때마다 completedCount를 1 증가시킨다(되돌리기 후 재완료 시 누적됨).
     */
    advanceOrderStatus: function (orderId, targetStatus) {
      var order = db.orders.find(function (o) {
        return o.id === orderId;
      });
      if (!order) {
        return withLatency({ message: '주문을 찾을 수 없습니다.' }, true);
      }
      if (order.status === 'COMPLETED' || order.status === 'CANCELED') {
        return withLatency({ code: 'ALREADY_PROCESSED', message: '이미 처리된 주문입니다.' }, true);
      }
      var isForwardMove = STATUS_RANK[targetStatus] > STATUS_RANK[order.status];
      if (!isForwardMove) {
        return withLatency({ message: '허용되지 않는 상태 변경입니다.' }, true);
      }
      var now = new Date().toISOString();
      if (targetStatus === 'RECEIVED') order.acceptedAt = now;
      if (targetStatus === 'COMPLETED') {
        order.completedAt = now;
        order.completedCount = (order.completedCount || 0) + 1;
      }
      order.status = targetStatus;
      saveDB(db);
      emit('mock:orders-changed', { reason: 'status', orderId: orderId });
      return withLatency({ order: order });
    },

    /**
     * PATCH /orders/:orderId/cancel
     * STEP 3 기준: 완료(COMPLETED)된 주문도 취소 가능(완료 탭에서도 취소 노출).
     * 단, 이미 취소된 주문은 재취소할 수 없다.
     * reason은 미리 정의된 사유(품절/고객요청/오류) 또는 '직접입력'으로 사장님이 입력한 임의의
     * 문자열이어도 된다 — 공백이 아닌 문자열이기만 하면 통과시킨다.
     */
    cancelOrder: function (orderId, reason) {
      var order = db.orders.find(function (o) {
        return o.id === orderId;
      });
      if (!order) {
        return withLatency({ message: '주문을 찾을 수 없습니다.' }, true);
      }
      if (order.status === 'CANCELED') {
        return withLatency({ code: 'ALREADY_PROCESSED', message: '이미 처리된 주문입니다.' }, true);
      }
      if (!reason || !String(reason).trim()) {
        return withLatency({ message: '취소 사유를 선택해주세요.' }, true);
      }
      order.status = 'CANCELED';
      order.cancelReason = String(reason).trim();
      order.canceledAt = new Date().toISOString();
      saveDB(db);
      emit('mock:orders-changed', { reason: 'cancel', orderId: orderId });
      return withLatency({ order: order });
    },

    /**
     * PATCH /orders/:orderId/revert-to-received
     * 완료 탭에서 실수로 완료 처리한 경우를 되돌리는 전용 함수 — COMPLETED -> RECEIVED(접수)로만
     * 되돌릴 수 있다(호출 탭이 사라졌으므로 되돌아갈 곳은 접수 탭 하나뿐).
     * completedCount는 되돌리기로 줄어들지 않는다 — 이후 다시 완료 처리하면 그때 또 누적된다.
     * (일반적인 상태 전이는 advanceOrderStatus로 앞으로만 가능하므로, 이 되돌리기만 예외적으로 역방향을 허용한다.)
     */
    revertCompletedToReceived: function (orderId) {
      var order = db.orders.find(function (o) {
        return o.id === orderId;
      });
      if (!order) {
        return withLatency({ message: '주문을 찾을 수 없습니다.' }, true);
      }
      if (order.status !== 'COMPLETED') {
        return withLatency({ message: '완료 상태의 주문만 되돌릴 수 있습니다.' }, true);
      }
      order.status = 'RECEIVED';
      order.completedAt = null;
      saveDB(db);
      emit('mock:orders-changed', { reason: 'revert', orderId: orderId });
      return withLatency({ order: order });
    },

    /** 알림톡 발송 문구 미리보기 (클라이언트에서 즉시 렌더링하는 순수 헬퍼, 지연 없음) */
    buildKakaoMessage: function (orderId) {
      var order = db.orders.find(function (o) {
        return o.id === orderId;
      });
      if (!order) return '';
      var store = findStore(order.storeId);
      var customerLabel = order.customerName || '#' + order.orderNo;
      var location = order.receiveType === 'TABLE_SERVICE' ? '테이블 ' + order.tableOrPickupNo + '번' : '카운터';
      return (
        '[' + (store ? store.name : '') + '] ' + customerLabel + '님, 주문하신 메뉴가 준비되었습니다. ' +
        location + '에서 수령해 주세요. 주문번호: ' + order.pgOrderNo
      );
    },

    /**
     * POST /orders/:orderId/kakao-alert
     * 카카오 알림톡 발송을 흉내내는 목업 — 90% 성공 / 10% 실패를 무작위로 반환한다.
     * 발송 실패는 기술적 오류가 아니라 "발송 결과가 실패"인 정상 응답이므로 reject 하지 않는다.
     */
    sendKakaoAlert: function (orderId) {
      var order = db.orders.find(function (o) {
        return o.id === orderId;
      });
      if (!order) {
        return withLatency({ message: '주문을 찾을 수 없습니다.' }, true);
      }
      var message = MockApi.buildKakaoMessage(orderId);
      var success = Math.random() < 0.9;
      var now = new Date().toISOString();
      var log = {
        id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        orderId: orderId,
        type: 'KAKAO_ALERT',
        status: success ? 'SUCCESS' : 'FAIL',
        sentAt: now,
        message: message,
      };
      db.notificationLogs.push(log);
      order.callStatus = success ? 'CALLED' : 'FAILED';
      if (success) order.calledAt = now;
      saveDB(db);
      emit('mock:orders-changed', { reason: 'kakao', orderId: orderId });
      return withLatency({ success: success, order: order, log: log });
    },

    /** 개발용 실시간 시뮬레이터가 호출 — 무작위 신규 주문 1건 생성 */
    createRandomOrder: function (storeId) {
      var store = findStore(storeId);
      if (!store || store.operatingStatus !== 'OPEN') {
        return withLatency({ message: '영업 중이 아닙니다.' }, true);
      }
      var storeCategoryIds = {};
      db.menuCategories.forEach(function (c) { if (c.storeId === storeId) storeCategoryIds[c.id] = true; });
      var availableItems = db.menuItems.filter(function (m) {
        return storeCategoryIds[m.categoryId] && m.isVisible && !m.isSoldout && !m.isDeleted;
      });
      if (availableItems.length === 0) {
        return withLatency({ message: '주문 가능한 메뉴가 없습니다.' }, true);
      }
      var channel = Math.random() < 0.5 ? 'QR' : 'TABLET';
      var receiveType = Math.random() < 0.5 ? 'TABLE_SERVICE' : 'COUNTER_PICKUP';
      var itemCount = 1 + Math.floor(Math.random() * 3);
      var chosenItems = [];
      for (var i = 0; i < itemCount; i++) {
        chosenItems.push(availableItems[Math.floor(Math.random() * availableItems.length)]);
      }
      // 약 15% 확률로 오입력 의심 번호(010이 아니거나 자릿수가 다름)를 섞어 화면의 경고 표시를 계속 테스트할 수 있게 한다.
      var phone =
        Math.random() < 0.15
          ? Math.random() < 0.5
            ? '02' + String(Math.floor(1000000 + Math.random() * 8999999))
            : '010' + String(Math.floor(1000000 + Math.random() * 8999999))
          : '010' + String(Math.floor(10000000 + Math.random() * 89999999));
      var paymentMethodRoll = Math.random();
      var paymentMethod = paymentMethodRoll < 0.6 ? '카드' : paymentMethodRoll < 0.9 ? '간편결제' : '현금';
      var orderTypeRoll = Math.random();
      var orderType = orderTypeRoll < 0.45 ? 'PACKAGING' : orderTypeRoll < 0.8 ? 'REUSABLE' : 'EXPERIENCE';
      var orderId = 'order-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      var totalAmount = chosenItems.reduce(function (sum, m) {
        return sum + m.price;
      }, 0);
      var orderNo = db.nextOrderNo++;
      var now = new Date();
      var ymd = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      var autoAccept = !!store.autoAcceptOrders;
      var order = {
        id: orderId,
        storeId: storeId,
        orderNo: orderNo,
        pgOrderNo: 'PG-' + ymd + '-' + String(orderNo).padStart(6, '0'),
        channel: channel,
        receiveType: receiveType,
        orderType: orderType,
        tableOrPickupNo: String(1 + Math.floor(Math.random() * 20)),
        customerPhone: phone,
        customerName: null,
        status: autoAccept ? 'RECEIVED' : 'WAITING',
        paymentStatus: 'PAID',
        paymentMethod: paymentMethod,
        totalAmount: totalAmount,
        orderedAt: now.toISOString(),
        acceptedAt: autoAccept ? now.toISOString() : null,
        completedAt: null,
        canceledAt: null,
        cancelReason: null,
        completedCount: 0,
        callStatus: 'NOT_CALLED',
        calledAt: null,
      };
      db.orders.push(order);
      chosenItems.forEach(function (m, idx) {
        db.orderItems.push({
          id: orderId + '-item-' + idx,
          orderId: orderId,
          menuItemId: m.id,
          menuName: m.name,
          unitPrice: m.price,
          quantity: 1,
          optionsSummary: '',
        });
      });
      saveDB(db);
      emit('mock:orders-changed', { reason: 'create', orderId: orderId });
      emit('mock:new-order', { order: order });
      return withLatency({ order: order });
    },

    /**
     * GET /stores/:storeId/sales
     * dimension: 'PERIOD'(기간별) | 'HOUR'(시간대별) | 'MENU'(메뉴별) | 'PAYMENT'(결제수단별) | 'CHANNEL'(주문경로별)
     * range: { from: ISOString, to: ISOString } (inclusive)
     * 결제수단(PAYMENT)은 이제 Order.paymentMethod 실제 필드를 그대로 집계한다(computeBreakdown 참고).
     */
    getSalesBreakdown: function (storeId, dimension, range) {
      if (!findStore(storeId)) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      var ordersInRange = ordersInRangeFor([storeId], range);
      return withLatency(computeBreakdown(ordersInRange, dimension));
    },

    /**
     * GET /events/:eventId/sales
     * 사장님 앱의 getSalesBreakdown과 완전히 같은 집계 로직(computeBreakdown)을 재사용하되,
     * 대상을 매장 하나가 아니라 storeIdFilter로 지정한다: null/'ALL'이면 이 행사에 속한 모든
     * 매장의 주문을 합산하고, 특정 storeId면 그 매장 하나만 본다(매출 화면의 '매장 필터' 용도).
     * store-1(브루웍스 성수점) 외에는 실제 Order 데이터가 없으므로(행사 담당자 기반 구조 개편
     * 단계 참고), 다른 매장을 단독으로 선택하면 해당 기간에 매출이 없는 것으로 정상적으로 표시된다
     * — 데이터를 지어내지 않고 실제로 존재하는 주문만 집계한 정직한 결과다.
     */
    getEventSalesBreakdown: function (eventId, storeIdFilter, dimension, range) {
      var eventStoreIds = db.stores.filter(function (s) { return s.eventId === eventId; }).map(function (s) { return s.id; });
      var targetStoreIds = storeIdFilter && storeIdFilter !== 'ALL' ? [storeIdFilter] : eventStoreIds;
      var ordersInRange = ordersInRangeFor(targetStoreIds, range);
      return withLatency(computeBreakdown(ordersInRange, dimension));
    },

    /**
     * GET /events/:eventId/menu-ranking?storeId=&from=&to=
     * getEventSalesBreakdown의 'MENU' 집계와 달리, 매장이 다르면 같은 이름의 메뉴가 섞이지 않도록
     * (매장, 메뉴명) 쌍으로 묶어서 "메뉴명 (매장명)" 라벨을 만든다 — 행사 전체 메뉴 랭킹용.
     * store-1 외에는 실제 Order 데이터가 없어(getEventSalesBreakdown 주석 참고) 사실상 store-1의
     * 메뉴만 나타나는 경우가 많다 — 데이터를 지어내지 않고 실제 주문만 집계한 정직한 결과다.
     */
    getEventMenuRanking: function (eventId, storeIdFilter, range) {
      var eventStores = db.stores.filter(function (s) { return s.eventId === eventId; });
      var targetStoreIds = storeIdFilter && storeIdFilter !== 'ALL' ? [storeIdFilter] : eventStores.map(function (s) { return s.id; });
      var ordersInRange = ordersInRangeFor(targetStoreIds, range);
      var storeIdByOrderId = {};
      ordersInRange.forEach(function (o) { storeIdByOrderId[o.id] = o.storeId; });
      var storeNameById = {};
      eventStores.forEach(function (s) { storeNameById[s.id] = s.name; });
      var byKey = {};
      db.orderItems.forEach(function (it) {
        var storeId = storeIdByOrderId[it.orderId];
        if (!storeId) return;
        var key = storeId + '::' + it.menuName;
        if (!byKey[key]) byKey[key] = { menuName: it.menuName, storeName: storeNameById[storeId] || '-', amount: 0, qty: 0 };
        byKey[key].amount += it.unitPrice * it.quantity;
        byKey[key].qty += it.quantity;
      });
      var rows = Object.keys(byKey)
        .map(function (key) {
          var r = byKey[key];
          return { label: r.menuName + ' (' + r.storeName + ')', amount: r.amount, sub: r.qty + '개 판매' };
        })
        .sort(function (a, b) { return b.amount - a.amount; });
      var totalAmount = rows.reduce(function (sum, r) { return sum + r.amount; }, 0);
      return withLatency({ totalAmount: totalAmount, orderCount: ordersInRange.length, rows: rows });
    },

    /**
     * GET /events/:eventId/order-stats — 오늘 하루 기준 총 주문건수/취소건수와 주문경로(QR/태블릿)
     * 비중을 계산한다. 매출과 달리 완료 여부와 무관하게 오늘 접수된 모든 주문을 센다(주문경로
     * 비중은 "얼마나 벌었는지"가 아니라 "몇 건이 어떤 채널로 들어왔는지"를 보여주는 값이라 건수
     * 기준이 더 자연스럽다 — 매출 기준인 주문경로별 매출 도넛 차트와는 의도적으로 다른 지표다).
     */
    getEventOrderStats: function (eventId) {
      var storeIds = db.stores.filter(function (s) { return s.eventId === eventId; }).map(function (s) { return s.id; });
      var storeIdSet = {};
      storeIds.forEach(function (id) { storeIdSet[id] = true; });
      var now = new Date();
      var todayFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      var todayTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      var todaysOrders = db.orders.filter(function (o) {
        if (!storeIdSet[o.storeId]) return false;
        var t = new Date(o.orderedAt).getTime();
        return t >= todayFrom && t <= todayTo;
      });
      var totalOrderCount = todaysOrders.length;
      var canceledOrderCount = todaysOrders.filter(function (o) { return o.status === 'CANCELED'; }).length;
      var qrCount = todaysOrders.filter(function (o) { return o.channel === 'QR'; }).length;
      var qrPct = totalOrderCount > 0 ? Math.round((qrCount / totalOrderCount) * 100) : 0;
      var tabletPct = totalOrderCount > 0 ? 100 - qrPct : 0;
      return withLatency({
        totalOrderCount: totalOrderCount,
        canceledOrderCount: canceledOrderCount,
        qrPct: qrPct,
        tabletPct: tabletPct,
      });
    },

    /**
     * GET /events/:eventId/ai-sales-insight
     * ⚠️ 목업: 실제 AI/LLM 연동이 아니라, 오늘/어제 매출·매출 1위 매장·가장 많이 팔린 메뉴·
     * 오늘 취소율을 계산해 미리 정해둔 문장 틀에 끼워 넣는 규칙 기반 조합이다. 실제 AI 분석
     * 기능으로 교체할 때는 이 함수의 "본문만" 실제 LLM API 호출(현재 계산한 통계를 프롬프트에
     * 담아 전달하거나, 아예 원시 데이터를 서버로 보내 서버가 프롬프트를 구성하는 방식 등)로
     * 바꾸면 된다 — 반환 형태({ message })와 호출부(eventManagerSales.js)는 그대로 유지 가능하다.
     */
    getAiSalesInsight: function (eventId) {
      var stores = db.stores.filter(function (s) { return s.eventId === eventId; });
      var storeIds = stores.map(function (s) { return s.id; });
      var storeIdSet = {};
      storeIds.forEach(function (id) { storeIdSet[id] = true; });
      var now = new Date();
      var todayFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      var todayTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      var yestFrom = new Date(todayFrom.getTime());
      yestFrom.setDate(yestFrom.getDate() - 1);
      var yestTo = new Date(todayTo.getTime());
      yestTo.setDate(yestTo.getDate() - 1);

      var todayCompleted = ordersInRangeFor(storeIds, { from: todayFrom.toISOString(), to: todayTo.toISOString() });
      var yestCompleted = ordersInRangeFor(storeIds, { from: yestFrom.toISOString(), to: yestTo.toISOString() });
      var todaySales = todayCompleted.reduce(function (sum, o) { return sum + o.totalAmount; }, 0);
      var yestSales = yestCompleted.reduce(function (sum, o) { return sum + o.totalAmount; }, 0);

      var allTodayOrders = db.orders.filter(function (o) {
        if (!storeIdSet[o.storeId]) return false;
        var t = new Date(o.orderedAt).getTime();
        return t >= todayFrom.getTime() && t <= todayTo.getTime();
      });

      if (allTodayOrders.length === 0) {
        return withLatency({ message: '오늘은 아직 집계된 주문이 없어요. 주문이 들어오면 인사이트를 보여드릴게요.' });
      }

      var growthPct = yestSales > 0 ? Math.round(((todaySales - yestSales) / yestSales) * 100) : (todaySales > 0 ? 100 : 0);

      var byStore = {};
      todayCompleted.forEach(function (o) { byStore[o.storeId] = (byStore[o.storeId] || 0) + o.totalAmount; });
      var topStoreId = Object.keys(byStore).sort(function (a, b) { return byStore[b] - byStore[a]; })[0];
      var topStore = topStoreId ? stores.find(function (s) { return s.id === topStoreId; }) : null;

      var todayOrderIds = {};
      todayCompleted.forEach(function (o) { todayOrderIds[o.id] = true; });
      var byMenu = {};
      db.orderItems.forEach(function (it) {
        if (todayOrderIds[it.orderId]) byMenu[it.menuName] = (byMenu[it.menuName] || 0) + it.quantity;
      });
      var topMenuName = Object.keys(byMenu).sort(function (a, b) { return byMenu[b] - byMenu[a]; })[0] || null;

      var canceledToday = allTodayOrders.filter(function (o) { return o.status === 'CANCELED'; }).length;
      var cancelRatePct = Math.round((canceledToday / allTodayOrders.length) * 1000) / 10;

      var sentence = '오늘 매출은 어제보다 ' + (growthPct >= 0 ? growthPct + '% 증가했어요.' : Math.abs(growthPct) + '% 감소했어요.');
      if (topStore) sentence += ' ' + topStore.name + pickIGaParticle(topStore.name) + ' 가장 높은 매출(' + byStore[topStoreId].toLocaleString('ko-KR') + '원)을 기록했고,';
      if (topMenuName) sentence += (topStore ? '' : ' ') + ' 가장 많이 팔린 메뉴는 ' + topMenuName + '예요.';
      sentence += ' 취소율은 ' + cancelRatePct + '%로 ' + (cancelRatePct >= 5 ? '평소보다 높아요 — 취소 사유를 확인해보는 게 좋겠어요.' : '안정적이에요.');

      return withLatency({ message: sentence });
    },

    /** 개발용: 시드 데이터로 초기화 */
    resetSeed: function () {
      db = seedDB();
      emit('mock:orders-changed', { reason: 'reset' });
      return withLatency({ ok: true });
    },
  };

  window.MockApi = MockApi;
})();
