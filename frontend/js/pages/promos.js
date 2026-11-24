/**
 * promos.js — list of published promo videos. Thumbnails only (video files are NOT loaded in the list =
 * lazy loading of heavy media). Admin: publish/unpublish toggle, edit, delete. List is cached and invalidated on writes.
 */
Layout.ready(function () {
  var admin = Auth.isAdmin(), $grid = $('#promo-grid');
  if (admin) $('#admin-actions').removeClass('hidden');

  function card(p) {
    var thumb = p.thumbnail_url || UI.meta(p).thumbnail_url, draft = !UI.isPublished(p);
    return '<article class="card overflow-hidden flex flex-col" aria-labelledby="p-' + p.id + '">' +
      (thumb ? '<img src="' + UI.esc(UI.assetUrl(thumb)) + '" alt="" loading="lazy" class="h-44 w-full object-cover bg-slate-200"/>'
             : (p.video_url
               // No thumbnail from the backend: show the video's first frame, fetched only when the card scrolls into view.
               ? '<video class="lazy-video h-44 w-full object-cover bg-slate-900" data-src="' + UI.esc(UI.assetUrl(p.video_url)) + '#t=0.5" muted playsinline preload="none" tabindex="-1" aria-hidden="true"></video>'
               : '<div class="h-44 bg-gradient-to-br from-slate-900 to-green-900 flex items-center justify-center text-white text-5xl" aria-hidden="true">🎬</div>')) +
      '<div class="p-4 flex-1 flex flex-col"><h2 id="p-' + p.id + '" class="text-lg font-bold">' + UI.esc(p.title) + (draft ? ' <span class="badge bg-amber-200 text-amber-900">Unpublished</span>' : '') + '</h2>' +
      '<p class="text-sm text-slate-700 mt-1 line-clamp-3 flex-1">' + UI.esc(p.description || '') + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-4"><a class="btn-primary" href="promo.html?id=' + p.id + '" aria-label="Play ' + UI.esc(p.title) + '">▶ Play</a>' +
      (admin ? '<button type="button" class="btn-secondary pub-btn" data-id="' + p.id + '" data-pub="' + (draft ? 0 : 1) + '">' + (draft ? 'Publish' : 'Unpublish') + '</button>' +
        '<a class="btn-secondary" href="promo-form.html?id=' + p.id + '" aria-label="Edit ' + UI.esc(p.title) + '">Edit</a>' +
        '<button type="button" class="btn-danger del-btn" data-id="' + p.id + '" data-title="' + UI.esc(p.title) + '" aria-label="Delete ' + UI.esc(p.title) + '">Delete</button>' : '') +
      '</div></div></article>';
  }

  /** Lazy-load first-frame previews with IntersectionObserver (heavy media is never fetched off-screen). */
  function lazyFrames() {
    var vids = $grid.find('video.lazy-video').toArray();
    function loadOne(v) { v.preload = 'metadata'; v.src = v.getAttribute('data-src'); }
    if (!('IntersectionObserver' in window)) { vids.forEach(loadOne); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { loadOne(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '200px' });
    vids.forEach(function (v) { io.observe(v); });
  }

  function load() {
    $grid.attr('aria-busy', 'true').html(UI.skeletonCards(3));
    Api.get(CIVIC.EP.promos, { cache: true }).done(function (res) {
      var list = Api.items(res).filter(function (p) { return admin || UI.isPublished(p); });
      $grid.attr('aria-busy', 'false').html(list.length ? list.map(card).join('') : UI.emptyState('No promos yet', 'Check back soon.'));
      lazyFrames();
    }).fail(function (err) { $grid.attr('aria-busy', 'false'); UI.errorState($grid, err.message, load); });
  }

  $grid.on('click', '.pub-btn', function () {
    if (!Auth.isAdmin()) return;      // admin-only guard
    var $b = $(this), publish = String($b.data('pub')) === '0';
    UI.setBusy($b, true, 'Saving…');
    Api.patch(publish ? CIVIC.EP.promoPublish($b.data('id')) : CIVIC.EP.promoUnpublish($b.data('id'))).done(function () {
      UI.toast(publish ? 'Promo published.' : 'Promo unpublished.', 'success'); load();
    }).fail(function (err) { UI.toast(err.message, 'error'); UI.setBusy($b, false); });
  });
  $grid.on('click', '.del-btn', function () {
    if (!Auth.isAdmin()) return;
    var id = $(this).data('id');
    UI.confirm('Delete promo "' + $(this).data('title') + '"?', 'Delete', true).done(function () {
      Api.del(CIVIC.EP.promo(id)).done(function () { UI.toast('Promo deleted.', 'success'); load(); })
        .fail(function (err) { UI.toast(err.message, 'error'); });
    });
  });
  load();
});
