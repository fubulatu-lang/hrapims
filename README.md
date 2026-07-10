# HRAPIMS v2.0.0

Hospital Records And Patient Information Management System.

This is a rebuild of the frontend as a proper React application (components,
hooks, context — no more single HTML file) with a temporary **pseudo
login**: tap "Staff" or "Administrator" and you're in, no password. The
backend already has real credential auth ready to switch on (bcrypt +
JWT + PIN sign-in) — see "About login" at the bottom.

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
