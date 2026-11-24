/**
 * events.js — Events list: search + date/location filters, pagination, register/cancel, admin edit/delete.
 * ROLE UI: Edit/Delete/"New event" are rendered only when Auth.isAdmin(); Register only for normal users.
 */
Layout.ready(function (user) {
  var admin = Auth.isAdmin();
  var state = { page: parseInt(UI.param('page'), 10) || 1, search: UI.param('search') || '', location: UI.param('location') || '', date: UI.param('date') || '' };
  var $grid = $('#events-grid'), $pager = $('#events-pager'), $count = $('#events-count');

  if (admin) $('#admin-actions').removeClass('hidden');
  $('#f-search').val(state.search); $('#f-location').val(state.location); $('#f-date').val(state.date);

  function matches(ev) {
    var s = state.search.toLowerCase(), l = state.location.toLowerCase();
    if (s && (ev.title + ' ' + (ev.description || '')).toLowerCase().indexOf(s) === -1) return false;
    if (l && (ev.location || '').toLowerCase().indexOf(l) === -1) return false;
    if (state.date) {
      var day = new Date(state.date + 'T00:00:00'), next = new Date(day.getTime() + 86400000);
      var st = new Date(ev.starts_at), en = ev.ends_at ? new Date(ev.ends_at) : st;
      if (!(st < next && en >= day)) return false;
    }
    return true;
  }

  function card(ev) {
    var img = UI.meta(ev).image_url, draft = !UI.isPublished(ev), reg = Reg.isRegistered(ev.id);
    var actions = '<a class="btn-secondary" href="event.html?id=' + ev.id + '">View</a>';
    if (admin) {
      actions += '<a class="btn-secondary" href="event-form.html?id=' + ev.id + '" aria-label="Edit ' + UI.esc(ev.title) + '">Edit</a>' +
        '<button type="button" class="btn-danger del-btn" data-id="' + ev.id + '" data-title="' + UI.esc(ev.title) + '" aria-label="Delete ' + UI.esc(ev.title) + '">Delete</button>';
    } else {
      actions += reg
        ? '<button type="button" class="btn-secondary cancel-btn" data-id="' + ev.id + '">Cancel registration</button>'
        : '<button type="button" class="btn-primary reg-btn" data-id="' + ev.id + '">Register</button>';
    }
    return '<article class="card overflow-hidden flex flex-col" aria-labelledby="ev-' + ev.id + '">' +
      (img ? '<img src="' + UI.esc(UI.assetUrl(img)) + '" alt="" loading="lazy" class="h-44 w-full object-cover bg-slate-200"/>'
           : '<div class="h-44 bg-gradient-to-br from-green-700 to-green-950 flex items-center justify-center text-white text-4xl" aria-hidden="true">📅</div>') +
      '<div class="p-4 flex-1 flex flex-col"><h2 id="ev-' + ev.id + '" class="text-lg font-bold">' + UI.esc(ev.title) +
      (draft ? ' <span class="badge bg-amber-200 text-amber-900">Draft</span>' : '') +
      (reg ? ' <span class="badge bg-green-100 text-green-900">Registered</span>' : '') + '</h2>' +
      '<p class="text-sm text-slate-700 mt-1"><span aria-hidden="true">🕒</span> <span class="sr-only">When:</span> ' + UI.fmtDateTime(ev.starts_at) + '</p>' +
      '<p class="text-sm text-slate-700"><span aria-hidden="true">📍</span> <span class="sr-only">Where:</span> ' + UI.esc(ev.location || 'TBA') + '</p>' +
      '<p class="text-sm text-slate-700 mt-2 line-clamp-3 flex-1">' + UI.esc(ev.description || '') + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-4">' + actions + '</div></div></article>';
  }

  var cache = null;   // the backend returns ALL events (no server-side filter/pagination) -> filter + paginate here

  function render() {
    var list = cache.filter(function (e) { return (admin || UI.isPublished(e)) && matches(e); });
    var totalPages = Math.max(1, Math.ceil(list.length / CIVIC.PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var slice = list.slice((state.page - 1) * CIVIC.PAGE_SIZE, state.page * CIVIC.PAGE_SIZE);
    $count.text(list.length ? list.length + ' event' + (list.length === 1 ? '' : 's') + ' found' : '');
    $grid.attr('aria-busy', 'false').html(slice.length ? slice.map(card).join('') : UI.emptyState('No events found', 'Try changing your search or filters.'));
    UI.pagination($pager, state.page, totalPages, function (p) { state.page = p; sync(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  function load() {
    $grid.attr('aria-busy', 'true').html(UI.skeletonCards(6));
    var regP = admin ? $.Deferred().resolve().promise() : Reg.load().then(null, function () { return $.Deferred().resolve().promise(); });
    $.when(Api.get(CIVIC.EP.events), regP).done(function (res) {
      cache = Api.items(res).sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
      render();
    }).fail(function (err) { $grid.attr('aria-busy', 'false'); UI.errorState($grid, err.message, load); });
  }

  function sync() { // keep filters in the URL (shareable / back-button friendly)
    var p = new URLSearchParams();
    ['search', 'location', 'date'].forEach(function (k) { if (state[k]) p.set(k, state[k]); });
    if (state.page > 1) p.set('page', state.page);
    history.replaceState(null, '', 'events.html' + (p.toString() ? '?' + p : ''));
  }

  $('#filter-form').on('submit', function (e) {
    e.preventDefault();
    state.search = $('#f-search').val().trim(); state.location = $('#f-location').val().trim(); state.date = $('#f-date').val(); state.page = 1;
    sync(); render();
  });
  $('#filter-reset').on('click', function () {
    $('#filter-form')[0].reset(); state = { page: 1, search: '', location: '', date: '' }; sync(); render();
  });

  // Register (optimistic: flip button state first, revert on failure)
  $grid.on('click', '.reg-btn', function () {
    var $b = $(this), id = $b.data('id'); UI.setBusy($b, true, 'Registering…');
    Reg.register(id).done(function () { UI.toast('You are registered!', 'success'); load(); })
      .fail(function (err) { UI.toast(err.status === 409 ? 'The server says you are already registered for this event (a cancelled registration cannot be re-opened).' : err.message, 'error'); UI.setBusy($b, false); });
  });
  $grid.on('click', '.cancel-btn', function () {
    var $b = $(this), id = $b.data('id');
    UI.confirm('Cancel your registration for this event?', 'Cancel registration', true).done(function () {
      UI.setBusy($b, true, 'Cancelling…');
      Reg.cancel(id).done(function () { UI.toast('Registration cancelled.', 'success'); load(); })
        .fail(function (err) { UI.toast(err.message, 'error'); UI.setBusy($b, false); });
    });
  });
  // Delete (admin only)
  $grid.on('click', '.del-btn', function () {
    if (!Auth.isAdmin()) return;               // client-side guard (backend also enforces)
    var id = $(this).data('id'), title = $(this).data('title');
    UI.confirm('Delete "' + title + '"? This cannot be undone.', 'Delete', true).done(function () {
      Api.del(CIVIC.EP.event(id)).done(function () { UI.toast('Event deleted.', 'success'); load(); })
        .fail(function (err) { UI.toast(err.message, 'error'); });
    });
  });

  load();
});
