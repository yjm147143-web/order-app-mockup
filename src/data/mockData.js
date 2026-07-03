/*
 * 목업 시드 데이터
 * 실제 백엔드 전환 시: 이 파일 전체를 삭제하고 src/api/mockApi.js 의 함수 시그니처를 유지한 채
 * fetch(real endpoint) 로 교체하면 된다. (엔드포인트 매핑은 src/api/mockApi.js 상단 주석 참고)
 *
 * 데이터 모델
 * - Store: id, name, address, phone, operatingStatus(CLOSED|OPEN|PAUSED), businessHours,
 *          autoSoldoutOnZeroStock, estimatedWaitMinutes
 *          (CLOSED=마감, OPEN=영업중, PAUSED=일시중지. 신규 주문 생성은 OPEN일 때만 허용된다.
 *           autoSoldoutOnZeroStock: 메뉴 재고가 0이 되면 자동으로 품절 처리할지 여부, 기본값 true.
 *           estimatedWaitMinutes: 메뉴판 전체 기준 예상 대기시간(분). 메뉴 개별 조리시간 대신
 *           사장님이 5분 단위로 직접 조정하는 매장 전체 값 — "현재 예상 대기 시간은 약 OO분
 *           이내입니다." 문구에 그대로 사용된다.)
 * - User: id, loginId, password, name, role(OWNER|STAFF), storeIds[]
 * - MenuCategory: id, storeId, name, sortOrder, isHidden
 *                 (isHidden: 연결된 메뉴가 있어 진짜 삭제 대신 숨김 처리된 경우 true)
 * - MenuItem: id, categoryId, name, description, price, imageUrl, isSoldout, isVisible, isDeleted,
 *             sortOrder, optionGroups, stockQuantity
 *             (isDeleted: 소프트 삭제 플래그. isVisible과 별개 — isVisible은 "지금 노출 여부"를
 *              사장님이 직접 켜고 끄는 값이고, isDeleted는 "삭제됨"을 나타내는 값이다.
 *              stockQuantity: null이면 재고 관리를 쓰지 않는(무제한) 메뉴, 숫자면 남은 재고 수량 —
 *              0이 되고 매장의 autoSoldoutOnZeroStock이 켜져 있으면 자동으로 isSoldout=true 처리.
 *              예상 조리시간은 더 이상 메뉴별 필드가 아니다 — Store.estimatedWaitMinutes(매장 전체
 *              공통 값) 참고.
 *              optionGroups: [{ id, name, required, multiSelect,
 *                options: [{id,name,extraPrice,isSoldout}] }] — 옵션도 개별적으로 품절 처리 가능)
 * - Order: id, orderNo, pgOrderNo, channel(QR|TABLET), receiveType(TABLE_SERVICE|COUNTER_PICKUP),
 *          tableOrPickupNo, customerPhone, customerName, status(WAITING|RECEIVED|COMPLETED|CANCELED),
 *          paymentStatus(PAID), totalAmount, orderedAt, acceptedAt, completedAt, canceledAt, cancelReason,
 *          completedCount, callStatus(NOT_CALLED|CALLED|FAILED), calledAt
 *          (STEP 2 개편 기준: 상태 흐름은 WAITING(대기, 매장이 아직 확인/수락 전) ->
 *           RECEIVED(접수, 수락 후 완료 전까지 계속 머무르며 이 안에서 몇 번이든 고객 호출 가능) ->
 *           COMPLETED(완료). WAITING에서 RECEIVED를 건너뛰고 바로 COMPLETED로 처리하는 것도 허용된다.
 *           CANCELED는 COMPLETED 이후에도 가능(이미 CANCELED인 주문만 재취소 불가), cancelReason은
 *           품절|고객요청|오류|직접 입력한 문자열 중 하나.
 *           completedCount: 이 주문이 COMPLETED로 전이된 누적 횟수 — 완료 후 되돌리기(→RECEIVED)를
 *           했다가 다시 완료 처리하면 1씩 더 늘어난다(되돌리기 자체는 이 값을 줄이지 않는다).
 *           pgOrderNo는 실제로는 결제 시스템(PG) API 연동으로 채워질 값 — 지금은 목업 형식으로 생성.
 *           callStatus는 카카오 알림톡 발송 상태이며 주문 진행 상태(status)와는 별개 축이다.)
 * - OrderItem: id, orderId, menuItemId, menuName, unitPrice, quantity, optionsSummary
 *              (menuName/unitPrice 는 주문 시점 스냅샷 — 메뉴가 나중에 바뀌어도 과거 주문엔 영향 없음)
 * - NotificationLog: id, orderId, type(KAKAO_ALERT), status(SUCCESS|FAIL), sentAt, message
 */

