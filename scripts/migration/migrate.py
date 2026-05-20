#!/usr/bin/env python3
"""scripts/migration/migrate.py — legacy spreadsheet → Postgres.

Six-pass dispatch over column_mapping.csv; writes via psycopg v3.
Dry-run default; `--commit` required to persist.

See scripts/migration/CLAUDE.md for the architectural rationale.
"""
from __future__ import annotations

import argparse
import csv
import dataclasses
import datetime as _dt
import hashlib
import logging
import os
import re
import sys
import urllib.parse
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import psycopg
from psycopg import sql as pgsql
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# ─── constants ────────────────────────────────────────────────────────────────

# Prod project ref. Health-row loads are refused against any DSN whose host
# matches this regardless of CLI flags. Belt-and-suspenders.
#
# Project-ref history (recorded so a reviewer can audit the guard direction):
#   2026-05-13  cethihabtddiujzayaxe  was prod (single-project setup)
#   2026-05-16  cdbgkgkjnomjnpicaxqe  IS prod (new empty project; clean cutover)
#               cethihabtddiujzayaxe  IS dev/staging (retains pre-split data)
# The token below MUST match whatever is currently prod, NOT historical prod.
# Flipping these accidentally would allow Health-row loads onto prod — the
# exact failure this guard exists to prevent.
PROD_HOST_TOKEN = "cdbgkgkjnomjnpicaxqe"
DEV_HOST_TOKEN = "cethihabtddiujzayaxe"  # informational only; not load-bearing

DEFAULT_WORKBOOK = REPO_ROOT / "docs" / "Upskiller Community Manager.xlsx"
DEFAULT_MAPPING_CSV = REPO_ROOT / "scripts" / "migration" / "column_mapping.csv"
DEFAULT_LOG_DIR = REPO_ROOT / "scripts" / "migration"

HEALTH_SHEETS = {"Health Pod Registration", "Health Voting & Pods"}

# CLI --cycle value → public.cycles.name to verify. Trailing space on Health
# is real on prod; quote-handled at the SQL boundary.
CYCLE_NAMES = {
    "energy": "Energy & Climate",
    "health": "Spring 2026: Health ",
}

# Energy operator pod shortlist. Each entry: numeric prefix from the legacy
# seat-preference label → (pod_name, problem_statement_text). Edit before
# --commit if the operator has fuller Energy problem-statement text from a
# source the workbook lacks (Submissions sheet contains Health-only rows).
#
# '6.' (Fast Fashion) deliberately omitted — operator dropped it from the
# final shortlist. Seat preferences pointing at '6.' will [WARN] + skip
# (D1-step option b).
ENERGY_POD_SHORTLIST: dict[str, tuple[str, str]] = {
    "5":  ("Clean Energy",       "Household and community organizations and clean-energy"),
    "7":  ("Sustainable Travel", "Sustainable Travel"),
    "8":  ("Carbon Footprint",   "Individuals and organizations understanding their carbon footprint"),
    "15": ("Recycling",          "Recycling is confusing"),
}

# Prose → enum (folder doc §"Prose → enum normalization"). Both lookups use
# the smart-apostrophe form Google Forms exports; legacy data may also carry
# straight apostrophes — handled via NFC normalization in the lookup.
COMMITMENT_MAP = {
    "I’m ready to participate consistently and follow through on commitments": "yes",
    "I'm ready to participate consistently and follow through on commitments": "yes",
    "I’m interested, but my availability is uncertain right now":              "uncertain",
    "I'm interested, but my availability is uncertain right now":              "uncertain",
}

FAMILIARITY_MAP = {
    "Never used":       1,
    "Hardly use":       2,
    "Use occasionally": 3,
    "Use often":        4,
    "Daily user":       5,
}

# ── Enum-safe placeholders for participants CHECK-constrained columns ────────
# Decision (#42 conversation): do NOT relax CHECK or NOT NULL via 00016.
# Schema integrity stays maximally rigid; legacy rows land via enum-safe
# placeholders that the CHECK already accepts. Cost: a legacy row that lacks
# `dcpl_card` data renders 'not sure' on the profile page — looks like an
# answered question. Operator accepts this in exchange for zero schema delta.
#
# Pass 0.5 (audit pass) emits a per-column report of which raw values landed
# in which buckets so the operator reviews coercions before --commit.

# state — varchar(10) CHECK in ('MD','DC','VA','Other').
# Substring match handles 'Washington, DC' / 'Atlanta, GA' / 'Buffalo' etc.
# Anything not matching DMV → 'Other'. Blank → 'Other'.
STATE_MAP_SUBSTRINGS = [
    # (lowercased substring or exact equality marker, enum value)
    ("washington",  "DC"),
    (" dc",         "DC"),
    (", dc",        "DC"),
    ("d.c.",        "DC"),
    ("virginia",    "VA"),
    ("maryland",    "MD"),
]
STATE_EXACT = {"dc": "DC", "va": "VA", "md": "MD"}
STATE_FALLBACK = "Other"

# dcpl_card — varchar(20) CHECK in ('yes','no','not sure'). Spreadsheet
# capitalizes them. Blank or unrecognized → 'not sure' (the neutral enum).
DCPL_MAP = {
    "yes":      "yes",
    "no":       "no",
    "not sure": "not sure",
}
DCPL_FALLBACK = "not sure"

# work_situation — varchar(50) CHECK in 7 lowercase values. Spreadsheet has
# similar wording with case + hyphen differences; 'unemployed and jobseeking'
# is one word in the enum but the spreadsheet has 'job searching' (two words),
# so the prose mapping is hand-curated and load-bearing.
WORK_SITUATION_MAP = {
    "employed full-time":                     "employed full time",
    "employed full time":                     "employed full time",
    "employed part-time":                     "employed part-time",
    "employed part time":                     "employed part-time",
    "self-employed":                          "self-employed",
    "self employed":                          "self-employed",
    "unemployed and actively job searching":  "unemployed and jobseeking",
    "unemployed and jobseeking":              "unemployed and jobseeking",
    "in a career transition":                 "in a career transition",
    "student":                                "student",
    "prefer not to say":                      "prefer not to say",
}
WORK_SITUATION_FALLBACK = "prefer not to say"

# main_focus — varchar(50) CHECK in 7 values incl. 'other' (catchall) and
# 'n/a'. Recognized prose → matched enum. Free-text outside the lookup →
# 'other'. Blank → 'n/a'.
MAIN_FOCUS_MAP = {
    "finding a new role":            "finding a new role",
    "building a portfolio of work":  "building a portfolio",
    "building a portfolio":          "building a portfolio",
    "upskilling in my current field": "upskilling in current field",
    "upskilling in current field":   "upskilling in current field",
    "exploring new directions":      "exploring new directions",
    "starting something new":        "starting something new",
    "n/a":                           "n/a",
    "other":                         "other",
}
MAIN_FOCUS_UNRECOGNIZED = "other"  # free-text answer not in lookup
MAIN_FOCUS_BLANK = "n/a"            # cell absent entirely

# neighborhood — varchar(255) NOT NULL with no CHECK. Empty string satisfies
# the constraint and is the honest representation of "not asked".
NEIGHBORHOOD_BLANK = ""

# CSV transforms that route to participant_options. The transform string
# looks like: csv_split → participant_options(list_name='ai_tools')
LIST_NAME_RE = re.compile(r"list_name='([^']+)'")
# CSV transforms that route to a label_lookup destination (Seats → pods.id).
LABEL_LOOKUP_RE = re.compile(r"label_lookup → ([a-z_]+)\.id")

