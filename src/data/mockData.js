/*
 * 목업 시드 데이터
 * 실제 백엔드 전환 시: 이 파일 전체를 삭제하고 src/api/mockApi.js 의 함수 시그니처를 유지한 채
 * fetch(real endpoint) 로 교체하면 된다. (엔드포인트 매핑은 src/api/mockApi.js 상단 주석 참고)
 *
 * 데이터 모델
 * - Event(행사): id, name, location, startDate, endDate, status(예정|진행중|종료)
 *                (행사 1개는 매장을 여러 개 포함하고, 매장은 정확히 1개의 행사에 소속된다 — Store.eventId 참고)
 * - Store: id, name, address, phone, operatingStatus(CLOSED|OPEN|PAUSED), businessHours,
 *          autoSoldoutOnZeroStock, autoAcceptOrders, waitTimeGuideEnabled, waitTimeMenuCountUnit,
 *          waitTimeMinutesPerUnit, waitTimeMaxMinutes, eventId, boothNumber,
 *          todaySalesAmount, todayOrderCount, totalSalesAmount, lastOrderAt, statusChangedAt
 *          (CLOSED=마감, OPEN=영업중, PAUSED=일시중지. 신규 주문 생성은 OPEN일 때만 허용된다.
 *           autoSoldoutOnZeroStock: 메뉴 재고가 0이 되면 자동으로 품절 처리할지 여부, 기본값 true.
 *           autoAcceptOrders: 신규 주문을 대기(WAITING) 없이 바로 접수(RECEIVED)로 자동 수락할지 여부,
 *           기본값 false(수동 수락).
 *           예상 대기시간은 더 이상 사장님이 직접 입력하는 고정값이 아니다 — 설정 > '예상
 *           대기시간 관리' 화면에서 "대기 메뉴 (N)개당 예상 시간 (M)분" 기준을 정해두면,
 *           현재 대기/접수 탭에 남아있는 미완료 주문의 메뉴 항목 총 수량을 기준으로 매번
 *           올림(총수량/N)×M 으로 자동 계산된다(mockApi.js getEstimatedWaitInfo 참고).
 *           waitTimeGuideEnabled: 꺼두면 고객 화면에 예상 대기시간 문구 자체를 노출하지 않는다.
 *           waitTimeMenuCountUnit(N)/waitTimeMinutesPerUnit(M): 위 계산식의 두 기준값(5단위로만
 *           조정). waitTimeMaxMinutes: 계산값이 이 값을 넘으면 이 값으로 고정해서 보여준다
 *           (예: 최대 30분으로 설정해두면 계산상 45분이 나와도 "약 30분 이내"로 안내).
 *           eventId: 이 매장(부스)이 소속된 행사. boothNumber: 부스 번호(선택, 없으면 null).
 *           todaySalesAmount/todayOrderCount/totalSalesAmount: 행사 담당자용 홈 대시보드/매장
 *           현황 화면에서 쓸 목업 집계값 — 실제로는 Order 데이터에서 계산되어야 하지만, 이번
 *           단계는 매장을 대량으로 시드하는 것이 목적이라 모든 매장에 실제 주문 데이터를 채우는
 *           대신 간단한 고정 집계값으로 대체했다(totalSalesAmount = 행사 시작 이후 누적 매출).
 *           store-1(브루웍스 성수점)만 예외적으로 실제 Order/MenuItem 데이터를 갖고 있다 — 기존
 *           사장님 앱 데모 계정(owner/1234)이 그대로 쓰는 매장이기 때문.
 *           lastOrderAt: 이 매장의 가장 최근 주문 시각(홈 대시보드의 "1시간 이상 신규 주문 없음"
 *           감지에 사용 — 실제로는 주문 테이블에서 매장별 최신 시각을 조회한 값이지만, 목업이라
 *           Store에 미리 계산해 둔 값으로 대체). statusChangedAt: operatingStatus가 마지막으로
 *           바뀐 시각(홈 대시보드의 "장시간 마감 유지" 감지 + 매장 현황 화면의 "상태 최종 변경
 *           시각" 표시에 사용 — updateStoreOperatingStatus/bulkUpdateStoreStatus 호출 시마다
 *           갱신된다). ownerName/ownerPhone: 이 매장을 담당하는 사장님 이름·연락처 — 실제로는
 *           User 테이블과 조인해서 가져올 값이지만, 부스 17개 전부에 별도 로그인 계정을 만드는
 *           것은 이번 단계 범위 밖이라 Store에 표시용 값만 넣어두었다(store-1만 실제 User와
 *           일치한다).)
 * - User: id, loginId, password, name, role(OWNER|STAFF|EVENT_MANAGER), storeIds[](OWNER/STAFF용),
 *         eventIds[](EVENT_MANAGER용 — 담당 행사 목록. 이 행사에 속한 모든 매장의 데이터에 접근 가능하다는
 *         뜻이며, 실제 접근 범위 제한은 화면/API 단에서 eventId -> storeIds로 풀어서 검사해야 한다.)
 *         STAFF 전용 필드: phone, isActive(비활성화된 직원은 로그인 불가 — mockApi.login에서 함께 검사),
 *         permissions{ orderManage, menuManage, salesView, settingsChange }(권한 토글, 화면에서
 *         사장님이 켜고 끔). OWNER는 이 필드가 없고 코드상 항상 모든 권한을 가진 것으로 취급하며
 *         직원 계정 관리 화면에서 오너 권한은 수정할 수 없다.
 * - MenuCategory: id, storeId, name, sortOrder, isHidden
 *                 (isHidden: 연결된 메뉴가 있어 진짜 삭제 대신 숨김 처리된 경우 true)
 * - MenuItem: id, categoryId, name, description, price, imageUrl, isSoldout, isVisible, isDeleted,
 *             sortOrder, optionGroups, stockQuantity, origin
 *             (isDeleted: 소프트 삭제 플래그. isVisible과 별개 — isVisible은 "지금 노출 여부"를
 *              사장님이 직접 켜고 끄는 값이고, isDeleted는 "삭제됨"을 나타내는 값이다.
 *              stockQuantity: null이면 재고 관리를 쓰지 않는(무제한) 메뉴, 숫자면 남은 재고 수량 —
 *              0이 되고 매장의 autoSoldoutOnZeroStock이 켜져 있으면 자동으로 isSoldout=true 처리.
 *              예상 조리시간은 메뉴별 필드가 아니다 — 매장 전체 공통 계산식(Store.waitTimeMenuCountUnit/
 *              waitTimeMinutesPerUnit) 참고. origin: 원산지 표기(선택, 빈 문자열 가능).
 *              optionGroups: [{ id, name, required, multiSelect,
 *                options: [{id,name,extraPrice,isSoldout}] }] — 옵션도 개별적으로 품절 처리 가능)
 * - Order: id, storeId, orderNo, pgOrderNo, channel(QR|TABLET), receiveType(TABLE_SERVICE|COUNTER_PICKUP),
 *          tableOrPickupNo, customerPhone, customerName, status(WAITING|RECEIVED|COMPLETED|CANCELED),
 *          paymentStatus(PAID), paymentMethod(카드|간편결제|현금), totalAmount, orderedAt, acceptedAt,
 *          completedAt, canceledAt, cancelReason, completedCount, callStatus(NOT_CALLED|CALLED|FAILED), calledAt
 *          (STEP 2 개편 기준: 상태 흐름은 WAITING(대기, 매장이 아직 확인/수락 전) ->
 *           RECEIVED(접수, 수락 후 완료 전까지 계속 머무르며 이 안에서 몇 번이든 고객 호출 가능) ->
 *           COMPLETED(완료). WAITING에서 RECEIVED를 건너뛰고 바로 COMPLETED로 처리하는 것도 허용된다.
 *           CANCELED는 COMPLETED 이후에도 가능(이미 CANCELED인 주문만 재취소 불가), cancelReason은
 *           품절|고객요청|오류|직접 입력한 문자열 중 하나.
 *           completedCount: 이 주문이 COMPLETED로 전이된 누적 횟수 — 완료 후 되돌리기(→RECEIVED)를
 *           했다가 다시 완료 처리하면 1씩 더 늘어난다(되돌리기 자체는 이 값을 줄이지 않는다).
 *           storeId: 이 주문이 속한 매장 — 매장이 여러 개가 된 이후 추가된 필드(행사 개편 참고).
 *           paymentMethod: 주문 카드 및 매출 조회(결제수단별)에서 함께 쓰는 실제 필드 — 예전에는
 *           결제수단이 모델에 없어서 매출 집계 때 주문 id를 해시해 흉내냈지만, 이제 진짜 필드가
 *           생겼으므로 매출 집계도 이 필드를 직접 집계하도록 함께 바꿨다(mockApi.js computeBreakdown 참고).
 *           orderType: PACKAGING(포장)|REUSABLE(다회용기)|EXPERIENCE(체험) — 주문 카드 헤더에 채널
 *           배지 옆 아웃라인 pill로 노출된다(UI.orderTypeBadgeHtml 참고).
 *           pgOrderNo는 실제로는 결제 시스템(PG) API 연동으로 채워질 값 — 지금은 목업 형식으로 생성.
 *           callStatus는 카카오 알림톡 발송 상태이며 주문 진행 상태(status)와는 별개 축이다.)
 * - OrderItem: id, orderId, menuItemId, menuName, unitPrice, quantity, optionsSummary
 *              (menuName/unitPrice 는 주문 시점 스냅샷 — 메뉴가 나중에 바뀌어도 과거 주문엔 영향 없음)
 * - NotificationLog: id, orderId, type(KAKAO_ALERT), status(SUCCESS|FAIL), sentAt, message
 * - AuditLog(감사 로그): id, actorUserId, actorRole, action, targetStoreIds[], beforeStatus,
 *          afterStatus, resultSummary, timestamp
 *          (행사 담당자가 매장 현황 화면에서 전체/선택 매장을 일괄 상태 변경할 때마다 하나의
 *           로그 항목이 쌓인다 — targetStoreIds가 여러 개일 수 있으므로(일괄 조치 한 번 = 로그
 *           한 건) beforeStatus는 매장마다 다를 수 있어 일괄 조치에서는 null로 둔다(afterStatus만
 *           의미 있음). action은 "행사담당자 OO님이 전체/선택한 N개 매장을 OO(으)로 변경" 형태의
 *           사람이 읽을 문장. resultSummary는 "성공 N개 · 이미 같은 상태 N개 · 실패 N개" 형태.
 *           개별 매장 하나만 바로 바꾸는 조작(매장 현황 리스트의 개별 버튼)은 즉시 반영되는 가벼운
 *           동작으로 취급해 로그를 남기지 않는다 — 감사 로그는 "일괄 조치" 전용이다.)
 */

