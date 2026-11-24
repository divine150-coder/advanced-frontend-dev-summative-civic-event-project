/** signup.js — Sign-up with strong password policy + live strength meter. */
Layout.ready(function () {
  var rules = [
    { id: 'len', test: function (p) { return p.length >= 8; } },
    { id: 'lower', test: function (p) { return /[a-z]/.test(p); } },
    { id: 'upper', test: function (p) { return /[A-Z]/.test(p); } },
    { id: 'num', test: function (p) { return /\d/.test(p); } },
    { id: 'special', test: function (p) { return /[^A-Za-z0-9]/.test(p); } }
  ];
  var labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  var colors = ['bg-slate-300', 'bg-red-600', 'bg-orange-500', 'bg-yellow-500', 'bg-green-600', 'bg-green-700'];

  function meter() {
    var p = $('#password').val(), score = 0;
    rules.forEach(function (r) {
      var ok = r.test(p); if (ok) score++;
      $('#rule-' + r.id).toggleClass('text-green-800', ok).toggleClass('text-slate-600', !ok)
        .find('.mark').text(ok ? '✓' : '○');
    });
    if (!p) score = 0;
    $('#pw-bar').attr('class', 'h-2 rounded transition-all ' + colors[score]).css('width', (score / 5 * 100) + '%');
    $('#pw-label').text(p ? labels[score] : '');
    return score === 5;
  }
  $('#password').on('input', meter);

  // Requirements + strength meter live in a floating panel: shown while the password field has focus, hidden otherwise
  // (like Instagram / Facebook). Keyboard users get it too because it follows focus.
  $('#password').on('focus', function () { meter(); $('#pw-popover').removeClass('hidden'); });
  $('#password').on('blur', function () { $('#pw-popover').addClass('hidden'); });
  $(document).on('keydown', function (e) { if (e.key === 'Escape') $('#pw-popover').addClass('hidden'); });

  $('#signup-form').on('submit', function (e) {
    e.preventDefault();
    var $err = $('#form-error').addClass('hidden');
    var name = $('#full_name').val().trim(), email = $('#email').val().trim(),
        pw = $('#password').val(), pw2 = $('#confirm_password').val();
    ['full_name', 'email', 'password', 'confirm_password'].forEach(function (f) { UI.fieldError($('#' + f), ''); });
    var ok = true;
    if (name.length < 2) { UI.fieldError($('#full_name'), 'Enter your full name.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.fieldError($('#email'), 'Enter a valid email address.'); ok = false; }
    if (!meter()) { UI.fieldError($('#password'), 'Password must be 8+ characters with upper & lower case, a number and a special character.'); ok = false; }
    if (pw !== pw2) { UI.fieldError($('#confirm_password'), 'Passwords do not match.'); ok = false; }
    if (!ok) { $('[aria-invalid="true"]').first().focus(); return; }

    var $btn = $('#signup-submit'); UI.setBusy($btn, true, 'Creating account…');
    Api.post(CIVIC.EP.register, { full_name: name, email: email, password: pw }, { auth: false }).done(function () {
      UI.flash('Account created! Please log in.', 'success');
      window.location.href = 'login.html';
    }).fail(function (err) {
      $err.removeClass('hidden').text(err.status === 409 ? 'That email is already registered. Try logging in instead.' : err.message);
      UI.setBusy($btn, false);
    });
  });
});