# Source-column synonyms encountered in the wild that should resolve to one
# logical destination. Keep this short — every entry is a correctness risk if
# the source workbook header drifts. Confirmed against the column_mapping.csv
# during Pass 1 startup; mismatches abort.
PARTICIPANTS_FIELD_TRANSFORMS = {
    "Email Address":   ("email",                     "lower+trim"),
    "First Name":      ("first_name",                "trim"),
    "Last Name":       ("last_name",                 "trim"),
    "Preferred Name":  ("preferred_name",            "trim"),
}

# ─── logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger("migrate")


def setup_logging(log_file: Optional[Path], verbose: bool) -> Path:
    """Configure stdout + file logging. File output is PII-clean."""
    if log_file is None:
        ts = _dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        log_file = DEFAULT_LOG_DIR / f"run_{ts}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.handlers.clear()

    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(message)s", "%H:%M:%S")

    sh = logging.StreamHandler(sys.stdout)
    sh.setLevel(logging.DEBUG if verbose else logging.INFO)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setLevel(logging.INFO)
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    return log_file


# ─── anonymization ────────────────────────────────────────────────────────────

def anon_email(email: str, salt: str) -> str:
    h = hashlib.sha256(f"{salt}:email:{email.lower().strip()}".encode()).hexdigest()[:10]
    return f"anon-{h}@hash.local"


def anon_name(name: Optional[str], salt: str) -> Optional[str]:
    if name is None:
        return None
    h = hashlib.sha256(f"{salt}:name:{str(name).lower().strip()}".encode()).hexdigest()[:6]
    return f"Anon-{h}"


def is_health_sheet(sheet: str) -> bool:
    return sheet in HEALTH_SHEETS


# ─── transform handlers ───────────────────────────────────────────────────────

def _na(v: Any) -> bool:
    if v is None:
        return True
    try:
        return pd.isna(v)
    except (TypeError, ValueError):
        return False


def t_direct(v: Any) -> Optional[str]:
    if _na(v):
        return None
    s = str(v).strip()
    return s or None


def t_lower_trim(v: Any) -> Optional[str]:
    s = t_direct(v)
    return s.lower() if s else None


def t_bool_yn(v: Any) -> Optional[bool]:
    s = t_direct(v)
    if s is None:
        return None
    s = s.lower()
    if s in ("yes", "y", "true", "1"):
        return True
    if s in ("no", "n", "false", "0", "prefer not to be photographed"):
        return False
    return None


def t_parse_date(v: Any) -> Optional[_dt.datetime]:
    if _na(v):
        return None
    if isinstance(v, _dt.datetime):
        return v
    try:
        return pd.to_datetime(v).to_pydatetime()
    except (ValueError, TypeError):
        return None


def t_int_scale(v: Any, mapping: dict[str, int]) -> Optional[int]:
    s = t_direct(v)
    if s is None:
        return None
    if s.isdigit():
        n = int(s)
        return n if 1 <= n <= 5 else None
    return mapping.get(s)


def t_prose_enum(v: Any, mapping: dict[str, str]) -> Optional[str]:
    s = t_direct(v)
    if s is None:
        return None
    return mapping.get(s)


def t_csv_split(v: Any) -> list[str]:
    s = t_direct(v)
    if not s:
        return []
    return [x.strip() for x in s.split(",") if x.strip()]


# ── enum-safe normalizers for CHECK-constrained columns ──────────────────────
# Each returns (normalized_value, bucket_label). The bucket label is used by
# Pass 0.5 to histogram the coercions for operator review.

def normalize_state(raw: Any) -> tuple[str, str]:
    s = t_direct(raw)
    if s is None:
        return STATE_FALLBACK, "blank → Other"
    low = s.lower()
    if low in STATE_EXACT:
        v = STATE_EXACT[low]
        return v, f"exact → {v}"
    for needle, target in STATE_MAP_SUBSTRINGS:
        if needle in low:
            return target, f"substring '{needle}' → {target}"
    return STATE_FALLBACK, f"non-DMV → Other ({s!r})"


def normalize_dcpl_card(raw: Any) -> tuple[str, str]:
    s = t_direct(raw)
    if s is None:
        return DCPL_FALLBACK, "blank → not sure"
    low = s.lower()
    if low in DCPL_MAP:
        return DCPL_MAP[low], f"matched → {DCPL_MAP[low]}"
    return DCPL_FALLBACK, f"unrecognized → not sure ({s!r})"


def normalize_work_situation(raw: Any) -> tuple[str, str]:
    s = t_direct(raw)
    if s is None:
        return WORK_SITUATION_FALLBACK, "blank → prefer not to say"
    low = s.lower()
    if low in WORK_SITUATION_MAP:
        return WORK_SITUATION_MAP[low], f"matched → {WORK_SITUATION_MAP[low]}"
    return WORK_SITUATION_FALLBACK, f"unrecognized → prefer not to say ({s!r})"


def normalize_main_focus(raw: Any) -> tuple[str, str]:
    s = t_direct(raw)
    if s is None:
        return MAIN_FOCUS_BLANK, "blank → n/a"
    low = s.lower()
    if low in MAIN_FOCUS_MAP:
        return MAIN_FOCUS_MAP[low], f"matched → {MAIN_FOCUS_MAP[low]}"
    return MAIN_FOCUS_UNRECOGNIZED, f"free-text → other ({s[:40]}{'…' if len(s) > 40 else ''})"


def dump_normalizer_rules() -> None:
    """Emit the normalizer lookup tables for operator pre-run audit."""
    logger.info("─── Normalizer rules (--verbose) ───")
    logger.info("state CHECK ∈ %s", sorted(set(STATE_EXACT.values()) | {STATE_FALLBACK}))
    logger.info("  exact lookups: %s", STATE_EXACT)
    logger.info("  substring lookups: %s", STATE_MAP_SUBSTRINGS)
    logger.info("  fallback (non-DMV or blank): %s", STATE_FALLBACK)
    logger.info("dcpl_card CHECK ∈ ('yes','no','not sure')")
    logger.info("  lookups: %s", DCPL_MAP)
    logger.info("  fallback: %s", DCPL_FALLBACK)
    logger.info("work_situation CHECK ∈ 7 values; lookups (lowercased keys → enum):")
    for k, v in WORK_SITUATION_MAP.items():
        logger.info("  %-45r → %r", k, v)
    logger.info("  fallback: %s", WORK_SITUATION_FALLBACK)
    logger.info("main_focus CHECK ∈ 7 values; lookups:")
    for k, v in MAIN_FOCUS_MAP.items():
        logger.info("  %-35r → %r", k, v)
    logger.info("  unrecognized free-text fallback: %s", MAIN_FOCUS_UNRECOGNIZED)
    logger.info("  blank fallback: %s", MAIN_FOCUS_BLANK)


# Dispatch table for Pass 1 (single-value scalars per destination column).
SCALAR_TRANSFORMS: dict[str, Any] = {
    "":            t_direct,
    "direct":      t_direct,
    "trim":        t_direct,
    "lower+trim":  t_lower_trim,
    "bool_yn":     t_bool_yn,
    "parse_date":  t_parse_date,
    "int_scale_1_5(familiarity_map)": lambda v: t_int_scale(v, FAMILIARITY_MAP),
    "prose_lookup(commitment_map)":   lambda v: t_prose_enum(v, COMMITMENT_MAP),
}


# ─── source data loaders ──────────────────────────────────────────────────────

