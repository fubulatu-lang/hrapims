# HRAPIMS v2.1.2

Hospital Records And Patient Information Management System.

## v2.1.2 — the actual, confirmed root cause (this one was mine)

Thank you for sending the Vercel logs — that made this a five-minute fix
instead of another guess. The real error, straight from the logs:

```
ReferenceError: module is not defined in ES module scope
This file is being treated as an ES module because it has a '.js' file
extension and '/var/task/package.json' contains "type": "module".
    at file:///var/task/api/index.js:3:1
Node.js process exited with exit status: 1.
```

`package.json` had `"type": "module"` set (added during the React
rewrite, out of habit more than necessity). That setting tells Node to
treat **every** `.js` file in the project as an ES module — including
`api/index.js` and `server/src/index.js`, which are written in CommonJS
(`require(...)` / `module.exports`). Node refused to load them at all,
the serverless function crashed on startup, and **every single API
route** 500'd — which matches your screenshot exactly: patients, staff,
activity, settings, check-unique, all of it, all at once. This explains
everything since the `public/index.html` fix — that fix was correct and
necessary, it just uncovered this second, unrelated bug once the real
frontend started actually calling the API.

**The fix:** removed `"type": "module"` from `package.json`. It turns
out nothing in this project actually needed it — Vite transpiles
`vite.config.js` internally regardless of that setting, and the built
frontend files are loaded via `<script type="module">` in the HTML,
which is governed by the browser, not Node's `package.json`. So this was
a pure footgun with no upside; removing it costs nothing and fixes the
crash. The backend stays CommonJS (`require`/`module.exports`), same as
it's been since v1.0.0.

No files need deleting this time — just replace `package.json`,
`api/index.js`, and `server/src/index.js` with the versions in this zip
(or sync the whole thing) and redeploy.

### Also: ID uniqueness lookups now check as-you-type
Continued from v2.1.1 — see that section below for details.

---

## Everything below is unchanged from v2.1.1



Found it. It wasn't the server code at all — **your repo had a leftover
`public/index.html` file from the very first single-HTML-file version of
this app** (before the React rewrite). Vite copies everything in
`public/` into the build output as a final step, and since that file is
also named `index.html`, it was **silently overwriting the real,
React-built `index.html`** every single deploy. You've been running the
old pre-React app this whole time — none of the fixes from v1.3.0 through
v2.1.0 ever actually reached your browser, because the entry file itself
was stale. That's why every fix looked like it "didn't work."

**Action required on your end:** deleting a file from a zip re-upload
doesn't delete it from GitHub — your mobile sync tool appears to only
add/overwrite files. You need to explicitly delete two files from the
GitHub repo itself:
- `public/index.html` (the stale file causing this whole issue)
- `src/hooks/useDarkMode.js` (superseded by `useTheme.js` back in v2.1.0,
  never actually used anymore — harmless but dead; delete it for hygiene)

Easiest way on a phone: open each file on github.com, tap the trash-can /
"..." → Delete file, commit. Then re-sync this corrected project on top
(or just push these files) and redeploy.

### Identification lookups now check as you type, not just on blur
Both **National ID** and **Insurance Number** trigger the duplicate-check
against the database the instant the last digit is typed (10th for
National ID, 8th for Insurance) — you no longer have to tap out of the
field to see a duplicate warning. Leaving the field still re-checks as a
safety net (e.g. after pasting a number in).

---

## Everything below is unchanged from v2.1.0



### Fixed: the three "Request failed 500" errors

All three (Recent Activity, Register Patient, Create Staff) were reported
against a live deployment I have no access to (no logs, no DB), so this
is a best-effort fix based on careful code review rather than a
reproduced-and-confirmed fix. Two changes:

1. **Every 500 response now includes the real error message** instead of
   a generic "Server error" — if anything still fails, the app itself
   will show you the actual cause, which turns "mysterious 500" into an
   actionable message. If you hit this again, please paste back exactly
   what the red alert says.
2. **Hardened the folder-number sequence** (`getNextFolderNumber` in
   `server/src/index.js`): it previously crashed with an unhelpful error
   if the `system_settings` row was ever missing (e.g. a race on first
   deploy). It now self-heals instead of throwing — this was the most
   likely culprit for patient registration failing for *everyone*
   (staff and admin alike), since both hit this exact function.
