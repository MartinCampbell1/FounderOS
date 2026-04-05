import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const HARDENING_SUITE_STEPS = [
  {
    key: "contract",
    label: "Shell contract smoke",
    args: ["run", "test", "--workspace", "@founderos/web"],
  },
  {
    key: "parity",
    label: "Live parity stack",
    args: ["run", "test:live-parity:stack"],
  },
  {
    key: "review",
    label: "Live review suite",
    args: ["run", "test:live-review-suite:stack"],
  },
  {
    key: "settings",
    label: "Settings parity links",
    args: ["run", "test:live-settings-parity-links:stack"],
  },
];

function formatDuration(durationMs) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function normalizeSelection(rawValue) {
  return new Set(
    String(rawValue || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function selectSteps() {
  const selection = normalizeSelection(process.env.FOUNDEROS_HARDENING_SUITE_ONLY);

  if (selection.size === 0) {
    return HARDENING_SUITE_STEPS;
  }

  const steps = HARDENING_SUITE_STEPS.filter(
    (step) =>
      selection.has(step.key) ||
      selection.has(step.label) ||
      step.args.some((arg) => selection.has(arg))
  );

  if (steps.length === 0) {
    throw new Error(
      `FOUNDEROS_HARDENING_SUITE_ONLY did not match any known suite step. Supported keys: ${HARDENING_SUITE_STEPS.map((step) => step.key).join(", ")}.`
    );
  }

  return steps;
}

function runStep(step) {
  return new Promise((resolveStep, rejectStep) => {
    const startedAt = Date.now();
    const printableCommand = `${npmCommand} ${step.args.join(" ")}`;

    console.error(`[hardening-suite] starting ${step.label}: ${printableCommand}`);

    const child = spawn(npmCommand, step.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", rejectStep);
    child.once("exit", (code, signal) => {
      if (signal) {
        rejectStep(new Error(`${step.label} exited from signal ${signal}.`));
        return;
      }

      if ((code ?? 1) !== 0) {
        rejectStep(
          new Error(`${step.label} exited with code ${code ?? "unknown"}.`)
        );
        return;
      }

      const durationMs = Date.now() - startedAt;

      console.error(
        `[hardening-suite] completed ${step.label} in ${formatDuration(durationMs)}`
      );

      resolveStep({
        key: step.key,
        label: step.label,
        command: printableCommand,
        durationMs,
      });
    });
  });
}

try {
  const steps = selectSteps();
  const results = [];

  for (const step of steps) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runStep(step);
    results.push(result);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        stepCount: results.length,
        totalDurationMs: results.reduce(
          (sum, result) => sum + result.durationMs,
          0
        ),
        steps: results,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    `[hardening-suite] failed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
}