def load_workbook(path: Path) -> dict[str, pd.DataFrame]:
    logger.info("Loading workbook: %s", path)
    if not path.exists():
        sys.exit(f"workbook not found: {path}")
    xl = pd.ExcelFile(path)
    sheets: dict[str, pd.DataFrame] = {}
    for name in xl.sheet_names:
        if name in ("Management Dashboard", "Slack Data", "Health Pod Registration Summary"):
            continue
        header = [0, 1] if name == "Health Voting & Pods" else 0
        sheets[name] = pd.read_excel(path, sheet_name=name, header=header)
        logger.info("  loaded sheet %-32s %d rows × %d cols",
                    f"'{name}'", len(sheets[name]), len(sheets[name].columns))
    return sheets


def load_mapping(path: Path) -> list[dict[str, str]]:
    logger.info("Loading mapping CSV: %s", path)
    if not path.exists():
        sys.exit(f"mapping CSV not found: {path}")
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    logger.info("  loaded %d mapping rows", len(rows))
    return rows


# ─── connection helpers ───────────────────────────────────────────────────────

def parse_dsn_host(dsn: str) -> str:
    try:
        return urllib.parse.urlparse(dsn).hostname or ""
    except ValueError:
        return ""


def guard_prod_connection(dsn: str, will_load_health: bool, anonymize: bool) -> None:
    """Refuse Health-row loads against prod. Refuse --no-anonymize against prod
    for any cycle (because operator might still touch Health by mistake)."""
    host = parse_dsn_host(dsn)
    is_prod = PROD_HOST_TOKEN in host.lower()
    if is_prod and will_load_health:
        sys.exit(
            f"[GUARD] DSN host '{host}' looks like prod (matches '{PROD_HOST_TOKEN}'). "
            f"Health-cycle rows are staging fixture only; refusing to load. "
            f"Run --cycle energy or point at a non-prod DSN."
        )
    if is_prod and not anonymize and will_load_health:
        # Unreachable given the above but keep the second guard for posterity.
        sys.exit("[GUARD] --no-anonymize against prod is disallowed for Health rows.")
    env_label = (
        "PROD"  if is_prod
        else "DEV/STAGING" if DEV_HOST_TOKEN in host.lower()
        else "LOCAL" if host.startswith("127.") or host == "localhost"
        else "UNKNOWN"
    )
    logger.info("DSN host: %s  (env=%s, will_load_health=%s, anonymize=%s)",
                host, env_label, will_load_health, anonymize)


def verify_cycle(conn: psycopg.Connection, cycle_name: str) -> tuple[int, bool]:
    cur = conn.cursor()
    cur.execute("""
        SELECT c.id,
               EXISTS (SELECT 1 FROM public.cycle_config WHERE cycle_id = c.id)
        FROM public.cycles c
        WHERE c.name = %s
    """, (cycle_name,))
    row = cur.fetchone()
    if not row:
        sys.exit(f"[VERIFY] cycle '{cycle_name}' not found. Operator must insert "
                 f"the cycles row before re-running.")
    cycle_id, has_config = row
    if not has_config:
        sys.exit(f"[VERIFY] cycle_config missing for cycle_id={cycle_id} ('{cycle_name}'). "
                 f"Operator must insert before re-running.")
    logger.info("Verified cycle: id=%d name=%r has_config=True", cycle_id, cycle_name)
    return cycle_id, has_config


def load_option_lists_cache(conn: psycopg.Connection) -> dict[tuple[str, str], int]:
    cur = conn.cursor()
    cur.execute("SELECT list_name, value, id FROM public.option_lists WHERE active = TRUE")
    cache = {(ln, v): oid for ln, v, oid in cur.fetchall()}
    by_list: dict[str, int] = defaultdict(int)
    for (ln, _v), _ in cache.items():
        by_list[ln] += 1
    logger.info("option_lists cache: %d entries across %d lists (%s)",
                len(cache), len(by_list),
                ", ".join(f"{k}={v}" for k, v in sorted(by_list.items())))
    return cache


def load_existing_participants(conn: psycopg.Connection) -> dict[str, int]:
    cur = conn.cursor()
    cur.execute("SELECT lower(email), id FROM public.participants WHERE email IS NOT NULL")
    return dict(cur.fetchall())


# ─── SQL emission ─────────────────────────────────────────────────────────────

@dataclasses.dataclass
class EmitContext:
    conn: psycopg.Connection
    dry_run: bool
    sql_preview_count: int = 0
    sql_preview_limit: int = 5

    def execute(self, query: pgsql.Composable | str, params: tuple, *,
                returning: bool = False, preview_label: str = "") -> Optional[int]:
        """In dry-run, log a sample of the SQL and skip execution. In commit
        mode, execute (and return RETURNING id if requested)."""
        if self.dry_run:
            if preview_label and self.sql_preview_count < self.sql_preview_limit:
                # Render fully — operator sees what they'd execute. PII risk lives
                # in stdout, not the log file (log handler filters at INFO level
                # and we use DEBUG for full SQL).
                rendered = self._render(query, params)
                logger.debug("[SQL %s]\n  %s", preview_label, rendered)
                self.sql_preview_count += 1
            return -1 if returning else None
        cur = self.conn.cursor()
        cur.execute(query, params)
        if returning:
            return cur.fetchone()[0]
        return None

    def _render(self, query: pgsql.Composable | str, params: tuple) -> str:
        try:
            if isinstance(query, str):
                return self.conn.cursor().mogrify(query, params).decode("utf-8", errors="replace")
            return query.as_string(self.conn) + "  -- params=<binary composable>"
        except Exception as e:  # pragma: no cover — best-effort rendering
            return f"<render error: {e}>"


# ─── pass 0.5 — normalization audit ───────────────────────────────────────────

def pass_0_5_normalization_audit(
    workbook: dict[str, pd.DataFrame],
    mapping: list[dict[str, str]],
) -> None:
    """Pre-write audit: walk Upskiller Registrations once, apply each
    CHECK-bound normalizer, emit per-column histogram of bucket landings.
    No DB writes; operator reviews coercions before --commit."""
    logger.info("=== Pass 0.5: normalization audit ===")
    df = workbook.get("Upskiller Registrations")
    if df is None or df.empty:
        logger.warning("  no Upskiller Registrations rows; skipping audit")
        return

    def source_col(dest_col: str) -> Optional[str]:
        for m in mapping:
            if (m["source_sheet"] == "Upskiller Registrations"
                    and m["destination_table"] == "participants"
                    and m["destination_column"] == dest_col):
                return m["source_column"]
        return None

    fields: list[tuple[str, Any]] = [
        ("state",          normalize_state),
        ("dcpl_card",      normalize_dcpl_card),
        ("work_situation", normalize_work_situation),
        ("main_focus",     normalize_main_focus),
    ]

    for dest, fn in fields:
        src = source_col(dest)
        if src is None or src not in df.columns:
            logger.warning("  %s: source column not in workbook (looked for %r); skipping", dest, src)
            continue
        buckets: dict[str, int] = defaultdict(int)
        examples: dict[str, list[str]] = defaultdict(list)
        for raw in df[src]:
            _value, bucket_label = fn(raw)
            buckets[bucket_label] += 1
            raw_disp = "" if _na(raw) else str(raw).strip()
            if raw_disp and raw_disp not in examples[bucket_label]:
                examples[bucket_label].append(raw_disp)
        total = sum(buckets.values())
        logger.info("%s — %d rows scanned:", dest, total)
        for bucket, n in sorted(buckets.items(), key=lambda kv: -kv[1]):
            sample_n = examples[bucket][:3]
            more = f" +{len(examples[bucket]) - 3} more" if len(examples[bucket]) > 3 else ""
            sample = ", ".join(repr(e) for e in sample_n) if sample_n else "(blank)"
            logger.info("  %-50s %3d  e.g. %s%s", bucket, n, sample, more)


