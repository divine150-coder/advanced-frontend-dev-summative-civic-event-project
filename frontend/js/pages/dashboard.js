/**
 * dashboard.js — ADMIN ONLY. Summary cards + readable bar charts from GET /api/dashboard/admin.
 * Real payload (backend/src/models/dashboard.model.js):
 *   { users:{total_users,active_users,inactive_users}, events:{total_events,upcoming_events,past_events},
 *     registrations:{total_registrations}, feedbacks:{total_feedback}, promos:{total_promos},
 *     announcements:{total_announcements}, notifications:{total_notifications}, user_growth:[{month,new_users}] }
 * Counts arrive as strings (Postgres COUNT) so they are converted with Number().
 * Auto-refreshes every 60 s so numbers/charts update when data changes.
 */
Layout.ready(function () {
  if (!Auth.isAdmin()) return;      // belt-and-braces guard (page is also data-access="admin")
  var $cards = $('#stat-cards'), $chart = $('#chart-wrap');

  function n(group, key) { return Number((group && group[key]) || 0); }

  function render(d) {
    var stats = [
      ['Total users', n(d.users, 'total_users')], ['Active users', n(d.users, 'active_users')], ['Disabled users', n(d.users, 'inactive_users')],
      ['Total events', n(d.events, 'total_events')], ['Upcoming events', n(d.events, 'upcoming_events')], ['Past events', n(d.events, 'past_events')],
      ['Registrations', n(d.registrations, 'total_registrations')], ['Feedback entries', n(d.feedbacks, 'total_feedback')],
      ['Promos', n(d.promos, 'total_promos')], ['Announcements', n(d.announcements, 'total_announcements')],
      ['Notifications', n(d.notifications, 'total_notifications')],
      ['Your unread notifications', Layout.Notif.unread()]
    ];
    $cards.attr('aria-busy', 'false').html(stats.map(function (s) {
      return '<div class="card p-5"><dt class="text-sm font-semibold text-slate-700">' + UI.esc(s[0]) + '</dt><dd class="text-4xl font-extrabold text-green-900 mt-1">' + s[1].toLocaleString() + '</dd></div>';
    }).join(''));

    $chart.empty()
      .append(chart('New users per month (last 6 months)', (d.user_growth || []).map(function (r) { return { label: r.month, value: Number(r.new_users) }; }), 'No sign-ups in the last 6 months.'))
      .append(chart('Events: upcoming vs past', [{ label: 'Upcoming', value: n(d.events, 'upcoming_events') }, { label: 'Past', value: n(d.events, 'past_events') }]))
      .append(chart('Users: active vs disabled', [{ label: 'Active', value: n(d.users, 'active_users') }, { label: 'Disabled', value: n(d.users, 'inactive_users') }]));
  }

  /** Accessible bar chart: a labelled list with CSS bars (numbers are always printed, not colour-only). */
  function chart(title, data, emptyMsg) {
    var max = Math.max.apply(null, data.map(function (r) { return r.value; }).concat([1]));
    var body = data.length ? data.map(function (r) {
      return '<li class="flex items-center gap-3"><span class="w-24 shrink-0 text-sm text-slate-800">' + UI.esc(r.label) + '</span>' +
        '<span class="flex-1 bg-slate-100 rounded h-6 overflow-hidden"><span class="block h-6 bg-green-800 rounded" style="width:' + Math.max(r.value ? 2 : 0, r.value / max * 100) + '%"></span></span>' +
        '<span class="w-12 text-right font-semibold text-sm">' + r.value.toLocaleString() + '</span></li>';
    }).join('') : '<li class="text-slate-600">' + UI.esc(emptyMsg || 'No data yet.') + '</li>';
    return $('<div class="mb-8 last:mb-0"></div>').html('<h2 class="text-lg font-bold">' + UI.esc(title) + '</h2><ul class="mt-3 space-y-2" role="list" aria-label="Bar chart: ' + UI.esc(title) + '">' + body + '</ul>');
  }

  function load(silent) {
    if (!silent) { $cards.attr('aria-busy', 'true').html(UI.skeletonCards(4)); }
    Api.get(CIVIC.EP.dashboard).done(function (res) {
      render(Api.item(res) || {}); $('#updated').text('Updated ' + new Date().toLocaleTimeString());
    }).fail(function (err) { if (!silent) UI.errorState($cards, err.message, load); });
  }
  $('#refresh').on('click', function () { load(false); });
  setInterval(function () { if (!document.hidden) load(true); }, 60000);
  load(false);
});
