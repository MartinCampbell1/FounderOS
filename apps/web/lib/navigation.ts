import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Bot,
  BriefcaseBusiness,
  CheckSquare,
  ClipboardCheck,
  Eye,
  FolderKanban,
  GitBranch,
  Inbox,
  Kanban,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  MessageSquarePlus,
  Orbit,
  PenLine,
  PlayCircle,
  Puzzle,
  Search,
  Sparkles,
  Settings2,
  ShieldCheck,
  Sliders,
  Trophy,
  UserCircle,
  Vote,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type SectionKey =
  | "dashboard"
  | "review"
  | "discovery"
  | "execution"
  | "portfolio"
  | "inbox"
  | "settings";

export interface SubNavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavItem {
  key: SectionKey;
  label: string;
  href: string;
  icon: LucideIcon;
  children?: SubNavItem[];
}

export interface SectionGroup {
  title: string;
  items: string[];
}

export interface SectionModel {
  key: SectionKey;
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  highlights: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  groups: SectionGroup[];
  checklist: string[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "inbox",
    label: "Inbox",
    href: "/inbox",
    icon: Inbox,
  },
  {
    key: "discovery",
    label: "Discovery",
    href: "/discovery",
    icon: Orbit,
    children: [
      { key: "discovery:sessions", label: "Sessions", href: "/discovery", icon: MessageSquare },
      { key: "discovery:ideas", label: "Ideas", href: "/discovery/ideas", icon: Lightbulb },
      { key: "discovery:board", label: "Board", href: "/discovery/board", icon: Kanban },
      { key: "discovery:ranking", label: "Ranking", href: "/discovery/board/ranking", icon: Trophy },
      { key: "discovery:swipe", label: "Swipe Queue", href: "/discovery/board/simulations", icon: Zap },
      { key: "discovery:archive", label: "Archive", href: "/discovery/board/archive", icon: Archive },
      { key: "discovery:finals", label: "Finals", href: "/discovery/board/finals", icon: Vote },
      { key: "discovery:research", label: "Research", href: "/discovery/traces", icon: Search },
      { key: "discovery:intelligence", label: "Intelligence", href: "/discovery/intelligence", icon: GitBranch },
      { key: "discovery:improvement", label: "Improvement", href: "/discovery/improvement", icon: Sparkles },
      { key: "discovery:replays", label: "Replays", href: "/discovery/replays", icon: PlayCircle },
      { key: "discovery:authoring", label: "Authoring", href: "/discovery/authoring", icon: PenLine },
      { key: "discovery:review", label: "Review", href: "/discovery/review", icon: Eye },
    ],
  },
  {
    key: "execution",
    label: "Execution",
    href: "/execution",
    icon: Workflow,
    children: [
      { key: "execution:projects", label: "Projects", href: "/execution", icon: FolderKanban },
      { key: "execution:intake", label: "Intake", href: "/execution/intake", icon: MessageSquarePlus },
      { key: "execution:issues", label: "Issues", href: "/execution/issues", icon: AlertTriangle },
      { key: "execution:approvals", label: "Approvals", href: "/execution/approvals", icon: CheckSquare },
      { key: "execution:controlplane", label: "Control Plane", href: "/execution/review", icon: ShieldCheck },
      { key: "execution:audits", label: "Audits", href: "/execution/audits", icon: ShieldCheck },
      { key: "execution:events", label: "Events", href: "/execution/events", icon: Activity },
      { key: "execution:handoffs", label: "Handoffs", href: "/execution/handoffs", icon: ArrowRightLeft },
      { key: "execution:agents", label: "Agents", href: "/execution/agents", icon: Bot },
    ],
  },
  {
    key: "portfolio",
    label: "Portfolio",
    href: "/portfolio",
    icon: BriefcaseBusiness,
  },
  {
    key: "review",
    label: "Review",
    href: "/review",
    icon: ClipboardCheck,
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings2,
    children: [
      {
        key: "settings:preferences",
        label: "Preferences",
        href: "/settings",
        icon: Sliders,
      },
      {
        key: "settings:accounts",
        label: "Accounts",
        href: "/settings/accounts",
        icon: UserCircle,
      },
      {
        key: "settings:capabilities",
        label: "Capabilities",
        href: "/settings/capabilities",
        icon: Puzzle,
      },
    ],
  },
];

