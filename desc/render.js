/* 기획 주석 보드 — 공용 렌더 함수. screens.js / details.js 를 병합해 카드 HTML을 만든다.
 * 내용만 고칠 때는 details.js 만 수정하면 되고, 이미지/핀 좌표는 그대로 둔다. */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function listHtml(items) {
    if (!items || items.length === 0) return '<div class="empty">해당 없음</div>';
    return '<ul>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }

  function memoKey(screenKey, n) {
    return 'desc-memo:' + screenKey + ':' + n;
  }

  function pinCardHtml(screenKey, pin, detail) {
    detail = detail || { purpose: [], behavior: [], exception: [] };
    var mk = memoKey(screenKey, pin.n);
    return (
      '<div class="pin-card">' +
        '<div class="pin-card-head"><span class="pin-num">' + pin.n + '</span><span class="pin-title">' + esc(pin.title) + '</span></div>' +
        '<div class="pin-cat purpose"><span class="pin-cat-label"><span class="dot"></span>기능·목적</span>' + listHtml(detail.purpose) + '</div>' +
        '<div class="pin-cat behavior"><span class="pin-cat-label"><span class="dot"></span>동작·상태값</span>' + listHtml(detail.behavior) + '</div>' +
        '<div class="pin-cat exception"><span class="pin-cat-label"><span class="dot"></span>예외처리·UX문구</span>' + listHtml(detail.exception) + '</div>' +
        '<div class="memo-label">내 메모 (이 브라우저에 자동 저장)</div>' +
        '<div class="memo-box" contenteditable="true" data-memo-key="' + mk + '" data-placeholder="여기에 메모를 입력하세요"></div>' +
      '</div>'
    );
  }

  function screenBlockHtml(screen, imgPathPrefix) {
    var details = (window.DETAILS && window.DETAILS[screen.key]) || {};
    var cards = screen.pins.map(function (p) { return pinCardHtml(screen.key, p, details[String(p.n)]); }).join('');
    var imgSrc = (imgPathPrefix || '') + 'img/' + screen.key + '_pin.png';
    return (
      '<div class="screen-block" id="screen-' + screen.key + '">' +
        '<div class="screen-block-head">' +
          '<span class="ord">' + String(screen.ord).padStart(2, '0') + '</span>' +
          '<h2>' + esc(screen.name) + '</h2>' +
          '<span class="group">' + esc(screen.group) + '</span>' +
        '</div>' +
        '<div class="screen-body">' +
          '<div class="screen-img-col"><img src="' + imgSrc + '" alt="' + esc(screen.name) + '" /></div>' +
          '<div class="screen-cards-col">' + cards + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function restoreMemos(root) {
    (root || document).querySelectorAll('.memo-box').forEach(function (el) {
      var key = el.getAttribute('data-memo-key');
      var saved = localStorage.getItem(key);
      if (saved) el.textContent = saved;
      el.addEventListener('input', function () {
        localStorage.setItem(key, el.textContent);
      });
    });
  }

  window.DescBoard = {
    screenBlockHtml: screenBlockHtml,
    restoreMemos: restoreMemos,
  };
})();