(function () {
  function minutesAgo(mins) {
    return new Date(Date.now() - mins * 60 * 1000).toISOString();
  }

  // 목업 PG(결제 시스템) 주문번호 형식 — 실제로는 PG API 연동으로 채워질 값
  function pgOrderNo(seq) {
    var d = new Date();
    var ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'PG-' + ymd + '-' + String(seq).padStart(6, '0');
  }

  var STORE = {
    id: 'store-1',
    name: '브루웍스 성수점',
    address: '서울특별시 성동구 성수이로 100',
    phone: '02-1234-5678',
    operatingStatus: 'OPEN',
    businessHours: '09:00 - 21:00',
    autoSoldoutOnZeroStock: true,
    estimatedWaitMinutes: 15,
  };

  var USERS = [
    {
      id: 'user-owner-1',
      loginId: 'owner',
      password: '1234',
      name: '김사장',
      role: 'OWNER',
      storeIds: ['store-1'],
    },
  ];

  var MENU_CATEGORIES = [
    { id: 'cat-1', storeId: 'store-1', name: '커피', sortOrder: 1, isHidden: false },
    { id: 'cat-2', storeId: 'store-1', name: '논커피', sortOrder: 2, isHidden: false },
    { id: 'cat-3', storeId: 'store-1', name: '디저트', sortOrder: 3, isHidden: false },
  ];

  var MENU_ITEMS = [
    { id: 'menu-1', categoryId: 'cat-1', name: '아메리카노', description: '깔끔한 원두 본연의 맛', price: 4500, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 1, stockQuantity: null, optionGroups: [
      { id: 'og-1', name: '온도 선택', required: true, multiSelect: false, options: [
        { id: 'opt-1', name: '아이스', extraPrice: 0, isSoldout: false },
        { id: 'opt-2', name: '따뜻하게', extraPrice: 0, isSoldout: false },
      ] },
      { id: 'og-2', name: '샷 추가', required: false, multiSelect: true, options: [
        { id: 'opt-3', name: '샷 1추가', extraPrice: 500, isSoldout: false },
        { id: 'opt-4', name: '샷 2추가', extraPrice: 900, isSoldout: true },
      ] },
    ] },
    { id: 'menu-2', categoryId: 'cat-1', name: '카페라떼', description: '부드러운 우유와 에스프레소', price: 5000, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 2, stockQuantity: null, optionGroups: [] },
    { id: 'menu-3', categoryId: 'cat-1', name: '바닐라라떼', description: '달콤한 바닐라 시럽 추가', price: 5500, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 3, stockQuantity: 8, optionGroups: [] },
    { id: 'menu-4', categoryId: 'cat-2', name: '자몽에이드', description: '상큼한 자몽 과육 가득', price: 5800, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 1, stockQuantity: 5, optionGroups: [] },
    { id: 'menu-5', categoryId: 'cat-2', name: '복숭아 아이스티', description: '달콤한 복숭아 향', price: 5300, imageUrl: '', isSoldout: true, isVisible: true, isDeleted: false, sortOrder: 2, stockQuantity: 0, optionGroups: [] },
    { id: 'menu-6', categoryId: 'cat-3', name: '치즈케이크', description: '진한 크림치즈 풍미', price: 6500, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 1, stockQuantity: null, optionGroups: [] },
    { id: 'menu-7', categoryId: 'cat-3', name: '크루아상', description: '겉바속촉 버터 크루아상', price: 4200, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 2, stockQuantity: 15, optionGroups: [] },
  ];

  // 오늘자 더미 주문 (대시보드 요약 계산용) — 항상 "지금 기준 오늘"처럼 보이도록 상대 시간으로 생성
  // order-2: 010으로 시작하지 않는 오입력 테스트용 번호 / order-5: 자릿수가 10자리인 오입력 테스트용 번호
  // (주문 화면에서 ⚠️ 오입력 가능성 있음 경고가 뜨는지 확인하는 용도)
  var ORDERS = [
    { id: 'order-1', orderNo: 1001, pgOrderNo: pgOrderNo(1001), channel: 'QR', receiveType: 'TABLE_SERVICE', tableOrPickupNo: '5', customerPhone: '01011112222', customerName: '이지은', status: 'COMPLETED', paymentStatus: 'PAID', totalAmount: 9500, orderedAt: minutesAgo(240), acceptedAt: minutesAgo(235), completedAt: minutesAgo(220), canceledAt: null, cancelReason: null, completedCount: 1, callStatus: 'CALLED', calledAt: minutesAgo(222) },
    { id: 'order-2', orderNo: 1002, pgOrderNo: pgOrderNo(1002), channel: 'TABLET', receiveType: 'COUNTER_PICKUP', tableOrPickupNo: '12', customerPhone: '02198761234', customerName: '박준호', status: 'COMPLETED', paymentStatus: 'PAID', totalAmount: 5000, orderedAt: minutesAgo(180), acceptedAt: minutesAgo(178), completedAt: minutesAgo(165), canceledAt: null, cancelReason: null, completedCount: 1, callStatus: 'FAILED', calledAt: null },
    { id: 'order-3', orderNo: 1003, pgOrderNo: pgOrderNo(1003), channel: 'QR', receiveType: 'TABLE_SERVICE', tableOrPickupNo: '2', customerPhone: '01033334444', customerName: '최수아', status: 'CANCELED', paymentStatus: 'PAID', totalAmount: 4500, orderedAt: minutesAgo(150), acceptedAt: null, completedAt: null, canceledAt: minutesAgo(147), cancelReason: '품절', completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
    { id: 'order-4', orderNo: 1004, pgOrderNo: pgOrderNo(1004), channel: 'QR', receiveType: 'TABLE_SERVICE', tableOrPickupNo: '8', customerPhone: '01044445555', customerName: '정민재', status: 'RECEIVED', paymentStatus: 'PAID', totalAmount: 11800, orderedAt: minutesAgo(40), acceptedAt: minutesAgo(35), completedAt: null, canceledAt: null, cancelReason: null, completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
    { id: 'order-5', orderNo: 1005, pgOrderNo: pgOrderNo(1005), channel: 'TABLET', receiveType: 'COUNTER_PICKUP', tableOrPickupNo: '15', customerPhone: '0105556666', customerName: '한소희', status: 'WAITING', paymentStatus: 'PAID', totalAmount: 5500, orderedAt: minutesAgo(15), acceptedAt: null, completedAt: null, canceledAt: null, cancelReason: null, completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
    { id: 'order-6', orderNo: 1006, pgOrderNo: pgOrderNo(1006), channel: 'QR', receiveType: 'TABLE_SERVICE', tableOrPickupNo: '3', customerPhone: '01066667777', customerName: null, status: 'WAITING', paymentStatus: 'PAID', totalAmount: 8700, orderedAt: minutesAgo(2), acceptedAt: null, completedAt: null, canceledAt: null, cancelReason: null, completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
  ];

  var NEXT_ORDER_NO = 1007;

  var ORDER_ITEMS = [
    { id: 'oi-1', orderId: 'order-1', menuItemId: 'menu-2', menuName: '카페라떼', unitPrice: 5000, quantity: 1, optionsSummary: '' },
    { id: 'oi-2', orderId: 'order-1', menuItemId: 'menu-7', menuName: '크루아상', unitPrice: 4200, quantity: 1, optionsSummary: '' },
    { id: 'oi-3', orderId: 'order-2', menuItemId: 'menu-2', menuName: '카페라떼', unitPrice: 5000, quantity: 1, optionsSummary: '' },
    { id: 'oi-4', orderId: 'order-3', menuItemId: 'menu-1', menuName: '아메리카노', unitPrice: 4500, quantity: 1, optionsSummary: '' },
    { id: 'oi-5', orderId: 'order-4', menuItemId: 'menu-6', menuName: '치즈케이크', unitPrice: 6500, quantity: 1, optionsSummary: '' },
    { id: 'oi-6', orderId: 'order-4', menuItemId: 'menu-1', menuName: '아메리카노', unitPrice: 4500, quantity: 1, optionsSummary: '샷 추가' },
    { id: 'oi-7', orderId: 'order-5', menuItemId: 'menu-3', menuName: '바닐라라떼', unitPrice: 5500, quantity: 1, optionsSummary: '' },
    { id: 'oi-8', orderId: 'order-6', menuItemId: 'menu-4', menuName: '자몽에이드', unitPrice: 5800, quantity: 1, optionsSummary: '얼음 적게' },
    { id: 'oi-9', orderId: 'order-6', menuItemId: 'menu-1', menuName: '아메리카노', unitPrice: 4500, quantity: 1, optionsSummary: '' },
    { id: 'oi-10', orderId: 'order-6', menuItemId: 'menu-7', menuName: '크루아상', unitPrice: 4200, quantity: 1, optionsSummary: '' },
  ];

  var NOTIFICATION_LOGS = [
    { id: 'log-1', orderId: 'order-1', type: 'KAKAO_ALERT', status: 'SUCCESS', sentAt: minutesAgo(222), message: '[브루웍스 성수점] 이지은님, 주문하신 메뉴가 준비되었습니다.' },
    { id: 'log-2', orderId: 'order-2', type: 'KAKAO_ALERT', status: 'FAIL', sentAt: minutesAgo(168), message: '[브루웍스 성수점] 박준호님, 주문하신 메뉴가 준비되었습니다.' },
  ];

  window.MockData = {
    STORE: STORE,
    USERS: USERS,
    MENU_CATEGORIES: MENU_CATEGORIES,
    MENU_ITEMS: MENU_ITEMS,
    ORDERS: ORDERS,
    ORDER_ITEMS: ORDER_ITEMS,
    NOTIFICATION_LOGS: NOTIFICATION_LOGS,
    NEXT_ORDER_NO: NEXT_ORDER_NO,
  };
})();
