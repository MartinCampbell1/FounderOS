import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const bootstrapScript = join(repoRoot, "scripts", "bootstrap_founderos_local.sh");
const runStackScript = join(repoRoot, "scripts", "run-stack.mjs");

function createTempRoot() {
  return mkdtempSync(join(tmpdir(), "founderos-release-contract-"));
}

function writeBootstrapFixture(tempRoot, options = {}) {
  mkdirSync(join(tempRoot, "scripts"), { recursive: true });
  copyFileSync(bootstrapScript, join(tempRoot, "scripts", "bootstrap_founderos_local.sh"));

  if (options.quorum) {
    mkdirSync(join(tempRoot, "quorum"), { recursive: true });
    if (options.quorum.gateway !== false) {
      writeFileSync(join(tempRoot, "quorum", "gateway.py"), "print('ok')\n");
    }
    if (options.quorum.pyproject !== false) {
      writeFileSync(join(tempRoot, "quorum", "pyproject.toml"), "[project]\nname='quorum'\nversion='0.0.0'\n");
    }
  }

  if (options.autopilot) {
    mkdirSync(join(tempRoot, "autopilot"), { recursive: true });
    if (options.autopilot.pyproject !== false) {
      writeFileSync(
        join(tempRoot, "autopilot", "pyproject.toml"),
        "[project]\nname='autopilot'\nversion='0.0.0'\n"
      );
    }
  }
}

function writeRunStackFixture(tempRoot, options = {}) {
  mkdirSync(join(tempRoot, "scripts"), { recursive: true });
  mkdirSync(join(tempRoot, "apps", "web"), { recursive: true });
  copyFileSync(runStackScript, join(tempRoot, "scripts", "run-stack.mjs"));

  if (options.quorum) {
    mkdirSync(join(tempRoot, "quorum"), { recursive: true });
    if (options.quorum.gateway !== false) {
      writeFileSync(join(tempRoot, "quorum", "gateway.py"), "print('ok')\n");
    }
    if (options.quorum.pyproject !== false) {
      writeFileSync(join(tempRoot, "quorum", "pyproject.toml"), "[project]\nname='quorum'\nversion='0.0.0'\n");
    }
  }

  if (options.autopilot) {
    mkdirSync(join(tempRoot, "autopilot"), { recursive: true });
    if (options.autopilot.pyproject !== false) {
      writeFileSync(
        join(tempRoot, "autopilot", "pyproject.toml"),
        "[project]\nname='autopilot'\nversion='0.0.0'\n"
      );
    }
  }
}

function runBootstrap(tempRoot) {
  return spawnSync("bash", [join(tempRoot, "scripts", "bootstrap_founderos_local.sh")], {
    cwd: tempRoot,
    encoding: "utf8",
  });
}

function runStack(tempRoot) {
  return spawnSync(process.execPath, [join(tempRoot, "scripts", "run-stack.mjs"), "dev"], {
    cwd: tempRoot,
    encoding: "utf8",
  });
}

test("bootstrap fails clearly when quorum runtime root is missing", () => {
  const tempRoot = createTempRoot();
  try {
    writeBootstrapFixture(tempRoot);
    const result = runBootstrap(tempRoot);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /required path missing: .*quorum/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("bootstrap fails clearly when autopilot runtime root is missing", () => {
  const tempRoot = createTempRoot();
  try {
    writeBootstrapFixture(tempRoot, { quorum: {} });
    const result = runBootstrap(tempRoot);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /required path missing: .*autopilot/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("stack launcher fails clearly when quorum runtime root is missing", () => {
  const tempRoot = createTempRoot();
  try {
    writeRunStackFixture(tempRoot);
    const result = runStack(tempRoot);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Quorum runtime root is missing/);
    assert.match(result.stderr, /git submodule update --init --recursive/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("stack launcher fails clearly when autopilot runtime root is missing", () => {
  const tempRoot = createTempRoot();
  try {
    writeRunStackFixture(tempRoot, { quorum: {} });
    const result = runStack(tempRoot);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Autopilot runtime root is missing/);
    assert.match(result.stderr, /git submodule update --init --recursive/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
