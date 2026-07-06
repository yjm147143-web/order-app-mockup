/*
 * QR 메뉴판 보기 — 설정 > 'QR 메뉴판 보기'에서 진입. 뒤로가기는 설정 화면으로 돌아간다.
 * 실제 이전 시: features/settings/screens/QrMenuScreen.tsx
 *
 * 이 매장의 QR오더 메뉴판 링크(AppConfig.QR_ORDER_BASE_URL + '/' + storeId)를 보여주고,
 * 그 링크를 인코딩한 QR코드 이미지를 표시한다. QR코드 자체는 별도 라이브러리 없이(이 프로젝트는
 * Node/npm 빌드 도구 없이 순수 정적 파일로 동작한다) 공개 QR 생성 API(api.qrserver.com) 이미지를
 * 그대로 <img>로 띄우는 방식을 쓴다 — 실제 서비스 전환 시에는 서버에서 QR 이미지를 직접
 * 생성하거나 정식 QR 라이브러리로 교체하는 것을 권장한다.
 */
(function () {
  var currentUnmount = null;

  function qrImageUrl(data) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(data);
  }

  function render() {
    return (
      '<div class="screen">' +
        UI.topBar({ title: 'QR 메뉴판 보기', leftIcon: UI.Icons.back, leftAction: 'go-back' }) +
        '<div class="screen-scroll" style="padding: 8px 20px 24px;">' +
          '<div class="card" style="margin-bottom:16px;">' +
            '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:8px;">메뉴판 링크</div>' +
            '<div class="qr-link-row">' +
              '<input class="input-field" id="qr-link-input" readonly />' +
              UI.button({ label: '복사', action: 'copy-link', variant: 'outline' }) +
            '</div>' +
          '</div>' +
          '<div class="card" style="text-align:center;">' +
            '<div id="qr-image-host" class="qr-image-host"></div>' +
            '<div style="margin-top:16px;">' + UI.button({ label: 'QR코드 다운로드', action: 'download-qr', variant: 'primary' }) + '</div>' +
            '<div class="helper-text" style="margin-top:8px;">이 QR코드를 인쇄해 테이블/포스터에 붙여두면 고객이 스캔해 메뉴판으로 바로 접속할 수 있어요.</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    var storeId = AppState.get().currentStoreId;
    var link = AppConfig.QR_ORDER_BASE_URL + '/' + storeId;
    var imgUrl = qrImageUrl(link);

    root.querySelector('[data-action="go-back"]').addEventListener('click', function () {
      Router.showScreen('settings');
    });

    root.querySelector('#qr-link-input').value = link;
    root.querySelector('#qr-image-host').innerHTML = '<img src="' + UI.escapeHtml(imgUrl) + '" alt="메뉴판 QR코드" class="qr-image" />';

    root.querySelector('[data-action="copy-link"]').addEventListener('click', function () {
      var input = root.querySelector('#qr-link-input');
      input.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(
          function () { UI.showToast('링크를 복사했어요'); },
          function () { UI.showToast('복사에 실패했어요'); }
        );
      } else {
        try {
          document.execCommand('copy');
          UI.showToast('링크를 복사했어요');
        } catch (e) {
          UI.showToast('복사에 실패했어요');
        }
      }
    });

    root.querySelector('[data-action="download-qr"]').addEventListener('click', function () {
      fetch(imgUrl)
        .then(function (res) { return res.blob(); })
        .then(function (blob) {
          var objectUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = objectUrl;
          a.download = 'menu-qr-' + storeId + '.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objectUrl);
          UI.showToast('QR코드 이미지를 다운로드했어요');
        })
        .catch(function () {
          window.open(imgUrl, '_blank');
          UI.showToast('새 탭에서 열었어요 · 이미지를 길게 눌러 저장해주세요');
        });
    });

    currentUnmount = function () {};
  }

  function unmount() {
    if (currentUnmount) currentUnmount();
    currentUnmount = null;
  }

  window.Screens = window.Screens || {};
  window.Screens.qrMenu = { render: render, mount: mount, unmount: unmount };
})();
