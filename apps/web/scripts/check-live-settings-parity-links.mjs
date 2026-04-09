import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const contractPath = join(appRoot, "lib", "shell-browser-contract.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const externalBaseUrl = (process.env.FOUNDEROS_PARITY_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const buildIdPath = join(appRoot, ".next", "BUILD_ID");

if (!externalBaseUrl && !existsSync(buildIdPath)) {
  console.error(
    "Missing production build for @founderos/web. Run `npm run build --workspace @founderos/web` first.",
  );
  process.exit(1);
}

const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3970 + Math.floor(Math.random() * 100));
const baseUrl = externalBaseUrl || `http://${host}:${port}`;
const shellAdminToken = (
  process.env.FOUNDEROS_SHELL_ADMIN_TOKEN || "shell-settings-admin-token"
).trim();
const SUITE_TARGET_KEYS = ["discovery-pass", "critical-pass", "decision-pass"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function firstString(value) {
  return String(value || "").trim();
}

function buildScopedHref(pathname, scope, extras = []) {
  const params = new URLSearchParams();
  if (scope?.projectId) {
    params.set("project_id", scope.projectId);
  }
  if (scope?.intakeSessionId) {
    params.set("intake_session_id", scope.intakeSessionId);
  }
  for (const [key, value] of extras) {
    if (!value) {
      continue;
    }
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function assertIncludes(html, value, label) {
  assert(html.includes(value), `Missing ${label} text in SSR HTML: ${value}`);
}

function extractHrefsByPathPrefix(html, pathPrefix) {
  const pattern = /href="([^"]+)"/g;
  const matches = [];

  for (const match of html.matchAll(pattern)) {
    const href = String(match[1] || "").replace(/&amp;/g, "&");
    if (!pathPrefix || href.startsWith(pathPrefix)) {
      matches.push(href);
    }
  }

  if (matches.length === 0) {
    throw new Error(`Missing ${pathPrefix || "href"} in SSR HTML.`);
  }

  return matches;
}

function selectScopedSettingsHref(html, check) {
  const matches = extractHrefsByPathPrefix(html, "/settings");
  const scoredMatches = matches.map((href) => {
    const url = new URL(href, "http://founderos-shell.local");
    const projectId = firstString(url.searchParams.get("project_id"));
    const intakeSessionId = firstString(
      url.searchParams.get("intake_session_id"),
    );
    const ideaId = firstString(url.searchParams.get("idea_id"));
    const sessionId = firstString(url.searchParams.get("session_id"));
    let score = 0;

    if (url.pathname === "/settings") score += 1;
    if (projectId === check.scope.projectId) score += 2;
    if (intakeSessionId === check.scope.intakeSessionId) score += 2;
    if (ideaId) score += 1;
    if (sessionId) score += 1;
    if (check.requireIdea && ideaId) score += 4;
    if (check.requireSession && sessionId) score += 4;

    return {
      href,
      score,
      pathname: url.pathname,
      projectId,
      intakeSessionId,
      ideaId,
      sessionId,
    };
  });

  const exactMatch = scoredMatches.find((match) => {
    if (match.pathname !== "/settings") {
      return false;
    }
    if (match.projectId !== check.scope.projectId) {
      return false;
    }
    if (match.intakeSessionId !== check.scope.intakeSessionId) {
      return false;
    }
    if (check.requireIdea && !match.ideaId) {
      return false;
    }
    if (check.requireSession && !match.sessionId) {
      return false;
    }
    return true;
  });

  if (exactMatch) {
    return exactMatch.href;
  }

  const debugCandidates = scoredMatches
    .sort((left, right) => right.score - left.score)
    .map((match) => match.href)
    .join(", ");

  throw new Error(
    `Missing suitable ${check.label} scoped settings href in SSR HTML. Candidates: ${debugCandidates}`,
  );
}

function parseSuiteTargets(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    throw new Error(
      "FOUNDEROS_REVIEW_SUITE_TARGETS_JSON is required for settings parity link checks.",
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `FOUNDEROS_REVIEW_SUITE_TARGETS_JSON must contain valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const normalized = {};
  for (const preset of SUITE_TARGET_KEYS) {
    const target = parsed?.[preset];
    assert(
      target && typeof target === "object",
      `Missing suite target for ${preset}.`,
    );
    normalized[preset] = {
      preset,
      role: firstString(target.role),
      scenario: firstString(target.scenario),
      routeScope: {
        projectId: firstString(target.routeScope?.projectId),
        intakeSessionId: firstString(target.routeScope?.intakeSessionId),
      },
      parityTargets: {
        discoverySessionId: firstString(
          target.parityTargets?.discoverySessionId,
        ),
        discoveryIdeaId: firstString(target.parityTargets?.discoveryIdeaId),
      },
    };
  }

  return normalized;
}

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Timed out waiting for shell server at ${url}.`);
}

async function fetchHtml(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: shellAdminToken
      ? { "x-founderos-shell-admin-token": shellAdminToken }
      : {},
  });
  const html = await response.text();
  assert(
    response.status === 200,
    `Expected 200 for ${path}, received ${response.status}.`,
  );
  return html;
}

