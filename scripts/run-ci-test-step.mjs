import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    artifactDir: { type: "string" },
    command: { type: "string" },
    name: { type: "string" },
    summaryChars: { type: "string" },
  },
});

const artifactDir = values.artifactDir ? resolve(values.artifactDir) : null;
const command = values.command;
const name = values.name || "CI test step";
const summaryChars = Number.parseInt(values.summaryChars || "6000", 10);

if (!artifactDir) {
  throw new Error("--artifactDir is required");
}

if (!command) {
  throw new Error("--command is required");
}

mkdirSync(artifactDir, { recursive: true });

const logPath = resolve(artifactDir, "command.log");
const junitPath = resolve(artifactDir, "junit.xml");
const resultPath = resolve(artifactDir, "result.json");
const summaryPath = resolve(artifactDir, "summary.md");

const startTime = Date.now();
let tail = "";
let combinedOutput = "";

function appendOutput(chunk) {
  const text = chunk.toString("utf8");
  combinedOutput += text;
  tail += text;
  if (tail.length > summaryChars) {
    tail = tail.slice(tail.length - summaryChars);
  }
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function markdownEscape(value) {
  return String(value).replaceAll("`", "\\`");
}

const child = spawn(command, {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", appendOutput);
child.stderr.on("data", appendOutput);

const exitCode = await new Promise((resolvePromise) => {
  child.on("error", (error) => {
    tail = error.message;
    resolvePromise({ code: 1, signal: null, error });
  });
  child.on("close", (code, signal) => {
    resolvePromise({ code, signal });
  });
});

const durationMs = Date.now() - startTime;
const success = exitCode.code === 0;
const durationSeconds = (durationMs / 1000).toFixed(3);
const failureReason =
  exitCode.error?.message ||
  (exitCode.signal ? `signal ${exitCode.signal}` : `exit code ${exitCode.code ?? "unknown"}`);

const summary = [
  `### ${name}`,
  "",
  `- Command: \`${markdownEscape(command)}\``,
  `- Status: ${success ? "passed" : "failed"} (${failureReason})`,
  `- Duration: ${durationSeconds}s`,
  `- Artifact dir: \`${markdownEscape(artifactDir)}\``,
  `- Logs: \`command.log\`, \`junit.xml\`, \`result.json\``,
  "",
  success ? "Output tail:" : "Failure tail:",
  "```text",
  tail.trimEnd() || "(no output captured)",
  "```",
  "",
].join("\n");

writeFileSync(logPath, combinedOutput, "utf8");
writeFileSync(
  resultPath,
  JSON.stringify(
    {
      artifactDir,
      command,
      durationMs,
      exitCode: exitCode.code,
      failureReason,
      name,
      signal: exitCode.signal,
      spawnError: exitCode.error?.message || null,
      success,
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(
  junitPath,
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<testsuites>` +
    `<testsuite name="${xmlEscape(name)}" tests="1" failures="${success ? 0 : 1}" errors="0" skipped="0" time="${durationSeconds}">` +
    `<testcase name="${xmlEscape(command)}" classname="${xmlEscape(name)}" time="${durationSeconds}">` +
    (success
      ? ""
      : `<failure message="${xmlEscape(failureReason)}">${xmlEscape(tail.trimEnd() || "no output captured")}</failure>`) +
    `</testcase>` +
    `<system-out>${xmlEscape(tail.trimEnd() || "no output captured")}</system-out>` +
    `</testsuite>` +
    `</testsuites>\n`,
  "utf8"
);
writeFileSync(summaryPath, summary, "utf8");

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

process.exitCode = exitCode.code ?? 1;
