/** promo-form.js — Create/edit promo (ADMIN ONLY). Uploads video as multipart field "video" + caption_text. */
Layout.ready(function () {
  if (!Auth.isAdmin()) return;
  var id = UI.param('id'), editing = !!id;

  $('#form-title').text(editing ? 'Edit promo' : 'New promo');
  if (editing) {
    $('#video-hint').text('Leave empty to keep the current video.');
    Api.get(CIVIC.EP.promo(id)).done(function (res) {
      var p = Api.item(res); $('#title').val(p.title); $('#description').val(p.description || '');
      $('#caption_text').val(p.caption_text || ''); $('#published').prop('checked', UI.isPublished(p));
    }).fail(function (err) { UI.errorState($('#form-wrap'), err.message); });
  }

  $('#video').on('change', function () {
    var f = this.files[0], msg = UI.checkFile(f, CIVIC.VIDEO_EXTS, CIVIC.MAX_VIDEO_MB, 'Video');
    UI.fieldError($('#video'), msg);
    if (msg) { this.value = ''; $('#video-preview').addClass('hidden'); return; }
    if (f) $('#video-preview').attr('src', URL.createObjectURL(f)).removeClass('hidden');
  });

  $('#promo-form').on('submit', function (e) {
    e.preventDefault();
    var title = $('#title').val().trim(), file = $('#video')[0].files[0];
    ['title', 'description', 'caption_text', 'video'].forEach(function (k) { if (k !== 'video' || !file) UI.fieldError($('#' + k), ''); });
    var ok = true;
    if (title.length < 3) { UI.fieldError($('#title'), 'Title must be at least 3 characters.'); ok = false; }
    if (!$('#description').val().trim()) { UI.fieldError($('#description'), 'Add a short description.'); ok = false; }
    if (!$('#caption_text').val().trim()) { UI.fieldError($('#caption_text'), 'Caption text is required.'); ok = false; }
    if (!editing && !file) { UI.fieldError($('#video'), 'Choose a video file to upload.'); ok = false; }
    if (!ok) { $('[aria-invalid="true"]').first().focus(); return; }

    var fd = new FormData();
    fd.append('title', title); fd.append('description', $('#description').val().trim());
    fd.append('caption_text', $('#caption_text').val().trim());
    if (editing) fd.append('published', $('#published').is(':checked') ? 'true' : 'false');   // PUT accepts `published`
    if (file) fd.append('video', file);               // key must be "video"

    var $b = $('#save-btn'), $bar = $('#progress'); UI.setBusy($b, true, 'Uploading…'); $bar.removeClass('hidden');
    Api.upload(editing ? 'PUT' : 'POST', editing ? CIVIC.EP.promo(id) : CIVIC.EP.promos, fd, function (p) {
      $bar.find('div').css('width', p + '%'); $bar.attr('aria-valuenow', p);
    }).done(function (res) {
      var saved = Api.item(res) || {}, want = $('#published').is(':checked');
      // POST always creates a published promo, so a new promo that should be hidden is unpublished right after.
      var after = (editing || want) ? $.Deferred().resolve().promise() : Api.patch(CIVIC.EP.promoUnpublish(saved.id));
      after.always(function () { UI.flash(editing ? 'Promo updated.' : 'Promo created — a notification was sent to all users.', 'success'); window.location.href = 'promos.html'; });
    }).fail(function (err) { UI.toast(err.message, 'error'); UI.setBusy($b, false); $bar.addClass('hidden'); });
  });
});
