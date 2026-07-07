"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { EmptyState, Tabs } from "@/app/components/ui";
import { rankByQuery, statusRank } from "@/lib/directory/rank";
import type {
  DirectoryData,
  DirectoryPerson,
  DirectoryPod,
  DirectoryProject,
} from "@/lib/directory/types";
import { FilterDropdown } from "./filter-dropdown";
import { PersonRow, PodRow, ProjectRow, ResultList } from "./result-rows";

/**
 * The directory's search workspace — LinkedIn-style tabbed results (All /
 * People / Pods / Projects) over the server-fetched dataset, with a search
 * box and per-tab filters. Filtering is all client-side (the community is a
 * few hundred rows) and instant; the URL mirrors the state via
 * router.replace so results are shareable and back-button-friendly:
 *
 *   /directory?tab=pods&q=climate&cycle=3&status=active
 *
 * `updatesSlot` carries the Community-updates feed (an async RSC rendered by
 * the page) — shown only on the default, unfiltered All view.
 */

type Tab = "all" | "people" | "pods" | "projects";

interface SearchState {
  tab: Tab;
  q: string;
  metro: string | null;
  intent: string | null;
  cycle: string | null;
  status: string | null;
}

const INTENT_FILTERS: { key: string; label: string }[] = [
  { key: "cycle", label: "Builders" },
  { key: "mentor", label: "Mentors" },
  { key: "volunteer", label: "Volunteers" },
];

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "forming", label: "Forming" },
  { key: "inactive", label: "Inactive" },
];

function parseParams(params: URLSearchParams): SearchState {
  const tab = params.get("tab");
  return {
    tab:
      tab === "people" || tab === "pods" || tab === "projects" ? tab : "all",
    q: params.get("q") ?? "",
    metro: params.get("metro"),
    intent: params.get("intent"),
    cycle: params.get("cycle"),
    status: params.get("status"),
  };
}

function serialize(state: SearchState): string {
  const params = new URLSearchParams();
  if (state.tab !== "all") params.set("tab", state.tab);
  if (state.q) params.set("q", state.q);
  if (state.metro) params.set("metro", state.metro);
  if (state.intent) params.set("intent", state.intent);
  if (state.cycle) params.set("cycle", state.cycle);
  if (state.status) params.set("status", state.status);
  return params.toString();
}

