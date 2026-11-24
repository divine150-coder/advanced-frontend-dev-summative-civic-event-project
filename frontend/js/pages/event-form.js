/**
 * event-form.js — Create / edit event (ADMIN ONLY page: <body data-access="admin">).
 * Sends multipart/form-data: title, description, location, starts_at, ends_at, image (backend has no 'published' field for events).
 */
Layout.ready(function () {
  if (!Auth.isAdmin()) return;                       // belt-and-braces guard
  var id = UI.param('id'), editing = !!id;
  var existingImage = '';

  $('#form-title').text(editing ? 'Edit event' : 'Create event');
  document.title = (editing ? 'Edit' : 'Create') + ' event · CivicEvents';

  if (editing) {
    $('#form-wrap').attr('aria-busy', 'true');
    Api.get(CIVIC.EP.event(id)).done(function (res) {
      var ev = Api.item(res);
      $('#title').val(ev.title); $('#description').val(ev.description); $('#location').val(ev.location);
      $('#starts_at').val(UI.toLocalInput(ev.starts_at)); $('#ends_at').val(UI.toLocalInput(ev.ends_at));
      existingImage = UI.meta(ev).image_url || '';
      if (existingImage) $('#preview').attr('src', UI.assetUrl(existingImage)).removeClass('hidden');
      $('#form-wrap').attr('aria-busy', 'false');
    }).fail(function (err) { UI.errorState($('#form-wrap'), err.message); });
  }

  // Image preview + client-side type/size check before upload
  $('#image').on('change', function () {
    var f = this.files[0];
    var msg = UI.checkFile(f, CIVIC.IMAGE_EXTS, CIVIC.MAX_IMAGE_MB, 'Image');
    UI.fieldError($('#image'), msg);
    if (msg) { this.value = ''; $('#preview').addClass('hidden'); return; }
    if (f) { $('#preview').attr('src', URL.createObjectURL(f)).removeClass('hidden'); }
  });

  $('#event-form').on('submit', function (e) {
    e.preventDefault();
    var f = { title: $('#title').val().trim(), description: $('#description').val().trim(), location: $('#location').val().trim(), s: $('#starts_at').val(), e: $('#ends_at').val() };
    ['title', 'description', 'location', 'starts_at', 'ends_at'].forEach(function (k) { UI.fieldError($('#' + k), ''); });
    var ok = true;
    if (f.title.length < 3) { UI.fieldError($('#title'), 'Title must be at least 3 characters.'); ok = false; }
    if (!f.description) { UI.fieldError($('#description'), 'Add a description.'); ok = false; }
    if (!f.location) { UI.fieldError($('#location'), 'Add a location.'); ok = false; }
    if (!f.s) { UI.fieldError($('#starts_at'), 'Choose a start date and time.'); ok = false; }
    if (!f.e) { UI.fieldError($('#ends_at'), 'Choose an end date and time.'); ok = false; }
    if (f.s && f.e && new Date(f.e) <= new Date(f.s)) { UI.fieldError($('#ends_at'), 'End must be after the start.'); ok = false; }
    if ($('#image').attr('aria-invalid')) ok = false;
    if (!ok) { $('[aria-invalid="true"]').first().focus(); return; }

    var fd = new FormData();
    fd.append('title', f.title); fd.append('description', f.description); fd.append('location', f.location);
    fd.append('starts_at', new Date(f.s).toISOString()); fd.append('ends_at', new Date(f.e).toISOString());
    var file = $('#image')[0].files[0]; if (file) fd.append('image', file);   // key must be "image"

    var $b = $('#save-btn'), $bar = $('#progress');
    UI.setBusy($b, true, 'Saving…'); $bar.removeClass('hidden');
    Api.upload(editing ? 'PUT' : 'POST', editing ? CIVIC.EP.event(id) : CIVIC.EP.events, fd, function (pct) {
      $bar.find('div').css('width', pct + '%'); $bar.attr('aria-valuenow', pct);
    }).done(function (res) {
      var saved = Api.item(res) || {};
      UI.flash(editing ? 'Event updated successfully.' : 'Event created successfully.', 'success');
      var newId = saved.id || id;
      window.location.href = newId ? 'event.html?id=' + newId : 'events.html';
    }).fail(function (err) {
      UI.toast(err.message, 'error'); UI.setBusy($b, false); $bar.addClass('hidden');
    });
  });
});
