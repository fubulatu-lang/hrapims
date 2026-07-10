# HRAPIMS v1.3.0

Hospital Records And Patient Information Management System.
Staff and administrators sign in by tapping their name and entering a
4-digit PIN — no typing usernames on a shared hospital tablet. Sessions
are real JWTs checked on every API call, not just a UI toggle.

This guide assumes you're doing everything from a phone browser. No
computer, no terminal, no app installs required.

---

## Part 1 — Create your database (Neon)

1. Open **neon.tech** in your phone browser → **Sign up** (Google/GitHub/email all work).
2. Tap **Create a project**. Give it any name (e.g. "hrapims"), pick a region close to you, tap **Create**.
3. You'll land on the project dashboard. Find **Connection Details** (sometimes under "Connect" or shown right on the dashboard).
4. There's a toggle/dropdown for **Pooled connection** — make sure that's selected (the hostname should contain `-pooler` in it).
5. Tap to reveal/copy the full connection string. It looks like:
   ```
   postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require
   ```
6. Paste it somewhere safe (Notes app) — you'll need it in Part 3.

---

## Part 2 — Put the code on GitHub

1. Open **github.com** → sign in (or sign up).
2. Tap the **+** icon (top right) → **New repository**.
3. Name it `hrapims`, leave it Public or Private (either works), don't check any of the "add a README" boxes, tap **Create repository**.
4. You'll be on an empty repo page with an **"uploading an existing file"** link — tap that.
5. This is the tricky part on mobile: file pickers don't always preserve folder structure. The most reliable method on a phone is to add each file individually with its full path as the filename:
   - Instead of "upload", go to **Add file → Create new file**.
   - In the filename box, type the full path, e.g. `api/index.js` — GitHub automatically creates the `api` folder for you.
   - Paste that file's contents into the big text box below.
   - Scroll down, tap **Commit new file**.
   - Repeat for every file listed below.

**Files to create (path → what to paste):**
- `package.json`
- `vercel.json`
- `.gitignore`
- `api/index.js`
- `server/src/index.js`
- `public/index.html`

(All six file contents are in the zip attached to this conversation — open each one, copy its contents, paste into the matching GitHub "Create new file" page.)

---

## Part 3 — Deploy (Vercel)

1. Open **vercel.com** → **Sign up** → choose **Continue with GitHub** (this links your accounts, so you can import repos directly).
2. Tap **Add New...** → **Project**.
3. Find `hrapims` in the list of repos → tap **Import**.
4. On the configuration screen, expand **Environment Variables** and add:
   - `DATABASE_URL` → the Neon connection string from Part 1
   - `JWT_SECRET` → any long random string (e.g. mash your keyboard for 40+ characters). This signs staff sessions — set it yourself so sign-ins survive redeploys; if you skip it, one gets generated for you automatically but everyone is signed out on every deploy.
5. Tap **Deploy**. Wait ~1 minute.
6. You'll get a URL like `hrapims-yourname.vercel.app` — open it.

You'll land on the sign-in screen. Tap **Vercel → your project → Logs** and look for a block that says `DEFAULT ADMIN ACCOUNT CREATED` with a **Name** and a **PIN** — that's your first login. Tap **Administrator** on the sign-in screen, tap **System Administrator**, enter that PIN. You'll be asked to set a real PIN immediately — do that, then use **Settings → Manage Staff** to add real staff and admin accounts (each gets their own temporary PIN, shown once, which you share with them directly).

---

## Confirming it actually works

Don't just trust a blank-looking success — test the real path:
1. Sign in as the default admin (see above) and set a new PIN.
2. Tap **+ New Patient** → fill in First Name, Last Name, Gender, Location → **Register Patient**.
3. If it saves and you're taken to the patient record, your Neon connection is confirmed working end-to-end.
4. Tap **Activity** — you should see a `CREATE` entry for the patient you just added, attributed to your name.

If something fails at this step, check Vercel → your project → **Logs** tab for the error message, and check that `DATABASE_URL` is exactly the pooled connection string from Neon (typos here are the most common cause of failure).

---

## Making changes later

Every time you edit a file in GitHub (even through the mobile "edit" pencil icon) and commit it, Vercel automatically redeploys — no extra step needed.

## About the login

This is a lightweight, real permission boundary (bcrypt-hashed PINs, JWT
sessions checked server-side on every request, account lockout after 5
failed attempts) — not just a UI toggle. What it deliberately does **not**
include: password-reset-by-email, audit-grade compliance certifications,
or multi-factor auth. If this app will hold real patient data, have
someone who owns your compliance requirements (HIPAA or your local
equivalent) review it before go-live.

