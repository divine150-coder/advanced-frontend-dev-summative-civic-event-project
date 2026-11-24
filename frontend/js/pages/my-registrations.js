/** my-registrations.js — "My events": events the signed-in user registered for, with cancel. */
Layout.ready(function () {
  var $grid = $('#reg-grid');

  function card(r) {
    var ev = r.event || r.Event || r, eid = Reg.eventIdOf(r) || ev.id;
    var img = UI.meta(ev).image_url;
    return '<article class="card overflow-hidden flex flex-col" aria-labelledby="r-' + r.id + '">' +
      (img ? '<img src="' + UI.esc(UI.assetUrl(img)) + '" alt="" loading="lazy" class="h-36 w-full object-cover bg-slate-200"/>' : '') +
      '<div class="p-4 flex-1 flex flex-col"><h2 id="r-' + r.id + '" class="text-lg font-bold">' + UI.esc(ev.title || 'Event #' + eid) + '</h2>' +
      '<p class="text-sm text-slate-700 mt-1">🕒 ' + UI.fmtDateTime(ev.starts_at) + '</p><p class="text-sm text-slate-700">📍 ' + UI.esc(ev.location || 'TBA') + '</p>' +
      '<p class="text-xs text-slate-600 mt-2 flex-1">Registered ' + UI.fmtDate(r.created_at || r.registered_at) + '</p>' +
      '<div class="flex gap-2 mt-4"><a class="btn-secondary" href="event.html?id=' + eid + '">View / feedback</a>' +
      '<button type="button" class="btn-danger cancel-btn" data-event="' + eid + '" aria-label="Cancel registration for ' + UI.esc(ev.title || 'event') + '">Cancel</button></div></div></article>';
  }

  function load() {
    $grid.attr('aria-busy', 'true').html(UI.skeletonCards(3));
    Reg.load().done(function (list) {
      $grid.attr('aria-busy', 'false').html(list.length ? list.map(card).join('')
        : UI.emptyState('No registrations yet', 'Browse events and register to see them here.') );
    }).fail(function (err) { $grid.attr('aria-busy', 'false'); UI.errorState($grid, err.message, load); });
  }

  $grid.on('click', '.cancel-btn', function () {
    var $b = $(this), eid = $b.data('event');
    UI.confirm('Cancel this registration?', 'Cancel registration', true).done(function () {
      UI.setBusy($b, true, 'Cancelling…');
      Reg.cancel(eid).done(function () { UI.toast('Registration cancelled.', 'success'); load(); })
        .fail(function (err) { UI.toast(err.message, 'error'); UI.setBusy($b, false); });
    });
  });
  load();
});
