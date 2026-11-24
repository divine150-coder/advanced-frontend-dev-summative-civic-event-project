/**
 * config.js — single place to configure the backend connection.
 *
 * API_BASE_URL: the provided backend listens on http://localhost:4000 (see backend/README.md).
 * Change it here, OR override it at runtime from the browser console:
 *     localStorage.setItem('civic_api_base', 'https://my-backend.example.com')
 *
 * EP: every endpoint path used by the app, mapped from backend/src/routes/*.routes.js.
 * Upload limits mirror backend/src/middlewares/upload.middleware.js (multer).
 */
(function () {
  var stored = null;
  try { stored = localStorage.getItem('civic_api_base'); } catch (e) { /* storage blocked */ }

  window.CIVIC = {
    API_BASE_URL: (stored || 'http://localhost:4000').replace(/\/+$/, ''),
    PAGE_SIZE: 9,

    // File rules enforced by the backend (checked client-side first so users get instant feedback)
    IMAGE_EXTS: ['.jpg', '.jpeg', '.png', '.gif'], MAX_IMAGE_MB: 2,
    AUDIO_EXTS: ['.mp3', '.wav', '.m4a', '.ogg'], MAX_AUDIO_MB: 5,
    VIDEO_EXTS: ['.mp4', '.mov', '.avi', '.mkv'], MAX_VIDEO_MB: 8,

    EP: {
      login: '/api/auth/login',
      register: '/api/auth/signup',

      users: '/api/users',                                              // admin
      user: function (id) { return '/api/users/' + id; },               // admin
      userEnable: function (id) { return '/api/users/' + id + '/enable'; },   // admin, PATCH
      userDisable: function (id) { return '/api/users/' + id + '/disable'; }, // admin, PATCH
      profile: '/api/users/profile/me',                                 // GET / PATCH own profile

      events: '/api/events',
      event: function (id) { return '/api/events/' + id; },

      register_event: '/api/event-registrations/register',              // POST { event_id }
      cancel_event: '/api/event-registrations/cancel',                  // POST { event_id }
      myRegistrations: '/api/event-registrations/my-registrations',
      eventAttendees: function (eventId) { return '/api/event-registrations/event/' + eventId + '/attendees'; }, // admin

      feedback: '/api/event-feedback',                                  // POST { event_id, rating, comment }
      feedbackItem: function (id) { return '/api/event-feedback/' + id; },     // PUT own feedback
      myFeedback: '/api/event-feedback/my-feedback',
      eventFeedback: function (eventId) { return '/api/event-feedback/event/' + eventId; }, // admin only

      announcements: '/api/announcements',
      announcement: function (id) { return '/api/announcements/' + id; },
      announcementPublish: function (id) { return '/api/announcements/' + id + '/publish'; },
      announcementUnpublish: function (id) { return '/api/announcements/' + id + '/unpublish'; },

      promos: '/api/promos',
      promo: function (id) { return '/api/promos/' + id; },
      promoPublish: function (id) { return '/api/promos/' + id + '/publish'; },
      promoUnpublish: function (id) { return '/api/promos/' + id + '/unpublish'; },

      notifications: '/api/notifications',
      notification: function (id) { return '/api/notifications/' + id; },  // DELETE = admin only

      dashboard: '/api/dashboard/admin'
    }
  };
})();
