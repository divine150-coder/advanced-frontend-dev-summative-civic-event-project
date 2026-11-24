/** login.js — Login form. Stores token in sessionStorage (default) or localStorage ("Remember me"). */
Layout.ready(function () {
  var $form = $('#login-form'), $btn = $('#login-submit'), $err = $('#form-error');

  $form.on('submit', function (e) {
    e.preventDefault();
    $err.addClass('hidden').text('');
    var email = $('#email').val().trim(), password = $('#password').val();
    var ok = true;
    UI.fieldError($('#email'), ''); UI.fieldError($('#password'), '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.fieldError($('#email'), 'Enter a valid email address.'); ok = false; }
    if (!password) { UI.fieldError($('#password'), 'Enter your password.'); ok = false; }
    if (!ok) return;

    UI.setBusy($btn, true, 'Signing in…');
    Api.post(CIVIC.EP.login, { email: email, password: password }, { auth: false }).done(function (res) {
      var token = res.token || (res.data && res.data.token) || res.accessToken;
      var user = res.user || (res.data && res.data.user);
      if (!token || !user) { $err.removeClass('hidden').text('Unexpected response from the server (no token/user).'); UI.setBusy($btn, false); return; }
      Auth.save(token, user, $('#remember').is(':checked'));
      if (user.is_active === false || user.is_active === 0) { Auth.clear(); $err.removeClass('hidden').text('This account has been disabled. Contact an administrator.'); UI.setBusy($btn, false); return; }
      // Admins land on the Dashboard; normal users have no dashboard, so they land on Events.
      window.location.href = user.role === 'admin' ? 'dashboard.html' : 'events.html';
    }).fail(function (err) {
      var msg = err.status === 401 || err.status === 400 ? (err.message || 'Incorrect email or password.') : err.message;
      $err.removeClass('hidden').text(msg);
      UI.setBusy($btn, false);
    });
  });

  $('#toggle-pw').on('click', function () {
    var $p = $('#password'), show = $p.attr('type') === 'password';
    $p.attr('type', show ? 'text' : 'password'); $(this).text(show ? 'Hide' : 'Show').attr('aria-pressed', show);
  });
});
