/*
 * 앱 전역 설정값 (외부로 나가는 링크 등)
 * 실제 서비스로 전환 시 값만 교체하면 되도록 이 파일에 모아둔다.
 */
window.AppConfig = {
  // TODO: 실제 아이디/비밀번호 찾기 페이지 URL이 정해지면 아래 값을 교체하세요. (현재는 임시 주소)
  FIND_ACCOUNT_URL: 'https://example.com/find-account',
  // TODO: 실제 QR오더 메뉴판 서비스 도메인이 정해지면 아래 값을 교체하세요. (현재는 임시 주소)
  // 최종 링크는 이 값 + '/' + storeId 형태로 만들어진다 (qrMenu.js 참고).
  QR_ORDER_BASE_URL: 'https://example.com/order',
};