(function () {
  function minutesAgo(mins) {
    return new Date(Date.now() - mins * 60 * 1000).toISOString();
  }

  function daysFromNow(days) {
    var d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // 목업 PG(결제 시스템) 주문번호 형식 — 실제로는 PG API 연동으로 채워질 값
  function pgOrderNo(seq) {
    var d = new Date();
    var ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'PG-' + ymd + '-' + String(seq).padStart(6, '0');
  }

  var EVENTS = [
    { id: 'event-1', name: '성수 푸드마켓 2026', location: '서울특별시 성동구 성수동 일대', startDate: daysFromNow(-2), endDate: daysFromNow(3), status: '진행중' },
    { id: 'event-2', name: '강남 브루어리 페스티벌 2026', location: '서울특별시 강남구 코엑스', startDate: daysFromNow(20), endDate: daysFromNow(23), status: '예정' },
  ];

  // store-1은 기존 사장님 데모 계정(owner/1234)이 그대로 쓰는 매장 — 실제 메뉴/주문 데이터를 갖고 있다.
  var STORE = {
    id: 'store-1',
    name: '브루웍스 성수점',
    address: '서울특별시 성동구 성수이로 100',
    phone: '02-1234-5678',
    operatingStatus: 'OPEN',
    businessHours: '09:00 - 21:00',
    autoSoldoutOnZeroStock: true,
    autoAcceptOrders: false,
    waitTimeGuideEnabled: true,
    waitTimeMenuCountUnit: 5,
    waitTimeMinutesPerUnit: 10,
    waitTimeMaxMinutes: 60,
    eventId: 'event-1',
    boothNumber: 'A-01',
    todaySalesAmount: 245000,
    todayOrderCount: 32,
    totalSalesAmount: 3200000,
    lastOrderAt: minutesAgo(2),
    statusChangedAt: minutesAgo(500),
    ownerName: '김사장',
    ownerPhone: '010-1234-5678',
  };

  // event-1(성수 푸드마켓, 진행중)에 속한 나머지 부스들 — 다양한 영업상태/매출값 테스트용.
  // 실제 메뉴/주문 데이터는 없고(이번 단계 범위 밖), 행사 담당자용 매장 현황 화면에서 쓸 집계값만 가진다.
  var EVENT1_BOOTH_NAMES = [
    '수제버거 트럭', '타코야끼 부스', '크래프트비어 하우스', '떡볶이 포차', '젤라또 카트',
    '스무디 바', '와플 부스', '핫도그 트럭', '전통차 부스', '오뎅바', '고로케 트럭',
  ];
  var STATUS_CYCLE = ['OPEN', 'OPEN', 'PAUSED', 'CLOSED'];
  var OWNER_SURNAMES = ['박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서'];

  var EVENT1_EXTRA_STORES = EVENT1_BOOTH_NAMES.map(function (name, idx) {
    var seq = idx + 2; // store-2 ~ store-12
    return {
      id: 'store-' + seq,
      name: name,
      address: '서울특별시 성동구 성수이로 ' + (100 + seq),
      phone: '02-1234-' + String(5700 + seq).padStart(4, '0'),
      operatingStatus: STATUS_CYCLE[idx % STATUS_CYCLE.length],
      businessHours: '11:00 - 20:00',
      autoSoldoutOnZeroStock: true,
      autoAcceptOrders: false,
      waitTimeGuideEnabled: true,
      waitTimeMenuCountUnit: 5,
      waitTimeMinutesPerUnit: 10,
      waitTimeMaxMinutes: 60,
      eventId: 'event-1',
      boothNumber: 'A-' + String(seq).padStart(2, '0'),
      todaySalesAmount: 60000 + idx * 41000,
      todayOrderCount: 6 + idx * 4,
      totalSalesAmount: 600000 + idx * 410000,
      lastOrderAt: minutesAgo(3 + idx * 4), // 기본은 최근에도 주문이 들어온 것으로 — 정상 매장들
      statusChangedAt: minutesAgo(120 + idx * 10), // CLOSED/PAUSED 매장은 이 값으로 "얼마나 오래" 그 상태였는지 판단
      ownerName: OWNER_SURNAMES[idx % OWNER_SURNAMES.length] + '사장',
      ownerPhone: '010-' + String(2000 + seq).padStart(4, '0') + '-' + String(3000 + seq).padStart(4, '0'),
    };
  });

  // 홈 대시보드 '주의가 필요한 매장' 감지 테스트 픽스처
  // - 조건 A(대기 주문 15분 이상 지연)는 아래 ORDERS에 store-3용 WAITING 주문을 25분 전으로 추가해서 만든다.
  // - 조건 B(영업중인데 1시간 이상 신규 주문 없음): store-4는 원래 사이클상 PAUSED지만, OPEN으로
  //   바꾸고 lastOrderAt을 95분 전으로 덮어써서 이 조건에 걸리도록 한다.
  // - 조건 C(행사 진행중인데 마감 상태 장시간 유지)는 위 STATUS_CYCLE에서 이미 CLOSED로 배정된
  //   매장들(store-5, store-9)의 statusChangedAt이 120분 이상 전이라 별도 오버라이드 없이도 걸린다.
  var storeForConditionB = EVENT1_EXTRA_STORES.find(function (s) { return s.id === 'store-4'; });
  storeForConditionB.operatingStatus = 'OPEN';
  storeForConditionB.lastOrderAt = minutesAgo(95);

  // event-2(강남 브루어리 페스티벌, 예정)에 속한 부스들 — 행사가 아직 시작 전이라 대부분 마감 상태.
  var EVENT2_BOOTH_NAMES = ['수제맥주 부스', '안주 트럭', '치즈볼 카트', '레모네이드 바', '피자 포차', '커피 트럭'];
  var EVENT2_STORES = EVENT2_BOOTH_NAMES.map(function (name, idx) {
    var seq = idx + 13; // store-13 ~ store-18
    return {
      id: 'store-' + seq,
      name: name,
      address: '서울특별시 강남구 영동대로 ' + (500 + seq),
      phone: '02-9876-' + String(1000 + seq).padStart(4, '0'),
      operatingStatus: idx === 0 ? 'OPEN' : 'CLOSED',
      businessHours: '12:00 - 21:00',
      autoSoldoutOnZeroStock: true,
      autoAcceptOrders: false,
      waitTimeGuideEnabled: true,
      waitTimeMenuCountUnit: 5,
      waitTimeMinutesPerUnit: 10,
      waitTimeMaxMinutes: 60,
      eventId: 'event-2',
      boothNumber: 'B-' + String(idx + 1).padStart(2, '0'),
      todaySalesAmount: 0,
      todayOrderCount: 0,
      totalSalesAmount: 0,
      lastOrderAt: null,
      statusChangedAt: null,
      ownerName: OWNER_SURNAMES[(idx + 5) % OWNER_SURNAMES.length] + '사장',
      ownerPhone: '010-' + String(4000 + seq).padStart(4, '0') + '-' + String(5000 + seq).padStart(4, '0'),
    };
  });

  var STORES = [STORE].concat(EVENT1_EXTRA_STORES, EVENT2_STORES); // 총 18개 매장(1 + 11 + 6)

  var USERS = [
    {
      id: 'user-owner-1',
      loginId: 'owner',
      password: '1234',
      name: '김사장',
      role: 'OWNER',
      storeIds: ['store-1'],
    },
    {
      id: 'user-staff-1',
      loginId: 'staff1',
      password: '1234',
      name: '이알바',
      phone: '010-2222-3333',
      role: 'STAFF',
      storeIds: ['store-1'],
      isActive: true,
      permissions: { orderManage: true, menuManage: false, salesView: false, settingsChange: false },
    },
    {
      id: 'user-staff-2',
      loginId: 'staff2',
      password: '1234',
      name: '최파트',
      phone: '010-4444-5555',
      role: 'STAFF',
      storeIds: ['store-1'],
      isActive: false,
      permissions: { orderManage: true, menuManage: true, salesView: false, settingsChange: false },
    },
    {
      id: 'user-event-manager-1',
      loginId: 'manager1',
      password: '1234',
      name: '이행사',
      role: 'EVENT_MANAGER',
      eventIds: ['event-1'], // 담당 행사 1개 -> 로그인 시 행사 선택 화면 없이 바로 진입
    },
    {
      id: 'user-event-manager-2',
      loginId: 'manager2',
      password: '1234',
      name: '박행사',
      role: 'EVENT_MANAGER',
      eventIds: ['event-1', 'event-2'], // 담당 행사 2개 -> 로그인 시 행사 선택 화면 노출
    },
  ];

  var MENU_CATEGORIES = [
    { id: 'cat-1', storeId: 'store-1', name: '커피', sortOrder: 1, isHidden: false },
    { id: 'cat-2', storeId: 'store-1', name: '논커피', sortOrder: 2, isHidden: false },
    { id: 'cat-3', storeId: 'store-1', name: '디저트', sortOrder: 3, isHidden: false },
  ];

  var MENU_ITEMS = [
    { id: 'menu-1', categoryId: 'cat-1', name: '아메리카노', description: '깔끔한 원두 본연의 맛', price: 4500, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 1, stockQuantity: null, origin: '콜롬비아산 원두', optionGroups: [
      { id: 'og-1', name: '온도 선택', required: true, multiSelect: false, options: [
        { id: 'opt-1', name: '아이스', extraPrice: 0, isSoldout: false },
        { id: 'opt-2', name: '따뜻하게', extraPrice: 0, isSoldout: false },
      ] },
      { id: 'og-2', name: '샷 추가', required: false, multiSelect: true, options: [
        { id: 'opt-3', name: '샷 1추가', extraPrice: 500, isSoldout: false },
        { id: 'opt-4', name: '샷 2추가', extraPrice: 900, isSoldout: true },
      ] },
    ] },
    { id: 'menu-2', categoryId: 'cat-1', name: '카페라떼', description: '부드러운 우유와 에스프레소', price: 5000, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 2, stockQuantity: null, origin: '국내산 우유', optionGroups: [] },
    { id: 'menu-3', categoryId: 'cat-1', name: '바닐라라떼', description: '달콤한 바닐라 시럽 추가', price: 5500, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 3, stockQuantity: 8, origin: '', optionGroups: [] },
    { id: 'menu-4', categoryId: 'cat-2', name: '자몽에이드', description: '상큼한 자몽 과육 가득', price: 5800, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 1, stockQuantity: 5, origin: '제주산 자몽', optionGroups: [] },
    { id: 'menu-5', categoryId: 'cat-2', name: '복숭아 아이스티', description: '달콤한 복숭아 향', price: 5300, imageUrl: '', isSoldout: true, isVisible: true, isDeleted: false, sortOrder: 2, stockQuantity: 0, origin: '', optionGroups: [] },
    { id: 'menu-6', categoryId: 'cat-3', name: '치즈케이크', description: '진한 크림치즈 풍미', price: 6500, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 1, stockQuantity: null, origin: '', optionGroups: [] },
    { id: 'menu-7', categoryId: 'cat-3', name: '크루아상', description: '겉바속촉 버터 크루아상', price: 4200, imageUrl: '', isSoldout: false, isVisible: true, isDeleted: false, sortOrder: 2, stockQuantity: 15, origin: '국내산 밀가루', optionGroups: [] },
  ];

  // 오늘자 더미 주문 (대시보드 요약 계산용) — 항상 "지금 기준 오늘"처럼 보이도록 상대 시간으로 생성
  // 전부 store-1(브루웍스 성수점) 소속 — 다른 매장들은 이번 단계 범위 밖이라 실제 주문 데이터가 없다.
  // order-2: 010으로 시작하지 않는 오입력 테스트용 번호 / order-5: 자릿수가 10자리인 오입력 테스트용 번호
  // (주문 화면에서 ⚠️ 오입력 가능성 있음 경고가 뜨는지 확인하는 용도)
  var ORDERS = [
    { id: 'order-1', storeId: 'store-1', orderNo: 1001, pgOrderNo: pgOrderNo(1001), channel: 'QR', receiveType: 'TABLE_SERVICE', orderType: 'PACKAGING', tableOrPickupNo: '5', customerPhone: '01011112222', customerName: '이지은', status: 'COMPLETED', paymentStatus: 'PAID', paymentMethod: '카드', totalAmount: 9500, orderedAt: minutesAgo(240), acceptedAt: minutesAgo(235), completedAt: minutesAgo(220), canceledAt: null, cancelReason: null, completedCount: 1, callStatus: 'CALLED', calledAt: minutesAgo(222) },
    { id: 'order-2', storeId: 'store-1', orderNo: 1002, pgOrderNo: pgOrderNo(1002), channel: 'TABLET', receiveType: 'COUNTER_PICKUP', orderType: 'REUSABLE', tableOrPickupNo: '12', customerPhone: '02198761234', customerName: '박준호', status: 'COMPLETED', paymentStatus: 'PAID', paymentMethod: '간편결제', totalAmount: 5000, orderedAt: minutesAgo(180), acceptedAt: minutesAgo(178), completedAt: minutesAgo(165), canceledAt: null, cancelReason: null, completedCount: 1, callStatus: 'FAILED', calledAt: null },
    { id: 'order-3', storeId: 'store-1', orderNo: 1003, pgOrderNo: pgOrderNo(1003), channel: 'QR', receiveType: 'TABLE_SERVICE', orderType: 'PACKAGING', tableOrPickupNo: '2', customerPhone: '01033334444', customerName: '최수아', status: 'CANCELED', paymentStatus: 'PAID', paymentMethod: '카드', totalAmount: 4500, orderedAt: minutesAgo(150), acceptedAt: null, completedAt: null, canceledAt: minutesAgo(147), cancelReason: '품절', completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
    { id: 'order-4', storeId: 'store-1', orderNo: 1004, pgOrderNo: pgOrderNo(1004), channel: 'QR', receiveType: 'TABLE_SERVICE', orderType: 'EXPERIENCE', tableOrPickupNo: '8', customerPhone: '01044445555', customerName: '정민재', status: 'RECEIVED', paymentStatus: 'PAID', paymentMethod: '현금', totalAmount: 11800, orderedAt: minutesAgo(40), acceptedAt: minutesAgo(35), completedAt: null, canceledAt: null, cancelReason: null, completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
    { id: 'order-5', storeId: 'store-1', orderNo: 1005, pgOrderNo: pgOrderNo(1005), channel: 'TABLET', receiveType: 'COUNTER_PICKUP', orderType: 'REUSABLE', tableOrPickupNo: '15', customerPhone: '0105556666', customerName: '한소희', status: 'WAITING', paymentStatus: 'PAID', paymentMethod: '카드', totalAmount: 5500, orderedAt: minutesAgo(15), acceptedAt: null, completedAt: null, canceledAt: null, cancelReason: null, completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
    { id: 'order-6', storeId: 'store-1', orderNo: 1006, pgOrderNo: pgOrderNo(1006), channel: 'QR', receiveType: 'TABLE_SERVICE', orderType: 'PACKAGING', tableOrPickupNo: '3', customerPhone: '01066667777', customerName: null, status: 'WAITING', paymentStatus: 'PAID', paymentMethod: '간편결제', totalAmount: 8700, orderedAt: minutesAgo(2), acceptedAt: null, completedAt: null, canceledAt: null, cancelReason: null, completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
    // 홈 대시보드 '주의가 필요한 매장' 조건 A(대기 주문 15분 이상 지연) 테스트 픽스처 — store-3(타코야끼 부스) 소속
    { id: 'order-att-1', storeId: 'store-3', orderNo: 9001, pgOrderNo: pgOrderNo(9001), channel: 'QR', receiveType: 'COUNTER_PICKUP', orderType: 'EXPERIENCE', tableOrPickupNo: '1', customerPhone: '01099998888', customerName: null, status: 'WAITING', paymentStatus: 'PAID', paymentMethod: '카드', totalAmount: 8000, orderedAt: minutesAgo(25), acceptedAt: null, completedAt: null, canceledAt: null, cancelReason: null, completedCount: 0, callStatus: 'NOT_CALLED', calledAt: null },
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

  var AUDIT_LOGS = []; // 행사 담당자의 매장 일괄 조치 이력 — 다음 단계에서 실제로 쌓일 예정 (구조는 상단 주석 참고)

  window.MockData = {
    EVENTS: EVENTS,
    STORES: STORES,
    USERS: USERS,
    MENU_CATEGORIES: MENU_CATEGORIES,
    MENU_ITEMS: MENU_ITEMS,
    ORDERS: ORDERS,
    ORDER_ITEMS: ORDER_ITEMS,
    NOTIFICATION_LOGS: NOTIFICATION_LOGS,
    NEXT_ORDER_NO: NEXT_ORDER_NO,
    AUDIT_LOGS: AUDIT_LOGS,
  };
})();