3. Fixed a real, confirmed bug: three dormant auth routes (`DELETE
   /api/staff/:id`, `/api/auth/me`, `/api/auth/change-pin`) referenced
   `req.staff.id` even though `req.staff` is never set while real login
   is switched off — any of them would have thrown. Now guarded.

### Staff no longer see Activity Logs
Removed from the bottom nav, the dashboard's "Recent Activity" card, and
the request is never even made for a staff session (not just hidden —
skipped entirely).

### Swipe navigation + transitions
Swipe left/right anywhere on Home, Patients, Search, Activity (admin), or
Settings to move between them — same order as the bottom nav. Tapping the
bottom nav directly still works and animates the same way. Sub-pages
(patient detail/form, staff management) get a fade-and-rise entrance
instead, and don't participate in swipe (so swiping while editing a form
doesn't accidentally navigate away). Modals and dropdown menus now have
entrance animations too, and every tappable element eases back after a
press instead of snapping.

### Insurance Number, National ID, Next of Kin Contact
- **Insurance Number**: digits only, capped at 8, checkmark on the 8th
  digit, blur triggers a database uniqueness check.
- **National ID**: prefilled with `GHA-`, dashes auto-insert as you type
  (`GHA-XXXXXXXXX-X`), checkmark at the 10th digit, blur triggers a
  uniqueness check. If nothing is typed, the prefilled `GHA-` is discarded
  (saved as empty, not as the literal string).
- **Next of Kin Contact**: now the exact same component as the Phone
  field (`PhoneField`, in `src/components/patients/`) — same 10-digit
  checkmark behavior, literally shared code so they can't drift apart.

### Date of Birth
Type `DD-MM-YYYY` directly (dashes auto-insert), with a muted placeholder
showing the format — or tap the calendar button beside the field to use
the native date picker. Both paths feed the same underlying value.
(`src/components/ui/DateField.jsx`)

### Draft persistence + Clear button
The New Patient form now autosaves to `localStorage` as you type. Closing
the tab/app by accident and coming back restores exactly what was there.
A **Clear** button next to Register/Update wipes the form (with a
confirmation) — on the New Patient form this also clears the saved draft.

### Haptics & Touch Sounds (Settings)
Five strength levels each, 0 = off:
- **Haptics**: Off / Light (60ms) / Medium (90ms) / Strong (120ms) / Max
  (160ms), via the Vibration API. No-ops silently on devices/browsers
  that don't support it (e.g. iOS Safari).
- **Touch Sounds**: Off / Quiet / Medium / Loud / Max — a short
  synthesized click (Web Audio oscillator), not an audio file, so there's
  nothing extra to host or ship.

Both fire automatically on every Button/IconButton/Fab/nav tap — no page
had to be touched to wire this in (`useFeedback` hook, called from inside
the shared components themselves).

### Midnight mode
A third theme alongside Light/Dark: true black (`#000`) backgrounds for
OLED/AMOLED screens — saves battery and gives real blacks instead of dark
grey. Cycle through all three from the dashboard's theme icon, or pick
directly in Settings → Appearance.

### Staff can merge patients
The Merge Patients card in Settings is no longer admin-only.

### Shared sort control
Patients list and Search results use the exact same `SortControl`
component and the exact same backend query parameters (`sortBy`,
`sortDir` — Name / Recently Added / Age / Folder Number, ascending or
descending). The choice is remembered across both screens.

---

## Everything below is unchanged from v2.0.0

This is still a **pseudo login** (tap Staff or Administrator, no
credentials) — see "About login" further down. Deployment (Neon +
Vercel), the React component architecture, and the backend's business
logic are all as described previously.

---

## What changed from v1.3.0

- **Frontend rebuilt in React** (Vite build, ~40 small files instead of one
  giant HTML file): a real component library (`src/components/ui`), custom
  hooks, and context-based session/navigation state. See the architecture
  notes below.
- **Login is now a pseudo tap-to-enter** (Staff card / Administrator card,
  no PIN) instead of the PIN-pad flow. That flow had a real bug — the
  bootstrap admin PIN is 6 digits but the PIN pad only accepted 4 and
  auto-submitted, so nobody could ever log in. Rather than patch a PIN
  flow you're not ready to use yet, it's disabled: tapping a role just
  sets it client-side. The API itself is open (no `Authorization` header
  required) to match — it's not pretending to be secure right now.
