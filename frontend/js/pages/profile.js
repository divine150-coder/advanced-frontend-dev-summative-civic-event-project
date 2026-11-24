/** profile.js — view/update own profile. Only full_name and email are editable; role & is_active are read-only. */
Layout.ready(function (user) {
  function showInfo(u) {
    $('#p-role').text(u.role || '—'); $('#p-active').text(u.is_active === false || u.is_active === 0 ? 'Disabled' : 'Active');
    $('#p-id').text(u.id);
  }
  $('#full_name').val(user.full_name); $('#email').val(user.email || ''); showInfo(user);

  // Refresh from the API (so email/is_active are current)
  Api.get(CIVIC.EP.profile).done(function (res) {
    var u = Api.item(res); if (!u) return;
    $('#full_name').val(u.full_name); $('#email').val(u.email); showInfo(u);
    Auth.updateUser({ full_name: u.full_name, email: u.email, is_active: u.is_active });
  });

  $('#profile-form').on('submit', function (e) {
    e.preventDefault();
    var name = $('#full_name').val().trim(), email = $('#email').val().trim(), ok = true;
    UI.fieldError($('#full_name'), ''); UI.fieldError($('#email'), '');
    if (name.length < 2) { UI.fieldError($('#full_name'), 'Enter your full name.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.fieldError($('#email'), 'Enter a valid email address.'); ok = false; }
    if (!ok) return;
    var $b = $('#save-btn'); UI.setBusy($b, true, 'Saving…');
    // Role / is_active are deliberately NOT sent.
    Api.patch(CIVIC.EP.profile, { full_name: name, email: email }).done(function () {
      Auth.updateUser({ full_name: name, email: email });
      UI.toast('Profile updated.', 'success'); UI.setBusy($b, false);
      $('#profile-btn span:last').text(name);
    }).fail(function (err) {
      if (err.status === 409) UI.fieldError($('#email'), 'That email address is already used by another account. Please choose a different one.');
      else UI.toast(err.message, 'error');
      UI.setBusy($b, false);
    });
  });
});
