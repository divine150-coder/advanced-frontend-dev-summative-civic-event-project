/**
 * api.js — thin jQuery wrapper around the backend.
 *  - Adds `Authorization: Bearer <token>` to protected requests.
 *  - 401 -> sign out + redirect to login. 403 -> friendly toast.
 *  - Normalises error messages (network / 4xx / 5xx).
 *  - Optional session cache for lists (opts.cache) that is invalidated by any write.
 *  - Tolerant response helpers (items/item/meta) so differing JSON envelopes still work.
 */
var Api = (function ($) {
  var CACHE_PREFIX = 'civic_cache:';

  function fullUrl(p) { return /^https?:/.test(p) ? p : CIVIC.API_BASE_URL + p; }

  function parse(text) { if (!text) return null; try { return JSON.parse(text); } catch (e) { return null; } }

  function errorMessage(xhr, body) {
    if (xhr.status === 0) return 'Network error: the server could not be reached. Check your connection and try again.';
    if (body) {
      // express-validator style: { message:'Validation failed', errors:[{field,message}] }
      if (Array.isArray(body.errors) && body.errors.length) return body.errors.map(function (e) { return e.message || e.msg || e; }).join(' ');
      if (typeof body.message === 'string') return body.message;
      if (typeof body.error === 'string') return body.error;
      if (body.error && body.error.message) return body.error.message;
      if (Array.isArray(body.errors)) return body.errors.map(function (e) { return e.msg || e.message || e; }).join(', ');
    }
    if (xhr.status === 403) return 'You do not have permission to do that. Contact an administrator if you think this is a mistake.';
    if (xhr.status === 404) return 'We could not find what you were looking for.';
    if (xhr.status >= 500) return 'The server ran into a problem (' + xhr.status + '). Please try again shortly.';
    return 'Request failed (' + xhr.status + ').';
  }

  function clearCache() {
    try {
      Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf(CACHE_PREFIX) === 0) sessionStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
  }

  /**
   * request(method, path, opts)
   * opts: data (object -> JSON body / query for GET), formData (FormData), onProgress(pct),
   *       auth:false (skip bearer + 401 sign-out, used by login/signup), cache:true (GET only)
   */
  function request(method, path, opts) {
    opts = opts || {};
    var d = $.Deferred();
    var token = Auth.getToken();
    var useAuth = opts.auth !== false;
    var cacheKey = null;

    if (method === 'GET' && opts.cache) {
      cacheKey = CACHE_PREFIX + fullUrl(path) + '?' + $.param(opts.data || {});
      try {
        var hit = sessionStorage.getItem(cacheKey);
        if (hit) { d.resolve(JSON.parse(hit)); return d.promise(); }
      } catch (e) { /* ignore */ }
    }

    var cfg = { url: fullUrl(path), method: method, dataType: 'text', headers: {} };
    if (useAuth && token) cfg.headers.Authorization = 'Bearer ' + token;

    if (opts.formData) {
      cfg.data = opts.formData; cfg.processData = false; cfg.contentType = false;
      if (opts.onProgress) {
        cfg.xhr = function () {
          var x = $.ajaxSettings.xhr();
          if (x.upload) x.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable) opts.onProgress(Math.round((e.loaded / e.total) * 100));
          });
          return x;
        };
      }
    } else if (opts.data !== undefined) {
      if (method === 'GET') cfg.data = opts.data;
      else { cfg.data = JSON.stringify(opts.data); cfg.contentType = 'application/json'; }
    }

    $.ajax(cfg).done(function (text) {
      var body = parse(text);
      if (cacheKey) { try { sessionStorage.setItem(cacheKey, JSON.stringify(body)); } catch (e) {} }
      if (method !== 'GET') clearCache();   // any write invalidates cached lists
      d.resolve(body);
    }).fail(function (xhr) {
      var body = parse(xhr.responseText);
      var msg = errorMessage(xhr, body);
      if (xhr.status === 401 && useAuth && token) {
        Auth.logout('Your session has expired. Please sign in again.');
      } else if (xhr.status === 403 && useAuth) {
        UI.toast(msg, 'error');
      }
      d.reject({ status: xhr.status, message: msg, body: body });
    });
    return d.promise();
  }

  /** First array found in a response: [..] | {data:[..]} | {data:{items:[..]}} | {events:[..]} ... */
  function items(res) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    var keys = ['data', 'items', 'results', 'rows'];
    for (var i = 0; i < keys.length; i++) {
      var v = res[keys[i]];
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object') { var inner = items(v); if (inner.length) return inner; }
    }
    for (var k in res) if (Array.isArray(res[k])) return res[k];
    return [];
  }

  /** Single record from { data: {...} } | { event: {...} } | {...} */
  function item(res) {
    if (!res || typeof res !== 'object') return res;
    if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data;
    var skip = { pagination: 1, meta: 1 };
    for (var k in res) if (res[k] && typeof res[k] === 'object' && !Array.isArray(res[k]) && !skip[k]) return res[k];
    return res;
  }

  /** Pagination info -> { page, totalPages, total } (best effort). */
  function pageInfo(res, limit, fallbackCount) {
    var m = (res && (res.pagination || res.meta || (res.data && res.data.pagination))) || res || {};
    var total = m.total || m.totalItems || m.total_items || m.count || null;
    var pages = m.totalPages || m.total_pages || m.pages || (total ? Math.ceil(total / limit) : null);
    return { page: m.page || m.currentPage || m.current_page || 1, totalPages: pages || 1, total: total || fallbackCount || 0 };
  }

  return {
    get: function (p, o) { return request('GET', p, o); },
    post: function (p, data, o) { return request('POST', p, $.extend({ data: data }, o)); },
    put: function (p, data, o) { return request('PUT', p, $.extend({ data: data }, o)); },
    patch: function (p, data, o) { return request('PATCH', p, $.extend({ data: data }, o)); },
    del: function (p, o) { return request('DELETE', p, o); },
    upload: function (method, p, formData, onProgress) { return request(method, p, { formData: formData, onProgress: onProgress }); },
    items: items, item: item, pageInfo: pageInfo, clearCache: clearCache
  };
})(jQuery);
