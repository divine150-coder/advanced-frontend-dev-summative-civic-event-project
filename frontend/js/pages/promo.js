/** promo.js — promo detail: HTML5 video with a captions <track> (on by default) + text transcript. */
Layout.ready(function () {
  var id = UI.param('id'), admin = Auth.isAdmin(), $root = $('#promo-root');
  if (!id) { UI.errorState($root, 'No promo selected.'); return; }

  function vttFromText(text) {
    function ts(s) { var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return [h, m, x].map(function (n) { return String(n).padStart(2, '0'); }).join(':') + '.000'; }
    var out = 'WEBVTT\n\n';
    text.split(/\n+/).filter(function (l) { return l.trim(); }).forEach(function (l, i) { out += ts(i * 4) + ' --> ' + ts(i * 4 + 4) + '\n' + l.trim() + '\n\n'; });
    return URL.createObjectURL(new Blob([out], { type: 'text/vtt' }));
  }

  function load() {
    $root.attr('aria-busy', 'true').html('<div class="skeleton h-72 rounded-xl"></div>');
    Api.get(CIVIC.EP.promo(id)).done(function (res) {
      var p = Api.item(res);
      if (!admin && !UI.isPublished(p)) { UI.errorState($root, 'This promo is not available.'); return; }
      render(p);
    }).fail(function (err) { $root.attr('aria-busy', 'false'); UI.errorState($root, err.message, load); });
  }

  function render(p) {
    document.title = p.title + ' · CivicEvents';
    var src = UI.assetUrl(p.video_url), cap = UI.assetUrl(p.caption_url);
    // Fallback: no caption file from the backend but we have caption_text -> build a WebVTT track in the browser
    // (one cue per line, 4 s each) so the <track> still exists and can be toggled with the CC button.
    if (!cap && p.caption_text) cap = vttFromText(p.caption_text);
    var poster = UI.assetUrl(p.thumbnail_url || UI.meta(p).thumbnail_url);
    $root.attr('aria-busy', 'false').html(
      '<a href="promos.html" class="text-green-800 underline text-sm">← Back to promos</a>' +
      '<article class="card p-6 mt-3"><h1 class="text-3xl font-extrabold">' + UI.esc(p.title) + '</h1>' +
      '<p class="mt-2 text-slate-800">' + UI.esc(p.description || '') + '</p>' +
      '<div class="mt-5 bg-black rounded-xl overflow-hidden">' +
      // preload="metadata": the full video is only fetched when the user presses play
      '<video id="video" controls preload="metadata" playsinline class="w-full max-h-[70vh]" ' + (poster ? 'poster="' + UI.esc(poster) + '"' : '') + ' aria-label="' + UI.esc(p.title) + '">' +
      '<source src="' + UI.esc(src) + '">' +
      (cap ? '<track kind="captions" src="' + UI.esc(cap) + '" srclang="en" label="English" default>' : '') +
      'Your browser cannot play this video. <a href="' + UI.esc(src) + '">Download the video</a>.</video></div>' +
      '<p id="v-err" class="text-red-700 mt-2 hidden" role="alert">The video could not be loaded.</p>' +
      '<p class="text-sm text-slate-700 mt-2">' + (cap ? 'Captions are on by default — use the CC button in the player to toggle them.' : 'No caption file is available for this video; see the transcript below.') + '</p>' +
      '<h2 class="text-lg font-bold mt-6">Transcript / description</h2>' +
      '<p class="mt-1 whitespace-pre-line text-slate-800">' + UI.esc(p.caption_text || p.transcript || 'No transcript provided.') + '</p>' +
      (admin ? '<div class="mt-6"><a class="btn-primary" href="promo-form.html?id=' + p.id + '">Edit promo</a></div>' : '') + '</article>');

    var v = document.getElementById('video');
    v.addEventListener('error', function () { $('#v-err').removeClass('hidden'); }, true);
    // make sure captions are showing when a track exists
    if (v.textTracks && v.textTracks.length) { v.textTracks[0].mode = 'showing'; }
  }
  load();
});