# ─── pass 1 — participants + cycle_enrollments ────────────────────────────────

def _pluck_participant_row(
    src_row: pd.Series,
    mapping_rows: list[dict[str, str]],
) -> dict[str, Any]:
    """Apply the CSV mapping for one Upskiller Registrations row → dict of
    destination columns. Skips rows with no email (anonymous submissions)."""
    out: dict[str, Any] = {}
    for m in mapping_rows:
        if m["destination_table"] != "participants":
            continue
        if not m["destination_column"]:
            continue
        col = m["source_column"]
        if col not in src_row.index:
            continue
        raw = src_row[col]
        transform_name = m["transform"]
        handler = SCALAR_TRANSFORMS.get(transform_name)
        if handler is None:
            # Multi-source or prefix transforms are handled separately.
            continue
        try:
            value = handler(raw)
        except Exception as e:  # pragma: no cover
            logger.warning("transform '%s' failed on col=%r: %s", transform_name, col, e)
            value = None
        # Two-source-to-one-column (notes): defer to the merge step below.
        if m["destination_column"] in out and m["destination_column"] != "notes":
            continue
        out[m["destination_column"]] = value
    # Merge the two notes-prefixed source columns per folder doc §"Two source
    # columns → one destination column".
    notes_parts = []
    stewardship = src_row.get("What interests you about taking on a stewardship or leadership role? ")
    other = src_row.get("Anything else you'd like us to know?")
    if pd.notna(stewardship) and str(stewardship).strip():
        notes_parts.append(f"Stewardship interest: {str(stewardship).strip()}")
    if pd.notna(other) and str(other).strip():
        notes_parts.append(f"Other: {str(other).strip()}")
    out["notes"] = "\n\n".join(notes_parts) if notes_parts else None
    return out


def pass1_participants_and_enrollments(
    emit: EmitContext,
    workbook: dict[str, pd.DataFrame],
    mapping: list[dict[str, str]],
    cycle_id: int,
    anonymize: bool,
    salt: str,
    existing_emails: dict[str, int],
) -> dict[str, int]:
    """Returns email → participant_id dict for downstream lookups. In dry-run,
    new participants get synthetic negative IDs."""
    logger.info("=== Pass 1: participants + cycle_enrollments ===")
    df = workbook.get("Upskiller Registrations")
    if df is None or df.empty:
        logger.warning("  no Upskiller Registrations rows; skipping pass 1")
        return dict(existing_emails)

    # google_id is NOT NULL on participants. Prod convention (12 of 32 rows
    # today) is to placeholder-fill it with the email pre-OAuth; the auth
    # flow overwrites with the real Google sub on first sign-in.
    participants_sql = """
        INSERT INTO public.participants (
            google_id,
            email, first_name, last_name, preferred_name,
            gender, phone_number, state, neighborhood,
            dcpl_card, dcpl_info,
            work_situation, main_focus, sector, current_title, linkedin,
            ai_tool_familiarity, participation_commitment,
            primary_expertise,
            availability_notes, commitment_notes, interest_areas,
            moderator_experience,
            text_updates, email_updates, comms_consent, photo_video_consent,
            source, notes
        ) VALUES (
            %(google_id)s,
            %(email)s, %(first_name)s, %(last_name)s, %(preferred_name)s,
            %(gender)s, %(phone_number)s, %(state)s, %(neighborhood)s,
            %(dcpl_card)s, %(dcpl_info)s,
            %(work_situation)s, %(main_focus)s, %(sector)s, %(current_title)s, %(linkedin)s,
            %(ai_tool_familiarity)s, %(participation_commitment)s,
            %(primary_expertise)s,
            %(availability_notes)s, %(commitment_notes)s, %(interest_areas)s,
            %(moderator_experience)s,
            %(text_updates)s, %(email_updates)s, %(comms_consent)s, %(photo_video_consent)s,
            %(source)s, %(notes)s
        )
        ON CONFLICT (email) DO UPDATE SET
            first_name          = COALESCE(EXCLUDED.first_name,          public.participants.first_name),
            last_name           = COALESCE(EXCLUDED.last_name,           public.participants.last_name),
            preferred_name      = COALESCE(EXCLUDED.preferred_name,      public.participants.preferred_name),
            phone_number        = COALESCE(EXCLUDED.phone_number,        public.participants.phone_number),
            availability_notes  = COALESCE(EXCLUDED.availability_notes,  public.participants.availability_notes),
            commitment_notes    = COALESCE(EXCLUDED.commitment_notes,    public.participants.commitment_notes),
            interest_areas      = COALESCE(EXCLUDED.interest_areas,      public.participants.interest_areas),
            moderator_experience= COALESCE(EXCLUDED.moderator_experience, public.participants.moderator_experience),
            notes               = COALESCE(EXCLUDED.notes,               public.participants.notes)
        RETURNING id
    """

    enrollments_sql = """
        INSERT INTO public.cycle_enrollments (participant_id, cycle_id, status)
        VALUES (%s, %s, 'inactive')
        ON CONFLICT (participant_id, cycle_id) DO NOTHING
    """

    email_to_pid: dict[str, int] = dict(existing_emails)
    synthetic_id = -1
    counts = {"read": 0, "skipped_no_email": 0, "would_upsert": 0,
              "would_enroll": 0, "already_present": 0}

    for idx, row in df.iterrows():
        counts["read"] += 1
        pdata = _pluck_participant_row(row, mapping)
        email = pdata.get("email")
        if not email:
            counts["skipped_no_email"] += 1
            logger.debug("  [row %d] skipped — no email", idx)
            continue
        # Pass 1 only loads Upskiller Registrations (cross-cycle), so no
        # Health-anonymization applies here. Health-tagged anonymization
        # kicks in for Pass 5 / Pass 6 emails.

        # Set defaults the CSV mapping doesn't cover explicitly.
        pdata.setdefault("source", "legacy_migration")
        pdata.setdefault("comms_consent", True)
        # Placeholder google_id — prod convention; OAuth flow overwrites on
        # first sign-in. Using email so the UNIQUE(google_id) constraint
        # holds for distinct emails. (Real Google subs are numeric, so no
        # collision with eventual real values.)
        pdata.setdefault("google_id", email)
        # first_name / last_name are NOT NULL with no CHECK — coerce missing
        # to 'Unknown' (warned). The handful of pre-email-collection rows in
        # the legacy form lack these.
        if not pdata.get("first_name"):
            pdata["first_name"] = "Unknown"
            logger.warning("  [row %d] first_name missing; coerced to 'Unknown'", idx)
        if not pdata.get("last_name"):
            pdata["last_name"] = "Unknown"
            logger.warning("  [row %d] last_name missing; coerced to 'Unknown'", idx)
        # CHECK-constrained fields: normalize to enum-safe values. See
        # ENUM-SAFE PLACEHOLDERS section at top of file. Raw values come from
        # the CSV mapping's plain 'direct' transform; we override here.
        raw_state = pdata.get("state")
        raw_dcpl = pdata.get("dcpl_card")
        raw_work = pdata.get("work_situation")
        raw_focus = pdata.get("main_focus")
        pdata["state"], _ = normalize_state(raw_state)
        pdata["dcpl_card"], _ = normalize_dcpl_card(raw_dcpl)
        pdata["work_situation"], _ = normalize_work_situation(raw_work)
        pdata["main_focus"], _ = normalize_main_focus(raw_focus)
        # neighborhood is NOT NULL with no CHECK — empty string OK.
        if pdata.get("neighborhood") is None:
            pdata["neighborhood"] = NEIGHBORHOOD_BLANK
        # ai_tool_familiarity NOT NULL CHECK 1..5 — default to 1.
        if pdata.get("ai_tool_familiarity") is None:
            pdata["ai_tool_familiarity"] = 1
        # text_updates / photo_video_consent NOT NULL bool — default FALSE
        # (conservative consent posture for missing data).
        if pdata.get("text_updates") is None:
            pdata["text_updates"] = False
        if pdata.get("photo_video_consent") is None:
            pdata["photo_video_consent"] = False
        # Backfill nullable keys the SQL expects.
        for k in ("gender", "phone_number", "dcpl_info",
                  "sector", "current_title", "linkedin",
                  "participation_commitment", "primary_expertise",
                  "availability_notes", "commitment_notes", "interest_areas",
                  "moderator_experience", "email_updates"):
            pdata.setdefault(k, None)

        pid = _emit_dict(emit, participants_sql, pdata, returning=True,
                         preview_label=f"pass1.participants[row{idx}]")
        if pid is None:
            continue
        if pid == -1:
            pid = synthetic_id
            synthetic_id -= 1
            counts["would_upsert"] += 1
        else:
            if email in existing_emails:
                counts["already_present"] += 1
            else:
                counts["would_upsert"] += 1
        email_to_pid[email] = pid

        emit.execute(enrollments_sql, (pid, cycle_id),
                     preview_label=f"pass1.enrollments[row{idx}]")
        counts["would_enroll"] += 1

    logger.info(
        "Pass 1 done — read=%d skipped_no_email=%d would_upsert=%d already_present=%d would_enroll=%d",
        counts["read"], counts["skipped_no_email"], counts["would_upsert"],
        counts["already_present"], counts["would_enroll"]
    )
    return email_to_pid