export default function DirectorySearch({
  data,
  updatesSlot,
}: {
  data: DirectoryData;
  updatesSlot?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<SearchState>(() =>
    parseParams(new URLSearchParams(searchParams))
  );
  // The input tracks keystrokes; state.q follows after a debounce so
  // filtering (and the URL) don't churn on every character.
  const [qInput, setQInput] = useState(state.q);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setState((s) => (s.q === qInput.trim() ? s : { ...s, q: qInput.trim() }));
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // State → URL. Skip when already in sync (e.g. right after hydration).
  useEffect(() => {
    const qs = serialize(state);
    if (qs === serialize(parseParams(new URLSearchParams(searchParams)))) {
      return;
    }
    lastWritten.current = qs;
    router.replace(qs ? `/directory?${qs}` : "/directory", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  // URL → state, for changes we didn't write (back/forward, nav search).
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const qs = serialize(parseParams(params));
    if (lastWritten.current === qs) return;
    const next = parseParams(params);
    setState(next);
    setQInput(next.q);
  }, [searchParams]);

  // The mobile nav search icon lands on /directory?focus=1.
  useEffect(() => {
    if (new URLSearchParams(searchParams).get("focus")) {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { people, pods, projects, filterOptions } = data;
  const { tab, q, metro, intent, cycle, status } = state;

  // Cycle recency: filterOptions.cycles is already newest-first.
  const cycleOrder = useMemo(() => {
    const order = new Map<number, number>();
    filterOptions.cycles.forEach((c, i) => order.set(c.id, i));
    return order;
  }, [filterOptions.cycles]);

  const filteredPeople = useMemo(() => {
    let list = people; // already newest-first from the server
    if (metro) list = list.filter((p) => p.metroSlug === metro);
    if (intent) list = list.filter((p) => p.role_intents.includes(intent));
    if (cycle) list = list.filter((p) => p.cycleIds.includes(Number(cycle)));
    return rankByQuery(
      list,
      q,
      (p) => p.displayName,
      (p) => [p.headline, p.primary_expertise, p.metroName]
    );
  }, [people, q, metro, intent, cycle]);

  const matchesStatus = (s: string) =>
    !status ||
    (status === "inactive" ? s === "inactive" || s === "closed" : s === status);

  const filteredPods = useMemo(() => {
    let list = pods.filter((p) => matchesStatus(p.status));
    if (cycle) list = list.filter((p) => p.cycleId === Number(cycle));
    list = [...list].sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) ||
        (cycleOrder.get(a.cycleId ?? -1) ?? 99) -
          (cycleOrder.get(b.cycleId ?? -1) ?? 99) ||
        (a.name ?? "").localeCompare(b.name ?? "")
    );
    return rankByQuery(
      list,
      q,
      (p) => p.name ?? `Pod ${p.id}`,
      (p) => [p.statement, p.cycleName, p.moderatorNames.join(" ")]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pods, q, cycle, status, cycleOrder]);

  const filteredProjects = useMemo(() => {
    let list = projects.filter((p) => matchesStatus(p.status));
    if (cycle) list = list.filter((p) => p.cycleId === Number(cycle));
    list = [...list].sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) ||
        (cycleOrder.get(a.cycleId ?? -1) ?? 99) -
          (cycleOrder.get(b.cycleId ?? -1) ?? 99) ||
        (a.name ?? "").localeCompare(b.name ?? "")
    );
    return rankByQuery(
      list,
      q,
      (p) => p.name ?? `Project ${p.id}`,
      (p) => [p.summary, p.podName, p.cycleName]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, q, cycle, status, cycleOrder]);

  const activeFilterCount = [metro, intent, cycle, status].filter(
    Boolean
  ).length;
  const isDefaultView = tab === "all" && !q && activeFilterCount === 0;

  const set = (patch: Partial<SearchState>) =>
    setState((s) => ({ ...s, ...patch }));
  const resetAll = () => {
    setQInput("");
    set({ q: "", metro: null, intent: null, cycle: null, status: null });
  };

  const chipGroup = (
    options: { key: string; label: string }[],
    value: string | null,
    onPick: (v: string | null) => void
  ) =>
    options.map((o) => {
      const active = value === o.key;
      return (
        <button
          key={o.key}
          type="button"
          className={`chip${active ? " active" : ""}`}
          aria-pressed={active}
          onClick={() => onPick(active ? null : o.key)}
        >
          {o.label}
        </button>
      );
    });

  const showPeopleFilters = tab === "all" || tab === "people";
  const showStatusFilters = tab === "all" || tab === "pods" || tab === "projects";

  const emptyEverything =
    (tab === "all" &&
      filteredPeople.length + filteredPods.length + filteredProjects.length ===
        0) ||
    (tab === "people" && filteredPeople.length === 0) ||
    (tab === "pods" && filteredPods.length === 0) ||
    (tab === "projects" && filteredProjects.length === 0);

  return (
    <div>
      {/* Search box */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search people, pods, and projects…"
        value={qInput}
        onChange={(e) => setQInput(e.target.value)}
        aria-label="Search the directory"
        className="w-full max-w-xl rounded-card border border-ink/10 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-meta-soft focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15 transition-[border-color,box-shadow] duration-150"
      />

      {/* Tabs */}
      <Tabs
        className="mt-5"
        value={tab}
        onValueChange={(v) => set({ tab: v as Tab })}
        tabs={[
          { value: "all", label: "All" },
          {
            value: "people",
            label: "People",
            badge: (
              <span className="text-xs text-meta tabular-nums">
                {filteredPeople.length}
              </span>
            ),
          },
          {
            value: "pods",
            label: "Pods",
            badge: (
              <span className="text-xs text-meta tabular-nums">
                {filteredPods.length}
              </span>
            ),
          },
          {
            value: "projects",
            label: "Projects",
            badge: (
              <span className="text-xs text-meta tabular-nums">
                {filteredProjects.length}
              </span>
            ),
          },
        ]}
      />

      {/* Filter row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {showPeopleFilters && filterOptions.metros.length > 0 && (
          <FilterDropdown
            label="Location"
            anyLabel="Any location"
            value={metro}
            options={filterOptions.metros.map((m) => ({
              value: m.slug,
              label: m.label,
            }))}
            onChange={(v) => set({ metro: v })}
          />
        )}
        {filterOptions.cycles.length > 0 && (
          <FilterDropdown
            label="Cycle"
            anyLabel="Any cycle"
            value={cycle}
            options={filterOptions.cycles.map((c) => ({
              value: String(c.id),
              label: c.name,
            }))}
            onChange={(v) => set({ cycle: v })}
          />
        )}
        {showPeopleFilters &&
          chipGroup(INTENT_FILTERS, intent, (v) => set({ intent: v }))}
        {showStatusFilters &&
          chipGroup(STATUS_FILTERS, status, (v) => set({ status: v }))}
        {activeFilterCount > 0 && (
          <button
            type="button"
            className="ml-1 text-sm font-medium text-teal-deep hover:text-ink transition-colors duration-150"
            onClick={resetAll}
          >
            Reset filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Results */}
      <div className="mt-6 space-y-10">
        {emptyEverything ? (
          <EmptyState
            icon={SearchX}
            title="No results"
            description="Nothing in the directory matches your search. Try a different term, or clear the filters."
            action={
              <button
                type="button"
                className="btn btn-teal self-start"
                onClick={resetAll}
              >
                Clear search
              </button>
            }
          />
        ) : tab === "all" ? (
          <>
            <AllSection
              title="People"
              count={filteredPeople.length}
              onSeeAll={() => set({ tab: "people" })}
              items={filteredPeople.slice(0, q ? 3 : 5)}
              render={(p: DirectoryPerson) => <PersonRow key={p.id} person={p} />}
            />
            <AllSection
              title="Pods"
              count={filteredPods.length}
              onSeeAll={() => set({ tab: "pods" })}
              items={filteredPods.slice(0, q ? 3 : 5)}
              render={(p: DirectoryPod) => <PodRow key={p.id} pod={p} />}
            />
            <AllSection
              title="Projects"
              count={filteredProjects.length}
              onSeeAll={() => set({ tab: "projects" })}
              items={filteredProjects.slice(0, q ? 3 : 5)}
              render={(p: DirectoryProject) => (
                <ProjectRow key={p.id} project={p} />
              )}
            />
          </>
        ) : tab === "people" ? (
          <TabResults
            countLabel={`${filteredPeople.length} ${filteredPeople.length === 1 ? "member" : "members"}`}
          >
            {filteredPeople.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </TabResults>
        ) : tab === "pods" ? (
          <TabResults
            countLabel={`${filteredPods.length} ${filteredPods.length === 1 ? "pod" : "pods"}`}
          >
            {filteredPods.map((p) => (
              <PodRow key={p.id} pod={p} />
            ))}
          </TabResults>
        ) : (
          <TabResults
            countLabel={`${filteredProjects.length} ${filteredProjects.length === 1 ? "project" : "projects"}`}
          >
            {filteredProjects.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </TabResults>
        )}
      </div>

      {isDefaultView && updatesSlot && <div className="mt-10">{updatesSlot}</div>}
    </div>
  );
}

function AllSection<T>({
  title,
  count,
  items,
  onSeeAll,
  render,
}: {
  title: string;
  count: number;
  items: T[];
  onSeeAll: () => void;
  render: (item: T) => ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <h2 className="t-h3 text-ink">
          {title} <span className="text-meta tabular-nums">· {count}</span>
        </h2>
        {count > items.length && (
          <button type="button" className="see" onClick={onSeeAll}>
            See all →
          </button>
        )}
      </div>
      <ResultList>{items.map(render)}</ResultList>
    </section>
  );
}

function TabResults({
  countLabel,
  children,
}: {
  countLabel: string;
  children: ReactNode;
}) {
  return (
    <section>
      <p className="mb-3 text-sm text-meta tabular-nums">{countLabel}</p>
      <ResultList>{children}</ResultList>
    </section>
  );
}
