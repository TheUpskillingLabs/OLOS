"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import SearchThumb from "@/app/components/search/search-thumb";
import { SEARCH_GROUP_LABELS, type SearchResult } from "@/lib/search/types";

/**
 * The app bar's LinkedIn-style global search — a compact dark-chrome input
 * with typeahead across people, pods, projects, events, local labs, and
 * cycles (GET /api/search/suggest).
 *
 * Desktop (≥900px): inline input that widens on focus; suggestions drop in a
 * white panel below (combobox/listbox semantics, arrow-key navigation).
 * Below 900px: an icon-only button linking to /search?focus=1 — the search
 * page autofocuses its own box. Escape and outside-click dismissal follow
 * the avatar-menu contract. Plain Enter and "See all results" land on
 * /search?q=….
 */

export default function NavSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced typeahead fetch; aborts stale requests. Short queries clear
  // the panel in the onChange handler, not here (no setState in effect body).
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const body = (await res.json()) as { results: SearchResult[] };
        setResults(body.results);
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        // aborted or offline — keep whatever is showing
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // Outside-click + Escape close — the avatar-menu contract.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const goToSearch = () => {
    const query = q.trim();
    setOpen(false);
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!open || results.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) =>
        e.key === "ArrowDown"
          ? (i + 1) % results.length
          : (i - 1 + results.length) % results.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0 && results[activeIndex]) {
        setOpen(false);
        router.push(results[activeIndex].href);
      } else if (q.trim()) {
        goToSearch();
      }
    }
  };

  return (
    <>
      {/* Below 900px: icon-only, lands on the search page's own box. */}
      <Link
        href="/search?focus=1"
        aria-label="Search"
        className="appnav-search-icon grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white min-[900px]:hidden"
      >
        <Search className="h-5 w-5" aria-hidden />
      </Link>

      <div
        ref={wrapRef}
        className="relative hidden shrink-0 min-[900px]:block"
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            if (value.trim().length < 2) {
              setResults([]);
              setOpen(false);
            }
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (results.length > 0 && q.trim().length >= 2) setOpen(true);
          }}
          placeholder="Search"
          aria-label="Search people, pods, projects, events, labs, and cycles"
          role="combobox"
          aria-expanded={open}
          aria-controls="nav-search-listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `nav-search-option-${activeIndex}` : undefined
          }
          className="h-9 w-[170px] rounded-[10px] border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/55 transition-[width,border-color,background] duration-200 focus:w-[260px] focus:border-white/30 focus:bg-white/15 focus:outline-none xl:w-[210px]"
        />
        {open && results.length > 0 && (
          <div
            id="nav-search-listbox"
            role="listbox"
            aria-label="Search suggestions"
            className="absolute left-0 top-[calc(100%+10px)] z-[210] max-h-[70vh] w-[320px] overflow-y-auto rounded-card border border-ink/10 bg-white p-2 shadow-lg"
          >
            {results.map((r, i) => {
              const groupStart = i === 0 || results[i - 1].type !== r.type;
              return (
                <div key={`${r.type}-${r.href}`}>
                  {groupStart && (
                    <div className="lbl" style={{ padding: "8px 12px 4px" }}>
                      {SEARCH_GROUP_LABELS[r.type]}
                    </div>
                  )}
                  <Link
                    id={`nav-search-option-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    href={r.href}
                    className={`menu-item${i === activeIndex ? " bg-teal/10" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    <SearchThumb result={r} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.label}</span>
                      {r.sublabel && (
                        <span className="block truncate text-xs font-normal text-meta">
                          {r.sublabel}
                        </span>
                      )}
                    </span>
                  </Link>
                </div>
              );
            })}
            <div className="menu-rule" />
            <button type="button" className="menu-item" onClick={goToSearch}>
              <Search className="h-4 w-4 shrink-0 text-meta" aria-hidden />
              See all results for “{q.trim()}”
            </button>
          </div>
        )}
      </div>
    </>
  );
}
