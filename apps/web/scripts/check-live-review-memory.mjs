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
  String(3960 + Math.floor(Math.random() * 100));
const baseUrl = externalBaseUrl || `http://${host}:${port}`;
const shellAdminToken = (
  process.env.FOUNDEROS_SHELL_ADMIN_TOKEN || "shell-review-memory-admin-token"
).trim();
const SUITE_TARGET_KEYS = ["discovery-pass", "critical-pass", "decision-pass"];

const EXPECTED_REVIEW_MEMORY = {
  global: {
    lane: "execution",
    preset: "critical-pass",
  },
  linked: {
    lane: "handoff",
    preset: "discovery-pass",
  },
  intakeLinked: {
    lane: "intake",
    preset: "decision-pass",
  },
  orphanProject: {
    lane: "execution",
    preset: "critical-pass",
  },
};

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

function buildDiscoveryReviewHref(scope, filter) {
  return buildScopedHref("/discovery/review", scope, [["filter", filter]]);
}

function buildExecutionReviewHref(scope, filter) {
  return buildScopedHref("/execution/review", scope, [["filter", filter]]);
}

function parseReviewHref(href) {
  const url = new URL(href, "http://localhost");
  return {
    lane: firstString(url.searchParams.get("lane")) || "all",
    preset: firstString(url.searchParams.get("preset")) || null,
  };
}

function reviewPassSemantics(pass) {
  if (pass.lane === "execution" && pass.preset === "critical-pass") {
    return {
      presetLabel: "Critical pass",
      savedDefaultLabel: "Execution lane + Critical pass",
      clearPresetLane: "execution",
      discoveryFilter: "execution",
      executionFilter: "all",
    };
  }

  if (pass.lane === "handoff" && pass.preset === "discovery-pass") {
    return {
      presetLabel: "Discovery pass",
      savedDefaultLabel: "Handoff lane + Discovery pass",
      clearPresetLane: "handoff",
      discoveryFilter: "handoff",
      discoveryCurrentFilterLabel: "Handoff lane + Discovery pass",
      discoveryRememberedText: "Current filter remembered",
      executionFilter: "linked",
      executionCurrentFilterLabel: "Linked lane + Chain pass",
      executionRememberedText: "Remember Linked chains filter",
    };
  }

  if (pass.lane === "intake" && pass.preset === "decision-pass") {
    return {
      presetLabel: "Decision pass",
      savedDefaultLabel: "Intake lane + Decision pass",
      clearPresetLane: "intake",
      discoveryFilter: "execution",
      discoveryCurrentFilterLabel: "Follow-through lane + Chain pass",
      discoveryRememberedText: "Remember Intake-origin chains filter",
      executionFilter: "intake",
      executionCurrentFilterLabel: "Intake lane + Decision pass",
      executionRememberedText: "Current filter remembered",
    };
  }

  throw new Error(
    `Missing review semantics for lane=${pass.lane} preset=${pass.preset ?? "none"}.`,
  );
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
    "g",
  );

  for (const match of html.matchAll(pattern)) {
    const href = String(match[1] || "").replace(/&amp;/g, "&");
    if (!pathPrefix || href.startsWith(pathPrefix)) {
      return href;
    }
  }

  throw new Error(`Missing ${label} href in SSR HTML.`);
}

function assertExactHref(actualHref, expectedHref, label) {
  assert(
    actualHref === expectedHref,
    `${label} must equal ${expectedHref}, received ${actualHref}.`,
  );
}

function parseSuiteTargets(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) {
    throw new Error(
      "FOUNDEROS_REVIEW_SUITE_TARGETS_JSON is required for live review memory checks.",
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

async function fetchHtml(path, cookieHeader) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(shellAdminToken
        ? { "x-founderos-shell-admin-token": shellAdminToken }
        : {}),
    },
  });
  const html = await response.text();
  assert(
    response.status === 200,
    `Expected 200 for ${path}, received ${response.status}.`,
  );
  return html;
}

