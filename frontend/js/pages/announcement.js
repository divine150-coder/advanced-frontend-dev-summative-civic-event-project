/** announcement.js — detail with an accessible custom audio player (play/pause, seek, time, volume) + transcript. */
Layout.ready(function () {
  var id = UI.param('id'), admin = Auth.isAdmin(), $root = $('#ann-root');
  if (!id) { UI.errorState($root, 'No announcement selected.'); return; }

  function load() {
    $root.attr('aria-busy', 'true').html(UI.skeletonRows(4));
    Api.get(CIVIC.EP.announcement(id)).done(function (res) {
      var a = Api.item(res);
      if (!admin && !UI.isPublished(a)) { UI.errorState($root, 'This announcement is not available.'); return; }
      render(a);
    }).fail(function (err) { $root.attr('aria-busy', 'false'); UI.errorState($root, err.message, load); });
  }

  function render(a) {
    document.title = a.title + ' · CivicEvents';
    var src = UI.assetUrl(a.audio_url || (UI.meta(a).audio_url));
    $root.attr('aria-busy', 'false').html(
      '<a href="announcements.html" class="text-green-800 underline text-sm">← Back to announcements</a>' +
      '<article class="card p-6 mt-3"><h1 class="text-3xl font-extrabold">' + UI.esc(a.title) + '</h1>' +
      '<p class="text-sm text-slate-700 mt-1">Published ' + UI.fmtDateTime(a.created_at) + '</p>' +
      '<div class="mt-5 bg-green-950 text-white rounded-xl p-4" role="group" aria-label="Audio player">' +
      // preload=metadata keeps it light; fallback text shown by browsers that cannot play the format
      '<audio id="audio" preload="metadata" src="' + UI.esc(src) + '">Your browser cannot play this audio. <a href="' + UI.esc(src) + '">Download the audio file</a> or read the transcript below.</audio>' +
      '<div class="flex items-center gap-3"><button id="pp" type="button" class="bg-amber-400 text-slate-900 rounded-full w-12 h-12 text-xl font-bold focus-ring" aria-label="Play">▶</button>' +
      '<div class="flex-1"><label for="seek" class="sr-only">Seek</label><input id="seek" type="range" min="0" max="100" value="0" step="0.1" class="w-full accent-amber-400" aria-valuetext="0:00 of 0:00"/>' +
      '<div class="flex justify-between text-xs mt-1" aria-hidden="true"><span id="cur">0:00</span><span id="dur">0:00</span></div></div></div>' +
      '<div class="flex items-center gap-2 mt-3 text-sm"><label for="vol">Volume</label><input id="vol" type="range" min="0" max="1" step="0.05" value="1" class="w-32 accent-amber-400"/>' +
      '<span id="a-err" class="text-red-200 ml-auto hidden" role="alert"></span></div></div>' +
      '<h2 class="text-lg font-bold mt-6">Transcript</h2>' +
      '<p class="mt-1 whitespace-pre-line text-slate-800">' + UI.esc(a.transcript || 'No transcript is available for this announcement yet. If you need one, please contact us using the details in the footer.') + '</p>' +
      (admin ? '<div class="mt-6"><a class="btn-primary" href="announcement-form.html?id=' + a.id + '">Edit</a></div>' : '') + '</article>');

    var au = document.getElementById('audio'), $pp = $('#pp'), $seek = $('#seek');
    function sync() {
      var d = au.duration || 0;
      $('#cur').text(UI.fmtClock(au.currentTime)); if (isFinite(au.duration)) $('#dur').text(UI.fmtClock(au.duration));
      $seek.val(d ? (au.currentTime / d) * 100 : 0).attr('aria-valuetext', UI.fmtClock(au.currentTime) + ' of ' + UI.fmtClock(d));
    }
    $pp.on('click', function () { if (au.paused) { au.play().catch(function () { $('#a-err').removeClass('hidden').text('Playback was blocked or the file is unavailable.'); }); } else au.pause(); });
    au.addEventListener('play', function () { $pp.text('❚❚').attr('aria-label', 'Pause'); });
    au.addEventListener('pause', function () { $pp.text('▶').attr('aria-label', 'Play'); });
    au.addEventListener('ended', function () { $pp.text('▶').attr('aria-label', 'Play'); });
    au.addEventListener('timeupdate', sync); au.addEventListener('loadedmetadata', sync);
    au.addEventListener('error', function () { $('#a-err').removeClass('hidden').text('Audio could not be loaded.'); });
    $seek.on('input', function () { var d = au.duration || 0; au.currentTime = (this.value / 100) * d; });
    $('#vol').on('input', function () { au.volume = parseFloat(this.value); });
    if (UI.param('autoplay') === '1') au.play().catch(function () { /* browsers may block autoplay; user can press Play */ });
  }
  load();
});
