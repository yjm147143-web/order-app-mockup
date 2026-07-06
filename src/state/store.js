/*
 * 앱 전역 상태 (초경량 store)
 * 실제 프로젝트 전환 시: Zustand의 create()로 그대로 옮길 수 있는 구조로 설계함.
 * (state 필드 + set 함수 조합 -> Zustand store 시그니처와 1:1 대응)
 */

(function () {
  var SESSION_KEY = 'sajang-app-session-v1';

  function loadSession() {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      // 자동 로그인이 꺼진 채로 저장된 세션이면 다음 실행 시 복원하지 않는다(로그인 화면부터 다시 시작).
      if (!parsed.autoLogin) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  var session = loadSession();

  var state = {
    currentUser: session ? session.currentUser : null,
    currentStoreId: session ? session.currentStoreId : null,
    currentEventId: session ? session.currentEventId : null, // 행사 담당자 계정이 선택한 담당 행사
    autoLogin: session ? !!session.autoLogin : false,
    isOffline: false, // 디버그용 오프라인 시뮬레이션 플래그 — 세션 간 유지하지 않고 항상 false로 시작한다.
  };

  function persist() {
    saveSession({
      currentUser: state.currentUser,
      currentStoreId: state.currentStoreId,
      currentEventId: state.currentEventId,
      autoLogin: state.autoLogin,
    });
  }

  var AppState = {
    get: function () {
      return state;
    },
    isLoggedIn: function () {
      return !!state.currentUser;
    },
    hasSelectedStore: function () {
      return !!state.currentStoreId;
    },
    hasSelectedEvent: function () {
      return !!state.currentEventId;
    },
    login: function (user, autoLogin) {
      state.currentUser = user;
      state.autoLogin = !!autoLogin;
      persist();
    },
    selectStore: function (storeId) {
      state.currentStoreId = storeId;
      persist();
    },
    selectEvent: function (eventId) {
      state.currentEventId = eventId;
      persist();
    },
    logout: function () {
      state.currentUser = null;
      state.currentStoreId = null;
      state.currentEventId = null;
      state.autoLogin = false;
      persist();
    },
    setOffline: function (isOffline) {
      state.isOffline = isOffline;
    },
  };

  window.AppState = AppState;
})();
