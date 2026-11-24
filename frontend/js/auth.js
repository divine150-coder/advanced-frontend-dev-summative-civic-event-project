/**
 * auth.js — token storage, current-user context and CLIENT-SIDE ROLE GUARDS.
 *
 * Storage rules:
 *  - "Remember me" unchecked -> sessionStorage (cleared when the tab closes; safer).
 *  - "Remember me" checked   -> localStorage (survives restarts, but any XSS on this
 *    origin could read the token — that is the security trade-off).
 *
 * IMPORTANT: guards here are UX only. The backend is the real security boundary.
 */
var Auth = (function () {
  var TOKEN_KEY = 'civic_token';
  var USER_KEY = 'civic_user';

  /** Returns whichever storage currently holds the session (or null). */
  function store() {
    try {
      if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
      if (localStorage.getItem(TOKEN_KEY)) return localStorage;
    } catch (e) { /* ignore */ }
    return null;
  }

  function save(token, user, persistent) {
    clear();
    var s = persistent ? localStorage : sessionStorage;
    s.setItem(TOKEN_KEY, token);
    // Global auth context: only { id, full_name, role } (+ email for the profile page).
    s.setItem(USER_KEY, JSON.stringify({
      id: user.id, full_name: user.full_name, email: user.email, role: user.role, is_active: user.is_active
    }));
  }

  function clear() {
    try {
      [sessionStorage, localStorage].forEach(function (s) {
        s.removeItem(TOKEN_KEY); s.removeItem(USER_KEY);
      });
    } catch (e) { /* ignore */ }
  }

  function getToken() { var s = store(); return s ? s.getItem(TOKEN_KEY) : null; }

  function getUser() {
    var s = store();
    if (!s) return null;
    try { return JSON.parse(s.getItem(USER_KEY)); } catch (e) { return null; }
  }

  /** Update cached user (e.g. after a profile edit) while keeping the same storage. */
  function updateUser(patch) {
    var s = store(); var u = getUser();
    if (!s || !u) return;
    s.setItem(USER_KEY, JSON.stringify($.extend(u, patch)));
  }

  /** Decode the JWT `exp` claim (seconds) without verifying — expiry check for UX only. */
  function tokenExpired() {
    var t = getToken();
    if (!t) return true;
    try {
      var payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return !!payload.exp && payload.exp * 1000 < Date.now();
    } catch (e) { return false; /* opaque token: let the server decide (401) */ }
  }

  function isLoggedIn() { return !!getToken() && !!getUser() && !tokenExpired(); }
  function isAdmin() { var u = getUser(); return !!u && u.role === 'admin'; }

  function logout(message) {
    clear();
    if (message) { try { sessionStorage.setItem('civic_flash', JSON.stringify({ msg: message, type: 'error' })); } catch (e) {} }
    window.location.href = 'login.html';
  }

  /**
   * ROLE-BASED ACCESS GUARDS
   * Called by layout.js for every page according to <body data-access="...">:
   *   guest -> only for signed-out visitors (login/signup)
   *   user  -> any signed-in user (admin or normal)
   *   admin -> ADMIN ONLY pages (dashboard, users, event/announcement/promo forms)
   * Returns true when the page may render.
   */
  function guard(access) {
    if (access === 'guest') {
      if (isLoggedIn()) { window.location.replace(isAdmin() ? 'dashboard.html' : 'events.html'); return false; }
      return true;
    }
    if (!getToken() || !getUser()) { window.location.replace('login.html'); return false; }
    if (tokenExpired()) { logout('Your session has expired. Please sign in again.'); return false; }
    if (access === 'admin' && !isAdmin()) {
      // Normal users are bounced with a message; the API would also answer 403.
      try { sessionStorage.setItem('civic_flash', JSON.stringify({ msg: 'That page is for administrators only.', type: 'error' })); } catch (e) {}
      window.location.replace('events.html');
      return false;
    }
    return true;
  }

  return { save: save, clear: clear, getToken: getToken, getUser: getUser, updateUser: updateUser,
           isLoggedIn: isLoggedIn, isAdmin: isAdmin, logout: logout, guard: guard, tokenExpired: tokenExpired };
})();
