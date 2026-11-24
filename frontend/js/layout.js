/**
 * layout.js — runs on every page.
 *  1. Applies the ROLE GUARD from <body data-access="guest|user|admin"> (see auth.js).
 *  2. Renders header (logo, global search, nav, notification bell, profile menu, admin links) and footer.
 *  3. Owns the notification store (`Notif`) and the slide-over notification drawer.
 *  4. Exposes Layout.ready(fn) — page scripts run only after the guard passed.
 *
 * ROLE-BASED UI: admin-only links/controls are only *rendered* when Auth.isAdmin() is true.
 * Hidden controls are cosmetic — the backend enforces permissions.
 */
var Layout = (function ($) {
  var queue = [], started = false, passed = false;

  function ready(fn) { if (passed) fn(Auth.getUser()); else queue.push(fn); }

  /* ================= Notification store ================= */
  var Notif = {
    items: [],
    readKey: function () { var u = Auth.getUser(); return 'civic_read_' + (u ? u.id : 'x'); },
    localRead: function () { try { return JSON.parse(localStorage.getItem(this.readKey()) || '[]'); } catch (e) { return []; } },
    saveLocalRead: function (arr) { try { localStorage.setItem(this.readKey(), JSON.stringify(arr)); } catch (e) {} },
    isRead: function (n) { return !!(n.is_read || n.read || n.read_at) || this.localRead().indexOf(n.id) !== -1; },
    unread: function () { var self = this; return this.items.filter(function (n) { return !self.isRead(n); }).length; },

    refresh: function () {
      var self = this;
      return Api.get(CIVIC.EP.notifications).then(function (res) {
        self.items = Api.items(res).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        self.updateBadge(); self.renderDrawer();
        $(document).trigger('notifications:updated');
        return self.items;
      });
    },
    updateBadge: function () {
      var c = this.unread();
      var $b = $('#notif-count');
      $b.text(c > 99 ? '99+' : c).toggleClass('hidden', c === 0);
      $('#notif-btn').attr('aria-label', 'Notifications, ' + c + ' unread');
    },
    /**
     * Mark as read. The provided backend has no per-user "read" endpoint (its `read` column is shared by all users),
     * so read-state is kept per user in localStorage. UI updates instantly (optimistic) and never needs a revert.
     */
    markRead: function (id) {
      var cur = this.localRead();
      if (cur.indexOf(id) !== -1) return;
      this.saveLocalRead(cur.concat([id]));
      this.updateBadge(); this.renderDrawer(); $(document).trigger('notifications:updated');
    },
    /** Link to the related resource using notification metadata. */
    link: function (n) {
      var m = $.extend({}, n, UI.meta(n));
      if (m.event_id) return { href: 'event.html?id=' + encodeURIComponent(m.event_id), text: 'Open related event' };
      if (m.announcement_id) return { href: 'announcement.html?id=' + encodeURIComponent(m.announcement_id), text: 'Open related announcement' };
      if (m.promo_id) return { href: 'promo.html?id=' + encodeURIComponent(m.promo_id), text: 'Open related promo' };
      return null;
    },
    itemHtml: function (n, withDelete) {
      var unread = !this.isRead(n);
      return '<li class="border-b border-slate-200 last:border-0">' +
        '<div class="flex items-start gap-2 p-3 ' + (unread ? 'bg-green-50' : '') + '">' +
        '<button type="button" class="notif-open flex-1 text-left rounded focus-ring" data-id="' + UI.esc(n.id) + '">' +
        '<span class="flex items-center gap-2">' + (unread ? '<span class="w-2 h-2 rounded-full bg-green-700" aria-hidden="true"></span><span class="sr-only">Unread:</span>' : '') +
        '<span class="font-semibold text-slate-900">' + UI.esc(n.title || 'Notification') + '</span></span>' +
        '<span class="block text-sm text-slate-700 line-clamp-2">' + UI.esc(n.message || '') + '</span>' +
        '<span class="block text-xs text-slate-600 mt-1">' + (n.type ? '<span class="badge bg-slate-200 text-slate-800 mr-1">' + UI.esc(n.type) + '</span>' : '') + UI.timeAgo(n.created_at) + '</span></button>' +
        (withDelete ? '<button type="button" class="notif-del btn-danger" data-id="' + UI.esc(n.id) + '" aria-label="Delete notification ' + UI.esc(n.title || '') + '">Delete</button>' : '') +
        '</div></li>';
    },
    renderDrawer: function () {
      var $l = $('#notif-list'); if (!$l.length) return;
      if (!this.items.length) { $l.html('<li class="p-6 text-center text-slate-600">You have no notifications.</li>'); return; }
      var self = this;
      $l.html(this.items.slice(0, 20).map(function (n) { return self.itemHtml(n, false); }).join(''));
    },
    /** Detail dialog: full message + link to related resource. Marks the item read. */
    openDetail: function (id) {
      var n = this.items.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!n) return;
      var l = this.link(n);
      UI.modal(n.title || 'Notification',
        '<p class="text-xs text-slate-600 mb-3">' + (n.type ? '<span class="badge bg-slate-200 text-slate-800 mr-1">' + UI.esc(n.type) + '</span>' : '') + UI.fmtDateTime(n.created_at) + '</p>' +
        '<p class="whitespace-pre-line text-slate-800">' + UI.esc(n.message || '') + '</p>' +
        (l ? '<p class="mt-5"><a class="btn-primary" href="' + l.href + '">' + l.text + '</a></p>' : ''), { wide: true });
      this.markRead(n.id);
    }
  };

  /* ================= Header / footer ================= */
  function navLink(href, label, key) {
    var page = $('body').data('page');
    var cur = page === key;
    return '<a href="' + href + '" class="nav-link px-3 py-2 rounded-md text-sm font-medium ' +
      (cur ? 'bg-green-800 text-white' : 'text-green-50 hover:bg-green-900') + '"' + (cur ? ' aria-current="page"' : '') + '>' + label + '</a>';
  }

  function renderHeader(access) {
    var u = Auth.getUser(), admin = Auth.isAdmin();
    var logo = '<a href="' + (u ? 'events.html' : 'login.html') + '" class="flex items-center gap-2 text-white font-extrabold text-lg rounded focus-ring">' +
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>CivicEvents</a>';

    if (!u) { // guest header (login / signup)
      $('#app-header').html('<header class="bg-green-950"><div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">' + logo +
        '<nav aria-label="Account" class="flex gap-2"><a class="text-green-50 px-3 py-2 text-sm font-medium hover:underline" href="login.html">Log in</a>' +
        '<a class="bg-white text-green-900 px-3 py-2 rounded-md text-sm font-semibold" href="signup.html">Sign up</a></nav></div></header>');
      return;
    }

    var links = navLink('events.html', 'Events', 'events') + navLink('announcements.html', 'Announcements', 'announcements') +
      navLink('promos.html', 'Promos', 'promos') + navLink('notifications.html', 'Notifications', 'notifications');
    if (!admin) links += navLink('my-registrations.html', 'My events', 'my-registrations');
    if (admin) links += navLink('dashboard.html', 'Dashboard', 'dashboard') + navLink('users.html', 'Admin: Users', 'users');   // ADMIN-ONLY links

    var initials = (u.full_name || '?').split(' ').map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase();

    $('#app-header').html(
      '<header class="bg-green-950 sticky top-0 z-40 shadow"><div class="max-w-6xl mx-auto px-4 py-2">' +
      '<div class="flex items-center gap-3">' + logo +
      '<form id="global-search" role="search" class="hidden md:flex flex-1 max-w-md mx-4"><label for="gs-input" class="sr-only">Search events</label>' +
      '<input id="gs-input" type="search" placeholder="Search events…" class="w-full rounded-l-md px-3 py-2 text-sm text-slate-900" />' +
      '<button class="bg-amber-400 hover:bg-amber-300 text-slate-900 px-3 rounded-r-md font-semibold text-sm" type="submit" aria-label="Search">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></form>' +
      '<div class="ml-auto flex items-center gap-2">' +
      '<button id="notif-btn" type="button" class="relative text-white p-2 rounded-md hover:bg-green-800 focus-ring" aria-haspopup="dialog" aria-controls="notif-drawer" aria-label="Notifications">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8zM10 20a2 2 0 004 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span id="notif-count" class="hidden absolute -top-0.5 -right-0.5 bg-amber-400 text-slate-900 text-xs font-bold rounded-full min-w-[1.2rem] h-5 px-1 flex items-center justify-center">0</span></button>' +
      '<div class="relative"><button id="profile-btn" type="button" class="flex items-center gap-2 text-white rounded-md px-2 py-1 hover:bg-green-800 focus-ring" aria-haspopup="menu" aria-expanded="false" aria-controls="profile-menu">' +
      '<span class="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-bold flex items-center justify-center text-sm" aria-hidden="true">' + UI.esc(initials) + '</span>' +
      '<span class="hidden sm:inline text-sm">' + UI.esc(u.full_name) + '</span></button>' +
      '<div id="profile-menu" role="menu" class="hidden absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1 text-sm">' +
      '<div class="px-4 py-2 text-slate-600 border-b border-slate-200">Signed in as <strong class="text-slate-900">' + UI.esc(u.role) + '</strong></div>' +
      '<a role="menuitem" class="block px-4 py-2 hover:bg-slate-100" href="profile.html">My profile</a>' +
      (admin ? '' : '<a role="menuitem" class="block px-4 py-2 hover:bg-slate-100" href="my-registrations.html">My registrations</a>') +
      (admin ? '<a role="menuitem" class="block px-4 py-2 hover:bg-slate-100" href="dashboard.html">Admin dashboard</a>' : '') +
      '<button role="menuitem" id="logout-btn" type="button" class="w-full text-left px-4 py-2 hover:bg-slate-100 text-red-700">Log out</button></div></div>' +
      '<button id="menu-btn" type="button" class="md:hidden text-white p-2 rounded-md hover:bg-green-800 focus-ring" aria-expanded="false" aria-controls="main-nav" aria-label="Toggle menu">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div></div>' +
      '<nav id="main-nav" aria-label="Main" class="hidden md:flex flex-wrap gap-1 mt-2 pb-1">' + links +
      '<form id="global-search-m" role="search" class="md:hidden w-full mt-2 flex"><label for="gs-input-m" class="sr-only">Search events</label>' +
      '<input id="gs-input-m" type="search" placeholder="Search events…" class="flex-1 rounded-l-md px-3 py-2 text-sm text-slate-900"/>' +
      '<button class="bg-amber-400 text-slate-900 px-3 rounded-r-md font-semibold text-sm" type="submit">Search</button></form></nav>' +
      '</div></header>' +
      // Notification drawer
      '<div id="notif-backdrop" class="hidden fixed inset-0 bg-black/40 z-40"></div>' +
      '<aside id="notif-drawer" class="drawer fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-xl flex flex-col" role="dialog" aria-modal="true" aria-label="Notifications" aria-hidden="true" tabindex="-1">' +
      '<div class="flex items-center justify-between p-4 border-b border-slate-200"><h2 class="text-lg font-bold">Notifications</h2>' +
      '<button id="notif-close" type="button" class="text-2xl leading-none rounded focus-ring px-2" aria-label="Close notifications">×</button></div>' +
      '<ul id="notif-list" class="flex-1 overflow-auto" aria-live="polite"><li class="p-4">' + UI.skeletonRows(3) + '</li></ul>' +
      '<div class="p-3 border-t border-slate-200 text-center"><a href="notifications.html" class="text-green-800 font-semibold underline">View all notifications</a></div></aside>');
  }

  function renderFooter() {
    $('#app-footer').html(
      '<footer class="bg-green-950 text-green-100 mt-12"><div class="max-w-6xl mx-auto px-4 py-8 grid gap-6 sm:grid-cols-3 text-sm">' +
      '<div><p class="font-bold text-white text-base">CivicEvents</p><p class="mt-2">Accessible city events &amp; services for everyone.</p></div>' +
      '<div><p class="font-semibold text-white">Help &amp; contact</p><ul class="mt-2 space-y-1">' +
      '<li>Email: <a class="underline" href="mailto:help@civicevents.example">help@civicevents.example</a></li>' +
      '<li>Phone: <a class="underline" href="tel:+250 788 570 567">+250 788 570 567</a></li><li>Mon–Fri, 08:00–17:00</li></ul></div>' +
      '<div><p class="font-semibold text-white">Accessibility</p><p class="mt-2">Keyboard navigable, screen-reader labelled, captions on promo videos and transcripts for announcements. Need another format? Contact us.</p></div>' +
      '</div><div class="border-t border-green-900 text-center py-3 text-xs">© ' + new Date().getFullYear() + ' CivicEvents. Student project.</div></footer>');
  }

  /* ================= wiring ================= */
  function openDrawer() {
    $('#notif-backdrop').removeClass('hidden');
    $('#notif-drawer').addClass('open').attr('aria-hidden', 'false');
    $('#notif-btn').data('opener', true);
    setTimeout(function () { $('#notif-close').focus(); }, 50);
    Notif.refresh().fail(function (e) { $('#notif-list').html('<li class="p-4 text-red-800" role="alert">' + UI.esc(e.message) + ' <button type="button" id="notif-retry" class="underline">Retry</button></li>'); });
  }
  function closeDrawer() {
    $('#notif-backdrop').addClass('hidden');
    $('#notif-drawer').removeClass('open').attr('aria-hidden', 'true');
    $('#notif-btn').focus();
  }

  function wire() {
    $('#notif-btn').on('click', openDrawer);
    $('#notif-close, #notif-backdrop').on('click', closeDrawer);
    $(document).on('click', '#notif-retry', openDrawer);
    $(document).on('click', '.notif-open', function () { Notif.openDetail($(this).data('id')); });
    $(document).on('keydown', function (e) {
      if (e.key === 'Escape') { if ($('#notif-drawer').hasClass('open')) closeDrawer(); $('#profile-menu').addClass('hidden'); $('#profile-btn').attr('aria-expanded', 'false'); }
    });

    $('#profile-btn').on('click', function (e) {
      e.stopPropagation();
      var open = $('#profile-menu').toggleClass('hidden').is(':visible');
      $(this).attr('aria-expanded', open);
      if (open) $('#profile-menu a,#profile-menu button').first().focus();
    });
    $(document).on('click', function () { $('#profile-menu').addClass('hidden'); $('#profile-btn').attr('aria-expanded', 'false'); });
    $('#logout-btn').on('click', function () { Auth.logout(); });
    $('#menu-btn').on('click', function () {
      var open = $('#main-nav').toggleClass('hidden').is(':visible');
      $(this).attr('aria-expanded', open);
    });
    $('#global-search, #global-search-m').on('submit', function (e) {
      e.preventDefault();
      var q = $(this).find('input').val().trim();
      window.location.href = 'events.html' + (q ? '?search=' + encodeURIComponent(q) : '');
    });
    var q = UI.param('search'); if (q) $('#gs-input, #gs-input-m').val(q);
  }

  function init() {
    if (started) return; started = true;
    var access = $('body').data('access') || 'user';
    if (!Auth.guard(access)) return;          // ROLE GUARD — redirects and stops page scripts
    passed = true;
    renderHeader(access); renderFooter();
    if (Auth.getUser()) { wire(); Notif.refresh().fail(function () { /* badge stays hidden; drawer shows error on open */ }); }
    UI.showFlash();
    queue.forEach(function (fn) { fn(Auth.getUser()); }); queue = [];
    window.setInterval(function () { if (Auth.getUser() && !document.hidden) Notif.refresh(); }, 60000);
  }

  $(init);
  return { ready: ready, Notif: Notif };
})(jQuery);
