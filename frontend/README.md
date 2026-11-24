# CivicEvents+ — Frontend

Accessible, responsive frontend for the CivicEvents+ portal, built with **HTML, Tailwind CSS and jQuery only**. Tailwind is pre-compiled into `css/tailwind.css` and jQuery is bundled in `js/vendor/`, so the app works offline with no build step. It consumes the provided Node/Express + PostgreSQL backend in `../backend`.

## 1. Run the backend (provided)
Follow `backend/README.md`. In short:

```bash
# 1. create the database in PostgreSQL:  CREATE DATABASE "civic-events-db";
# 2. create the tables (run from the backend folder, with your own credentials)
cd backend
export DB_USER=<user> DB_PASSWORD=<password> DB_NAME=civic-events-db DB_HOST=localhost DB_PORT=5432
psql -U $DB_USER -d $DB_NAME -h $DB_HOST -p $DB_PORT -f ./migrations/001_create_tables.sql
# 3. put the same credentials + JWT_SECRET in backend/.env
npm install
npm run dev          # -> http://localhost:4000  (health check: http://localhost:4000/health)
```

### Create an admin account
The sign-up form always creates a normal `user`. To get an admin, either:
- register normally, then in psql run `UPDATE users SET role='admin' WHERE email='you@example.com';`, **or**
- call the API directly (Postman collection included): `POST /api/auth/signup` with `{ "full_name": "...", "email": "...", "password": "Str0ng!Pass", "role": "admin" }`.

Log out and back in afterwards so the token/user in the browser carry the new role.

## 2. Run the frontend
1. **Backend URL** — `js/config.js` → `API_BASE_URL: 'http://localhost:4000'` (change if your backend uses another host/port). It can also be overridden at runtime: `localStorage.setItem('civic_api_base','http://localhost:4000')`.
2. **Serve the folder over HTTP** (not `file://`):
   ```bash
   cd frontend
   python3 -m http.server 8080      # or: npx serve .  /  VS Code "Live Server"
   ```
3. Open <http://localhost:8080>. The backend already enables CORS for all origins. (No internet is needed for styling.)

**Environment variables:** the frontend needs none — the only setting is `API_BASE_URL` above. The backend's `.env` holds `DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME, JWT_SECRET` (tokens expire after 1 hour; the frontend signs the user out with a message when that happens).

## 3. How the frontend maps to the API (`js/config.js`)

| Feature | Endpoint(s) |
|---|---|
| Sign up / Login | `POST /api/auth/signup`, `POST /api/auth/login` → `{ data: { token, user } }` |
| Own profile | `GET` / `PATCH /api/users/profile/me` (409 on duplicate email) |
| Users (admin) | `GET /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id/enable` \| `/disable` |
| Events | `GET /api/events` (all events; search, date/location filters and pagination are done client-side), `GET/POST/PUT/DELETE /api/events[/:id]` — multipart, file key `image` (jpg/jpeg/png/gif, ≤ 2 MB) |
| Registration | `POST /api/event-registrations/register` `{event_id}`, `POST .../cancel` `{event_id}`, `GET .../my-registrations`, `GET .../event/:id/attendees` (admin) |
| Feedback | `POST /api/event-feedback`, `PUT /api/event-feedback/:id`, `GET .../my-feedback`, `GET .../event/:id` (**admin only** — gives the list and average rating) |
| Announcements | `GET/POST/PUT/DELETE /api/announcements[/:id]` (multipart, file key `audio`: mp3/wav/m4a/ogg ≤ 5 MB), `PATCH .../:id/publish` \| `/unpublish` |
| Promos | `GET/POST/PUT/DELETE /api/promos[/:id]` (multipart, key `video`: mp4/mov/avi/mkv ≤ 8 MB, plus required `caption_text`), `PATCH .../publish` \| `/unpublish` |
| Notifications | `GET /api/notifications`, `DELETE /api/notifications/:id` (admin) |
| Dashboard | `GET /api/dashboard/admin` |

### Backend behaviours the UI is designed around
- **No `published` field editing for events**, and no transcript or duration fields for announcements. The UI therefore shows no event publish toggle; audio length is read from the audio file itself; the announcement transcript area shows a "not available" message.
- **Editing an announcement** only changes the title and published state (the API's PUT does not replace the audio file).
- **Feedback lists are admin-only** on the API, so normal users see/edit their *own* feedback (one per event, enforced by the database → 409) and administrators see everyone's feedback with the average rating.
- **Cancelling a registration** keeps the row with `status='cancelled'`, and the API answers 409 if the user tries to register again — the UI explains this.
- **Notifications** are created by the backend when an event / announcement / promo is added; there is no create route, so admins manage them with Delete. The API's `read` flag is shared by all users, so the "unread" state is kept per user in `localStorage` (optimistic, instant).

## 4. Project structure
```
frontend/
  *.html                 one file per page (login, signup, events, event, event-form, announcements, ...)
  css/tailwind.css       compiled Tailwind (committed). Rebuild: npx tailwindcss@3 -i ./src/input.css -o ./css/tailwind.css --minify
  tailwind.config.js, src/input.css   Tailwind build inputs
  js/vendor/             jQuery 3.7.1 (local copy)
  css/styles.css         buttons, fields, skeletons, focus styles (deep-green theme)
  js/config.js           API base URL, endpoint map, upload rules
  js/auth.js             token storage, current user, ROLE GUARDS
  js/api.js              jQuery AJAX wrapper (bearer header, 401/403/network handling, cache)
  js/ui.js               toasts, modals, pagination, skeletons, validation helpers
  js/layout.js           header/footer, global search, notification bell + drawer, guard runner
  js/registrations.js    register / cancel helper
  js/pages/*.js          one script per page
```

## 5. Role-based access (where the guards are)
- **`js/auth.js` → `Auth.guard(access)`** — page-level guard. Each page declares `<body data-access="guest|user|admin">`; `layout.js` runs the guard before any page script. `admin` pages (dashboard, users, event/announcement/promo forms) send normal users to Events with a message; signed-out visitors go to Login; expired tokens sign out with a message.
- **`js/layout.js`** — admin-only nav links (Dashboard, Users) are only rendered when `Auth.isAdmin()`.
- **`js/pages/*.js`** — admin-only controls (New / Edit / Delete, publish toggles, attendees list, notification delete, enable/disable users, feedback list + average) are only rendered for admins and each handler re-checks `Auth.isAdmin()`. Comments mark each spot.
- **`js/api.js`** — `401` → sign out and redirect to login; `403` → "no permission" toast.
- Frontend checks are UX only; the backend (`authenticate` / `authorize(['admin'])`) is the real security boundary.

## 6. Token storage
Default: `sessionStorage` (cleared when the tab closes). With **"Keep me signed in"**: `localStorage` (persists, but readable by any script on the origin if XSS occurs — the documented trade-off).

## 7. Features
Sign up (strength meter + policy) · login · global search · notification bell, drawer and inbox with deep links · events (search, date/location filters, pagination, image upload with preview, register/cancel, feedback, admin attendees) · audio announcements (accessible custom player) · promo videos with captions track + transcript · admin dashboard with charts (auto-refresh) and sidebar · user management (enable/disable, no role changes) · profile (409 email conflict handling) · skeleton loaders, toasts, confirm dialogs, upload progress, client-side file validation, retry on errors.

## 8. Accessibility
Skip link, semantic landmarks, labelled fields with `aria-invalid`/`aria-describedby`, `aria-live` regions, focus-managed modals and drawer (Esc closes), keyboard-operable media controls, captions, alt text, reduced-motion support, high-contrast deep-green palette.