function assertSettingsPage(html, check) {
  assertIncludes(html, "Route scope", `${check.label} settings route scope`);
  assertIncludes(
    html,
    "Resolved parity targets",
    `${check.label} resolved parity targets`,
  );
  assertIncludes(
    html,
    "Scoped parity playbooks",
    `${check.label} parity playbooks`,
  );
  assertIncludes(
    html,
    "Browser contract audit",
    `${check.label} browser contract audit`,
  );
  assertIncludes(
    html,
    "Upstream parity audit",
    `${check.label} upstream parity audit`,
  );
  assertIncludes(
    html,
    "FOUNDEROS_PARITY_PROJECT_ID=",
    `${check.label} scoped project env key`,
  );
  assertIncludes(
    html,
    "FOUNDEROS_PARITY_INTAKE_SESSION_ID=",
    `${check.label} scoped intake env key`,
  );
  assertIncludes(html, check.scope.projectId, `${check.label} project id`);
  assertIncludes(
    html,
    check.scope.intakeSessionId,
    `${check.label} intake session id`,
  );

  if (check.parityTargets.discoveryIdeaId) {
    assertIncludes(
      html,
      "FOUNDEROS_PARITY_DISCOVERY_IDEA_ID=",
      `${check.label} scoped idea env key`,
    );
    assertIncludes(
      html,
      check.parityTargets.discoveryIdeaId,
      `${check.label} discovery idea id`,
    );
  }

  if (check.parityTargets.discoverySessionId) {
    assertIncludes(
      html,
      "FOUNDEROS_PARITY_DISCOVERY_SESSION_ID=",
      `${check.label} scoped session env key`,
    );
    assertIncludes(
      html,
      check.parityTargets.discoverySessionId,
      `${check.label} discovery session id`,
    );
  }
}

function assertScopedSettingsHref(href, check) {
  const url = new URL(href, "http://founderos-shell.local");
  assert(
    url.pathname === "/settings",
    `${check.label} scoped settings must target /settings, received ${url.pathname}.`,
  );
  assert(
    url.searchParams.get("project_id") === check.scope.projectId,
    `${check.label} scoped settings must preserve project_id=${check.scope.projectId}.`,
  );
  assert(
    url.searchParams.get("intake_session_id") === check.scope.intakeSessionId,
    `${check.label} scoped settings must preserve intake_session_id=${check.scope.intakeSessionId}.`,
  );
  if (check.requireIdea) {
    assert(
      Boolean(url.searchParams.get("idea_id")),
      `${check.label} scoped settings must carry idea_id.`,
    );
  }
  if (check.requireSession) {
    assert(
      Boolean(url.searchParams.get("session_id")),
      `${check.label} scoped settings must carry session_id.`,
    );
  }
  return {
    href: `${url.pathname}${url.search}`,
    scope: {
      projectId: firstString(url.searchParams.get("project_id")),
      intakeSessionId: firstString(url.searchParams.get("intake_session_id")),
    },
    parityTargets: {
      discoverySessionId: firstString(url.searchParams.get("session_id")),
      discoveryIdeaId: firstString(url.searchParams.get("idea_id")),
    },
  };
}