- Backend routes, database schema, and business logic are unchanged from
  v1.3.0. The `staff` table, bcrypt PIN hashing, and JWT session code are
  all still there, just not wired into the request path.

---

## Deploying

The build step means the phone-only "paste each file into GitHub" workflow
from earlier versions changes slightly: **Vercel runs the build for you**
(`npm install && vite build`) — you still don't need a computer, you just
need all these files in the repo (package.json's `build` script points at
Vite). If creating ~40 individual files through GitHub's mobile editor is
too tedious, the zip attached to this conversation can be extracted and
pushed as a whole from a laptop, or uploaded via GitHub's web "Add file →
Upload files" (which does preserve folder structure when you drag a
folder in from a desktop browser).

1. **Neon** (database) and **Vercel** (hosting) setup is identical to
   before — see the v1.3.0 instructions if you're starting fresh:
   create a Neon project, grab the **pooled** connection string, create a
   GitHub repo, import it into Vercel.
2. In Vercel's project settings, set the environment variable:
   - `DATABASE_URL` → your Neon pooled connection string
   - `JWT_SECRET` → optional for now (a random one is generated if you
     skip it) — it's only used by the dormant PIN-login code, but
     setting it now means sessions will survive redeploys once you
     switch real login on later.
3. Deploy. Vercel builds the React app into `dist/` and serves it as
   static files, with `/api/*` routed to the Express backend
   (`api/index.js` → `server/src/index.js`).
4. Open the URL — you'll land on the role-select screen. Tap **Staff** or
   **Administrator** to go straight in.

---

## Project structure

```
src/
  main.jsx              — Vite/React entry point
  App.jsx               — wires SessionProvider, decides Login vs AppShell
  AppShell.jsx           — bottom nav + FAB + current page
  index.css              — Material 3 design tokens + component styles
  context/
    SessionContext.jsx   — pseudo role state (see docstring for the
                            real-auth upgrade path)
    NavigationContext.jsx — lightweight in-app routing (see docstring for
                            why this isn't react-router, and how to swap it)
  hooks/
    useApiQuery.js       — shared data-fetching (loading/error/refetch)
    useDobAgeSync.js     — the DOB ⇄ Age bidirectional-fill rule
    useDarkMode.js, useDebounce.js
  lib/
    api.js               — the one place fetch() is called
    format.js             — titleCase, initials, date helpers
  components/
    ui/                  — the reusable component library (see below)
    patients/            — PatientCard, DobAgeFields
  pages/                 — one file per screen
server/src/index.js       — Express API (unchanged logic from v1.3.0)
```

---

## Component architecture

Every screen is built from a small, shared component library rather than
one-off markup, so validation states, spacing, and accessibility behavior
can't drift between pages. The library lives in `src/components/ui/` and
is imported as a single barrel: `import { Button, TextField, Card } from
'../components/ui'`.

| Component | Purpose |
|---|---|
| `Button` / `IconButton` | Action primitives. Real `<button>`s underneath — every native prop (onClick, type, aria-*, ref) passes through. |
| `TextField` / `Select` | The **one** place the red-glow-error pattern is implemented. Pages pass an `error` string; the component handles the outline, the message, `aria-invalid`, and `aria-describedby`. No page ever touches error styling directly. |
| `Card` / `CardTitle` | Elevated / outlined / filled surface containers. |
| `Chip` | Status badges (Deleted, Locked, Non-Insured, etc). |
| `Avatar` | Initials-based avatar, used for both patients and staff. |
| `TopBar` / `BackButton` | Consistent app bar: title, subtitle, leading/trailing slots. |
| `BottomNav` | 5-item M3 navigation bar; active state driven by `aria-current="page"`. |
| `Fab` | Single primary action per screen (New Patient). |
| `Modal` | Handles focus-on-open, focus-return-on-close, Escape-to-close, and overlay click — every modal in the app gets this for free. |
| `Menu` / `useMenu` | Anchored dropdown for per-row actions (kebab menus). |
| `Alert` / `EmptyState` / `Spinner` | Status, empty, and loading states — used identically on every page. |

