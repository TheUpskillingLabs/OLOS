# OLOS Environments

Three environments: **local**, **dev**, and **prod**. Local and dev share the same Supabase database. Prod is isolated.

---

## The Three Environments

| | Local | Dev | Prod |
|---|---|---|---|
| **URL** | `http://localhost:3000` | Vercel preview (auto-deployed from `dev` branch) | `https://olos.theupskillinglabs.org` |
| **Git branch** | any | `dev` | `main` |
| **Supabase project** | `cethihabtddiujzayaxe` (OLOS-dev) | `cethihabtddiujzayaxe` (OLOS-dev) | `cdbgkgkjnomjnpicaxqe` (OLOS-prod) |
| **Env file** | `.env.development.local` | Vercel env vars (dev) | Vercel env vars (prod) |

Local and dev intentionally share the same Supabase project so that data seeded or tested locally is immediately visible on the dev Vercel deployment.

---

## Logging In

**Local (`localhost:3000`)**
```bash
npm run dev
```
Sign in at `http://localhost:3000/login` with a Google account that has a row in the dev `participants` table.

**Dev (Vercel)**
Open the Vercel preview URL for the `dev` branch. Sign in with Google — same dev Supabase, same participant rows.

**Prod (`olos.theupskillinglabs.org`)**
Open `https://olos.theupskillinglabs.org/login`. Sign in with Google. Your account must have a row in the *prod* `participants` table — dev data does not carry over.

> If someone can authenticate (Google accepts the login) but lands on `/register`, their email is missing from the `participants` table for that environment. Add the row in Supabase Studio, or send them an invitation from the admin panel.

---

## All Test Data Goes in Dev

**Never use prod to test features.** All seeding, dummy data, invitation testing, and role experiments belong in the dev Supabase project (`cethihabtddiujzayaxe`).

Prod contains real participant data. Mistakes there are hard to undo.

To diagnose or inspect DB state, use the diagnostic script (always targets prod via `.env.production.local`):
```bash
node scripts/check-auth-rows.mjs
node scripts/check-auth-rows.mjs --email someone@example.com
```

---

## Env Files

All `.env*.local` files are git-ignored. Each developer needs to create them manually.

### `.env.development.local` — used by `npm run dev` and local testing
```bash
# Supabase (OLOS-dev)
NEXT_PUBLIC_SUPABASE_URL=https://cethihabtddiujzayaxe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev anon key>
SUPABASE_SERVICE_ROLE_KEY=<dev service role key>

# Anthropic
ANTHROPIC_API_KEY=<your key>

# Owner accounts
OWNER_EMAILS=hq@theupskillinglabs.org,brendan@withlevy.com

# Resend
RESEND_API_KEY=<resend key>
RESEND_FROM_EMAIL=hq@enroll.theupskillinglabs.org

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `.env.production.local` — used by `scripts/check-auth-rows.mjs` and any local prod debugging
```bash
# Supabase (OLOS-prod)
NEXT_PUBLIC_SUPABASE_URL=https://cdbgkgkjnomjnpicaxqe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon key>
SUPABASE_SERVICE_ROLE_KEY=<prod service role key>

# Anthropic
ANTHROPIC_API_KEY=<your key>

# Owner accounts
OWNER_EMAILS=hq@theupskillinglabs.org,brendan@withlevy.com

# Resend
RESEND_API_KEY=<resend key>
RESEND_FROM_EMAIL=hq@enroll.theupskillinglabs.org

# App URL
NEXT_PUBLIC_APP_URL=https://olos.theupskillinglabs.org
```

Keys are in 1Password (or ask Madhu). Do not commit either file — they are git-ignored.

### Vercel env vars
Vercel holds the live values for both deployments. To update them: **Vercel dashboard → OLOS project → Settings → Environment Variables**. Set scope to `Preview` for dev values and `Production` for prod values. Redeploy after changes take effect.

---

## Merging Dev → Main

All work happens on `dev` (or feature branches that merge into `dev`). Main is prod — only merge when the feature is tested and ready.

```bash
# 1. Make sure dev is up to date and tests pass
git checkout dev
git pull origin dev

# 2. Switch to main and pull latest
git checkout main
git pull origin main

# 3. Merge dev into main
git merge dev --no-ff -m "merge: dev → main (<brief description>)"

# 4. Push
git push origin main

# 5. Return to dev
git checkout dev
```

`--no-ff` preserves the merge commit so the history shows clearly when each batch of dev work landed in prod.

> **After merging:** if the merge includes new migrations, apply them to the prod Supabase project (see below).

---

## Database Migrations

Migrations live in `supabase/migrations/` and are numbered sequentially (`00001_`, `00002_`, …). They are the source of truth for the database schema — never make schema changes directly in Supabase Studio without also writing the equivalent migration file.

### Writing a migration

```bash
# Create the next migration file
touch supabase/migrations/000XX_short_description.sql
```

Write plain SQL. Include any `GRANT` statements if you're adding new tables (see `00015_grant_role_privileges.sql` for the pattern — or rely on the `ALTER DEFAULT PRIVILEGES` that migration set, which covers all future tables automatically).

### Applying to dev

```bash
# Applies all unapplied migrations to the dev Supabase project
supabase db push --linked
```

Or paste the SQL directly into **Supabase Studio → SQL Editor** for the dev project.

### Applying to prod

Migrations are **not** applied to prod automatically on deploy. After merging to `main`, apply any new migration files manually:

1. Open **Supabase Studio → SQL Editor** for the prod project (`cdbgkgkjnomjnpicaxqe`)
2. Paste and run each new migration file in order
3. Verify the change took effect before considering the deploy complete

Alternatively, if the Supabase CLI is linked to prod:
```bash
SUPABASE_DB_PASSWORD=<prod db password> supabase db push --linked
```

### Checking which migrations have been applied

Supabase tracks applied migrations in the `supabase_migrations.schema_migrations` table (`supabase_migrations` is a schema, not a table). To see what's live on prod, run this in Supabase Studio → SQL Editor:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

`version` is the numeric prefix of the migration filename. Compare against the files in `supabase/migrations/` — any file not in that list hasn't been applied yet.