def _emit_dict(
    ctx: EmitContext,
    query: str,
    params: dict[str, Any],
    *,
    returning: bool = False,
    preview_label: str = "",
) -> Optional[int]:
    """Variant of EmitContext.execute that uses %(name)s named params."""
    if ctx.dry_run:
        if preview_label and ctx.sql_preview_count < ctx.sql_preview_limit:
            try:
                rendered = ctx.conn.cursor().mogrify(query, params).decode("utf-8", "replace")
                logger.debug("[SQL %s]\n  %s", preview_label, rendered[:500] + ("…" if len(rendered) > 500 else ""))
            except Exception as e:
                logger.debug("[SQL %s] <render error: %s>", preview_label, e)
            ctx.sql_preview_count += 1
        return -1 if returning else None
    cur = ctx.conn.cursor()
    cur.execute(query, params)
    if returning:
        return cur.fetchone()[0]
    return None


# ─── pass 1.5 — orphan stubs (emails in pod-reg but not in Upskiller Reg) ────

def pass1_5_orphan_stubs(
    emit: EmitContext,
    workbook: dict[str, pd.DataFrame],
    cycle: str,
    cycle_id: int,
    email_to_pid: dict[str, int],
    existing_emails: dict[str, int],
) -> dict[str, int]:
    """For each distinct email in the cycle's Pod Registration sheet that
    isn't already in `email_to_pid`, INSERT a stub `participants` row with
    enum-safe placeholders and a `notes` audit trail, then INSERT a
    `cycle_enrollments` row (status='inactive').

    Use case: legacy participants who filled the pod-registration Google
    Form but never the upskiller-registration form. Without stubs, their
    pod-membership rows in Pass 5 silently drop. With stubs, they survive
    the migration and can be invited by #46 once status is flipped active.

    Returns the updated email_to_pid dict (caller mutates in-place too).
    """
    logger.info("=== Pass 1.5: orphan-email stubs ===")

    sheet_name = {"energy": "Energy Pod Registration",
                  "health": "Health Pod Registration"}.get(cycle)
    if sheet_name is None:
        logger.warning("  no pod-reg sheet for cycle=%s; skipping", cycle)
        return email_to_pid
    df = workbook.get(sheet_name)
    if df is None or df.empty or "Email Address" not in df.columns:
        logger.warning("  %s missing or has no Email Address column; skipping", sheet_name)
        return email_to_pid

    # Stub row uses the same enum-safe defaults Pass 1 derives for blanks.
    # `notes` is the audit trail — operator can query later via:
    #   SELECT email FROM participants WHERE notes LIKE 'stub from %, W1-004%'
    stub_sql = """
        INSERT INTO public.participants (
            google_id, email,
            first_name, last_name,
            state, neighborhood, dcpl_card,
            work_situation, main_focus, ai_tool_familiarity,
            text_updates, photo_video_consent, comms_consent,
            source, notes
        ) VALUES (
            %(google_id)s, %(email)s,
            %(first_name)s, %(last_name)s,
            %(state)s, %(neighborhood)s, %(dcpl_card)s,
            %(work_situation)s, %(main_focus)s, %(ai_tool_familiarity)s,
            %(text_updates)s, %(photo_video_consent)s, %(comms_consent)s,
            %(source)s, %(notes)s
        )
        ON CONFLICT (email) DO UPDATE SET
            notes = COALESCE(public.participants.notes, EXCLUDED.notes)
        RETURNING id
    """

    enrollments_sql = """
        INSERT INTO public.cycle_enrollments (participant_id, cycle_id, status)
        VALUES (%s, %s, 'inactive')
        ON CONFLICT (participant_id, cycle_id) DO NOTHING
    """

    counts = {"emails_scanned": 0, "already_known": 0,
              "stubs_inserted": 0, "stubs_enrolled": 0}
    seen_emails: set[str] = set()
    synthetic_id = min(email_to_pid.values(), default=0) - 1  # extend the negative range
    if synthetic_id >= 0:
        synthetic_id = -1

    for idx, row in df.iterrows():
        email = t_lower_trim(row.get("Email Address"))
        if not email or email in seen_emails:
            continue
        seen_emails.add(email)
        counts["emails_scanned"] += 1
        if email in email_to_pid:
            counts["already_known"] += 1
            continue

        pdata = {
            "google_id":            email,
            "email":                email,
            "first_name":           "Unknown",
            "last_name":            "Unknown",
            "state":                STATE_FALLBACK,        # 'Other'
            "neighborhood":         NEIGHBORHOOD_BLANK,    # ''
            "dcpl_card":            DCPL_FALLBACK,         # 'not sure'
            "work_situation":       WORK_SITUATION_FALLBACK,  # 'prefer not to say'
            "main_focus":           MAIN_FOCUS_BLANK,      # 'n/a'
            "ai_tool_familiarity":  1,
            "text_updates":         False,
            "photo_video_consent":  False,
            "comms_consent":        True,
            "source":               "legacy_migration",
            "notes":                f"stub from {sheet_name}, W1-004",
        }
        pid = _emit_dict(emit, stub_sql, pdata, returning=True,
                         preview_label=f"pass1_5.stub[{idx}]")
        if pid == -1:
            pid = synthetic_id
            synthetic_id -= 1
        if pid is None:
            continue
        email_to_pid[email] = pid
        counts["stubs_inserted"] += 1
        emit.execute(enrollments_sql, (pid, cycle_id),
                     preview_label=f"pass1_5.enrollment[{idx}]")
        counts["stubs_enrolled"] += 1

    logger.info(
        "Pass 1.5 done — scanned=%d already_known=%d stubs_inserted=%d stubs_enrolled=%d",
        counts["emails_scanned"], counts["already_known"],
        counts["stubs_inserted"], counts["stubs_enrolled"]
    )
    return email_to_pid