let lastStdout = "";
let lastStderr = "";
const server = externalBaseUrl
  ? null
  : spawn("npm", ["run", "start"], {
      cwd: appRoot,
      env: {
        ...process.env,
        FOUNDEROS_WEB_HOST: host,
        FOUNDEROS_WEB_PORT: port,
        FOUNDEROS_SHELL_ADMIN_TOKEN: shellAdminToken,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

server?.stdout.on("data", (chunk) => {
  lastStdout += chunk.toString();
  lastStdout = lastStdout.slice(-4000);
});
server?.stderr.on("data", (chunk) => {
  lastStderr += chunk.toString();
  lastStderr = lastStderr.slice(-4000);
});

const teardown = async () => {
  if (!server || server.killed || server.exitCode !== null) {
    return;
  }

  server.kill("SIGINT");
  await new Promise((resolveExit) => {
    server.once("exit", () => resolveExit());
    setTimeout(resolveExit, 2000);
  });
};

try {
  await waitForServer(`${baseUrl}${contract.liveRoutes.runtime}`);

  const suiteTargets = parseSuiteTargets(
    process.env.FOUNDEROS_REVIEW_SUITE_TARGETS_JSON || "",
  );
  const discoveryTarget = suiteTargets["discovery-pass"];
  const criticalTarget = suiteTargets["critical-pass"];
  const decisionTarget = suiteTargets["decision-pass"];

  const checks = [
    {
      key: "dashboard",
      label: "dashboard",
      sourceHref: buildScopedHref("/dashboard", discoveryTarget.routeScope),
      scope: discoveryTarget.routeScope,
      requireIdea: true,
      requireSession: false,
    },
    {
      key: "portfolio",
      label: "portfolio",
      sourceHref: buildScopedHref("/portfolio", decisionTarget.routeScope),
      scope: decisionTarget.routeScope,
      requireIdea: true,
      requireSession: false,
    },
    {
      key: "review",
      label: "review center",
      sourceHref: buildScopedHref("/review", discoveryTarget.routeScope, [
        ["lane", "handoff"],
        ["preset", "discovery-pass"],
      ]),
      scope: discoveryTarget.routeScope,
      requireIdea: false,
      requireSession: false,
    },
    {
      key: "discovery-review",
      label: "discovery review",
      sourceHref: buildScopedHref(
        "/discovery/review",
        discoveryTarget.routeScope,
        [["filter", "handoff"]],
      ),
      scope: discoveryTarget.routeScope,
      requireIdea: false,
      requireSession: false,
    },
    {
      key: "execution-review",
      label: "execution review",
      sourceHref: buildScopedHref(
        "/execution/review",
        criticalTarget.routeScope,
        [["filter", "linked"]],
      ),
      scope: criticalTarget.routeScope,
      requireIdea: true,
      requireSession: false,
    },
    {
      key: "discovery-authoring",
      label: "discovery authoring",
      sourceHref: buildScopedHref(
        `/discovery/ideas/${decisionTarget.parityTargets.discoveryIdeaId}/authoring`,
        decisionTarget.routeScope,
      ),
      scope: decisionTarget.routeScope,
      requireIdea: true,
      requireSession: false,
    },
    {
      key: "discovery-traces",
      label: "discovery traces",
      sourceHref: buildScopedHref(
        `/discovery/traces/${criticalTarget.parityTargets.discoveryIdeaId}`,
        criticalTarget.routeScope,
      ),
      scope: criticalTarget.routeScope,
      requireIdea: true,
      requireSession: true,
    },
  ];

  const resolvedChecks = [];
  for (const check of checks) {
    const html = await fetchHtml(check.sourceHref);
    assertIncludes(
      html,
      "Open scoped settings",
      `${check.label} scoped settings label`,
    );
    const actualSettingsHref = selectScopedSettingsHref(html, check);
    resolvedChecks.push({
      ...check,
      ...assertScopedSettingsHref(actualSettingsHref, check),
    });
  }

  const uniqueSettingsChecks = [];
  const seenSettingsHrefs = new Set();
  for (const check of resolvedChecks) {
    if (seenSettingsHrefs.has(check.href)) {
      continue;
    }
    seenSettingsHrefs.add(check.href);
    uniqueSettingsChecks.push(check);
  }

  for (const check of uniqueSettingsChecks) {
    const html = await fetchHtml(check.href);
    assertSettingsPage(html, check);
  }

  console.log(
    JSON.stringify({
      status: "ok",
      checks: resolvedChecks.map((check) => ({
        key: check.key,
        sourceHref: check.sourceHref,
        settingsHref: check.href,
      })),
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (lastStdout.trim()) {
    console.error(`shell stdout:\n${lastStdout}`);
  }
  if (lastStderr.trim()) {
    console.error(`shell stderr:\n${lastStderr}`);
  }
  process.exitCode = 1;
} finally {
  await teardown();
}
