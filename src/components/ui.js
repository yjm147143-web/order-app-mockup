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
  };
})();