# ─── pass 2 — participant_options ─────────────────────────────────────────────

def pass2_participant_options(
    emit: EmitContext,
    workbook: dict[str, pd.DataFrame],
    mapping: list[dict[str, str]],
    email_to_pid: dict[str, int],
    options_cache: dict[tuple[str, str], int],
    skip_options: bool = False,
) -> None:
    logger.info("=== Pass 2: participant_options ===")
    if skip_options:
        logger.warning(
            "  --skip-options set; participant_options inserts SKIPPED for this run. "
            "Legacy form's multi-select vocabulary does not match the OLOS option_lists "
            "seed (different questions, different answer sets — see issue #42 comment). "
            "Legacy participants will have empty participant_options until they re-answer "
            "via the OLOS form."
        )
        return
    insert_sql = """
        INSERT INTO public.participant_options (participant_id, option_id)
        VALUES (%s, %s)
        ON CONFLICT (participant_id, option_id) DO NOTHING
    """

    multi_select_rows = [
        m for m in mapping
        if m["destination_table"] == "participant_options"
        and "csv_split" in m["transform"]
    ]
    if not multi_select_rows:
        logger.warning("  no csv_split mapping rows; skipping pass 2")
        return

    counts = {"rows_scanned": 0, "tokens_split": 0, "would_insert": 0,
              "unmatched_token_halts": 0}
    unmatched: list[tuple[int, str, str, str]] = []

    by_sheet: dict[str, list[dict[str, str]]] = defaultdict(list)
    for m in multi_select_rows:
        by_sheet[m["source_sheet"]].append(m)

    for sheet, mrows in by_sheet.items():
        df = workbook.get(sheet)
        if df is None or df.empty:
            continue
        for idx, row in df.iterrows():
            email = t_lower_trim(row.get("Email Address"))
            if not email:
                continue
            pid = email_to_pid.get(email)
            if pid is None:
                logger.debug("  [%s row %d] email not in participants cache; skipping option fan-out", sheet, idx)
                continue
            for m in mrows:
                src = row.get(m["source_column"])
                tokens = t_csv_split(src)
                if not tokens:
                    continue
                counts["rows_scanned"] += 1
                match = LIST_NAME_RE.search(m["transform"])
                if not match:
                    logger.warning("  cannot extract list_name from transform=%r", m["transform"])
                    continue
                list_name = match.group(1)
                for token in tokens:
                    counts["tokens_split"] += 1
                    oid = options_cache.get((list_name, token))
                    if oid is None:
                        # HALT-worthy per folder doc §"Multi-select transforms".
                        # Defer the actual sys.exit until end of pass so the
                        # log shows the full set of unmatched tokens at once.
                        unmatched.append((idx, sheet, list_name, token))
                        continue
                    emit.execute(insert_sql, (pid, oid),
                                 preview_label=f"pass2.{list_name}[row{idx}]")
                    counts["would_insert"] += 1

    if unmatched:
        logger.error("Pass 2 — %d unmatched option_lists tokens:", len(unmatched))
        for idx, sheet, ln, tok in unmatched[:30]:
            logger.error("  [%s row %d] list=%s value=%r — NOT IN option_lists", sheet, idx, ln, tok)
        if len(unmatched) > 30:
            logger.error("  …%d more (truncated)", len(unmatched) - 30)
        sys.exit("Pass 2 halted on unmatched tokens. Either fix the legacy "
                 "data or add the value to option_lists, then re-run.")
    logger.info(
        "Pass 2 done — tokens_split=%d would_insert=%d unmatched=0",
        counts["tokens_split"], counts["would_insert"]
    )


# ─── pass 3 — problem_statements ──────────────────────────────────────────────

def pass3_problem_statements(
    emit: EmitContext,
    workbook: dict[str, pd.DataFrame],
    cycle: str,
    cycle_id: int,
    email_to_pid: dict[str, int],
    ops_email: str,
    anonymize: bool,
    salt: str,
) -> dict[str, int]:
    """Returns shortlist_key (e.g. '5') → problem_statements.id."""
    logger.info("=== Pass 3: problem_statements ===")
    stmt_to_psid: dict[str, int] = {}

    if cycle == "energy":
        # Energy submissions don't live in the workbook. Use the operator
        # shortlist as the seed for problem_statements (one row per
        # shortlisted pod). Submitter is the ops user — placeholder until
        # real submitter emails are wired through (likely never; Energy
        # voting closed before this script existed).
        ops_pid = email_to_pid.get(ops_email.lower().strip())
        if ops_pid is None:
            sys.exit(f"[Pass 3] ops email {ops_email!r} not in participants. "
                     f"Either add a participants row first or pass --ops-email "
                     f"matching a real participant.")
        for key, (_pod_name, statement_text) in ENERGY_POD_SHORTLIST.items():
            ps_id = _ensure_problem_statement(emit, cycle_id, ops_pid, statement_text, key)
            stmt_to_psid[key] = ps_id
        logger.info("Pass 3 done — created/reused %d problem_statements (operator shortlist for Energy)",
                    len(stmt_to_psid))
        return stmt_to_psid

    if cycle == "health":
        df = workbook.get("Problem Statement Submissions")
        if df is None or df.empty:
            logger.warning("  no Problem Statement Submissions rows; nothing to do")
            return stmt_to_psid
        col_email = "Email Address"
        col_stmt_short = next((c for c in df.columns if str(c).startswith("In one sentence")), None)
        if col_stmt_short is None:
            logger.error("  Problem Statement Submissions: cannot find 'In one sentence:' column")
            return stmt_to_psid
        for idx, row in df.iterrows():
            raw_email = t_lower_trim(row.get(col_email))
            if not raw_email:
                continue
            email = anon_email(raw_email, salt) if anonymize else raw_email
            pid = email_to_pid.get(email)
            if pid is None:
                logger.debug("  [Submissions row %d] email not in participants; skipping", idx)
                continue
            stmt = t_direct(row.get(col_stmt_short))
            if not stmt:
                continue
            ps_id = _ensure_problem_statement(emit, cycle_id, pid, stmt, f"health-{idx}")
            stmt_to_psid[f"health-{idx}"] = ps_id
        logger.info("Pass 3 done — %d Health problem_statements", len(stmt_to_psid))
        return stmt_to_psid

    return stmt_to_psid


def _ensure_problem_statement(
    emit: EmitContext,
    cycle_id: int,
    participant_id: int,
    statement_text: str,
    key: str,
) -> int:
    """Idempotent: SELECT-before-INSERT by (cycle_id, statement_text)."""
    # In dry-run, we still SELECT to detect existing rows so re-runs report
    # 'already_present' rather than 'would_insert'.
    cur = emit.conn.cursor()
    cur.execute(
        "SELECT id FROM public.problem_statements "
        "WHERE cycle_id = %s AND statement_text = %s",
        (cycle_id, statement_text),
    )
    existing = cur.fetchone()
    if existing:
        logger.debug("  [pass3] reusing problem_statement id=%d for key=%s", existing[0], key)
        return existing[0]
    pid = emit.execute(
        "INSERT INTO public.problem_statements (cycle_id, participant_id, statement_text) "
        "VALUES (%s, %s, %s) RETURNING id",
        (cycle_id, participant_id, statement_text),
        returning=True,
        preview_label=f"pass3.problem_statements[{key}]",
    )
    # In dry-run, emit.execute returns -1; assign a synthetic
    return pid if pid != -1 else -(1000 + abs(hash(key)) % 1000)


