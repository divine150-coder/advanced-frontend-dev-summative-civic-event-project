/**
 * ui.js — shared UI helpers: escaping, formatting, toasts, skeletons, modals,
 * pagination, file validation and small state boxes (empty / error + retry).
 */
var UI = (function ($) {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function param(name) { return new URLSearchParams(window.location.search).get(name); }

  /** `metadata` may arrive as an object or a JSON string. */
  function meta(o) {
    var m = o && o.metadata;
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } }
    return m || {};
  }
  /** Turn a backend path like /uploads/events/x.jpg into an absolute URL. */
  function assetUrl(p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    return CIVIC.API_BASE_URL + (p.charAt(0) === '/' ? '' : '/') + p;
  }
  function isPublished(x) { return x.published === undefined || x.published === true || x.published === 1 || x.published === 'true' || x.published === '1'; }

  function fmtDateTime(v) {
    if (!v) return '—'; var d = new Date(v); if (isNaN(d)) return esc(v);
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
  function fmtDate(v) {
    if (!v) return '—'; var d = new Date(v); if (isNaN(d)) return esc(v);
    return d.toLocaleDateString([], { dateStyle: 'medium' });
  }
  function toLocalInput(v) { // ISO -> value for <input type="datetime-local">
    if (!v) return ''; var d = new Date(v); if (isNaN(d)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function timeAgo(v) {
    var d = new Date(v); if (isNaN(d)) return '';
    var s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }

  /* ---------- toasts ---------- */
  function toast(message, type) {
    var colors = { success: 'bg-green-800', error: 'bg-green-800', info: 'bg-slate-800' };
    var $region = $('#toast-region');
    if (!$region.length) $region = $('<div id="toast-region" class="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 max-w-sm" aria-live="polite" aria-atomic="false"></div>').appendTo('body');
    var $t = $('<div role="status" class="toast text-white text-sm rounded-lg shadow-lg px-4 py-3 ' + (colors[type] || colors.info) + '"></div>').text(message);
    $region.append($t);
    setTimeout(function () { $t.fadeOut(250, function () { $t.remove(); }); }, type === 'error' ? 7000 : 4000);
  }
  /** Message that survives a redirect (signup -> login, expired token -> login ...). */
  function flash(msg, type) { try { sessionStorage.setItem('civic_flash', JSON.stringify({ msg: msg, type: type || 'info' })); } catch (e) {} }
  function showFlash() {
    try {
      var f = JSON.parse(sessionStorage.getItem('civic_flash') || 'null');
      if (f) { sessionStorage.removeItem('civic_flash'); toast(f.msg, f.type); return f; }
    } catch (e) {}
    return null;
  }

  /* ---------- loading / empty / error states ---------- */
  function skeletonCards(n) {
    var html = '';
    for (var i = 0; i < (n || 6); i++) {
      html += '<div class="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-hidden="true">' +
        '<div class="skeleton h-40"></div><div class="p-4 space-y-3"><div class="skeleton h-5 w-3/4 rounded"></div>' +
        '<div class="skeleton h-4 w-1/2 rounded"></div><div class="skeleton h-4 w-full rounded"></div></div></div>';
    }
    return html;
  }
  function skeletonRows(n) {
    var html = '';
    for (var i = 0; i < (n || 4); i++) html += '<div class="skeleton h-14 rounded-lg mb-2" aria-hidden="true"></div>';
    return html;
  }
  function emptyState(title, text) {
    return '<div class="col-span-full text-center py-12 bg-white border border-dashed border-slate-300 rounded-xl">' +
      '<p class="text-lg font-semibold text-slate-800">' + esc(title) + '</p>' +
      (text ? '<p class="text-slate-600 mt-1">' + esc(text) + '</p>' : '') + '</div>';
  }
  /** Error box with a Retry button; `onRetry` is called when clicked. */
  function errorState($el, message, onRetry) {
    $el.html('<div class="col-span-full bg-red-50 border border-red-300 text-red-900 rounded-xl p-5" role="alert">' +
      '<p class="font-semibold">Something went wrong</p><p class="mt-1">' + esc(message) + '</p>' +
      (onRetry ? '<button type="button" class="retry-btn mt-3 btn-secondary">Try again</button>' : '') + '</div>');
    if (onRetry) $el.find('.retry-btn').on('click', onRetry);
  }

  /* ---------- pagination ---------- */
  function pagination($el, page, totalPages, onChange) {
    $el.empty();
    if (totalPages <= 1) return;
    var html = '<ul class="flex flex-wrap items-center justify-center gap-1">';
    html += '<li><button type="button" class="pg btn-secondary" data-p="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' aria-label="Previous page">‹ Prev</button></li>';
    var start = Math.max(1, page - 2), end = Math.min(totalPages, page + 2);
    for (var i = start; i <= end; i++) {
      html += '<li><button type="button" class="pg ' + (i === page ? 'btn-primary' : 'btn-secondary') + '" data-p="' + i + '"' +
        (i === page ? ' aria-current="page"' : '') + ' aria-label="Page ' + i + '">' + i + '</button></li>';
    }
    html += '<li><button type="button" class="pg btn-secondary" data-p="' + (page + 1) + '"' + (page >= totalPages ? ' disabled' : '') + ' aria-label="Next page">Next ›</button></li></ul>';
    $el.html('<nav aria-label="Pagination">' + html + '</nav>');
    $el.find('.pg').on('click', function () { onChange(parseInt($(this).data('p'), 10)); });
  }

  /* ---------- modal (focus-managed, Esc to close) ---------- */
  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    var prev = document.activeElement;
    var id = 'modal-' + Date.now();
    var $o = $('<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"></div>');
    var $d = $('<div role="dialog" aria-modal="true" aria-labelledby="' + id + '" class="bg-white rounded-xl shadow-xl w-full ' + (opts.wide ? 'max-w-2xl' : 'max-w-md') + ' max-h-[90vh] overflow-auto p-6"></div>');
    $d.html('<div class="flex items-start justify-between gap-4 mb-3"><h2 id="' + id + '" class="text-xl font-bold">' + esc(title) + '</h2>' +
      '<button type="button" class="modal-x text-slate-600 hover:text-slate-900 text-2xl leading-none rounded focus-ring" aria-label="Close dialog">×</button></div>' +
      '<div class="modal-body">' + bodyHtml + '</div>');
    $o.append($d).appendTo('body');
    function close() { $(document).off('keydown.modal'); $o.remove(); if (prev && prev.focus) prev.focus(); }
    $o.on('click', function (e) { if (e.target === $o[0]) close(); });
    $d.find('.modal-x').on('click', close);
    $(document).on('keydown.modal', function (e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // simple focus trap
        var f = $d.find('a[href],button:not([disabled]),input,select,textarea').filter(':visible');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    setTimeout(function () { ($d.find('[autofocus]')[0] || $d.find('.modal-x')[0]).focus(); }, 0);
    return { $el: $d, close: close };
  }

  /** Confirmation dialog -> jQuery promise (resolved on OK, rejected on cancel). */
  function confirmDialog(message, okText, danger) {
    var d = $.Deferred();
    var m = modal('Please confirm', '<p class="text-slate-700">' + esc(message) + '</p>' +
      '<div class="flex justify-end gap-2 mt-6"><button type="button" class="c-cancel btn-secondary">Cancel</button>' +
      '<button type="button" class="c-ok ' + (danger ? 'btn-danger' : 'btn-primary') + '" autofocus>' + esc(okText || 'Confirm') + '</button></div>');
    m.$el.find('.c-cancel').on('click', function () { m.close(); d.reject(); });
    m.$el.find('.c-ok').on('click', function () { m.close(); d.resolve(); });
    return d.promise();
  }

  /* ---------- file validation (before uploading) ---------- */
  /** Checks extension + size using the same rules as the backend's multer config. Returns '' when OK. */
  function checkFile(file, exts, maxMB, label) {
    if (!file) return '';
    var m = /\.[^.]+$/.exec(file.name.toLowerCase());
    if (!m || exts.indexOf(m[0]) === -1) return (label || 'File') + ' must be one of: ' + exts.join(', ') + '.';
    if (file.size > maxMB * 1024 * 1024) return (label || 'File') + ' is too large (' + (file.size / 1048576).toFixed(1) + ' MB). Maximum is ' + maxMB + ' MB.';
    return '';
  }

  /** Inline field error helper (links error text to the input for screen readers). */
  function fieldError($input, msg) {
    var id = $input.attr('id') + '-err';
    $('#' + id).remove();
    $input.removeAttr('aria-invalid aria-describedby');
    if (msg) {
      $input.attr({ 'aria-invalid': 'true', 'aria-describedby': id }).addClass('border-red-600');
      $('<p id="' + id + '" class="text-sm text-red-700 mt-1" role="alert"></p>').text(msg).insertAfter($input);
    } else { $input.removeClass('border-red-600'); }
  }

  function setBusy($btn, busy, text) {
    if (busy) { $btn.data('label', $btn.text()).prop('disabled', true).attr('aria-busy', 'true').text(text || 'Working…'); }
    else { $btn.prop('disabled', false).removeAttr('aria-busy').text($btn.data('label') || $btn.text()); }
  }

  return { esc: esc, param: param, meta: meta, assetUrl: assetUrl, isPublished: isPublished,
    fmtDateTime: fmtDateTime, fmtDate: fmtDate, toLocalInput: toLocalInput, fmtClock: fmtClock, timeAgo: timeAgo,
    toast: toast, flash: flash, showFlash: showFlash, skeletonCards: skeletonCards, skeletonRows: skeletonRows,
    emptyState: emptyState, errorState: errorState, pagination: pagination, modal: modal, confirm: confirmDialog,
    checkFile: checkFile, fieldError: fieldError, setBusy: setBusy };
})(jQuery);
