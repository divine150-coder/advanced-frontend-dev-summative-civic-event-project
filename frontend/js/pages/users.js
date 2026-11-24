/**
 * users.js — ADMIN ONLY user management: list, view profile, enable/disable.
 * Admins CANNOT change a user's role from the UI (no such control exists, by design).
 */
Layout.ready(function (me) {
  if (!Auth.isAdmin()) return;
  var users = [], $body = $('#users-body');

  function active(u) { return !(u.is_active === false || u.is_active === 0 || u.is_active === '0' || u.is_active === 'false'); }

  function render() {
    var q = $('#u-search').val().trim().toLowerCase();
    var list = users.filter(function (u) { return !q || (u.full_name + ' ' + u.email).toLowerCase().indexOf(q) !== -1; });
    $body.attr('aria-busy', 'false').html(list.length ? list.map(function (u) {
      var self = String(u.id) === String(me.id);
      return '<tr class="border-b border-slate-100"><th scope="row" class="py-3 pr-3 text-left font-semibold">' + UI.esc(u.full_name) + (self ? ' <span class="badge bg-slate-200 text-slate-800">You</span>' : '') + '</th>' +
        '<td class="py-3 pr-3">' + UI.esc(u.email) + '</td><td class="py-3 pr-3"><span class="badge ' + (u.role === 'admin' ? 'bg-green-100 text-green-900' : 'bg-slate-200 text-slate-800') + '">' + UI.esc(u.role) + '</span></td>' +
        '<td class="py-3 pr-3"><span class="badge ' + (active(u) ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900') + '">' + (active(u) ? 'Active' : 'Disabled') + '</span></td>' +
        '<td class="py-3"><div class="flex gap-2 flex-wrap"><button type="button" class="btn-secondary view-btn" data-id="' + u.id + '">View</button>' +
        (self ? '' : '<button type="button" class="' + (active(u) ? 'btn-danger' : 'btn-primary') + ' toggle-btn" data-id="' + u.id + '" aria-label="' + (active(u) ? 'Disable ' : 'Enable ') + UI.esc(u.full_name) + '">' + (active(u) ? 'Disable' : 'Enable') + '</button>') +
        '</div></td></tr>';
    }).join('') : '<tr><td colspan="5" class="py-8 text-center text-slate-600">No users found.</td></tr>');
  }

  function load() {
    $body.attr('aria-busy', 'true').html('<tr><td colspan="5">' + UI.skeletonRows(4) + '</td></tr>');
    Api.get(CIVIC.EP.users, { data: { page: 1, limit: 200 } }).done(function (res) { users = Api.items(res); render(); })
      .fail(function (err) { $body.html('<tr><td colspan="5" class="py-4 text-red-800" role="alert">' + UI.esc(err.message) + ' <button type="button" id="retry" class="underline font-semibold">Retry</button></td></tr>'); });
  }
  $(document).on('click', '#retry', load);
  $('#u-search').on('input', render);

  $body.on('click', '.view-btn', function () {
    var id = $(this).data('id');
    Api.get(CIVIC.EP.user(id)).done(function (res) {
      var u = Api.item(res);
      UI.modal('User profile', '<dl class="space-y-2 text-sm"><div><dt class="font-semibold">Name</dt><dd>' + UI.esc(u.full_name) + '</dd></div>' +
        '<div><dt class="font-semibold">Email</dt><dd>' + UI.esc(u.email) + '</dd></div><div><dt class="font-semibold">Role</dt><dd>' + UI.esc(u.role) + '</dd></div>' +
        '<div><dt class="font-semibold">Status</dt><dd>' + (active(u) ? 'Active' : 'Disabled') + '</dd></div>' +
        '<div><dt class="font-semibold">Joined</dt><dd>' + UI.fmtDateTime(u.created_at) + '</dd></div></dl>');
    }).fail(function (err) { UI.toast(err.message, 'error'); });
  });

  $body.on('click', '.toggle-btn', function () {
    if (!Auth.isAdmin()) return;
    var id = $(this).data('id'), u = users.filter(function (x) { return String(x.id) === String(id); })[0], enable = !active(u);
    UI.confirm((enable ? 'Enable' : 'Disable') + ' the account for ' + u.full_name + '?', enable ? 'Enable' : 'Disable', !enable).done(function () {
      var before = u.is_active; u.is_active = enable; render();          // optimistic
      Api.patch(enable ? CIVIC.EP.userEnable(id) : CIVIC.EP.userDisable(id)).done(function () {
        UI.toast('User ' + (enable ? 'enabled' : 'disabled') + '.', 'success');
      }).fail(function (err) { u.is_active = before; render(); UI.toast(err.message, 'error'); });   // revert on failure
    });
  });
  load();
});
