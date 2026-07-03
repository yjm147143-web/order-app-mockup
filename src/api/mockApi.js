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
 *  updateStoreOperatingStatus() -> PATCH  /stores/:storeId/operating-status
 *  setAutoSoldoutOnZeroStock()  -> PATCH  /stores/:storeId/auto-soldout-on-zero-stock
 *  updateEstimatedWaitMinutes() -> PATCH  /stores/:storeId/estimated-wait-minutes
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
 *  addMenuItem()                  -> POST   /stores/:storeId/menu-items
 *  updateMenuItem()               -> PATCH  /menu-items/:menuItemId
 *  setMenuSoldout()               -> PATCH  /menu-items/:menuItemId/soldout
 *  deleteMenuItem()               -> DELETE /menu-items/:menuItemId  (소프트 삭제)
 *  getSalesBreakdown()            -> GET   /stores/:storeId/sales?dimension=&from=&to=
 *
 * 실제 프로젝트(Node 사용 가능 환경)에서는 json-server + 이 함수들 내부를
 * fetch('http://localhost:4000/...') 로 바꾸는 것을 권장한다. (README 참고)
 *
 * 이벤트: 데이터가 바뀔 때마다 window 에 CustomEvent를 발행한다 (실시간성 흉내).
 *  - 'mock:orders-changed'  detail: { reason } — 주문 관련 화면은 이 이벤트를 듣고 새로고침
 *  - 'mock:new-order'       detail: { order }  — 신규 주문 배너 알림용
 *  - 'mock:menu-changed'    detail: {}         — 메뉴/카테고리 화면은 이 이벤트를 듣고 새로고침
 */

