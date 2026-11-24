/**
 * registrations.js — helper for the signed-in user's event registrations.
 * Backend: POST /event-registrations/register {event_id}, POST /cancel {event_id}, GET /my-registrations.
 * Cancelling sets status='cancelled' (row is kept), so only status==='registered' counts as registered.
 */
var Reg = (function ($) {
  var ids = {};

  function eventIdOf(r) { return r.event_id || (r.event && r.event.id); }
  function active(r) { return !r.status || r.status === 'registered'; }

  /** Load (or reload) the user's registrations. Resolves with the ACTIVE ones. */
  function load() {
    return Api.get(CIVIC.EP.myRegistrations).then(function (res) {
      var list = Api.items(res).filter(active);
      ids = {};
      list.forEach(function (r) { var e = eventIdOf(r); if (e != null) ids[e] = true; });
      return list;
    });
  }
  function isRegistered(eventId) { return ids[eventId] === true; }

  function register(eventId) {
    return Api.post(CIVIC.EP.register_event, { event_id: eventId }).then(function (res) { ids[eventId] = true; return res; });
  }
  function cancel(eventId) {
    return Api.post(CIVIC.EP.cancel_event, { event_id: eventId }).then(function (res) { delete ids[eventId]; return res; });
  }
  return { load: load, isRegistered: isRegistered, register: register, cancel: cancel, eventIdOf: eventIdOf };
})(jQuery);
