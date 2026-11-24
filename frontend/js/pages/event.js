/**
 * event.js — Event detail: info, register/cancel, registrants (ADMIN ONLY), feedback + average rating.
 */
Layout.ready(function (user) {
  var admin = Auth.isAdmin(), id = UI.param('id'), ev = null;
  var $root = $('#event-root');
  if (!id) { UI.errorState($root, 'No event selected.'); return; }

  function stars(n) { n = Math.round(n || 0); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

  function loadEvent() {
    $root.attr('aria-busy', 'true').html('<div class="skeleton h-64 rounded-xl mb-4"></div>' + UI.skeletonRows(3));
    var regP = admin ? $.Deferred().resolve().promise() : Reg.load().then(null, function () { return $.Deferred().resolve().promise(); });
    $.when(Api.get(CIVIC.EP.event(id)), regP).done(function (res) {
      ev = Api.item(res);
      if (!admin && !UI.isPublished(ev)) { UI.errorState($root, 'This event is not available.'); return; }
      render();
      loadFeedback();
      if (admin) loadRegistrants();
    }).fail(function (err) { $root.attr('aria-busy', 'false'); UI.errorState($root, err.message, loadEvent); });
  }

  function render() {
    document.title = ev.title + ' · CivicEvents';
    var img = UI.meta(ev).image_url, reg = Reg.isRegistered(ev.id);
    var map = ev.location ? 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(ev.location) : '';
    var actions = '';
    if (admin) actions = '<a class="btn-primary" href="event-form.html?id=' + ev.id + '">Edit event</a><button type="button" id="del-event" class="btn-danger">Delete</button>';
    else actions = reg ? '<button type="button" id="cancel-btn" class="btn-secondary">Cancel registration</button>' : '<button type="button" id="reg-btn" class="btn-primary">Register for this event</button>';

    $root.attr('aria-busy', 'false').html(
      '<a href="events.html" class="text-green-800 underline text-sm">← Back to events</a>' +
      '<article class="card overflow-hidden mt-3">' +
      (img ? '<img src="' + UI.esc(UI.assetUrl(img)) + '" alt="Image for ' + UI.esc(ev.title) + '" class="w-full max-h-96 object-cover bg-slate-200"/>' : '') +
      '<div class="p-6"><h1 class="text-3xl font-extrabold">' + UI.esc(ev.title) +
      (!UI.isPublished(ev) ? ' <span class="badge bg-amber-200 text-amber-900">Draft</span>' : '') +
      (reg ? ' <span class="badge bg-green-100 text-green-900">Registered</span>' : '') + '</h1>' +
      '<dl class="grid sm:grid-cols-2 gap-3 mt-4 text-sm"><div><dt class="font-semibold">Starts</dt><dd>' + UI.fmtDateTime(ev.starts_at) + '</dd></div>' +
      '<div><dt class="font-semibold">Ends</dt><dd>' + UI.fmtDateTime(ev.ends_at) + '</dd></div>' +
      '<div class="sm:col-span-2"><dt class="font-semibold">Location</dt><dd>' + UI.esc(ev.location || 'TBA') +
      (map ? ' — <a class="text-green-800 underline" target="_blank" rel="noopener" href="' + map + '">View on map<span class="sr-only"> (opens in new tab)</span></a>' : '') + '</dd></div></dl>' +
      '<h2 class="text-lg font-bold mt-6">About this event</h2><p class="mt-1 whitespace-pre-line text-slate-800">' + UI.esc(ev.description || 'No description provided.') + '</p>' +
      '<div class="flex flex-wrap gap-2 mt-6">' + actions + '</div></div></article>' +
      '<section class="card p-6 mt-6" aria-labelledby="fb-h"><h2 id="fb-h" class="text-xl font-bold">Feedback</h2><div id="feedback-root" class="mt-3">' + UI.skeletonRows(2) + '</div></section>' +
      (admin ? '<section class="card p-6 mt-6" aria-labelledby="rg-h"><h2 id="rg-h" class="text-xl font-bold">Registrants <span class="text-slate-600 text-base" id="rg-count"></span></h2><div id="registrants-root" class="mt-3">' + UI.skeletonRows(2) + '</div></section>' : ''));
  }

  /* ----- register / cancel / delete ----- */
  $root.on('click', '#reg-btn', function () {
    var $b = $(this); UI.setBusy($b, true, 'Registering…');
    Reg.register(ev.id).done(function () { UI.toast('You are registered!', 'success'); loadEvent(); })
      .fail(function (err) { UI.toast(err.status === 409 ? 'The server says you are already registered (a cancelled registration cannot be re-opened).' : err.message, 'error'); UI.setBusy($b, false); });
  });
  $root.on('click', '#cancel-btn', function () {
    var $b = $(this);
    UI.confirm('Cancel your registration?', 'Cancel registration', true).done(function () {
      UI.setBusy($b, true, 'Cancelling…');
      Reg.cancel(ev.id).done(function () { UI.toast('Registration cancelled.', 'success'); loadEvent(); })
        .fail(function (err) { UI.toast(err.message, 'error'); UI.setBusy($b, false); });
    });
  });
  $root.on('click', '#del-event', function () {
    if (!Auth.isAdmin()) return;   // admin-only guard
    UI.confirm('Delete this event permanently?', 'Delete', true).done(function () {
      Api.del(CIVIC.EP.event(ev.id)).done(function () { UI.flash('Event deleted.', 'success'); window.location.href = 'events.html'; })
        .fail(function (err) { UI.toast(err.message, 'error'); });
    });
  });

  /* ----- registrants (ADMIN ONLY: section is only rendered for admins, API also enforces) ----- */
  function loadRegistrants() {
    Api.get(CIVIC.EP.eventAttendees(id)).done(function (res) {
      var list = Api.items(res);
      $('#rg-count').text('(' + list.length + ')');
      if (!list.length) { $('#registrants-root').html('<p class="text-slate-600">No one has registered yet.</p>'); return; }
      $('#registrants-root').html('<div class="overflow-x-auto"><table class="w-full text-sm text-left"><caption class="sr-only">Registrants</caption><thead><tr class="border-b border-slate-300"><th scope="col" class="py-2 pr-4">Name</th><th scope="col" class="py-2 pr-4">Email</th><th scope="col" class="py-2">Registered</th></tr></thead><tbody>' +
        list.map(function (r) {
          var u = r.user || r.User || r;
          return '<tr class="border-b border-slate-100"><td class="py-2 pr-4">' + UI.esc(u.full_name || r.full_name || ('User #' + r.user_id)) + '</td><td class="py-2 pr-4">' + UI.esc(u.email || r.email || '—') + '</td><td class="py-2">' + UI.fmtDateTime(r.created_at || r.registered_at) + '</td></tr>';
        }).join('') + '</tbody></table></div>');
    }).fail(function (err) { UI.errorState($('#registrants-root'), err.message, loadRegistrants); });
  }

  /* ----- feedback -----
   * Backend rules: GET /event-feedback/event/:id is ADMIN ONLY (full list + average rating);
   * normal users can only read their own feedback (GET /my-feedback), create one (POST) and edit it (PUT).
   * One feedback per user per event is enforced by the database (409 on duplicates). */
  var myFb = null;

  function loadFeedback() {
    if (admin) {
      Api.get(CIVIC.EP.eventFeedback(id)).done(function (res) {
        var list = Api.items(res);
        var avg = list.length ? list.reduce(function (s, f) { return s + Number(f.rating || 0); }, 0) / list.length : 0;
        $('#feedback-root').html(summary(avg, list.length) + listHtml(list));
      }).fail(function (err) { UI.errorState($('#feedback-root'), err.message, loadFeedback); });
      return;
    }
    Api.get(CIVIC.EP.myFeedback).done(function (res) {
      myFb = Api.items(res).filter(function (f) { return String(f.event_id) === String(id); })[0] || null;
      var html = '<p class="text-sm text-slate-700 mb-3">The average rating and everyone\'s comments are visible to administrators only.</p>';
      if (myFb) {
        html += '<div class="border border-slate-200 rounded-lg p-3"><p class="font-semibold">Your feedback</p>' + listHtml([myFb]) + '<button type="button" id="edit-fb" class="btn-secondary mt-2">Edit my feedback</button></div>';
      } else html += feedbackForm();
      $('#feedback-root').html(html);
    }).fail(function (err) { UI.errorState($('#feedback-root'), err.message, loadFeedback); });
  }

  function summary(avg, n) {
    return '<p class="text-lg" aria-label="Average rating ' + Number(avg).toFixed(1) + ' out of 5 from ' + n + ' reviews"><span class="text-amber-700 text-2xl" aria-hidden="true">' + stars(avg) + '</span> <strong>' + (n ? Number(avg).toFixed(1) : '–') + '</strong> <span class="text-slate-600">(' + n + ' review' + (n === 1 ? '' : 's') + ')</span></p>';
  }
  function listHtml(list) {
    return '<ul class="mt-3 space-y-3">' + (list.length ? list.map(function (f) {
      return '<li class="border border-slate-200 rounded-lg p-3"><p><span class="text-amber-700" aria-hidden="true">' + stars(f.rating) + '</span><span class="sr-only">' + f.rating + ' out of 5 stars</span> <strong class="ml-1">' + UI.esc(f.full_name || 'You') + '</strong> <span class="text-xs text-slate-600">' + UI.fmtDate(f.created_at) + '</span></p>' +
        (f.comment ? '<p class="mt-1 text-slate-800">' + UI.esc(f.comment) + '</p>' : '') + '</li>';
    }).join('') : '<li class="text-slate-600">No feedback yet.</li>') + '</ul>';
  }

  function feedbackForm(existing) {
    var s = '';
    for (var i = 5; i >= 1; i--) s += '<input type="radio" id="star' + i + '" name="rating" value="' + i + '"' + (existing && Number(existing.rating) === i ? ' checked' : '') + '><label for="star' + i + '" title="' + i + ' star' + (i > 1 ? 's' : '') + '"><span aria-hidden="true">★</span><span class="sr-only">' + i + ' star' + (i > 1 ? 's' : '') + '</span></label>';
    return '<form id="feedback-form" class="mt-4 border border-slate-200 rounded-lg p-4" novalidate><fieldset><legend class="label">Your rating</legend><div class="stars-row">' + s + '</div></fieldset>' +
      '<div class="mt-3"><label for="fb-comment" class="label">Comment</label><textarea id="fb-comment" rows="3" maxlength="500" class="field">' + UI.esc(existing ? existing.comment : '') + '</textarea></div>' +
      '<p id="fb-err" class="text-red-800 text-sm mt-2 hidden" role="alert"></p><button type="submit" class="btn-primary mt-3">' + (existing ? 'Update feedback' : 'Submit feedback') + '</button></form>';
  }
  $root.on('click', '#edit-fb', function () { $('#feedback-root').html(feedbackForm(myFb)); $('#fb-comment').focus(); });

  $root.on('submit', '#feedback-form', function (e) {
    e.preventDefault();
    var rating = parseInt($('input[name=rating]:checked').val(), 10), comment = $('#fb-comment').val().trim();
    var $err = $('#fb-err').addClass('hidden');
    if (!rating) { $err.removeClass('hidden').text('Please choose a rating from 1 to 5.'); return; }
    var $b = $(this).find('button[type=submit]'); UI.setBusy($b, true, 'Sending…');
    var req = myFb ? Api.put(CIVIC.EP.feedbackItem(myFb.id), { rating: rating, comment: comment })
                   : Api.post(CIVIC.EP.feedback, { event_id: ev.id, rating: rating, comment: comment });
    req.done(function () { UI.toast(myFb ? 'Feedback updated.' : 'Thanks for your feedback!', 'success'); loadFeedback(); })
      .fail(function (err) {
        $err.removeClass('hidden').text(err.status === 409 ? 'You have already submitted feedback for this event. Use "Edit my feedback" instead.' : err.message);
        UI.setBusy($b, false);
      });
  });

  loadEvent();
});
