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
    "Missing production build for @founderos/web. Run `npm run build --workspace @founderos/web` first."
  );
  process.exit(1);
}

const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3950 + Math.floor(Math.random() * 100));
const baseUrl = externalBaseUrl || `http://${host}:${port}`;
const SUITE_TARGET_KEYS = [
  "discovery-pass",
  "critical-pass",
  "decision-pass",
];
const PRESET_DEFINITIONS = [
  {
    key: "discovery-pass",
    label: "Discovery pass",
  },
  {
    key: "critical-pass",
    label: "Critical pass",
  },
  {
    key: "decision-pass",
    label: "Decision pass",
  },
  {
    key: "chain-pass",
    label: "Chain pass",
  },
];

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

function buildReviewHref(scope, lane, preset) {
  return buildScopedHref("/review", scope, [
    ["lane", lane],
    ["preset", preset],
  ]);
}

function htmlContainsHref(html, href) {
  return html.includes(`href="${href}"`) || html.includes(`href="${href.replace(/&/g, "&amp;")}"`);
}

function assertHref(html, href, label) {
  assert(htmlContainsHref(html, href), `Missing ${label} href in SSR HTML: ${href}`);
}

function assertIncludes(html, value, label) {
  assert(html.includes(value), `Missing ${label} text in SSR HTML: ${value}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractHrefByLabel(html, label, pathPrefix) {
  const pattern = new RegExp(
    `href="([^"]+)"[^>]*>[\\s\\S]{0,240}?${escapeRegex(label)}`,
    "g"
  );

  for (const match of html.matchAll(pattern)) {
    const href = String(match[1] || "").replace(/&amp;/g, "&");
    if (!pathPrefix || href.startsWith(pathPrefix)) {
      return href;
    }
  }

  throw new Error(`Missing ${label} href in SSR HTML.`);
}

function assertScopeHref(href, pathname, scope, label) {
  const url = new URL(href, "http://founderos-shell.local");
  assert(url.pathname === pathname, `${label} must target ${pathname}, received ${url.pathname}.`);
  assert(
    url.searchParams.get("project_id") === scope.projectId,
    `${label} must preserve project_id=${scope.projectId}.`
  );
  assert(
    url.searchParams.get("intake_session_id") === scope.intakeSessionId,
    `${label} must preserve intake_session_id=${scope.intakeSessionId}.`
  );
  return url;
}

