@AGENTS.md

## Orientation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current stack + the HQ / Local-Lab domain model. Start here.
- [docs/EVOLUTION.md](docs/EVOLUTION.md) — how the app got here; index of `docs/archive/` (superseded specs — history, not guidance).
- [SCHEMA.md](SCHEMA.md) — database reference. Update it in the same PR as any migration.

## Subdocs

- [lib/auth/CLAUDE.md](lib/auth/CLAUDE.md) — sign-in flow, role resolution, permissions & labs-lead scoping, invitation flow, and the founding-spec deviations (Issues #44, #45). Read before touching anything in `lib/auth/`, `app/api/auth/`, `app/(auth)/`, or `lib/email/`.
- [supabase/CLAUDE.md](supabase/CLAUDE.md) — migration conventions. Read before writing any migration.
- [docs/poderator-dashboard/CLAUDE.md](docs/poderator-dashboard/CLAUDE.md) — naming conventions, route structure, new DB tables, auth integration, and build order for the Poderator dashboard. Read before touching `app/(dashboard)/moderator/` or any `00019`+ migration.