export const SECTION_MODELS: Record<SectionKey, SectionModel> = {
  dashboard: {
    key: "dashboard",
    eyebrow: "Unified Shell",
    title: "Cross-plane dashboard now runs inside the shell.",
    summary:
      "The dashboard has moved past bootstrap and now aggregates gateway health, discovery activity, execution load, and attention state in one shell-native route.",
    status: "Live cross-plane overview",
    highlights: [
      {
        label: "View",
        value: "cross-plane",
        detail: "Discovery, execution, and attention state share one route.",
      },
      {
        label: "Upstreams",
        value: "2 tracked",
        detail: "Quorum and Autopilot availability surface through the gateway.",
      },
      {
        label: "Mode",
        value: "snapshot",
        detail: "The shell starts with polling-first aggregate visibility before deeper unification.",
      },
    ],
    groups: [
      {
        title: "Current workstreams",
        items: [
          "Cross-plane snapshot over discovery sessions, ideas, execution projects, and attention items",
          "Gateway health displayed directly from the shell instead of buried in logs",
          "Unified summary cards now link into the migrated shell routes",
        ],
      },
      {
        title: "Immediate migration targets",
        items: [
          "Keep expanding shell-native overview routes instead of adding new legacy tabs",
          "Use dashboard to expose cross-plane bottlenecks before deeper control-plane moves",
          "Retain explicit source ownership while summary views become richer",
        ],
      },
    ],
    checklist: [
      "Keep the overview route partial-data tolerant when one upstream is offline",
      "Expand execution and discovery signals without flattening plane semantics",
      "Use shell-native dashboards as the default top-level operator surface",
    ],
  },
  review: {
    key: "review",
    eyebrow: "Cross-plane",
    title: "Unified review now keeps discovery and execution pressure on one route.",
    summary:
      "The shell now exposes a top-level /review surface that pulls discovery review and execution review into one scoped operator lane without flattening plane-specific semantics.",
    status: "Live cross-plane operator route",
    highlights: [
      {
        label: "Route",
        value: "/review",
        detail: "Server-seeded unified review center backed by a shell-owned snapshot seam.",
      },
      {
        label: "Coverage",
        value: "2 planes",
        detail: "Discovery authoring/trace/handoff review and execution issues/approvals/runtimes stay explicit.",
      },
      {
        label: "Scope",
        value: "chain-aware",
        detail: "project_id and intake_session_id remain attached while moving across review surfaces.",
      },
    ],
    groups: [
      {
        title: "Operator lanes",
        items: [
          "Discovery authoring, trace, replay, and handoff review pressure",
          "Execution issue, approval, and tool-permission triage",
          "Scoped deep links back into dossier, intake, project, dashboard, inbox, and settings routes",
        ],
      },
      {
        title: "Current rules",
        items: [
          "Keep unified review additive instead of replacing plane-specific review queues",
          "Keep discovery and execution filters explicit when opening their source routes",
          "Keep review reads on shell-owned `/api/shell/*` seams instead of raw upstream URLs",
        ],
      },
    ],
    checklist: [
      "Keep cross-plane review pressure visible without flattening discovery vs execution semantics",
      "Preserve route-owned chain scope while moving through the review loop",
      "Use unified review as the top-level operator lane, not as a replacement for source-plane detail routes",
    ],
  },
  discovery: {
    key: "discovery",
    eyebrow: "Quorum Plane",
    title: "Discovery now runs as shell-native routes instead of a copied Quorum shell.",
    summary:
      "The shell keeps Quorum as the source of truth for sessions, ranking, swipe, simulation, archive evolution, finals resolution, dossier review, dossier authoring, authoring backlog management, and review backlog routing while replacing the old local tab shell with server-seeded URL routes and same-origin shell seams.",
    status: "Live shell-native route set",
    highlights: [
      {
        label: "Upstream",
        value: "/api/shell/discovery/*",
        detail: "Browser traffic now enters discovery through shell-owned seams.",
      },
      {
        label: "Frontend",
        value: "route-owned",
        detail: "Sessions, dossiers, and the FounderOS board now render as shell routes.",
      },
      {
        label: "Risk",
        value: "upstream fidelity",
        detail: "Board actions still depend on Quorum semantics and must stay parity-safe.",
      },
    ],
    groups: [
      {
        title: "Primary screens",
        items: [
          "Session list and session monitor",
          "FounderOS board with ranking, swipe, and simulation lanes",
          "Dedicated ranking, archive frontier, finals, and simulation detail routes",
          "Observability trace coverage and debate replay routes",
          "Repo intelligence and prompt-improvement lab surfaces",
          "Discovery authoring queue for dossier coverage gaps",
          "Discovery review queue for authoring, trace, replay, and handoff decisions",
          "Idea authoring route for evidence, validation, decisions, and timeline events",
          "Discovery inbox and dossier/detail views",
        ],
      },
      {
        title: "Current rules",
        items: [
          "Keep discovery reads and writes anchored to `/api/shell/discovery/*`",
          "Preserve Quorum semantics while removing legacy local tab containers",
          "Keep ranking, archive, finals, and simulation detail flows shell-native instead of reviving the old board shell",
          "Keep trace and replay history on the same route-owned shell boundary as active discovery work",
          "Keep repo intelligence and prompt-improvement visibility behind shell-owned discovery routes instead of raw upstream tabs",
          "Keep authoring queue state on the same discovery read model as ideas, chains, dashboard, portfolio, and inbox",
          "Keep discovery review work explicit as a route-owned backlog instead of burying it inside traces, replays, or dashboard badges",
          "Keep dossier authoring writes on the same shell mutation layer as the rest of discovery",
          "Keep execution handoff explicit instead of hiding control-plane work inside discovery",
        ],
      },
    ],
    checklist: [
      "Keep route-owned scope intact across sessions, board, dossiers, and cross-plane returns",
      "Expand remaining discovery-specific surfaces without reintroducing bespoke loaders",
      "Keep authoring backlog visibility route-owned instead of reintroducing ad hoc dashboard-only badges",
      "Keep discovery review routing attached to authoring, traces, replays, and board-family detail routes",
      "Keep ranking archive, finals, and simulation labs on the same mutation/invalidation pipeline as the rest of discovery",
      "Keep repo intelligence and improvement-lab visibility shell-native so discovery operators can audit inputs and prompt pressure without leaving the product",
      "Keep observability and replay routes server-seeded instead of falling back to client-only history cards",
      "Keep evidence, validation, decision, and timeline authoring inside shell-owned routes instead of raw upstream forms",
      "Retire direct legacy discovery browser calls after shell parity is stable",
    ],
  },
  execution: {
    key: "execution",
    eyebrow: "Autopilot Plane",
    title: "Execution stays route-driven and keeps its control-plane semantics.",
    summary:
      "Autopilot already has the right page model. The shell now hosts those flows under /execution while preserving runtime control, approvals, issues, and explicit execution review work as route-owned surfaces.",
    status: "Live shell-native execution routes",
    highlights: [
      {
        label: "Upstream",
        value: "/api/*",
        detail: "Autopilot keeps its current API surface.",
      },
      {
        label: "Strength",
        value: "control plane",
        detail: "Project, runtime, audit, and approval views are already solid.",
      },
      {
        label: "Constraint",
        value: "no regressions",
        detail: "This area is the highest-complexity migration zone.",
      },
    ],
    groups: [
      {
        title: "Primary screens",
        items: [
          "Project list and intake flow",
          "Project workspace and runtime diagnostics",
          "Execution review queue for issues, approvals, tool permissions, and audits",
          "Control plane, approvals, accounts, and settings entry points",
        ],
      },
      {
        title: "Migration rules",
        items: [
          "Do not flatten control-plane semantics into a generic dashboard",
          "Keep SSE and runtime-specific hooks where they already work",
          "Expose all browser traffic through the shell gateway instead of direct :8420 access",
          "Keep execution review as a dedicated route-owned operator lane instead of burying it in inbox-only cards",
        ],
      },
    ],
    checklist: [
      "Keep execution typed clients anchored to /api/shell/execution/*",
      "Keep project list, intake, handoff, and execution review on one route-owned shell boundary",
      "Preserve runtime-monitoring fidelity while re-skinning the frame",
    ],
  },
  portfolio: {
    key: "portfolio",
    eyebrow: "Cross-plane",
    title: "Portfolio should link ideas, briefs, projects, and outcomes.",
    summary:
      "This page is shell-native. It should not invent new backend contracts before the shell can reliably trace brief_id, idea_id, project_id, and outcome references.",
    status: "Waiting on link-key stabilization",
    highlights: [
      {
        label: "Source",
        value: "aggregated",
        detail: "Portfolio composes data from both systems.",
      },
      {
        label: "Key risk",
        value: "false links",
        detail: "Name matching is not acceptable for production linkage.",
      },
      {
        label: "Mode",
        value: "polling-first",
        detail: "Aggregate screens should start simple before SSE unification.",
      },
    ],
    groups: [
      {
        title: "Required link keys",
        items: [
          "idea_id",
          "brief_id",
          "autopilot_project_id",
          "explicit handoff metadata",
        ],
      },
      {
        title: "First shell outcomes",
        items: [
          "One view of idea -> brief -> execution -> outcome",
          "Explicit orphan detection for missing links",
          "Deep links back into source-plane screens",
        ],
      },
    ],
    checklist: [
      "Audit current handoff payloads for stable keys",
      "Model aggregated portfolio records in TS before UI complexity grows",
      "Keep aggregation in the shell, not inside either backend for v1",
    ],
  },
  inbox: {
    key: "inbox",
    eyebrow: "Cross-plane",
    title: "Cross-plane inbox with explicit source ownership.",
    summary:
      "The shell now aggregates discovery inbox work, execution issues, approvals, and tool permission prompts while keeping plane-specific actions explicit.",
    status: "v1 live with safe inline actions",
    highlights: [
      {
        label: "Shape",
        value: "aggregated queue",
        detail: "Every card keeps source-plane badges and a deep-link target.",
      },
      {
        label: "Actions",
        value: "safe only",
        detail: "Resolve, approve, reject, allow, and deny stay narrow and explicit.",
      },
      {
        label: "Fallback",
        value: "deep links",
        detail: "Anything broader than a queue decision still opens the source route.",
      },
    ],
    groups: [
      {
        title: "Discovery-origin items",
        items: [
          "Research and dossier follow-ups",
          "Review and tournament actions",
          "Discovery inbox tasks",
        ],
      },
      {
        title: "Execution-origin items",
        items: [
          "Approvals and shadow audits",
          "Runtime interventions and blocked work",
          "Control-plane attention queues",
        ],
      },
    ],
    checklist: [
      "Keep source metadata visible on every inbox card",
      "Add richer dossier and project previews without flattening semantics",
      "Expand queue coverage only through explicit source-plane contracts",
    ],
  },
  settings: {
    key: "settings",
    eyebrow: "Shell config",
    title: "Settings expose runtime config, gateway seams, and shell controls.",
    summary:
      "This route now describes the actual shell runtime, shell route families, route ownership, migration coverage, and shell-owned operator controls without inventing upstream backend settings.",
    status: "Live config surface with shell-owned controls",
    highlights: [
      {
        label: "Shell port",
        value: "3737",
        detail: "Reported through the shell settings snapshot and configurable via FOUNDEROS_WEB_PORT.",
      },
      {
        label: "Quorum",
        value: "8800",
        detail: "Reachable through shell-owned `/api/shell/discovery/*` routes over the internal gateway boundary.",
      },
      {
        label: "Autopilot",
        value: "8420/api",
        detail: "Reachable through shell-owned `/api/shell/execution/*` routes over the internal gateway boundary.",
      },
    ],
    groups: [
      {
        title: "Current shell contracts",
        items: [
          "apps/web owns routing, layout, and same-origin gateway routes",
          "packages/ui owns shared shell primitives and theme provider",
          "packages/api-clients is the first home for browser-facing fetch helpers",
          "packages/config now owns shell-wide env resolution and fallback validation",
        ],
      },
      {
        title: "Next package candidates",
        items: [
          "packages/contracts for shared TS mirror types",
          "A durable server store for operator controls if cookie-backed shell state stops being enough",
          "Shared execution/discovery feature packages once route patterns settle",
        ],
      },
    ],
    checklist: [
      "Expand config validation from fallback warnings into stricter startup checks",
      "Decide whether cookie-backed operator controls are enough or need a durable server-side store",
      "Decide where canonical TS contract mirrors should live once the route shapes stabilize",
    ],
  },
};

export function sectionFromPathname(pathname: string): SectionKey {
  // Check direct top-level matches first (most specific wins)
  const topLevel = NAV_ITEMS.find((item) => pathname === item.href);
  if (topLevel) return topLevel.key;

  // Check child routes
  for (const item of NAV_ITEMS) {
    if (item.children) {
      for (const child of item.children) {
        if (pathname.startsWith(child.href) && child.href !== "/") {
          return item.key;
        }
      }
    }
  }

  // Fall back to prefix match on top-level items
  const prefix = NAV_ITEMS.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href)
  );
  return prefix?.key ?? "dashboard";
}