# ─── pass 4 — pods ────────────────────────────────────────────────────────────

def pass4_pods(
    emit: EmitContext,
    cycle: str,
    cycle_id: int,
    stmt_to_psid: dict[str, int],
) -> dict[str, int]:
    """Returns shortlist_key → pods.id."""
    logger.info("=== Pass 4: pods ===")
    shortlist: dict[str, tuple[str, str]] = {}
    if cycle == "energy":
        shortlist = ENERGY_POD_SHORTLIST
    elif cycle == "health":
        # Health shortlist is whatever problem_statements exist; pod names
        # would come from operator. Out of scope for this dry-run.
        logger.warning("  Health pod shortlist not configured; skipping Pass 4 for cycle=health")
        return {}

    stmt_to_podid: dict[str, int] = {}
    for key, (pod_name, _stmt) in shortlist.items():
        ps_id = stmt_to_psid.get(key)
        if ps_id is None:
            logger.warning("  Pass 4: no problem_statement_id for key=%s; skipping pod %r", key, pod_name)
            continue
        cur = emit.conn.cursor()
        cur.execute(
            "SELECT id FROM public.pods WHERE cycle_id = %s AND name = %s",
            (cycle_id, pod_name),
        )
        existing = cur.fetchone()
        if existing:
            stmt_to_podid[key] = existing[0]
            logger.debug("  [pass4] reusing pod id=%d name=%r", existing[0], pod_name)
            continue
        pod_id = emit.execute(
            "INSERT INTO public.pods (cycle_id, problem_statement_id, name, status) "
            "VALUES (%s, %s, %s, 'forming') RETURNING id",
            (cycle_id, ps_id, pod_name),
            returning=True,
            preview_label=f"pass4.pods[{key}={pod_name}]",
        )
        stmt_to_podid[key] = pod_id if pod_id != -1 else -(2000 + abs(hash(key)) % 1000)
    logger.info("Pass 4 done — pods mapped for %d shortlisted statements", len(stmt_to_podid))
    return stmt_to_podid


# ─── pass 5 — pod_memberships ─────────────────────────────────────────────────

SEAT_LABEL_RE = re.compile(r"^\s*(\d+)\.\s*(.+)$")


def _seat_key(label: str) -> Optional[str]:
    """Extract the leading number from a seat-preference label.
    'Recycling is confusing' (without number) returns None."""
    m = SEAT_LABEL_RE.match(label)
    return m.group(1) if m else None


def pass5_pod_memberships(
    emit: EmitContext,
    workbook: dict[str, pd.DataFrame],
    cycle: str,
    email_to_pid: dict[str, int],
    stmt_to_pid: dict[str, int],
    anonymize: bool,
    salt: str,
    is_prod: bool,
) -> None:
    logger.info("=== Pass 5: pod_memberships ===")
    sheet_name = {"energy": "Energy Pod Registration", "health": "Health Pod Registration"}.get(cycle)
    if sheet_name is None:
        logger.warning("  no pod-registration sheet for cycle=%s; skipping", cycle)
        return
    if is_prod and is_health_sheet(sheet_name):
        logger.warning("  prod connection + Health sheet — guard refused load earlier; nothing to do")
        return
    df = workbook.get(sheet_name)
    if df is None or df.empty:
        logger.warning("  no rows in '%s'; skipping", sheet_name)
        return

    insert_sql = """
        INSERT INTO public.pod_memberships (participant_id, pod_id, joined_at, preference_rank)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (participant_id, pod_id) DO UPDATE
        SET preference_rank = COALESCE(EXCLUDED.preference_rank, public.pod_memberships.preference_rank)
    """

    counts = {"rows": 0, "would_insert": 0, "skipped_no_email": 0,
              "skipped_no_pid": 0, "skipped_unknown_pod": 0, "skipped_blank_seat": 0}

    for idx, row in df.iterrows():
        counts["rows"] += 1
        raw_email = t_lower_trim(row.get("Email Address"))
        if not raw_email:
            counts["skipped_no_email"] += 1
            continue
        email = anon_email(raw_email, salt) if (anonymize and is_health_sheet(sheet_name)) else raw_email
        pid = email_to_pid.get(email)
        if pid is None:
            counts["skipped_no_pid"] += 1
            logger.debug("  [%s row %d] email not in participants; skipping", sheet_name, idx)
            continue
        joined_at = t_parse_date(row.get("Timestamp"))
        for rank, col in [(1, "Seat 1"), (2, "Seat 2"), (3, "Seat 3")]:
            seat_value = t_direct(row.get(col))
            if not seat_value:
                counts["skipped_blank_seat"] += 1
                continue
            key = _seat_key(seat_value)
            pod_id = stmt_to_pid.get(key) if key else None
            if pod_id is None:
                # Operator-deliberate skip (e.g. Fast Fashion #6 dropped from shortlist).
                logger.warning(
                    "  [%s row %d %s] seat=%s key=%s → no pod in shortlist; SKIP",
                    sheet_name, idx, col, seat_value[:40] + ("…" if len(seat_value) > 40 else ""), key
                )
                counts["skipped_unknown_pod"] += 1
                continue
            emit.execute(insert_sql, (pid, pod_id, joined_at, rank),
                         preview_label=f"pass5.pod_memberships[{sheet_name}/row{idx}/seat{rank}]")
            counts["would_insert"] += 1

    logger.info(
        "Pass 5 done — rows=%d would_insert=%d skipped: no_email=%d no_pid=%d unknown_pod=%d blank_seat=%d",
        counts["rows"], counts["would_insert"], counts["skipped_no_email"],
        counts["skipped_no_pid"], counts["skipped_unknown_pod"], counts["skipped_blank_seat"]
    )


# ─── pass 6 — votes ───────────────────────────────────────────────────────────

def pass6_votes(
    emit: EmitContext,
    workbook: dict[str, pd.DataFrame],
    cycle: str,
    cycle_id: int,
    email_to_pid: dict[str, int],
    stmt_to_psid: dict[str, int],
    anonymize: bool,
    salt: str,
    is_prod: bool,
) -> None:
    logger.info("=== Pass 6: votes ===")
    if cycle != "health":
        logger.info("  cycle=%s; Energy voting data not in workbook; skipping pass 6", cycle)
        return
    if is_prod:
        logger.warning("  prod connection — votes are staging fixture only; skipping")
        return
    df = workbook.get("Health Voting & Pods")
    if df is None or df.empty:
        logger.warning("  no Health Voting & Pods rows; skipping")
        return

    # Header is multi-level. Build flat names for the columns we need.
    insert_sql = """
        INSERT INTO public.votes (cycle_id, voter_id, problem_statement_id, vote_count)
        VALUES (%s, %s, %s, 1)
        ON CONFLICT (voter_id, problem_statement_id, cycle_id) DO NOTHING
    """
    counts = {"rows": 0, "would_insert": 0, "skipped_no_email": 0,
              "skipped_no_pid": 0, "skipped_unknown_stmt": 0, "skipped_blank_vote": 0}

    email_col = next((c for c in df.columns if isinstance(c, tuple) and c[0] == "Email Address"), None)
    vote_cols = [(c, c[0]) for c in df.columns
                 if isinstance(c, tuple) and c[0] in ("Vote 1", "Vote 2", "Vote 3")]
    if email_col is None or not vote_cols:
        logger.error("  Health Voting & Pods: expected (Email Address, *) and Vote 1/2/3 columns under multi-level header")
        return

    # Health uses problem_statements created during a Health-cycle Pass 3 run.
    # If Pass 3 didn't populate stmt_to_psid for Health (which it doesn't in
    # this script — Health Pass 3 not finalised), there's nothing to FK against.
    if not stmt_to_psid:
        logger.warning("  no Health problem_statements registered in pass 3; skipping pass 6")
        return

    for idx, row in df.iterrows():
        counts["rows"] += 1
        raw_email = t_lower_trim(row[email_col])
        if not raw_email:
            counts["skipped_no_email"] += 1
            continue
        email = anon_email(raw_email, salt) if anonymize else raw_email
        pid = email_to_pid.get(email)
        if pid is None:
            counts["skipped_no_pid"] += 1
            continue
        for col, _label in vote_cols:
            vote_value = t_direct(row[col])
            if not vote_value:
                counts["skipped_blank_vote"] += 1
                continue
            # Match by leading number → stmt_to_psid key (which keys as 'health-<idx>'
            # by submission row index in Pass 3 — this mapping is incomplete for
            # the voting fixture; flag and skip.
            counts["skipped_unknown_stmt"] += 1
            logger.debug("  [Voting row %d] vote=%r → no problem_statement_id lookup wired (stub)",
                         idx, vote_value[:30])

    logger.info(
        "Pass 6 done — rows=%d would_insert=%d skipped: no_email=%d no_pid=%d unknown_stmt=%d blank_vote=%d",
        counts["rows"], counts["would_insert"], counts["skipped_no_email"],
        counts["skipped_no_pid"], counts["skipped_unknown_stmt"], counts["skipped_blank_vote"]
    )


