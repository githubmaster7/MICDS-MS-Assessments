# Roadmap

Planned extensions for the MICDS PE Grading Platform. Nothing on this list is
built yet unless noted otherwise — this tracks what's next, not what exists
today (see `README.md` for the current feature set and tech stack).

---

## School-year rollover & archival

Right now the app has exactly one `SchoolYear` row, created directly in the
database. There is no admin-facing way to:

- Create/activate a new school year.
- Automatically archive the previous year's groups, rotations, and grades
  when the new one starts.

The schema already supports this (`SchoolYear.isActive`, and every group/
rotation/grade record is scoped by `schoolYearId`), so this is a logic-and-UI
feature, not a data-model change. `src/app/api/admin/school-years/route.ts`
is a read-only stub today (GET only) with a comment noting "full school
year/term CRUD is a separate, larger feature" — this is that feature.

This is the foundational piece the next three items depend on: none of them
are meaningful until more than one school year exists in the system.

## Cross-year history views

Three sections already exist as placeholders in Admin Settings
(`src/app/admin/settings/page.tsx`, `COMING_SOON_SECTIONS`) with no backing
logic behind them yet:

- **Student grade history** — every student's past grades across each class
  they've taken, for any school year, not just the current one.
- **Group history** — which student groups each student has belonged to over
  time, and when they joined or left.
- **Teacher class history** — which classes each teacher has taught, which
  groups, and over what time periods.

## Grade export (CSV/PDF)

The README currently claims grade exports are "handled as background jobs,"
but no such feature exists in the codebase — the only real export today is
the Audit Log CSV download (`src/app/api/admin/audit-logs/route.ts`), which
is a plain synchronous response, not a background job. A real grade export
(per-student, per-class, or per-group, as CSV and/or PDF) is still to be
built.

## Self-hosted deployment support

The README's "Self-hosted (Docker + Postgres)" section references a
`Dockerfile` and `docker-compose.yml` that don't exist in the repo yet.
Vercel + Supabase is the only deployment path that's actually been built and
verified; Docker-based self-hosting is a planned option, not a current one.