### Props / API design

```jsx
// Button — variant + size drive the whole visual language
<Button variant="filled" icon="check_circle" onClick={save}>Save</Button>
<Button variant="danger" loading={isDeleting} onClick={onDelete}>Delete</Button>

// TextField — validation is just a prop, not DOM manipulation
<TextField
  label="First Name"
  required
  value={firstName}
  onChange={setFirstName}
  onBlur={(e) => validateField('firstName', e.target.value)}
  error={errors.firstName}
/>

// Modal — accessible by default
<Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Staff Account" icon="person_add">
  ...
</Modal>

// Menu — anchor it to whatever triggered it
const menu = useMenu();
<IconButton icon="more_vert" label="More actions" onClick={menu.openMenu} />
<Menu anchorEl={menu.anchorEl} onClose={menu.closeMenu} items={[
  { label: 'Edit', icon: 'edit', onClick: onEdit },
  { label: 'Delete', icon: 'delete', danger: true, onClick: onDelete },
]} />
```

### Loading / empty / error states

Every page that fetches data follows the same shape via `useApiQuery`:

```jsx
const { data, loading, error, refetch } = useApiQuery('/patients?limit=20');
if (loading) return <Spinner label="Loading patients" />;
if (error) return <Alert variant="error">{error}</Alert>;
if (data.patients.length === 0) return <EmptyState icon="inbox" title="No patients yet" />;
```

No page hand-rolls a spinner or writes its own "no results" markup — the
three states are visually and behaviorally identical everywhere.

### Accessibility choices worth knowing about

- Every icon-only control (`IconButton`, `Fab`) requires a `label` prop
  that becomes its `aria-label` — there's no way to render one without an
  accessible name.
- `TextField`/`Select` wire `aria-invalid` and `aria-describedby` to the
  error/helper text automatically.
- `Modal` traps Escape, moves focus in on open and back to the trigger on
  close, and marks itself `role="dialog"` / `aria-modal`.
- Focus rings (`:focus-visible`) are visible for keyboard users everywhere
  without showing on mouse clicks.
- `prefers-reduced-motion` disables the skeleton/pulse/shake animations.
- `Alert` uses `role="alert"` for errors/warnings (interrupts screen
  readers) and `role="status"` for success/info (announced politely).

### Best practices this follows (and a couple of honest trade-offs)

- **Controlled components everywhere.** No `document.getElementById`,
  no manual class toggling — validation state is React state, rendered
  declaratively through `error` props.
- **One data-fetching pattern** (`useApiQuery`) instead of each page
  writing its own `useEffect` + try/catch.
- **Barrel exports** for the UI kit so imports stay short and the
  internal file layout can change without touching every page.
- **Trade-off:** navigation is a small custom context, not react-router.
  That's a deliberate choice for a 9-screen kiosk-style tool with no need
  for deep-linkable URLs — `NavigationContext.jsx` explains exactly what
  to swap if that changes.
- **Trade-off:** no design-system dependency (MUI, Chakra, etc). The CSS
  is hand-written Material 3 tokens in plain CSS, which keeps the bundle
  tiny and dependency count low, at the cost of not getting a component
  library's accessibility testing for free — worth revisiting if the app
  grows well past its current scope.

---

## About login

**Right now:** tapping Staff or Administrator sets a role in
`localStorage` and nothing else. There are no credentials, and the API
does not check this value — it's a UI mode switch, not a security
boundary. Do not use this build with real patient data.

**When you're ready for real login:** the backend already has it —
`server/src/index.js` has a `staff` table (bcrypt-hashed PINs), account
lockout after 5 failed attempts, JWT sessions, and admin-only staff
management endpoints, all fully built and tested, just not enforced (see
the comments around `app.use('/api', authenticate)` near the top of the
route definitions — uncommenting that line and the `requireAdmin` guards
turns it back on). On the frontend, `SessionContext.jsx` is the single
file that needs to change: `login()` would call `/api/auth/login` and
store a real token instead of just a role string, and `lib/api.js` would
attach it as an `Authorization` header. No page component needs to know
the difference — this is exactly why the session state was kept behind a
hook instead of scattered through the app.
