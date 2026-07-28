# MICDS PE Grading Platform

A web application for managing Physical Education assessments at MICDS Middle School. Teachers grade students across four standards per activity unit; students submit written responses and self-ratings; parents view their child's progress. All data persists in PostgreSQL and the app runs on Next.js 16.

---

## Tech Stack

* **Framework:** Next.js 16 (App Router, Turbopack)
* **Frontend:** React 19 + TypeScript, Tailwind CSS, Radix UI (Dialog, Select, Tabs, Dropdown, Popover, Checkbox, Avatar, Toast), Recharts for analytics charts
* **Backend:** Next.js API routes + Prisma ORM (PostgreSQL)
* **Database:** Supabase
* **Authentication:** NextAuth.js (Credentials provider, JWT sessions) + bcrypt for password hashing
* **Hosting:** Vercel
* **Email:** Nodemailer (SMTP) for verification and approval notifications
* **Testing:** Jest + React Testing Library

### Key design decisions

- **Fixed groups, rotating teachers.** Students stay in their assigned group for the full school year. Teachers rotate through groups on a carousel schedule. This means a student's `HistoricalClassInstance` records accumulate over the year, one per activity unit.
- **Approval workflow.** New accounts land in `PENDING_EMAIL_VERIFICATION`, then `PENDING_ADMIN_APPROVAL`. An admin must explicitly activate them. Seed data skips this flow — all seed accounts are `ACTIVE`.
- **Snapshot-based grades.** `GradeCalculationSnapshot` stores a point-in-time calculation so that future rubric changes do not silently alter historical grades.

---

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Run database migrations
npx prisma migrate dev

# Seed with demo data
npm run db:seed

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Grade Calculation Documentation

### Standard Score to Internal Value

Raw teacher scores (1–4) are mapped to an internal decimal value before letter-grade calculation:

| Raw Score | Internal Value | Rationale |
|---|---|---|
| 1 | 0.50 | Beginning / not yet meeting |
| 1.5 | 0.5875 | Interpolated |
| 2 | 0.675 | Approaching |
| 2.5 | 0.7125 | Interpolated |
| 3 | 0.75 | Meeting expectations |
| 3.5 | 0.875 | Interpolated |
| 4 | 1.00 | Exceeding expectations |

The general formula is `internalValue = 0.5 + ((rawScore - 1) / 3) * 0.5`, which maps the 1–4 range linearly onto 0.50–1.00.

**Note on the 4.5 case:** An earlier version of the assessment spec mentioned a raw score of 4.5 mapping to 1.0. The maximum standard score in the current rubric is 4. We treat 4 as the ceiling (internal value = 1.0). If MICDS changes policy to allow half-point scores above 4, update the mapping in the `RubricVersion` configuration.

The overall average is the arithmetic mean of the four standard internal values (equal weight, 25% each).

### Standard 1 Scoring Logic

Standard 1 is assessed through individual skill scores. Each skill receives a color-coded score:

| Color | Score | Meaning |
|---|---|---|
| Red | 1 | Not demonstrated |
| Yellow | 2 | Partially demonstrated |
| Light Green | 3 | Demonstrated with minor errors |
| Bright Green | 4 | Demonstrated with correct form |

The Standard 1 raw score is the arithmetic mean of all individual skill scores, then rounded to the nearest 0.5.

### Standards 2–4 Scoring Logic

Standards 2, 3, and 4 are scored by the teacher using written-response evaluation and observation. Teachers enter a raw score of 1–4 directly (with optional half-point increments). Thresholds:

| Raw Score | Performance Band |
|---|---|
| 1.0–1.4 | Beginning |
| 1.5–2.4 | Approaching |
| 2.5–3.4 | Meeting |
| 3.5–4.0 | Exceeding |

### Letter Grade Boundaries

Letter grades are derived from the overall internal average (0.50–1.00):

| Letter Grade | Minimum Average | Maximum Average |
|---|---|---|
| A+ | 0.970 | 1.000 |
| A  | 0.930 | 0.969 |
| A- | 0.900 | 0.929 |
| B+ | 0.870 | 0.899 |
| B  | 0.830 | 0.869 |
| B- | 0.800 | 0.829 |
| C+ | 0.770 | 0.799 |
| C  | 0.730 | 0.769 |
| C- | 0.700 | 0.729 |
| D+ | 0.670 | 0.699 |
| D  | 0.630 | 0.669 |
| D- | 0.600 | 0.629 |
| F  | 0.500 | 0.599 |

