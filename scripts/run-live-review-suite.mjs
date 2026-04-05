import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const REVIEW_SUITE_STEPS = [
  {
    key: "memory",
    label: "Review memory",
    script: "test:live-review-memory:stack",
  },
  {
    key: "actions",
    label: "Review actions",
    script: "test:live-review-actions:stack",
  },
  {
    key: "batch-routes",
    label: "Review batch routes",
    script: "test:live-review-batch-routes:stack",
  },
  {
    key: "pressure-actions",
    label: "Review pressure actions",
    script: "test:live-review-pressure-actions:stack",
  },
  {
    key: "pressure-entry-links",
    label: "Review pressure entry links",
    script: "test:live-review-pressure-entry-links:stack",
  },
  {
    key: "playbook",
    label: "Review playbook",
    script: "test:live-review-playbook:stack",
  },
  {
    key: "preset-suite",
    label: "Review preset suite",
    script: "test:live-review-preset-suite:stack",
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
  const selection = normalizeSelection(process.env.FOUNDEROS_REVIEW_SUITE_ONLY);

  if (selection.size === 0) {
    return REVIEW_SUITE_STEPS;
  }

  const steps = REVIEW_SUITE_STEPS.filter(
    (step) => selection.has(step.key) || selection.has(step.script)
  );

  if (steps.length === 0) {
    throw new Error(
      `FOUNDEROS_REVIEW_SUITE_ONLY did not match any known suite step. Supported keys: ${REVIEW_SUITE_STEPS.map((step) => step.key).join(", ")}.`
    );
  }

  return steps;
}

function runStep(step) {
  return new Promise((resolveStep, rejectStep) => {
    const startedAt = Date.now();

    console.error(
      `[review-suite] starting ${step.label}: npm run ${step.script}`
    );

    const child = spawn(npmCommand, ["run", step.script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", rejectStep);
    child.once("exit", (code, signal) => {
      if (signal) {
        rejectStep(
          new Error(`${step.label} exited from signal ${signal}.`)
        );
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
        `[review-suite] completed ${step.label} in ${formatDuration(durationMs)}`
      );

      resolveStep({
        key: step.key,
        label: step.label,
        script: step.script,
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
    `[review-suite] failed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
}