(function () {
  var DB_KEY = 'sajang-app-mock-db-v7'; // v7: 주문 상태 대기/접수/완료 개편(WAITING/RECEIVED/COMPLETED), completedCount 추가,
                                         // 메뉴별 cookTimeMinutes 제거 후 Store.estimatedWaitMinutes(매장 전체 공통값)로 대체
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
      store: deepClone(window.MockData.STORE),
      users: deepClone(window.MockData.USERS),
      menuCategories: deepClone(window.MockData.MENU_CATEGORIES),
      menuItems: deepClone(window.MockData.MENU_ITEMS),
      orders: deepClone(window.MockData.ORDERS),
      orderItems: deepClone(window.MockData.ORDER_ITEMS),
      notificationLogs: deepClone(window.MockData.NOTIFICATION_LOGS),
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

  /**
   * 재고 수량이 0으로 설정되고 매장의 autoSoldoutOnZeroStock이 켜져 있으면 자동으로 품절 처리한다.
   * stockQuantity가 null(무제한)이거나 0보다 크면 건드리지 않는다(자동으로 품절 해제하지는 않음 —
   * 품절 해제는 사장님이 직접 토글해야 한다).
   */
  function applyAutoSoldout(menuItem) {
    if (menuItem.stockQuantity === 0 && db.store.autoSoldoutOnZeroStock) {
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
      var stores = user.storeIds
        .map(function (storeId) {
          return db.store.id === storeId ? db.store : null;
        })
        .filter(Boolean);
      return withLatency({ stores: stores });
    },

    /** GET /stores/:storeId */
    getStore: function (storeId) {
      if (db.store.id !== storeId) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      return withLatency({ store: db.store });
    },

    /** PATCH /stores/:storeId/operating-status */
    updateStoreOperatingStatus: function (storeId, status) {
      if (db.store.id !== storeId) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      db.store.operatingStatus = status;
      saveDB(db);
      return withLatency({ store: db.store });
    },

    /** PATCH /stores/:storeId/auto-soldout-on-zero-stock */
    setAutoSoldoutOnZeroStock: function (storeId, enabled) {
      if (db.store.id !== storeId) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      db.store.autoSoldoutOnZeroStock = enabled;
      saveDB(db);
      return withLatency({ store: db.store });
    },

    /** PATCH /stores/:storeId/estimated-wait-minutes — 5분 단위로 사장님이 직접 조정하는 매장 전체 공통 예상 대기시간 */
    updateEstimatedWaitMinutes: function (storeId, minutes) {
      if (db.store.id !== storeId) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      db.store.estimatedWaitMinutes = Math.max(0, minutes);
      saveDB(db);
      return withLatency({ store: db.store });
    },

    /** GET /stores/:storeId/dashboard-summary */
    getDashboardSummary: function (storeId) {
      if (db.store.id !== storeId) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      var todaysOrders = db.orders.filter(function (o) {
        return isToday(o.orderedAt) && o.status !== 'CANCELED';
      });
      var todaysSales = todaysOrders.reduce(function (sum, o) {
        return sum + (o.paymentStatus === 'PAID' ? o.totalAmount : 0);
      }, 0);
      var waitingCustomers = db.orders.filter(function (o) {
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
      ['categoryId', 'name', 'description', 'price', 'imageUrl', 'isVisible', 'stockQuantity', 'optionGroups'].forEach(function (key) {
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
    getOrders: function () {
      return withLatency({ orders: db.orders, orderItems: db.orderItems });
    },

    /** GET /stores/:storeId/notification-logs */
    getNotificationLogs: function () {
      return withLatency({ notificationLogs: db.notificationLogs });
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
      var customerLabel = order.customerName || '#' + order.orderNo;
      var location = order.receiveType === 'TABLE_SERVICE' ? '테이블 ' + order.tableOrPickupNo + '번' : '카운터';
      return (
        '[' + db.store.name + '] ' + customerLabel + '님, 주문하신 메뉴가 준비되었습니다. ' +
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
      if (db.store.id !== storeId || db.store.operatingStatus !== 'OPEN') {
        return withLatency({ message: '영업 중이 아닙니다.' }, true);
      }
      var channel = Math.random() < 0.5 ? 'QR' : 'TABLET';
      var receiveType = Math.random() < 0.5 ? 'TABLE_SERVICE' : 'COUNTER_PICKUP';
      var availableItems = db.menuItems.filter(function (m) {
        return m.isVisible && !m.isSoldout && !m.isDeleted;
      });
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
      var orderId = 'order-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      var totalAmount = chosenItems.reduce(function (sum, m) {
        return sum + m.price;
      }, 0);
      var orderNo = db.nextOrderNo++;
      var now = new Date();
      var ymd = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      var order = {
        id: orderId,
        orderNo: orderNo,
        pgOrderNo: 'PG-' + ymd + '-' + String(orderNo).padStart(6, '0'),
        channel: channel,
        receiveType: receiveType,
        tableOrPickupNo: String(1 + Math.floor(Math.random() * 20)),
        customerPhone: phone,
        customerName: null,
        status: 'WAITING',
        paymentStatus: 'PAID',
        totalAmount: totalAmount,
        orderedAt: now.toISOString(),
        acceptedAt: null,
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
     * 결제수단(PAYMENT)은 실제 모델에 없는 값이라 주문 id를 해시해 카드/간편결제/현금 비율(약 6:3:1)로
     * 안정적으로 나눈 목업 값이다 — 실제 연동 시 Order에 paymentMethod 필드가 추가되면 그대로 교체하면 된다.
     */
    getSalesBreakdown: function (storeId, dimension, range) {
      if (db.store.id !== storeId) {
        return withLatency({ message: '매장을 찾을 수 없습니다.' }, true);
      }
      var fromTime = new Date(range.from).getTime();
      var toTime = new Date(range.to).getTime();
      var ordersInRange = db.orders.filter(function (o) {
        if (o.status === 'CANCELED') return false;
        var t = new Date(o.orderedAt).getTime();
        return t >= fromTime && t <= toTime;
      });
      var totalAmount = ordersInRange.reduce(function (sum, o) {
        return sum + o.totalAmount;
      }, 0);
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
          .map(function (key) {
            return { label: key, amount: byDate[key] };
          });
      } else if (dimension === 'HOUR') {
        var byHour = {};
        ordersInRange.forEach(function (o) {
          var h = new Date(o.orderedAt).getHours();
          byHour[h] = (byHour[h] || 0) + o.totalAmount;
        });
        rows = Object.keys(byHour)
          .map(Number)
          .sort(function (a, b) {
            return a - b;
          })
          .map(function (h) {
            return { label: String(h).padStart(2, '0') + '시 ~ ' + String(h).padStart(2, '0') + '시 59분', amount: byHour[h] };
          });
      } else if (dimension === 'MENU') {
        var orderIdsInRange = {};
        ordersInRange.forEach(function (o) {
          orderIdsInRange[o.id] = true;
        });
        var byMenu = {};
        db.orderItems.forEach(function (it) {
          if (!orderIdsInRange[it.orderId]) return;
          if (!byMenu[it.menuName]) byMenu[it.menuName] = { amount: 0, qty: 0 };
          byMenu[it.menuName].amount += it.unitPrice * it.quantity;
          byMenu[it.menuName].qty += it.quantity;
        });
        rows = Object.keys(byMenu)
          .map(function (name) {
            return { label: name, amount: byMenu[name].amount, sub: byMenu[name].qty + '개 판매' };
          })
          .sort(function (a, b) {
            return b.amount - a.amount;
          });
      } else if (dimension === 'CHANNEL') {
        var byChannel = {};
        ordersInRange.forEach(function (o) {
          var label = o.channel === 'QR' ? 'QR오더' : '태블릿오더';
          byChannel[label] = (byChannel[label] || 0) + o.totalAmount;
        });
        rows = Object.keys(byChannel)
          .map(function (label) {
            return { label: label, amount: byChannel[label] };
          })
          .sort(function (a, b) {
            return b.amount - a.amount;
          });
      } else if (dimension === 'PAYMENT') {
        var byMethod = {};
        ordersInRange.forEach(function (o) {
          var hash = 0;
          for (var i = 0; i < o.id.length; i++) hash = (hash * 31 + o.id.charCodeAt(i)) >>> 0;
          var bucket = hash % 10;
          var method = bucket < 6 ? '카드' : bucket < 9 ? '간편결제' : '현금';
          byMethod[method] = (byMethod[method] || 0) + o.totalAmount;
        });
        rows = Object.keys(byMethod)
          .map(function (label) {
            return { label: label, amount: byMethod[label] };
          })
          .sort(function (a, b) {
            return b.amount - a.amount;
          });
      }

      return withLatency({ totalAmount: totalAmount, orderCount: ordersInRange.length, rows: rows });
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