---

## Student Group Carousel

MICDS Middle School PE uses a **fixed-groups, rotating-teachers** model:

1. At the start of the school year, an admin creates `StudentGroup` records (one per cohort, e.g. 6th Grade Boys Group A).
2. Students are assigned to groups via `StudentGroupMembership`. Students stay in these groups all year.
3. An admin creates a `CarouselPlan` listing `CarouselPosition` records — one position per activity unit, in rotation order.
4. Each position is tied to a `TeacherClassAssignment` (teacher + activity + school year).
5. As the year progresses, `GroupRotationAssignment` records track which group is in which position during each rotation window.
6. When a rotation window opens, `HistoricalClassInstance` records are created for each group+teacher pairing. Grading happens on these instances.
7. When a rotation ends, an admin locks the instance (`status: LOCKED`). Locked instances are read-only.

This architecture means a student accumulates one `HistoricalClassInstance` (and associated grades) per activity unit across the school year.

---

## Security Notes

- **Email domain enforcement.** The `ALLOWED_EMAIL_DOMAIN` env var is checked at registration. Only addresses ending with `@micds.org` (or whatever domain is configured) can create accounts.
- **Admin approval workflow.** Even after email verification, accounts sit in `PENDING_ADMIN_APPROVAL` until an admin explicitly activates them. This prevents unauthorized access even if someone guesses or obtains a valid school email.
- **Password hashing.** All passwords are hashed with bcrypt at a cost factor of 12. Plain-text passwords are never stored or logged.
- **Rate limiting.** Auth endpoints (`/api/auth/signin`, password reset) are rate-limited per IP to mitigate brute-force attacks.
- **Audit logging.** Every significant action (logins, grade changes, account approvals, rotation advances) is written to `AuditLog`. Logs include actor ID, action type, before/after values, and IP address.
- **Session security.** NextAuth sessions are JWT-based, signed with `NEXTAUTH_SECRET`. Sessions expire after 8 hours. Refresh requires re-authentication.
- **Locked instances.** Once a class instance is locked by an admin, no grade changes are permitted through the UI. The `lockedAt` / `lockedBy` fields are set server-side, not in client payloads.

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run a single test file
npm test -- src/lib/gradeCalculation.test.ts

# Watch mode during development
npm test -- --watch
```

Tests are co-located with source files as `*.test.ts` / `*.test.tsx`. Integration tests that require a database use a separate test database configured via `DATABASE_URL` in `.env.test`.

---

## Deployment

### Vercel + Supabase (recommended)

1. Create a Supabase project and copy the connection string (use the pooled connection for the app, the direct connection for migrations).
2. Run migrations against the production database:
   ```bash
   DATABASE_URL="<direct-connection-string>" npx prisma migrate deploy
   ```
3. (Optional) Seed production with an admin account only — do not run the full seed in production.
4. In the Vercel dashboard, add all environment variables from `.env.example` with production values.
5. Deploy:
   ```bash
   vercel --prod
   ```

### Self-hosted (Docker + Postgres)

A `Dockerfile` and `docker-compose.yml` are provided for self-hosted deployments. Set environment variables via a `.env` file or your host's secret manager, then:

```bash
docker compose up -d
```

### Secret Rotation

**NEXTAUTH_SECRET:** Generate a new secret with `openssl rand -base64 32`. Update the value in your hosting environment. All existing sessions will be invalidated immediately — users will need to sign in again. No database changes are required.

**Database credentials:** Update `DATABASE_URL` in your hosting environment. If you are rotating credentials (not just the password), also update the database user in PostgreSQL. Run a zero-downtime rotation by creating the new credential, updating the env var, redeploying, then removing the old credential from Postgres.

**SMTP password:** Update `SMTP_PASS` in your hosting environment and redeploy. No sessions are affected.

---

## Performance Notes

- All list endpoints (students, grades, audit logs) are paginated. Default page size is 25; maximum is 100.
- Common query patterns are covered by database indexes defined in `schema.prisma` (see `@@index` declarations on each model).
- Filtering (by school year, grade level, gender, rotation status) is done server-side in Prisma queries, not in JavaScript after fetching.
- Grade exports (CSV/PDF) are handled as background jobs to avoid blocking the request thread.
- `GradeCalculationSnapshot` is pre-computed and stored; grade summary pages read the snapshot rather than recalculating on every request.