function parseSuiteTargets(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    throw new Error(
      "FOUNDEROS_REVIEW_SUITE_TARGETS_JSON is required for review-pressure entry-link checks."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `FOUNDEROS_REVIEW_SUITE_TARGETS_JSON must contain valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const normalized = {};
  for (const preset of SUITE_TARGET_KEYS) {
    const target = parsed?.[preset];
    assert(target && typeof target === "object", `Missing suite target for ${preset}.`);
    normalized[preset] = {
      preset,
      role: firstString(target.role),
      scenario: firstString(target.scenario),
      routeScope: {
        projectId: firstString(target.routeScope?.projectId),
        intakeSessionId: firstString(target.routeScope?.intakeSessionId),
      },
      parityTargets: {
        discoverySessionId: firstString(target.parityTargets?.discoverySessionId),
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
  const response = await fetch(`${baseUrl}${path}`);
  const html = await response.text();
  assert(response.status === 200, `Expected 200 for ${path}, received ${response.status}.`);
  return html;
}

function assertReviewPresetPage(html, scope, presetLabel, clearLane) {
  assertIncludes(html, "Preset playbooks", `${presetLabel} preset panel`);
  assertIncludes(html, "Active preset:", `${presetLabel} active preset`);
  assertIncludes(html, presetLabel, `${presetLabel} preset label`);
  assertIncludes(html, "Clear preset", `${presetLabel} clear preset action`);
  const clearPresetHref = extractHrefByLabel(
    html,
    "Clear preset",
    "/review"
  );
  const clearPresetUrl = assertScopeHref(
    clearPresetHref,
    "/review",
    scope,
    `${presetLabel} clear preset`
  );
  if (typeof clearLane === "string") {
    assert(
      clearPresetUrl.searchParams.get("lane") === clearLane,
      `${presetLabel} clear preset must preserve lane=${clearLane}.`
    );
  }
}

function assertScopedReviewRoute(html, label) {
  assertIncludes(html, "Route scope", `${label} route scope`);
  assertIncludes(html, "Batch triage", `${label} batch triage`);
}

function reviewPresetFromUrl(url, label) {
  const presetKey = url.searchParams.get("preset");
  const preset = PRESET_DEFINITIONS.find((option) => option.key === presetKey);
  assert(
    preset,
    `${label} must carry a valid preset. Received ${presetKey || "<none>"}.`
  );
  return preset;
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
    process.env.FOUNDEROS_REVIEW_SUITE_TARGETS_JSON || ""
  );
  const discoveryTarget = suiteTargets["discovery-pass"];
  const criticalTarget = suiteTargets["critical-pass"];
  const decisionTarget = suiteTargets["decision-pass"];

  const dashboardHref = buildScopedHref("/dashboard", discoveryTarget.routeScope);
  const dashboardHtml = await fetchHtml(dashboardHref);
  assertIncludes(dashboardHtml, "Review pressure", "dashboard review pressure");

  const openReviewCenterHref = extractHrefByLabel(
    dashboardHtml,
    "Open review center",
    "/review"
  );
  const openDiscoveryReviewHref = extractHrefByLabel(
    dashboardHtml,
    "Open discovery review",
    "/discovery/review"
  );
  const openExecutionReviewHref = extractHrefByLabel(
    dashboardHtml,
    "Open execution review",
    "/execution/review"
  );

  const openReviewCenterUrl = assertScopeHref(
    openReviewCenterHref,
    "/review",
    discoveryTarget.routeScope,
    "dashboard open review center"
  );
  const openDiscoveryReviewUrl = assertScopeHref(
    openDiscoveryReviewHref,
    "/discovery/review",
    discoveryTarget.routeScope,
    "dashboard open discovery review"
  );
  const openExecutionReviewUrl = assertScopeHref(
    openExecutionReviewHref,
    "/execution/review",
    discoveryTarget.routeScope,
    "dashboard open execution review"
  );

  for (const preset of PRESET_DEFINITIONS) {
    assertHref(
      dashboardHtml,
      buildReviewHref(discoveryTarget.routeScope, null, preset.key),
      `dashboard ${preset.key} preset chip`
    );
  }

  const rememberedReviewHtml = await fetchHtml(openReviewCenterHref);
  const rememberedPresetKey = PRESET_DEFINITIONS.find(
    (preset) => preset.key === openReviewCenterUrl.searchParams.get("preset")
  );
  assert(
    rememberedPresetKey,
    `Dashboard open review center must carry a valid preset. Received ${openReviewCenterUrl.searchParams.get("preset") || "<none>"}.`
  );
  assertReviewPresetPage(
    rememberedReviewHtml,
    discoveryTarget.routeScope,
    rememberedPresetKey.label,
    openReviewCenterUrl.searchParams.get("lane")
  );

  const discoveryReviewHtml = await fetchHtml(openDiscoveryReviewHref);
  assertScopedReviewRoute(discoveryReviewHtml, "discovery review");
  assertIncludes(discoveryReviewHtml, "Discovery review", "discovery review label");
  assert(
    Boolean(openDiscoveryReviewUrl.searchParams.get("filter")),
    "Dashboard open discovery review must carry a route-owned discovery filter."
  );

  const executionReviewHtml = await fetchHtml(openExecutionReviewHref);
  assertScopedReviewRoute(executionReviewHtml, "execution review");
  assertIncludes(executionReviewHtml, "Execution review", "execution review label");
  assert(
    Boolean(openExecutionReviewUrl.searchParams.get("filter")),
    "Dashboard open execution review must carry a route-owned execution filter."
  );

  const presetPageChecks = [];
  for (const preset of PRESET_DEFINITIONS) {
    const href = buildReviewHref(discoveryTarget.routeScope, null, preset.key);
    const html = await fetchHtml(href);
    assertReviewPresetPage(html, discoveryTarget.routeScope, preset.label);
    presetPageChecks.push({
      preset: preset.key,
      href,
    });
  }

  const portfolioCriticalHref = buildScopedHref("/portfolio", criticalTarget.routeScope);
  const portfolioCriticalHtml = await fetchHtml(portfolioCriticalHref);
  assertIncludes(portfolioCriticalHtml, "Review pressure", "portfolio critical review pressure");
  const criticalWholeChainHref = extractHrefByLabel(
    portfolioCriticalHtml,
    "Triage whole chain",
    "/review"
  );
  const criticalWholeChainUrl = assertScopeHref(
    criticalWholeChainHref,
    "/review",
    criticalTarget.routeScope,
    "portfolio critical whole-chain triage"
  );
  const criticalWholeChainPreset = reviewPresetFromUrl(
    criticalWholeChainUrl,
    "portfolio critical whole-chain triage"
  );
  assert(
    Boolean(criticalWholeChainUrl.searchParams.get("lane")),
    "Portfolio critical whole-chain triage must carry a lane."
  );
  const criticalWholeChainHtml = await fetchHtml(criticalWholeChainHref);
  assertReviewPresetPage(
    criticalWholeChainHtml,
    criticalTarget.routeScope,
    criticalWholeChainPreset.label,
    criticalWholeChainUrl.searchParams.get("lane")
  );

  const portfolioDecisionHref = buildScopedHref("/portfolio", decisionTarget.routeScope);
  const portfolioDecisionHtml = await fetchHtml(portfolioDecisionHref);
  assertIncludes(portfolioDecisionHtml, "Review pressure", "portfolio decision review pressure");
  const decisionWholeChainHref = extractHrefByLabel(
    portfolioDecisionHtml,
    "Triage whole chain",
    "/review"
  );
  const decisionWholeChainUrl = assertScopeHref(
    decisionWholeChainHref,
    "/review",
    decisionTarget.routeScope,
    "portfolio decision whole-chain triage"
  );
  const decisionWholeChainPreset = reviewPresetFromUrl(
    decisionWholeChainUrl,
    "portfolio decision whole-chain triage"
  );
  assert(
    Boolean(decisionWholeChainUrl.searchParams.get("lane")),
    "Portfolio decision whole-chain triage must carry a lane."
  );
  const decisionWholeChainHtml = await fetchHtml(decisionWholeChainHref);
  assertReviewPresetPage(
    decisionWholeChainHtml,
    decisionTarget.routeScope,
    decisionWholeChainPreset.label,
    decisionWholeChainUrl.searchParams.get("lane")
  );

  console.log(
    JSON.stringify({
      status: "ok",
      dashboard: {
        href: dashboardHref,
        openReviewCenterHref,
        openDiscoveryReviewHref,
        openExecutionReviewHref,
        presetHrefs: PRESET_DEFINITIONS.map((preset) =>
          buildReviewHref(discoveryTarget.routeScope, null, preset.key)
        ),
      },
      portfolio: {
        criticalHref: portfolioCriticalHref,
        criticalWholeChainHref,
        criticalWholeChainPreset: criticalWholeChainPreset.key,
        decisionHref: portfolioDecisionHref,
        decisionWholeChainHref,
        decisionWholeChainPreset: decisionWholeChainPreset.key,
      },
      checkedPresetPages: presetPageChecks,
    })
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
