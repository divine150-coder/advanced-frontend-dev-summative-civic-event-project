/**
 * notifications.js — full inbox (all users) + ADMIN delete buttons.
 * The backend creates notifications automatically (new event / announcement / promo) and exposes no POST route,
 * so admins manage them by deleting. The delete UI is only rendered for admins and re-checked in the handler.
 */
Layout.ready(function () {
  var N = Layout.Notif, admin = Auth.isAdmin(), $list = $('#inbox-list'), filter = 'all';
  if (admin) $('#admin-panel').removeClass('hidden');

  function render() {
    var items = N.items.filter(function (n) { return filter === 'all' || (filter === 'unread' && !N.isRead(n)); });
    $list.attr('aria-busy', 'false').html(items.length
      ? items.map(function (n) { return N.itemHtml(n, admin); }).join('')
      : '<li class="p-8 text-center text-slate-600">' + (filter === 'unread' ? 'No unread notifications.' : 'You have no notifications.') + '</li>');
    $('#unread-total').text(N.unread() + ' unread');
  }

  function load() {
    $list.attr('aria-busy', 'true').html('<li class="p-4">' + UI.skeletonRows(4) + '</li>');
    N.refresh().done(render).fail(function (err) {
      $list.attr('aria-busy', 'false').html('<li class="p-4 text-red-800" role="alert">' + UI.esc(err.message) + ' <button type="button" id="retry" class="underline font-semibold">Retry</button></li>');
    });
  }
  $(document).on('click', '#retry', load);
  $(document).on('notifications:updated', render);   // optimistic read-state changes

  $('#filter-all, #filter-unread').on('click', function () {
    filter = this.id === 'filter-unread' ? 'unread' : 'all';
    $('#filter-all').attr('aria-pressed', filter === 'all'); $('#filter-unread').attr('aria-pressed', filter === 'unread'); render();
  });

  // Delete (ADMIN ONLY)
  $list.on('click', '.notif-del', function () {
    if (!Auth.isAdmin()) return;
    var id = $(this).data('id');
    UI.confirm('Delete this notification for everyone?', 'Delete', true).done(function () {
      Api.del(CIVIC.EP.notification(id)).done(function () { UI.toast('Notification deleted.', 'success'); load(); })
        .fail(function (err) { UI.toast(err.message, 'error'); });
    });
  });

  load();
});
