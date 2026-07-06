/*
 * 공용 UI 렌더 헬퍼 (디자인 시스템 컴포넌트)
 * Button / Card / Badge / Toggle / Toast 를 문자열 템플릿으로 제공.
 * 실제 RN 이전 시: 함수 하나 = components/*.tsx 컴포넌트 하나로 1:1 매핑.
 * (하단 탭바는 화면이 '주문' 하나만 남으며 제거됨 — TabBar 컴포넌트도 함께 삭제)
 */

(function () {
  var Icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
    customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.8.3 5 2.4 5 5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.2.6.7 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM18 18h3v3h-3z"/></svg>',
    tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M10 18h4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1-5h14l1 5"/><path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M5 9v10h14V9"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatWon(amount) {
    return amount.toLocaleString('ko-KR') + '원';
  }

  function timeAgoLabel(isoString) {
    var diffMin = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return diffMin + '분 전';
    var diffHour = Math.floor(diffMin / 60);
    return diffHour + '시간 전';
  }

  function button(opts) {
    var variant = opts.variant || 'primary'; // primary | secondary | outline | text | danger-text | success | warning | danger-solid
    var disabled = opts.disabled ? 'disabled' : '';
    var cls = {
      primary: 'btn btn-primary',
      secondary: 'btn btn-secondary',
      outline: 'btn btn-outline',
      text: 'btn btn-text',
      'danger-text': 'btn btn-danger-text',
      success: 'btn btn-success',
      warning: 'btn btn-warning',
      'danger-solid': 'btn btn-danger-solid',
    }[variant];
    return (
      '<button class="' + cls + '" ' + disabled + ' data-action="' + escapeHtml(opts.action || '') + '">' +
      escapeHtml(opts.label) +
      '</button>'
    );
  }

  function badge(label, variant) {
    var cls = {
      neutral: 'badge badge-neutral',
      dark: 'badge badge-dark',
      danger: 'badge badge-danger',
      'danger-soft': 'badge badge-danger-soft',
    }[variant || 'neutral'];
    return '<span class="' + cls + '">' + escapeHtml(label) + '</span>';
  }

  function toggle(isOn, action, extraAttrs) {
    return (
      '<button class="toggle ' + (isOn ? 'on' : '') + '" data-action="' + escapeHtml(action) + '" ' + (extraAttrs || '') +
      ' role="switch" aria-checked="' + isOn + '">' +
      '<span class="toggle-knob"></span>' +
      '</button>'
    );
  }

  function topBar(opts) {
    // opts: { title, leftIcon, leftAction, rightIcon, rightAction }
    var left = opts.leftIcon
      ? '<button class="icon-btn" data-action="' + escapeHtml(opts.leftAction) + '">' + opts.leftIcon + '</button>'
      : '<span style="width:44px"></span>';
    var right = opts.rightIcon
      ? '<button class="icon-btn" data-action="' + escapeHtml(opts.rightAction) + '">' + opts.rightIcon + '</button>'
      : '<span style="width:44px"></span>';
    return (
      '<div class="topbar">' + left + '<span class="topbar-title">' + escapeHtml(opts.title) + '</span>' + right + '</div>'
    );
  }

  var toastTimer = null;
  function showToast(message, opts) {
    opts = opts || {};
    var host = document.getElementById('toast-host');
    if (!host) return;
    var actionHtml = opts.actionLabel
      ? '<button class="toast-action" data-action="toast-action">' + escapeHtml(opts.actionLabel) + '</button>'
      : '';
    host.innerHTML =
      '<div class="toast ' + (actionHtml ? 'toast-with-action' : '') + '" id="toast-el"><span>' + escapeHtml(message) + '</span>' + actionHtml + '</div>';
    // 화면 하단에 고정 CTA 버튼(.cta-fixed)이 떠 있으면 그 위로 올라오게 오프셋을 준다(겹침 방지).
    var ctaFixed = document.querySelector('.cta-fixed');
    host.style.bottom = ctaFixed ? ctaFixed.getBoundingClientRect().height + 12 + 'px' : '24px';
    var el = document.getElementById('toast-el');
    requestAnimationFrame(function () {
      el.classList.add('show');
    });
    if (opts.onAction) {
      el.querySelector('[data-action="toast-action"]').addEventListener('click', function () {
        opts.onAction();
        hideToastNow();
      });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToastNow, opts.duration || 2200);
  }

  function hideToastNow() {
    var host = document.getElementById('toast-host');
    var el = document.getElementById('toast-el');
    if (!el) return;
    el.classList.remove('show');
    clearTimeout(toastTimer);
    setTimeout(function () {
      if (host) host.innerHTML = '';
    }, 200);
  }

  var bannerTimer = null;
  function showBanner(message, onClick) {
    var host = document.getElementById('banner-host');
    if (!host) return;
    host.innerHTML = '<div class="new-order-banner" id="banner-el">' +
      '<span class="new-order-banner-dot"></span>' +
      '<span>' + escapeHtml(message) + '</span>' +
      '</div>';
    var el = document.getElementById('banner-el');
    requestAnimationFrame(function () {
      el.classList.add('show');
    });
    if (onClick) {
      el.addEventListener('click', function () {
        onClick();
        hideBanner();
      });
    }
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, 3500);
  }

  function hideBanner() {
    var el = document.getElementById('banner-el');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(function () {
      var host = document.getElementById('banner-host');
      if (host) host.innerHTML = '';
    }, 200);
  }

  function segmentTabs(tabs, activeKey) {
    // tabs: [{key,label,count}]
    return (
      '<div class="segment-tabs">' +
      tabs
        .map(function (t) {
          return (
            '<button class="segment-tab ' + (t.key === activeKey ? 'active' : '') + '" data-action="segment-tab" data-key="' + t.key + '">' +
            '<span>' + escapeHtml(t.label) + '</span>' +
            '<span class="count">' + t.count + '</span>' +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  /*
   * 차트: 별도 라이브러리 없이 순수 SVG 문자열로 직접 그린다(이 프로젝트에 이미 Icons도 같은
   * 방식으로 하드코딩되어 있어 톤이 일관됨 — 브라우저 목업이라 npm 설치가 불가능했던 것과 별개로,
   * 이 정도 단순한 차트는 의존성 없이 충분히 구현 가능하다는 판단). 색상은 그레이스케일 위주,
   * 강조가 필요한 지점(최댓값 막대)에만 앱의 포인트 컬러인 블랙을 사용한다.
   * 사장님 앱 '매출 조회'(sales.js)와 행사 담당자 '매출현황 및 분석'(eventManagerSales.js)이
   * 이 헬퍼들을 공유한다 — 두 화면의 차트가 완전히 같은 코드로 그려진다는 뜻.
   * 실제 React Native 전환 시에는 react-native-svg + victory-native(또는 react-native-chart-kit)
   * 조합으로 옮기는 것을 권장한다 — 아래 barChartSvg/donutChartSvg의 입력 데이터 형태(rows: [{label,amount}])는
   * 그대로 각 라이브러리의 데이터 prop으로 넘기면 된다.
   */
  var DONUT_COLORS = ['#111111', '#666666', '#a0a0a0', '#cfcfcf', '#e5e5e5'];

  function barChartSvg(rows, shortLabelFn) {
    var w = 320, h = 170, padBottom = 24, padTop = 8;
    var maxAmount = rows.reduce(function (mx, r) { return Math.max(mx, r.amount); }, 0);
    var barGap = 6;
    var barWidth = rows.length ? (w - barGap * (rows.length + 1)) / rows.length : 0;
    var bars = rows
      .map(function (r, i) {
        var barH = maxAmount > 0 ? ((r.amount / maxAmount) * (h - padBottom - padTop)) : 0;
        var x = barGap + i * (barWidth + barGap);
        var y = h - padBottom - barH;
        var isMax = r.amount === maxAmount && maxAmount > 0;
        return (
          '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barWidth.toFixed(1) + '" height="' + Math.max(barH, 1).toFixed(1) + '" rx="3" fill="' + (isMax ? 'var(--color-text-primary)' : 'var(--color-disabled)') + '" />' +
          '<text x="' + (x + barWidth / 2).toFixed(1) + '" y="' + (h - 8) + '" font-size="9" text-anchor="middle" fill="var(--color-text-secondary)">' + escapeHtml(shortLabelFn(r, i)) + '</text>'
        );
      })
      .join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '">' + bars + '</svg>';
  }

  function donutChartSvg(rows, totalAmount) {
    var size = 160, radius = 54, stroke = 22, cx = size / 2, cy = size / 2;
    var circumference = 2 * Math.PI * radius;
    var offset = 0;
    if (totalAmount <= 0) {
      return (
        '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="var(--color-disabled)" stroke-width="' + stroke + '" /></svg>'
      );
    }
    var segments = rows
      .map(function (r, i) {
        var frac = r.amount / totalAmount;
        var dash = frac * circumference;
        var seg =
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + DONUT_COLORS[i % DONUT_COLORS.length] + '" stroke-width="' + stroke + '" ' +
          'stroke-dasharray="' + dash.toFixed(1) + ' ' + (circumference - dash).toFixed(1) + '" stroke-dashoffset="' + (-offset).toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" />';
        offset += dash;
        return seg;
      })
      .join('');
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' + segments + '</svg>';
  }

  function donutLegendHtml(rows, totalAmount) {
    return (
      '<div class="donut-legend">' +
      rows
        .map(function (r, i) {
          var pct = totalAmount > 0 ? Math.round((r.amount / totalAmount) * 100) : 0;
          return (
            '<div class="donut-legend-item">' +
              '<span class="donut-legend-dot" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></span>' +
              '<span class="donut-legend-label">' + escapeHtml(r.label) + '</span>' +
              '<span class="donut-legend-pct">' + pct + '%</span>' +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function salesChartHtml(dimension, data) {
    if (dimension === 'HOUR') {
      if (data.rows.length === 0) return '';
      return (
        '<div class="card chart-card">' +
          '<div class="chart-card-title">시간대별 매출 흐름</div>' +
          '<div class="bar-chart-wrap">' + barChartSvg(data.rows, function (r) { return r.label.slice(0, 2) + '시'; }) + '</div>' +
        '</div>'
      );
    }
    if (dimension === 'PAYMENT' || dimension === 'CHANNEL') {
      if (data.rows.length === 0) return '';
      return (
        '<div class="card chart-card">' +
          '<div class="chart-card-title">' + (dimension === 'PAYMENT' ? '결제수단별 비중' : '주문경로별 비중') + '</div>' +
          '<div class="donut-chart-wrap">' +
            donutChartSvg(data.rows, data.totalAmount) +
            donutLegendHtml(data.rows, data.totalAmount) +
          '</div>' +
        '</div>'
      );
    }
    return '';
  }

  /*
   * 랭킹형 매출 목록(순위/라벨(+보조문구)/금액(+비중%)) — 사장님 앱 매출 조회의 기준별 상세
   * 화면(sales.js)에서 쓰던 것을 행사 담당자 매출현황(메뉴별/매장별 랭킹)에서도 그대로 쓰기
   * 위해 이쪽으로 옮겼다.
   */
  function breakdownListHtml(data, emptyMessage) {
    if (!data.rows || data.rows.length === 0) {
      return (
        '<div class="center-empty" style="padding-top:40px;"><div class="emoji">🗂️</div><div class="title">' +
        escapeHtml(emptyMessage || '해당 기간의 매출이 없어요') + '</div></div>'
      );
    }
    return (
      '<div class="card">' +
      data.rows
        .map(function (row, idx) {
          var pct = data.totalAmount > 0 ? Math.round((row.amount / data.totalAmount) * 100) : 0;
          return (
            '<div class="sales-breakdown-row">' +
              '<span class="sales-breakdown-rank">' + (idx + 1) + '</span>' +
              '<span class="sales-breakdown-label">' + escapeHtml(row.label) + (row.sub ? '<div class="sales-breakdown-sub">' + escapeHtml(row.sub) + '</div>' : '') + '</span>' +
              '<span class="sales-breakdown-amount">' + formatWon(row.amount) + ' <span class="sales-breakdown-sub">(' + pct + '%)</span></span>' +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  /*
   * 주문 카드 공용 조각들 — 원래 customers.js(사장님 주문 화면)에만 있었는데, 행사 담당자의
   * '매장별 주문조회'(읽기 전용)가 똑같은 채널 배지/픽업번호/전화번호 표시·5분 단위 시간대
   * 묶음을 그대로 써야 해서 이쪽으로 옮겼다 — 두 화면이 완전히 같은 코드를 호출한다(복붙 아님).
   */
  var BUCKET_MS = 5 * 60 * 1000;

  function clockLabel(iso) {
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  }

  /* 24시간제 시각(오전/오후 없이) — 주문 카드 상단의 강조 시각 표시 전용. clockLabel은 다른
     곳(시간대 묶음 헤더, 상세 모달 등)에서 이미 쓰이고 있어 그대로 두고 별도로 추가했다. */
  function clockLabel24(iso) {
    var d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function elapsedLabel(iso) {
    var diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return '방금 경과';
    if (diffMin < 60) return diffMin + '분 경과';
    var diffHour = Math.floor(diffMin / 60);
    return diffHour + '시간 경과';
  }

  function formatFullPhone(phone) {
    var digits = (phone || '').replace(/\D/g, '');
    if (!digits) return phone || '-';
    return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
  }

  function isPhoneSuspicious(phone) {
    if (!phone) return true;
    var digits = phone.replace(/\D/g, '');
    return digits.length !== 11 || digits.slice(0, 3) !== '010';
  }

  function channelBadgeHtml(order) {
    var isQr = order.channel === 'QR';
    return (
      '<span class="channel-badge ' + (isQr ? 'channel-qr' : 'channel-tablet') + '">' +
      (isQr ? '🔳 QR오더' : '🖥️ 태블릿오더') +
      '</span>'
    );
  }

  var ORDER_TYPE_META = {
    PACKAGING: { cls: 'order-type-packaging', label: '포장' },
    REUSABLE: { cls: 'order-type-reusable', label: '다회용기' },
    EXPERIENCE: { cls: 'order-type-experience', label: '체험' },
  };

  function orderTypeBadgeHtml(order) {
    var meta = ORDER_TYPE_META[order.orderType];
    if (!meta) return '';
    return '<span class="order-type-pill ' + meta.cls + '">' + meta.label + '</span>';
  }

  function pickupBlockHtml(order) {
    var isTable = order.receiveType === 'TABLE_SERVICE';
    var label = isTable ? '테이블' : '픽업번호';
    var value = isTable ? order.tableOrPickupNo : order.customerPhone ? order.customerPhone.replace(/\D/g, '').slice(-4) : '----';
    return (
      '<div class="order-card-pickup-block"><div class="pickup-label">' + label + '</div><div class="pickup-value">' +
      escapeHtml(value) + '</div></div>'
    );
  }

  function phoneRowHtml(order) {
    if (isPhoneSuspicious(order.customerPhone)) {
      return (
        '<div class="order-card-phone suspicious">⚠️ ' + escapeHtml(formatFullPhone(order.customerPhone)) +
        ' <span class="phone-warning-inline">오입력 의심</span></div>'
      );
    }
    return '<div class="order-card-phone">' + escapeHtml(formatFullPhone(order.customerPhone)) + '</div>';
  }

  function bucketKeyOf(iso) {
    var d = new Date(iso);
    var flooredMin = Math.floor(d.getMinutes() / 5) * 5;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), flooredMin, 0, 0).getTime();
  }

  function bucketLabel(key) {
    return clockLabel(new Date(key).toISOString()) + ' ~ ' + clockLabel(new Date(key + BUCKET_MS).toISOString());
  }

  function groupByBucket(sortedList) {
    var groups = [];
    var currentKey = null;
    sortedList.forEach(function (o) {
      var key = bucketKeyOf(o.orderedAt);
      if (key !== currentKey) {
        groups.push({ key: key, orders: [] });
        currentKey = key;
      }
      groups[groups.length - 1].orders.push(o);
    });
    return groups;
  }

  function confirmModalHtml(opts) {
    // opts: { overlayId, title, message, confirmLabel, confirmAction, confirmVariant, closeAction }
    return (
      '<div class="modal-overlay" id="' + opts.overlayId + '">' +
        '<div class="modal-sheet">' +
          '<div class="modal-sheet-header">' +
            '<span class="modal-sheet-title">' + escapeHtml(opts.title) + '</span>' +
            '<button class="icon-btn" data-action="' + escapeHtml(opts.closeAction) + '">' + Icons.close + '</button>' +
          '</div>' +
          '<div class="modal-sheet-body"><div class="helper-text" style="text-align:left;">' + escapeHtml(opts.message) + '</div></div>' +
          '<div class="modal-sheet-footer">' +
            button({ label: opts.confirmLabel || '확인', action: opts.confirmAction, variant: opts.confirmVariant || 'primary' }) +
            button({ label: '취소', action: opts.closeAction, variant: 'outline' }) +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  window.UI = {
    Icons: Icons,
    escapeHtml: escapeHtml,
    formatWon: formatWon,
    timeAgoLabel: timeAgoLabel,
    button: button,
    badge: badge,
    toggle: toggle,
    topBar: topBar,
    showToast: showToast,
    showBanner: showBanner,
    segmentTabs: segmentTabs,
    confirmModalHtml: confirmModalHtml,
    barChartSvg: barChartSvg,
    donutChartSvg: donutChartSvg,
    donutLegendHtml: donutLegendHtml,
    salesChartHtml: salesChartHtml,
    breakdownListHtml: breakdownListHtml,
    clockLabel: clockLabel,
    clockLabel24: clockLabel24,
    elapsedLabel: elapsedLabel,
    formatFullPhone: formatFullPhone,
    isPhoneSuspicious: isPhoneSuspicious,
    channelBadgeHtml: channelBadgeHtml,
    orderTypeBadgeHtml: orderTypeBadgeHtml,
    pickupBlockHtml: pickupBlockHtml,
    phoneRowHtml: phoneRowHtml,
    bucketKeyOf: bucketKeyOf,
    bucketLabel: bucketLabel,
    groupByBucket: groupByBucket,
  };
})();