async function fetchJson(path, init = {}, cookieHeader) {
  const method = String(init?.method || "GET").toUpperCase();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init.headers ?? {}),
      ...(shellAdminToken
        ? { "x-founderos-shell-admin-token": shellAdminToken }
        : {}),
      ...(!["GET", "HEAD", "OPTIONS"].includes(method)
        ? { Origin: baseUrl }
        : {}),
    },
  });
  const payload = await response.json();
  return { response, json: payload };
}

async function updateOperatorPreferences(preferencesPatch) {
  const response = await fetch(`${baseUrl}/api/shell/operator-preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(shellAdminToken
        ? { "x-founderos-shell-admin-token": shellAdminToken }
        : {}),
      Origin: baseUrl,
    },
    body: JSON.stringify(preferencesPatch),
  });
  const payload = await response.json();
  assert(
    response.status === 200,
    `Updating operator preferences failed with ${response.status}.`,
  );
  const setCookie = response.headers.get("set-cookie") || "";
  assert(
    setCookie.length > 0,
    "Operator preferences update did not return a cookie.",
  );
  return {
    snapshot: payload,
    cookieHeader: setCookie.split(";")[0],
  };
}

function assertReviewMemory(snapshot) {
  assert(
    snapshot.source === "cookie",
    "Operator preferences source must be cookie.",
  );
  for (const bucket of Object.keys(EXPECTED_REVIEW_MEMORY)) {
    const expected = EXPECTED_REVIEW_MEMORY[bucket];
    const actual = snapshot.preferences?.reviewMemory?.[bucket];
    assert(actual, `Missing review memory bucket ${bucket}.`);
    assert(
      actual.lane === expected.lane,
      `Review memory bucket ${bucket} must store lane=${expected.lane}.`,
    );
    assert(
      actual.preset === expected.preset,
      `Review memory bucket ${bucket} must store preset=${expected.preset}.`,
    );
  }
}

function assertReviewPresetPage(
  html,
  expectedLabel,
  expectedSavedDefault,
  clearPresetHref,
) {
  assertIncludes(html, "Preset playbooks", `${expectedLabel} preset panel`);
  assertIncludes(html, "Active preset:", `${expectedLabel} active preset`);
  assertIncludes(html, expectedLabel, `${expectedLabel} preset label`);
  assertIncludes(html, "Saved default:", `${expectedLabel} saved default`);
  assertIncludes(
    html,
    expectedSavedDefault,
    `${expectedLabel} remembered pass`,
  );
  assertIncludes(
    html,
    "Current pass remembered",
    `${expectedLabel} remembered marker`,
  );
  assertExactHref(
    extractHrefByLabel(html, "Clear preset", "/review"),
    clearPresetHref,
    `${expectedLabel} clear preset`,
  );
}

function assertReviewLinksMatchRememberedPass({ html, scope, labelPrefix }) {
  const reviewCenterHref = extractHrefByLabel(
    html,
    "Open review center",
    "/review",
  );
  const pass = parseReviewHref(reviewCenterHref);
  const semantics = reviewPassSemantics(pass);

  assertExactHref(
    reviewCenterHref,
    buildReviewHref(scope, pass.lane === "all" ? null : pass.lane, pass.preset),
    `${labelPrefix} review center link`,
  );
  assertExactHref(
    extractHrefByLabel(html, "Open discovery review", "/discovery/review"),
    buildDiscoveryReviewHref(scope, semantics.discoveryFilter),
    `${labelPrefix} discovery review link`,
  );
  assertExactHref(
    extractHrefByLabel(html, "Open execution review", "/execution/review"),
    buildExecutionReviewHref(scope, semantics.executionFilter),
    `${labelPrefix} execution review link`,
  );

  return { pass, semantics };
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
  const linkedScope = suiteTargets["discovery-pass"].routeScope;
  const intakeLinkedScope = suiteTargets["decision-pass"].routeScope;

  const writeResult = await updateOperatorPreferences({
    reviewMemory: EXPECTED_REVIEW_MEMORY,
  });
  assertReviewMemory(writeResult.snapshot);

  const operatorPreferences = await fetchJson(
    "/api/shell/operator-preferences",
    {
      method: "GET",
    },
    writeResult.cookieHeader,
  );
  assert(
    operatorPreferences.response.status === 200,
    "Reading operator preferences with the cookie-backed snapshot must succeed.",
  );
  assertReviewMemory(operatorPreferences.json);

  const globalInboxHtml = await fetchHtml("/inbox", writeResult.cookieHeader);
  const globalReviewLinks = assertReviewLinksMatchRememberedPass({
    html: globalInboxHtml,
    scope: null,
    labelPrefix: "Unscoped inbox",
  });

  const scopedInboxHref = buildScopedHref("/inbox", linkedScope);
  const scopedInboxHtml = await fetchHtml(
    scopedInboxHref,
    writeResult.cookieHeader,
  );
  const scopedReviewLinks = assertReviewLinksMatchRememberedPass({
    html: scopedInboxHtml,
    scope: linkedScope,
    labelPrefix: "Scoped inbox",
  });

  const intakeLinkedInboxHref = buildScopedHref("/inbox", intakeLinkedScope);
  const intakeLinkedInboxHtml = await fetchHtml(
    intakeLinkedInboxHref,
    writeResult.cookieHeader,
  );
  const intakeLinkedReviewLinks = assertReviewLinksMatchRememberedPass({
    html: intakeLinkedInboxHtml,
    scope: intakeLinkedScope,
    labelPrefix: "Intake-linked inbox",
  });

  const globalReviewHtml = await fetchHtml("/review", writeResult.cookieHeader);
  assertReviewPresetPage(
    globalReviewHtml,
    globalReviewLinks.semantics.presetLabel,
    globalReviewLinks.semantics.savedDefaultLabel,
    buildReviewHref(null, globalReviewLinks.semantics.clearPresetLane, null),
  );

  const scopedReviewHref = buildScopedHref("/review", linkedScope);
  const scopedReviewHtml = await fetchHtml(
    scopedReviewHref,
    writeResult.cookieHeader,
  );
  assertReviewPresetPage(
    scopedReviewHtml,
    scopedReviewLinks.semantics.presetLabel,
    scopedReviewLinks.semantics.savedDefaultLabel,
    buildReviewHref(
      linkedScope,
      scopedReviewLinks.semantics.clearPresetLane,
      null,
    ),
  );

  const scopedDiscoveryReviewHtml = await fetchHtml(
    buildScopedHref("/discovery/review", linkedScope),
    writeResult.cookieHeader,
  );
  assertIncludes(
    scopedDiscoveryReviewHtml,
    "Saved default:",
    "Scoped discovery review saved default",
  );
  assertIncludes(
    scopedDiscoveryReviewHtml,
    scopedReviewLinks.semantics.savedDefaultLabel,
    "Scoped discovery review remembered pass",
  );
  assertIncludes(
    scopedDiscoveryReviewHtml,
    "Current filter maps to",
    "Scoped discovery review current filter text",
  );
  assertIncludes(
    scopedDiscoveryReviewHtml,
    scopedReviewLinks.semantics.discoveryCurrentFilterLabel,
    "Scoped discovery review derived current filter",
  );
  assertIncludes(
    scopedDiscoveryReviewHtml,
    scopedReviewLinks.semantics.discoveryRememberedText,
    "Scoped discovery review remember action",
  );

  const scopedExecutionReviewHtml = await fetchHtml(
    buildScopedHref("/execution/review", linkedScope),
    writeResult.cookieHeader,
  );
  assertIncludes(
    scopedExecutionReviewHtml,
    "Saved default:",
    "Scoped execution review saved default",
  );
  assertIncludes(
    scopedExecutionReviewHtml,
    scopedReviewLinks.semantics.savedDefaultLabel,
    "Scoped execution review remembered pass",
  );
  assertIncludes(
    scopedExecutionReviewHtml,
    "Current filter maps to",
    "Scoped execution review current filter text",
  );
  assertIncludes(
    scopedExecutionReviewHtml,
    scopedReviewLinks.semantics.executionCurrentFilterLabel,
    "Scoped execution review derived current filter",
  );
  assertIncludes(
    scopedExecutionReviewHtml,
    scopedReviewLinks.semantics.executionRememberedText,
    "Scoped execution review remembered marker",
  );

  const intakeLinkedReviewHref = buildScopedHref("/review", intakeLinkedScope);
  const intakeLinkedReviewHtml = await fetchHtml(
    intakeLinkedReviewHref,
    writeResult.cookieHeader,
  );
  assertReviewPresetPage(
    intakeLinkedReviewHtml,
    intakeLinkedReviewLinks.semantics.presetLabel,
    intakeLinkedReviewLinks.semantics.savedDefaultLabel,
    buildReviewHref(
      intakeLinkedScope,
      intakeLinkedReviewLinks.semantics.clearPresetLane,
      null,
    ),
  );

  const intakeLinkedDiscoveryReviewHtml = await fetchHtml(
    buildScopedHref("/discovery/review", intakeLinkedScope),
    writeResult.cookieHeader,
  );
  assertIncludes(
    intakeLinkedDiscoveryReviewHtml,
    "Saved default:",
    "Intake-linked discovery review saved default",
  );
  assertIncludes(
    intakeLinkedDiscoveryReviewHtml,
    intakeLinkedReviewLinks.semantics.savedDefaultLabel,
    "Intake-linked discovery review remembered pass",
  );
  assertIncludes(
    intakeLinkedDiscoveryReviewHtml,
    "Current filter maps to",
    "Intake-linked discovery review current filter text",
  );
  assertIncludes(
    intakeLinkedDiscoveryReviewHtml,
    intakeLinkedReviewLinks.semantics.discoveryCurrentFilterLabel,
    "Intake-linked discovery review derived current filter",
  );
  assertIncludes(
    intakeLinkedDiscoveryReviewHtml,
    intakeLinkedReviewLinks.semantics.discoveryRememberedText,
    "Intake-linked discovery review remember action",
  );

  const intakeLinkedExecutionReviewHtml = await fetchHtml(
    buildScopedHref("/execution/review", intakeLinkedScope),
    writeResult.cookieHeader,
  );
  assertIncludes(
    intakeLinkedExecutionReviewHtml,
    "Saved default:",
    "Intake-linked execution review saved default",
  );
  assertIncludes(
    intakeLinkedExecutionReviewHtml,
    intakeLinkedReviewLinks.semantics.savedDefaultLabel,
    "Intake-linked execution review remembered pass",
  );
  assertIncludes(
    intakeLinkedExecutionReviewHtml,
    "Current filter maps to",
    "Intake-linked execution review current filter text",
  );
  assertIncludes(
    intakeLinkedExecutionReviewHtml,
    intakeLinkedReviewLinks.semantics.executionCurrentFilterLabel,
    "Intake-linked execution review derived current filter",
  );
  assertIncludes(
    intakeLinkedExecutionReviewHtml,
    intakeLinkedReviewLinks.semantics.executionRememberedText,
    "Intake-linked execution review remembered marker",
  );

  console.log(
    JSON.stringify({
      status: "ok",
      baseUrl,
      linkedScope,
      intakeLinkedScope,
      reviewMemory: EXPECTED_REVIEW_MEMORY,
      checked: {
        unscopedInbox: "/inbox",
        scopedInbox: scopedInboxHref,
        intakeLinkedInbox: intakeLinkedInboxHref,
        unscopedReview: "/review",
        scopedReview: scopedReviewHref,
        intakeLinkedReview: intakeLinkedReviewHref,
        scopedDiscoveryReview: buildScopedHref(
          "/discovery/review",
          linkedScope,
        ),
        intakeLinkedDiscoveryReview: buildScopedHref(
          "/discovery/review",
          intakeLinkedScope,
        ),
        scopedExecutionReview: buildScopedHref(
          "/execution/review",
          linkedScope,
        ),
        intakeLinkedExecutionReview: buildScopedHref(
          "/execution/review",
          intakeLinkedScope,
        ),
      },
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
