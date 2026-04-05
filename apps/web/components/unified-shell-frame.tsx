"use client";

import {
  fetchShellRuntimeSnapshot,
  type ShellPreferences,
  type ShellRuntimeSnapshot,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Menu,
  MoonStar,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Search,
  SunMedium,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ShellEmptyState,
  ShellKeyboardHint,
  ShellOptionButton,
  ShellSearchField,
  ShellShortcutCombo,
  ShellShortcutLegend,
} from "@/components/shell/shell-screen-primitives";
import {
  NAV_ITEMS,
  SECTION_MODELS,
  sectionFromPathname,
  type SubNavItem,
} from "@/lib/navigation";
import {
  buildRememberedReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import {
  DEFAULT_SHELL_PREFERENCES,
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import {
  buildDashboardScopeHref,
  buildInboxScopeHref,
  EMPTY_SHELL_ROUTE_SCOPE,
  buildSettingsScopeHref,
  hasShellRouteScope,
  readShellRouteScopeFromSearchParams,
  withShellRouteScope,
} from "@/lib/route-scope";
import { EMPTY_RUNTIME_SNAPSHOT } from "@/lib/runtime";

type CommandPaletteItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  icon?: LucideIcon;
  group: "Navigation" | "Quick Actions" | "Settings" | "Scope";
  badges?: Array<{
    label: string;
    tone: "info" | "warning" | "danger" | "neutral" | "success";
  }>;
  searchText: string;
  shortcut?: string;
};

/* ── Keyboard chord routes ───────────────────────────────── */

const CHORD_ROUTES: Record<string, string> = {
  d: "/dashboard",
  i: "/inbox",
  s: "/discovery",
  a: "/discovery/ideas",
  b: "/discovery/board",
  r: "/discovery/board/ranking",
  w: "/discovery/board/simulations",
  e: "/execution",
  n: "/execution/intake",
  c: "/execution/review",
  p: "/portfolio",
  v: "/review",
  t: "/settings",
};

const SHORTCUT_REFERENCE: ReadonlyArray<{
  label: string;
  keys: string;
}> = [
  { label: "Dashboard", keys: "G then D" },
  { label: "Inbox", keys: "G then I" },
  { label: "Sessions", keys: "G then S" },
  { label: "Ideas", keys: "G then A" },
  { label: "Board", keys: "G then B" },
  { label: "Ranking", keys: "G then R" },
  { label: "Simulations", keys: "G then W" },
  { label: "Execution", keys: "G then E" },
  { label: "New project", keys: "G then N" },
  { label: "Control plane", keys: "G then C" },
  { label: "Portfolio", keys: "G then P" },
  { label: "Review", keys: "G then V" },
  { label: "Settings", keys: "G then T" },
  { label: "Command palette", keys: "\u2318K" },
  { label: "Shortcuts reference", keys: "?" },
];

/** Map from command palette item id to chord shortcut display string. */
const COMMAND_SHORTCUT_MAP: Record<string, string> = {
  "nav:dashboard": "G D",
  "nav:inbox": "G I",
  "nav:discovery:sessions": "G S",
  "nav:discovery:ideas": "G A",
  "nav:discovery:board": "G B",
  "nav:discovery:ranking": "G R",
  "nav:discovery:swipe": "G W",
  "nav:execution:projects": "G E",
  "nav:execution:intake": "G N",
  "nav:execution:controlplane": "G C",
  "nav:portfolio": "G P",
  "nav:review": "G V",
  "settings:preferences": "G T",
};

/* ── Sidebar nav sections ─────────────────────────────────── */

const TOP_NAV_KEYS = ["dashboard", "inbox"] as const;
const COLLAPSIBLE_NAV_KEYS = ["discovery", "execution", "settings"] as const;
const FLAT_MID_NAV_KEYS = ["portfolio", "review"] as const;

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsHydrated();

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const label = mounted ? (isDark ? "Light" : "Dark") : "Theme";

  return (
    <button
      type="button"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--shell-sidebar-muted)] transition-colors hover:bg-[color:var(--shell-control-hover)] hover:text-foreground"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      title={label}
    >
      {mounted && isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </button>
  );
}

