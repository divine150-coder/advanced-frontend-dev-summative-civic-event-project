/** announcements.js — list of published audio announcements. Admin: create/edit/delete controls. */
Layout.ready(function () {
  var admin = Auth.isAdmin(), $grid = $('#ann-grid');
  if (admin) $('#admin-actions').removeClass('hidden');

  function card(a) {
    var draft = !UI.isPublished(a);
    return '<article class="card p-4 flex flex-col" aria-labelledby="a-' + a.id + '">' +
      '<h2 id="a-' + a.id + '" class="text-lg font-bold">🔊 ' + UI.esc(a.title) + (draft ? ' <span class="badge bg-amber-200 text-amber-900">Draft</span>' : '') + '</h2>' +
      // The API stores no duration, so it is read from the audio file's metadata after the cards render.
      '<p class="text-sm text-slate-700 mt-1">Length: <strong class="dur" data-src="' + UI.esc(UI.assetUrl(a.audio_url)) + '">…</strong> · ' + UI.fmtDate(a.created_at) + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-4"><a class="btn-primary" href="announcement.html?id=' + a.id + '&autoplay=1" aria-label="Play ' + UI.esc(a.title) + '">▶ Play</a>' +
      '<a class="btn-secondary" href="announcement.html?id=' + a.id + '">Details</a>' +
      (admin ? '<button type="button" class="btn-secondary pub-btn" data-id="' + a.id + '" data-pub="' + (draft ? 0 : 1) + '">' + (draft ? 'Publish' : 'Unpublish') + '</button><a class="btn-secondary" href="announcement-form.html?id=' + a.id + '" aria-label="Edit ' + UI.esc(a.title) + '">Edit</a><button type="button" class="btn-danger del-btn" data-id="' + a.id + '" data-title="' + UI.esc(a.title) + '" aria-label="Delete ' + UI.esc(a.title) + '">Delete</button>' : '') +
      '</div></article>';
  }

  function load() {
    $grid.attr('aria-busy', 'true').html(UI.skeletonCards(3));
    Api.get(CIVIC.EP.announcements, { cache: true }).done(function (res) {
      var list = Api.items(res).filter(function (a) { return admin || UI.isPublished(a); })
        .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      $grid.attr('aria-busy', 'false').html(list.length ? list.map(card).join('') : UI.emptyState('No announcements yet', 'Check back soon.'));
      $grid.find('.dur').each(function () {
        var el = $(this), au = new Audio();
        au.preload = 'metadata';
        au.addEventListener('loadedmetadata', function () { el.text(UI.fmtClock(au.duration)); });
        au.addEventListener('error', function () { el.text('—'); });
        au.src = el.data('src');
      });
    }).fail(function (err) { $grid.attr('aria-busy', 'false'); UI.errorState($grid, err.message, load); });
  }

  $grid.on('click', '.pub-btn', function () {
    if (!Auth.isAdmin()) return;      // admin-only guard
    var $b = $(this), publish = String($b.data('pub')) === '0';
    UI.setBusy($b, true, 'Saving…');
    Api.patch(publish ? CIVIC.EP.announcementPublish($b.data('id')) : CIVIC.EP.announcementUnpublish($b.data('id'))).done(function () {
      UI.toast(publish ? 'Announcement published.' : 'Announcement unpublished.', 'success'); load();
    }).fail(function (err) { UI.toast(err.message, 'error'); UI.setBusy($b, false); });
  });
  $grid.on('click', '.del-btn', function () {
    if (!Auth.isAdmin()) return;      // admin-only guard
    var id = $(this).data('id');
    UI.confirm('Delete announcement "' + $(this).data('title') + '"?', 'Delete', true).done(function () {
      Api.del(CIVIC.EP.announcement(id)).done(function () { UI.toast('Announcement deleted.', 'success'); load(); })
        .fail(function (err) { UI.toast(err.message, 'error'); });
    });
  });
  load();
});
