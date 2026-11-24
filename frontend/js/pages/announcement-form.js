/** announcement-form.js — Create/edit announcement (ADMIN ONLY). Uploads audio as multipart field "audio". */
Layout.ready(function () {
  if (!Auth.isAdmin()) return;
  var id = UI.param('id'), editing = !!id;

  $('#form-title').text(editing ? 'Edit announcement' : 'New announcement');
  if (editing) {
    // Backend PUT only updates title/published — the audio file cannot be replaced, so hide the upload on edit.
    $('#audio-group').addClass('hidden');
    Api.get(CIVIC.EP.announcement(id)).done(function (res) {
      var a = Api.item(res); $('#title').val(a.title); $('#published').prop('checked', UI.isPublished(a));
    }).fail(function (err) { UI.errorState($('#form-wrap'), err.message); });
  }

  $('#audio').on('change', function () {
    var f = this.files[0]; var msg = UI.checkFile(f, CIVIC.AUDIO_EXTS, CIVIC.MAX_AUDIO_MB, 'Audio file');
    UI.fieldError($('#audio'), msg);
    if (msg) { this.value = ''; $('#audio-preview').addClass('hidden'); return; }
    if (f) {
      var url = URL.createObjectURL(f), a = new Audio(url);
      a.addEventListener('loadedmetadata', function () { $('#audio-info').text('Duration: ' + UI.fmtClock(a.duration)); });
      $('#audio-preview').attr('src', url).removeClass('hidden');
    }
  });

  $('#ann-form').on('submit', function (e) {
    e.preventDefault();
    var title = $('#title').val().trim(), file = $('#audio')[0].files[0];
    UI.fieldError($('#title'), ''); var ok = true;
    if (title.length < 3) { UI.fieldError($('#title'), 'Title must be at least 3 characters.'); ok = false; }
    if (!editing && !file) { UI.fieldError($('#audio'), 'Choose an audio file to upload.'); ok = false; }
    if ($('#audio').attr('aria-invalid') === 'true' && file) ok = false;
    if (!ok) { $('[aria-invalid="true"]').first().focus(); return; }

    var fd = new FormData();
    fd.append('title', title);
    fd.append('published', $('#published').is(':checked') ? 'true' : 'false');
    if (file && !editing) fd.append('audio', file);   // key must be "audio"

    var $b = $('#save-btn'), $bar = $('#progress'); UI.setBusy($b, true, 'Uploading…'); $bar.removeClass('hidden');
    Api.upload(editing ? 'PUT' : 'POST', editing ? CIVIC.EP.announcement(id) : CIVIC.EP.announcements, fd, function (p) {
      $bar.find('div').css('width', p + '%'); $bar.attr('aria-valuenow', p);
    }).done(function () {
      // Backend also creates a broadcast notification for new announcements.
      UI.flash(editing ? 'Announcement updated.' : 'Announcement created — a notification was sent to all users.', 'success');
      window.location.href = 'announcements.html';
    }).fail(function (err) { UI.toast(err.message, 'error'); UI.setBusy($b, false); $bar.addClass('hidden'); });
  });
});