function UnifiedShellFrameContent({
  children,
  routeScope,
  initialRuntimeSnapshot,
  initialPreferences,
}: {
  children: React.ReactNode;
  routeScope: { projectId: string; intakeSessionId: string };
  initialRuntimeSnapshot?: ShellRuntimeSnapshot | null;
  initialPreferences?: ShellPreferences | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const activeSection = sectionFromPathname(pathname);
  const { preferences, updatePreferences } = useShellPreferences(
    initialPreferences ?? undefined
  );
  const isHydrated = useIsHydrated();
  const activeCommandButtonRef = useRef<HTMLButtonElement | null>(null);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandActiveId, setCommandActiveId] = useState<string | null>(null);
  const [chordMode, setChordMode] = useState(false);
  const chordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const scopeActive = hasShellRouteScope(routeScope);
  const renderSidebarCollapsed = isHydrated
    ? preferences.sidebarCollapsed
    : DEFAULT_SHELL_PREFERENCES.sidebarCollapsed;
  const healthPollInterval = getShellPollInterval(
    "health_strip",
    preferences.refreshProfile
  );
  const loadRuntimeSnapshot = useCallback(() => fetchShellRuntimeSnapshot(), []);
  const selectLoadState = useCallback(
    (snapshot: ShellRuntimeSnapshot) => snapshot.loadState,
    []
  );
  const { snapshot: runtimeSnapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_RUNTIME_SNAPSHOT,
    initialSnapshot: initialRuntimeSnapshot,
    refreshNonce: 0,
    pollIntervalMs: healthPollInterval,
    loadSnapshot: loadRuntimeSnapshot,
    selectLoadState,
  });
  const reviewMemoryBucket = useMemo(
    () => resolveReviewMemoryBucket({ scope: routeScope }),
    [routeScope]
  );
  const reviewHref = useMemo(
    () =>
      buildRememberedReviewScopeHref({
        scope: routeScope,
        preferences,
        bucket: reviewMemoryBucket,
      }),
    [preferences, reviewMemoryBucket, routeScope]
  );
  const scopedNavItems = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        href:
          item.key === "review"
            ? reviewHref
            : withShellRouteScope(item.href, routeScope),
        children: item.children?.map((child) => ({
          ...child,
          href: withShellRouteScope(child.href, routeScope),
        })),
      })),
    [reviewHref, routeScope]
  );
  const scopedSettingsHref = useMemo(
    () => buildSettingsScopeHref(routeScope),
    [routeScope]
  );

  // Collapsible section state — auto-expand sections whose children match the current path
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of NAV_ITEMS) {
      if (item.children) {
        const anyChildActive = item.children.some((child) =>
          pathname.startsWith(child.href) && child.href !== "/"
        );
        if (anyChildActive || pathname.startsWith(item.href)) {
          initial.add(item.key);
        }
      }
    }
    return initial;
  });

  // Auto-expand sections on client-side navigation
  useEffect(() => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      for (const item of NAV_ITEMS) {
        if (item.children) {
          const anyChildActive = item.children.some(
            (child) => pathname.startsWith(child.href) && child.href !== "/"
          );
          if (anyChildActive || pathname.startsWith(item.href)) {
            next.add(item.key);
          }
        }
      }
      return next;
    });
  }, [pathname]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  /* ── Command palette items ─────────────────────────────── */

  /** Extra search keywords per command id for richer fuzzy matching. */
  const COMMAND_KEYWORDS: Record<string, string> = {
    "nav:dashboard": "home overview",
    "nav:inbox": "notifications queue attention",
    "nav:discovery:sessions": "chat conversation session",
    "nav:discovery:ideas": "brainstorm concept",
    "nav:discovery:board": "kanban pipeline",
    "nav:discovery:ranking": "leaderboard score ranking",
    "nav:discovery:swipe": "tinder swipe simulation",
    "nav:discovery:research": "trace observability search",
    "nav:discovery:authoring": "write author dossier",
    "nav:discovery:replays": "replay history debate",
    "nav:execution:projects": "project list",
    "nav:execution:intake": "chat new project intake",
    "nav:execution:controlplane": "review approve control",
    "nav:execution:handoffs": "handoff transfer",
    "nav:portfolio": "portfolio investments outcomes",
    "nav:review": "review audit cross-plane",
    "settings:preferences": "preferences config options",
    "settings:accounts": "accounts providers api keys",
    "settings:capabilities": "capabilities features flags tools",
    "action:new-session": "new session start chat",
    "action:new-project": "new project create intake",
  };

  const commandItems = useMemo((): CommandPaletteItem[] => {
    const isCurrentRoute = (href: string) =>
      href !== "/" && pathname.startsWith(href);

    // ── Navigation items (parent sections + all children) ──
    const navItems: CommandPaletteItem[] = [];

    for (const item of scopedNavItems) {
      // Skip settings — handled separately below
      if (item.key === "settings") continue;

      // Top-level items without children get a single entry
      if (!item.children || item.children.length === 0) {
        const cmdId = `nav:${item.key}`;
        navItems.push({
          id: cmdId,
          label: item.label,
          detail: SECTION_MODELS[item.key].title,
          href: item.href,
          icon: item.icon,
          group: "Navigation",
          badges: isCurrentRoute(item.href)
            ? [{ label: "Current", tone: "info" as const }]
            : [],
          shortcut: COMMAND_SHORTCUT_MAP[cmdId],
          searchText: [
            item.label,
            item.key,
            SECTION_MODELS[item.key].title,
            COMMAND_KEYWORDS[cmdId] ?? "",
          ]
            .join(" ")
            .toLowerCase(),
        });
        continue;
      }

      // For sections with children, emit each child as a separate entry
      for (const child of item.children) {
        const cmdId = `nav:${child.key.replace(":", ":")}`;
        navItems.push({
          id: cmdId,
          label: `${item.label} > ${child.label}`,
          detail: child.href,
          href: child.href,
          icon: child.icon,
          group: "Navigation",
          badges: isCurrentRoute(child.href)
            ? [{ label: "Current", tone: "info" as const }]
            : [],
          shortcut: COMMAND_SHORTCUT_MAP[cmdId],
          searchText: [
            item.label,
            child.label,
            item.key,
            child.key,
            child.href,
            COMMAND_KEYWORDS[cmdId] ?? "",
          ]
            .join(" ")
            .toLowerCase(),
        });
      }
    }

    // Discovery > Replays (not in sidebar nav but required in palette)
    const replaysHref = withShellRouteScope("/discovery/replays", routeScope);
    navItems.push({
      id: "nav:discovery:replays",
      label: "Discovery > Replays",
      detail: "/discovery/replays",
      href: replaysHref,
      icon: Play,
      group: "Navigation",
      badges: isCurrentRoute(replaysHref)
        ? [{ label: "Current", tone: "info" as const }]
        : [],
      searchText: [
        "discovery",
        "replays",
        "/discovery/replays",
        COMMAND_KEYWORDS["nav:discovery:replays"] ?? "",
      ]
        .join(" ")
        .toLowerCase(),
    });

    // ── Settings items ──
    const settingsParent = scopedNavItems.find((i) => i.key === "settings");
    const settingsEntries: Array<{
      id: string;
      label: string;
      href: string;
      icon?: LucideIcon;
    }> = [
      {
        id: "settings:preferences",
        label: "Settings > Preferences",
        href: withShellRouteScope("/settings", routeScope),
        icon: settingsParent?.children?.find(
          (c) => c.key === "settings:preferences"
        )?.icon,
      },
      {
        id: "settings:accounts",
        label: "Settings > Accounts",
        href: withShellRouteScope("/settings/accounts", routeScope),
        icon: settingsParent?.children?.find(
          (c) => c.key === "settings:accounts"
        )?.icon,
      },
      {
        id: "settings:capabilities",
        label: "Settings > Capabilities",
        href: withShellRouteScope("/settings/capabilities", routeScope),
        icon: settingsParent?.children?.find(
          (c) => c.key === "settings:capabilities"
        )?.icon,
      },
    ];

    const settingsItems: CommandPaletteItem[] = settingsEntries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      detail: entry.href,
      href: entry.href,
      icon: entry.icon,
      group: "Settings" as const,
      badges: isCurrentRoute(entry.href)
        ? [{ label: "Current", tone: "info" as const }]
        : [],
      shortcut: COMMAND_SHORTCUT_MAP[entry.id],
      searchText: [
        "settings",
        entry.label,
        entry.id,
        COMMAND_KEYWORDS[entry.id] ?? "",
      ]
        .join(" ")
        .toLowerCase(),
    }));

    // ── Quick actions ──
    const quickActions: CommandPaletteItem[] = [
      {
        id: "action:new-session",
        label: "New session",
        detail: "Start a new discovery session",
        href: withShellRouteScope("/discovery", routeScope),
        icon: Plus,
        group: "Quick Actions",
        badges: [],
        searchText: [
          "new session",
          "discovery",
          COMMAND_KEYWORDS["action:new-session"] ?? "",
        ]
          .join(" ")
          .toLowerCase(),
      },
      {
        id: "action:new-project",
        label: "New project",
        detail: "Start a new execution intake",
        href: withShellRouteScope("/execution/intake", routeScope),
        icon: Plus,
        group: "Quick Actions",
        badges: [],
        searchText: [
          "new project",
          "execution intake",
          COMMAND_KEYWORDS["action:new-project"] ?? "",
        ]
          .join(" ")
          .toLowerCase(),
      },
    ];

    // ── Scope items ──
    const scopeItems: CommandPaletteItem[] = scopeActive
      ? [
          {
            id: "scope:settings",
            label: "Open scoped settings",
            detail: "Settings for current scope",
            href: buildSettingsScopeHref(routeScope),
            group: "Scope",
            badges: [{ label: "Current scope", tone: "info" }],
            searchText: "open scoped settings current scope",
          },
          {
            id: "scope:dashboard",
            label: "Open scoped dashboard",
            detail: "Dashboard for current scope",
            href: buildDashboardScopeHref(routeScope),
            group: "Scope",
            badges: [{ label: "Current scope", tone: "info" }],
            searchText: "open scoped dashboard current scope",
          },
          {
            id: "scope:inbox",
            label: "Open scoped inbox",
            detail: "Inbox for current scope",
            href: buildInboxScopeHref(routeScope),
            group: "Scope",
            badges: [{ label: "Current scope", tone: "info" }],
            searchText: "open scoped inbox current scope",
          },
          {
            id: "scope:review",
            label: "Open scoped review",
            detail: "Review for current scope",
            href: reviewHref,
            group: "Scope",
            badges: [{ label: "Current scope", tone: "info" }],
            searchText: "open scoped review current scope",
          },
          {
            id: "scope:clear",
            label: "Clear current scope",
            detail: "Remove scope filters",
            href: pathname || "/dashboard",
            group: "Scope",
            badges: [{ label: "Scope reset", tone: "warning" }],
            searchText: "clear current scope",
          },
        ]
      : [];

    return [...quickActions, ...navItems, ...settingsItems, ...scopeItems];
  }, [pathname, reviewHref, routeScope, scopeActive, scopedNavItems]);

  const filteredCommandItems = useMemo(() => {
    const normalizedQuery = commandQuery.trim().toLowerCase();
    if (!normalizedQuery) return commandItems;
    return commandItems.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.detail.toLowerCase().includes(normalizedQuery) ||
        item.searchText.includes(normalizedQuery)
    );
  }, [commandItems, commandQuery]);

  const activeCommandId = useMemo(() => {
    if (filteredCommandItems.length === 0) return null;
    return filteredCommandItems.some((item) => item.id === commandActiveId)
      ? commandActiveId
      : filteredCommandItems[0]?.id ?? null;
  }, [commandActiveId, filteredCommandItems]);

  const groupedCommandItems = useMemo(
    () => ({
      quickActions: filteredCommandItems.filter(
        (item) => item.group === "Quick Actions"
      ),
      navigation: filteredCommandItems.filter(
        (item) => item.group === "Navigation"
      ),
      settings: filteredCommandItems.filter(
        (item) => item.group === "Settings"
      ),
      scope: filteredCommandItems.filter((item) => item.group === "Scope"),
    }),
    [filteredCommandItems]
  );

  const closeCommandPalette = useCallback(() => {
    setCommandOpen(false);
    setCommandQuery("");
    setCommandActiveId(null);
  }, []);

  const openCommandPalette = useCallback(() => {
    setCommandOpen(true);
    setCommandQuery("");
    setCommandActiveId(null);
  }, []);

  const runCommandItem = useCallback(
    (item: CommandPaletteItem) => {
      closeCommandPalette();
      router.push(item.href);
    },
    [closeCommandPalette, router]
  );

  const moveCommandSelection = useCallback(
    (direction: 1 | -1) => {
      if (filteredCommandItems.length === 0) return;
      const currentIndex = filteredCommandItems.findIndex(
        (item) => item.id === activeCommandId
      );
      const nextIndex =
        currentIndex < 0
          ? 0
          : (currentIndex + direction + filteredCommandItems.length) %
            filteredCommandItems.length;
      setCommandActiveId(filteredCommandItems[nextIndex]?.id ?? null);
    },
    [activeCommandId, filteredCommandItems]
  );

  useEffect(() => {
    document.documentElement.dataset.shellSidebarCollapsed = preferences.sidebarCollapsed
      ? "true"
      : "false";
  }, [preferences.sidebarCollapsed]);

  useEffect(() => {
    if (!commandOpen) return;
    const timer = window.setTimeout(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [commandOpen]);

  useEffect(() => {
    if (!commandOpen || !activeCommandId) return;
    activeCommandButtonRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeCommandId, commandOpen]);

  useEffect(() => {
    function handleGlobalKeydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);

      // Cmd/Ctrl+K opens command palette (even from within it)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (isTypingTarget && !commandOpen) return;
        event.preventDefault();
        openCommandPalette();
        return;
      }

      // Escape closes command palette or shortcut overlay
      if (event.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        closeCommandPalette();
        return;
      }

      // Skip chord/shortcut keys when typing in an input or when command palette is open
      if (isTypingTarget || commandOpen) return;

      // ? toggles shortcut reference overlay
      if (event.key === "?" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setShowShortcuts((s) => !s);
        return;
      }

      // Chord mode: second key press navigates
      if (chordMode) {
        const route = CHORD_ROUTES[event.key.toLowerCase()];
        if (route) {
          event.preventDefault();
          router.push(route);
        }
        setChordMode(false);
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);
        return;
      }

      // G starts chord mode
      if (event.key === "g" && !event.metaKey && !event.ctrlKey) {
        setChordMode(true);
        chordTimeoutRef.current = setTimeout(() => setChordMode(false), 1000);
      }
    }

    window.addEventListener("keydown", handleGlobalKeydown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);
      if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current);
    };
  }, [chordMode, closeCommandPalette, commandOpen, openCommandPalette, router, showShortcuts]);

  const sidebarClassName = useMemo(
    () =>
      cn(
        "shell-sidebar-panel fixed inset-y-0 left-0 z-40 flex max-w-[85vw] flex-col border-r text-[var(--shell-sidebar-foreground)] transition-transform duration-200 md:static md:z-auto md:max-w-none md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      ),
    [mobileOpen]
  );

  const renderCommandGroup = useCallback(
    (title: string, items: CommandPaletteItem[]) => {
      if (items.length === 0) return null;
      return (
        <div>
          <div className="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </div>
          <div className="mt-2 space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeCommandId === item.id;
              return (
                <ShellOptionButton
                  key={item.id}
                  onClick={() => runCommandItem(item)}
                  onMouseEnter={() => setCommandActiveId(item.id)}
                  active={isActive}
                  buttonRef={
                    isActive
                      ? activeCommandButtonRef
                      : undefined
                  }
                  className={cn(
                    "px-3 py-2.5",
                    isActive && "border-l-2 border-primary bg-primary/[0.08]"
                  )}
                  title={
                    <span className="text-[13px] font-medium text-foreground">
                      {Icon ? (
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                          {item.label}
                        </span>
                      ) : (
                        item.label
                      )}
                    </span>
                  }
                  description={
                    <span className="text-[12px] text-muted-foreground/60">{item.detail}</span>
                  }
                  badges={item.badges?.map((badge) => (
                    <Badge key={`${item.id}:${badge.label}`} tone={badge.tone}>
                      {badge.label}
                    </Badge>
                  ))}
                  trailing={
                    isActive ? (
                      <ShellShortcutCombo keys={["Enter"]} />
                    ) : item.shortcut ? (
                      <kbd className="inline-flex items-center justify-center rounded-[4px] border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_1px_rgba(255,255,255,0.04)]">{item.shortcut}</kbd>
                    ) : (
                      <ShellKeyboardHint>Go</ShellKeyboardHint>
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      );
    },
    [activeCommandButtonRef, activeCommandId, runCommandItem]
  );

  /* ── Render nav link ───────────────────────────────────── */
  function renderNavLink(item: (typeof scopedNavItems)[number]) {
    const Icon = item.icon;
    const isActive = activeSection === item.key;
    return (
      <Link
        key={item.key}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "shell-nav-item group flex h-8 items-center gap-2 rounded-md text-[13px] transition-colors",
          renderSidebarCollapsed ? "justify-center px-0" : "px-2",
          isActive
            ? "bg-[color:var(--shell-nav-active)] font-medium text-foreground"
            : "font-normal text-[var(--shell-sidebar-muted)] hover:bg-[color:var(--shell-control-hover)] hover:text-[var(--shell-sidebar-foreground)]"
        )}
        data-active={isActive}
        aria-label={item.label}
      >
        <Icon className="h-[16px] w-[16px] shrink-0" />
        {renderSidebarCollapsed ? null : <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  function renderSubNavLink(child: SubNavItem & { href: string }) {
    const Icon = child.icon;
    const isActive = pathname.startsWith(child.href) && child.href !== "/";
    return (
      <Link
        key={child.key}
        href={child.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "shell-nav-item group flex h-7 items-center gap-2 rounded-md pl-[28px] pr-2 text-[13px] transition-colors",
          isActive
            ? "bg-[color:var(--shell-nav-active)] font-medium text-foreground"
            : "font-normal text-[var(--shell-sidebar-muted)] hover:bg-[color:var(--shell-control-hover)] hover:text-[var(--shell-sidebar-foreground)]"
        )}
        data-active={isActive}
        aria-label={child.label}
      >
        <Icon className="h-[14px] w-[14px] shrink-0" />
        <span className="truncate">{child.label}</span>
      </Link>
    );
  }

  function renderCollapsibleSection(item: (typeof scopedNavItems)[number]) {
    const Icon = item.icon;
    const isExpanded = expandedSections.has(item.key);
    const isActive = activeSection === item.key;

    if (renderSidebarCollapsed) {
      // Collapsed mode: just show the parent icon
      return (
        <Link
          key={item.key}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "group flex h-8 items-center justify-center rounded-md text-[13px] font-medium transition-colors",
            isActive
              ? "bg-[color:var(--shell-nav-active)] text-foreground"
              : "text-[var(--shell-sidebar-muted)] hover:bg-[color:var(--shell-control-hover)] hover:text-[var(--shell-sidebar-foreground)]"
          )}
          aria-label={item.label}
        >
          <Icon className="h-[16px] w-[16px] shrink-0" />
        </Link>
      );
    }

    return (
      <div key={item.key} className="shell-sidebar-copy">
        <button
          type="button"
          onClick={() => toggleSection(item.key)}
          className={cn(
            "group/collapse flex h-8 w-full items-center justify-between rounded-md px-2 text-[13px] font-medium transition-colors",
            isActive
              ? "text-foreground"
              : "text-[var(--shell-sidebar-muted)] hover:bg-[color:var(--shell-control-hover)] hover:text-[var(--shell-sidebar-foreground)]"
          )}
        >
          <span className="flex items-center gap-2">
            <Icon className="h-[16px] w-[16px] shrink-0" />
            <span>{item.label}</span>
          </span>
          <ChevronRight
            className={cn(
              "h-3 w-3 opacity-40 transition-transform duration-150 group-hover/collapse:opacity-100",
              isExpanded && "rotate-90"
            )}
          />
        </button>
        {isExpanded && item.children ? (
          <div className="mt-0.5 space-y-0.5">
            {item.children.map((child) =>
              renderSubNavLink(child as SubNavItem & { href: string })
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const topNavItems = scopedNavItems.filter((item) =>
    (TOP_NAV_KEYS as readonly string[]).includes(item.key)
  );
  const collapsibleNavItems = scopedNavItems.filter((item) =>
    (COLLAPSIBLE_NAV_KEYS as readonly string[]).includes(item.key)
  );
  const flatMidNavItems = scopedNavItems.filter((item) =>
    (FLAT_MID_NAV_KEYS as readonly string[]).includes(item.key)
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Command Palette ─────────────────────────────── */}
      {commandOpen ? (
        <>
          <button
            type="button"
            aria-label="Close command palette"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]"
            onClick={closeCommandPalette}
          />
          <div className="fixed inset-x-4 top-[8vh] z-[60] mx-auto w-full max-w-[720px]">
            <div className="overflow-hidden rounded-xl border border-[color:var(--shell-control-border)]/50 bg-popover text-popover-foreground shadow-[0_16px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="border-b border-[color:var(--shell-control-border)] p-3">
                <ShellSearchField
                  value={commandQuery}
                  onChange={(event) => {
                    setCommandQuery(event.target.value);
                    setCommandActiveId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveCommandSelection(1);
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveCommandSelection(-1);
                      return;
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const nextItem = filteredCommandItems.find(
                        (item) => item.id === activeCommandId
                      );
                      if (nextItem) runCommandItem(nextItem);
                    }
                  }}
                  placeholder="Type a command or search..."
                  className="w-full"
                  inputClassName="bg-transparent text-[15px] border-none placeholder:text-muted-foreground/40 focus:shadow-none"
                  accessory={<ShellKeyboardHint>Esc</ShellKeyboardHint>}
                  inputRef={commandInputRef}
                />
              </div>
              <div className="max-h-[62vh] overflow-y-auto p-3">
                <div className="space-y-4">
                  {renderCommandGroup(
                    "Quick Actions",
                    groupedCommandItems.quickActions
                  )}
                  {renderCommandGroup(
                    "Navigation",
                    groupedCommandItems.navigation
                  )}
                  {renderCommandGroup(
                    "Settings",
                    groupedCommandItems.settings
                  )}
                  {renderCommandGroup("Scope", groupedCommandItems.scope)}
                  {filteredCommandItems.length === 0 ? (
                    <ShellEmptyState
                      description="No command matched the current query."
                      className="py-4"
                    />
                  ) : null}
                </div>
              </div>
              <div className="border-t border-[color:var(--shell-control-border)] px-3 py-2.5">
                <ShellShortcutLegend
                  items={[
                    { keys: ["↑", "↓"], label: "move" },
                    { keys: ["Enter"], label: "open" },
                    { keys: ["Esc"], label: "close" },
                  ]}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* ── Keyboard shortcut reference overlay ────────── */}
      {showShortcuts ? (
        <>
          <button
            type="button"
            aria-label="Close shortcuts reference"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]"
            onClick={() => setShowShortcuts(false)}
          />
          <div className="fixed inset-x-4 top-[15vh] z-[60] mx-auto w-full max-w-[480px] rounded-2xl border border-[color:var(--shell-control-border)]/50 bg-popover p-6 shadow-[var(--shadow-elevated,0_16px_70px_rgba(0,0,0,0.45))]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close shortcuts reference"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="space-y-0">
              {SHORTCUT_REFERENCE.map((entry, idx) => (
                <div
                  key={entry.label}
                  className={cn(
                    "flex justify-between py-2",
                    idx < SHORTCUT_REFERENCE.length - 1 && "border-b border-border/40"
                  )}
                >
                  <span className="text-[13px] text-muted-foreground">{entry.label}</span>
                  <kbd className="inline-flex items-center justify-center rounded-[4px] border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-[0_1px_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_1px_rgba(255,255,255,0.04)]">{entry.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* ── Chord mode indicator ───────────────────────── */}
      {chordMode ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-in fade-in duration-150 rounded-full bg-foreground/95 px-4 py-1.5 text-[11px] font-medium tracking-wide text-background shadow-[var(--shadow-elevated,0_8px_30px_rgba(0,0,0,0.35))] backdrop-blur-lg">
          G pressed — waiting for next key...
        </div>
      ) : null}

      {/* ── Layout ──────────────────────────────────────── */}
      <div className="flex min-h-screen">
        {/* ── Sidebar ─────────────────────────────────── */}
        <div className={sidebarClassName}>
          {/* Workspace switcher */}
          <div className="flex items-center gap-2 px-4 py-3">
            <Link
              href={buildDashboardScopeHref(routeScope)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#5e6ad2] to-[#4850b8] text-[10px] font-bold text-white shadow-sm"
            >
              FO
            </Link>
            {renderSidebarCollapsed ? null : (
              <>
                <Link
                  href={buildDashboardScopeHref(routeScope)}
                  className="shell-sidebar-copy min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--shell-sidebar-foreground)]"
                >
                  FounderOS
                </Link>
                <ChevronDown className="shell-sidebar-copy h-3.5 w-3.5 shrink-0 text-[var(--shell-sidebar-muted)]" />
              </>
            )}
            {renderSidebarCollapsed ? null : (
              <div className="shell-sidebar-copy ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--shell-sidebar-muted)] transition-colors hover:bg-[color:var(--shell-control-hover)] hover:text-[var(--shell-sidebar-foreground)]"
                  onClick={openCommandPalette}
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-3 py-1">
            {/* Top nav: Dashboard, Inbox */}
            <nav className="space-y-0.5">
              {topNavItems.map(renderNavLink)}
            </nav>

            {/* Collapsible sections: Discovery, Execution */}
            <div className={renderSidebarCollapsed ? "mt-2 space-y-0.5" : "shell-sidebar-copy mt-3 space-y-0.5"}>
              {collapsibleNavItems
                .filter((item) => item.key !== "settings")
                .map(renderCollapsibleSection)}
            </div>

            {/* Flat mid items: Portfolio, Review */}
            <nav className={renderSidebarCollapsed ? "mt-2 space-y-0.5" : "shell-sidebar-copy mt-3 space-y-0.5"}>
              {flatMidNavItems.map(renderNavLink)}
            </nav>

            {/* Configuration section: Settings (collapsible) */}
            <div className={renderSidebarCollapsed ? "mt-2 space-y-0.5" : "shell-sidebar-copy mt-3 space-y-0.5"}>
              {collapsibleNavItems
                .filter((item) => item.key === "settings")
                .map(renderCollapsibleSection)}
            </div>
          </div>

          {/* Sidebar footer */}
          {renderSidebarCollapsed ? null : (
            <div className="shell-sidebar-copy border-t border-[color:var(--shell-sidebar-border)] px-4 py-3">
              <Link
                href="#"
                className="flex items-center gap-2 text-[12px] text-[var(--shell-sidebar-muted)] opacity-60 transition-opacity hover:opacity-100"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Help</span>
              </Link>
            </div>
          )}

          {/* Sidebar collapse toggle (desktop) */}
          <div className="hidden border-t border-[color:var(--shell-sidebar-border)] p-2 md:block">
            <button
              type="button"
              className="flex h-7 w-full items-center justify-center rounded-md text-[var(--shell-sidebar-muted)] opacity-40 transition-opacity hover:opacity-100"
              onClick={() =>
                updatePreferences({
                  sidebarCollapsed: !preferences.sidebarCollapsed,
                })
              }
              aria-label={renderSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {renderSidebarCollapsed ? (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Mobile grid nav */}
          <div className="border-t border-[color:var(--shell-sidebar-border)] p-4 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              {scopedNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-[color:var(--shell-control-border)] px-3 py-2 text-[13px]",
                      isActive
                        ? "bg-[color:var(--shell-nav-active)] text-foreground"
                        : "text-[var(--shell-sidebar-muted)]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile overlay */}
        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
        ) : null}

        {/* ── Main content ────────────────────────────── */}
        <div className="min-w-0 flex-1 bg-background">
          <header className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-[color:var(--shell-topbar-border)] bg-[color:var(--shell-topbar-bg)] px-5 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex rounded-md p-1.5 text-foreground md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <h1 className="truncate text-[13px] font-semibold text-foreground">
                {NAV_ITEMS.find((item) => item.key === activeSection)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>

          <main className="pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function UnifiedShellFrame({
  children,
  initialRuntimeSnapshot,
  initialPreferences,
}: {
  children: React.ReactNode;
  initialRuntimeSnapshot?: ShellRuntimeSnapshot | null;
  initialPreferences?: ShellPreferences | null;
}) {
  const searchParams = useSearchParams();
  const routeScope = useMemo(
    () => readShellRouteScopeFromSearchParams(searchParams),
    [searchParams]
  );

  return (
    <UnifiedShellFrameContent
      routeScope={routeScope}
      initialRuntimeSnapshot={initialRuntimeSnapshot}
      initialPreferences={initialPreferences}
    >
      {children}
    </UnifiedShellFrameContent>
  );
}

export function UnifiedShellFrameFallback({
  children,
  initialRuntimeSnapshot,
  initialPreferences,
}: {
  children: React.ReactNode;
  initialRuntimeSnapshot?: ShellRuntimeSnapshot | null;
  initialPreferences?: ShellPreferences | null;
}) {
  return (
    <UnifiedShellFrameContent
      routeScope={EMPTY_SHELL_ROUTE_SCOPE}
      initialRuntimeSnapshot={initialRuntimeSnapshot}
      initialPreferences={initialPreferences}
    >
      {children}
    </UnifiedShellFrameContent>
  );
}