# ─── main ─────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Legacy spreadsheet → Postgres migration (W1-004).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK,
                   help="Path to the .xlsx workbook.")
    p.add_argument("--mapping-csv", type=Path, default=DEFAULT_MAPPING_CSV)
    p.add_argument("--cycle", choices=["energy", "health", "all"], default="energy")
    p.add_argument("--db-url", default=None,
                   help="Postgres DSN. Defaults to $SUPABASE_DB_URL from .env.local.")
    p.add_argument("--commit", action="store_true",
                   help="Actually write. Default is dry-run (print intended SQL).")
    p.add_argument("--anonymize", dest="anonymize", action="store_true", default=True,
                   help="Hash Health-row emails/names. Default ON for non-prod.")
    p.add_argument("--no-anonymize", dest="anonymize", action="store_false")
    p.add_argument("--skip-options", action="store_true",
                   help="Skip Pass 2 (participant_options). Use when the legacy form's "
                        "multi-select vocabulary does not match the OLOS option_lists "
                        "seed (true for the W1-004 import — Google Form asked different "
                        "questions than the OLOS form). Legacy participants get empty "
                        "options; they re-answer on first OLOS sign-in.")
    p.add_argument("--energy-only", action="store_true",
                   help="Narrow scope to the Energy pod cohort only. Skips Pass 1 "
                        "(Upskiller Registrations) entirely; Pass 1.5 stubs every "
                        "distinct email from Energy Pod Registration. Implies "
                        "--skip-options. Use when the migration's only goal is to "
                        "land the people you intend to magic-link, not the full "
                        "registration cohort.")
    p.add_argument("--ops-email", default="adm2216@columbia.edu",
                   help="Email of the participant who 'submits' Energy problem statements "
                        "(real Energy submitters not in workbook).")
    p.add_argument("--salt", default=os.getenv("OLOS_MIGRATE_SALT", "olos-local-2026"),
                   help="Anonymization salt; env-keyed so re-runs are deterministic.")
    p.add_argument("--log-file", type=Path, default=None,
                   help="Run log path. Default: scripts/migration/run_<timestamp>.log")
    p.add_argument("--verbose", action="store_true",
                   help="Include full sample SQL in stdout.")
    return p.parse_args()


def resolve_cycles(arg: str) -> list[str]:
    if arg == "all":
        return ["energy", "health"]
    return [arg]


def main() -> int:
    args = parse_args()
    log_file = setup_logging(args.log_file, args.verbose)
    logger.info("Log file: %s", log_file)
    load_dotenv(REPO_ROOT / ".env.local")
    dsn = args.db_url or os.getenv("SUPABASE_DB_URL")
    if not dsn:
        # Fall back to local supabase if --db-url not given and env unset.
        dsn = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
        logger.warning("No --db-url or SUPABASE_DB_URL — defaulting to local supabase (%s)", dsn)

    cycles = resolve_cycles(args.cycle)
    will_load_health = "health" in cycles
    guard_prod_connection(dsn, will_load_health, args.anonymize)
    is_prod = PROD_HOST_TOKEN in (parse_dsn_host(dsn) or "").lower()

    workbook = load_workbook(args.workbook)
    mapping = load_mapping(args.mapping_csv)

    dry_run = not args.commit
    logger.info("Mode: %s", "DRY-RUN (no writes)" if dry_run else "COMMIT (writing)")

    if args.verbose:
        dump_normalizer_rules()

    # Pass 0.5 — pre-write audit of CHECK-constrained column coercions.
    # Runs before any DB connection so it's safe even if the DSN is wrong.
    pass_0_5_normalization_audit(workbook, mapping)

    with psycopg.connect(dsn) as conn:
        conn.autocommit = False
        emit = EmitContext(conn=conn, dry_run=dry_run)
        try:
            options_cache = load_option_lists_cache(conn)
            existing_emails = load_existing_participants(conn)
            logger.info("Pre-existing participants in DB: %d", len(existing_emails))

            # --energy-only is the smallest-blast-radius mode: only the people
            # we intend to magic-link land in the DB. Pass 1 (Upskiller Reg) is
            # skipped entirely; Pass 1.5 stubs all distinct Energy-Pod-Reg
            # emails. Pass 2 is implicitly skipped (vocabulary mismatch is moot
            # when no rich profile data is loaded). Pass 6 skipped (Energy has
            # no vote data in the workbook).
            skip_options_effective = args.skip_options or args.energy_only

            for cycle in cycles:
                logger.info("─── cycle: %s ───", cycle)
                cycle_id, _ = verify_cycle(conn, CYCLE_NAMES[cycle])

                if args.energy_only:
                    logger.info("--energy-only: skipping Pass 1 (Upskiller Registrations)")
                    email_to_pid: dict[str, int] = dict(existing_emails)
                else:
                    email_to_pid = pass1_participants_and_enrollments(
                        emit, workbook, mapping, cycle_id,
                        args.anonymize, args.salt, existing_emails
                    )

                email_to_pid = pass1_5_orphan_stubs(
                    emit, workbook, cycle, cycle_id, email_to_pid, existing_emails
                )
                pass2_participant_options(
                    emit, workbook, mapping, email_to_pid, options_cache,
                    skip_options=skip_options_effective,
                )
                stmt_to_psid = pass3_problem_statements(
                    emit, workbook, cycle, cycle_id, email_to_pid, args.ops_email, args.anonymize, args.salt
                )
                stmt_to_pid = pass4_pods(emit, cycle, cycle_id, stmt_to_psid)
                pass5_pod_memberships(
                    emit, workbook, cycle, email_to_pid, stmt_to_pid, args.anonymize, args.salt, is_prod
                )
                pass6_votes(
                    emit, workbook, cycle, cycle_id, email_to_pid, stmt_to_psid,
                    args.anonymize, args.salt, is_prod
                )

            if dry_run:
                logger.info("Dry-run complete — no writes executed (no transaction opened).")
            else:
                conn.commit()
                logger.info("Committed all 6 passes.")
        except SystemExit:
            conn.rollback()
            raise
        except Exception:
            conn.rollback()
            logger.exception("Migration failed — rolled back.")
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
