import { Sandbox } from '@vercel/sandbox';
import { detectPackageManager } from './test-runner';

export type SourceFile = { path: string; content: string };

export type TestResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  packageManager: 'pnpm' | 'npm' | 'yarn';
};

export type LifecycleResult = {
  sandboxName: string;
  cloneExitCode: number;
  files: SourceFile[];
  testResult: TestResult;
  usedSnapshot: boolean;
};

const INTERESTING_PATHS = [
  'repo/package.json',
  'repo/src/index.ts',
  'repo/src/app.ts',
  'repo/lib/auth.ts'
];

const SNAPSHOT_ID = process.env.SANDBOX_SNAPSHOT_ID;

// Restores from a snapshot when SANDBOX_SNAPSHOT_ID is set. Restore errors are not caught here,
// so an expired or inaccessible snapshot shows as a real error, not as a silent fallback.
async function createSandbox(): Promise<{ sandbox: Sandbox; usedSnapshot: boolean }> {
  const base = {
    name: `repo-review-${Date.now()}`,
    persistent: false,
    timeout: 10 * 60 * 1000
  };

  if (!SNAPSHOT_ID) {
    console.warn('SANDBOX_SNAPSHOT_ID is not set; using a default Sandbox.');
    return { sandbox: await Sandbox.create(base), usedSnapshot: false };
  }

  const sandbox = await Sandbox.create({
    ...base,
    source: { type: 'snapshot', snapshotId: SNAPSHOT_ID }
  });
  return { sandbox, usedSnapshot: true };
}

export async function runSandboxLifecycle(repoUrl: string): Promise<LifecycleResult> {
  const { sandbox, usedSnapshot } = await createSandbox();

  try {
    const clone = await sandbox.runCommand('git', ['clone', '--depth', '1', repoUrl, 'repo']);
    if (clone.exitCode !== 0) {
      throw new Error(`Clone failed: ${await clone.stderr()}`);
    }

    const files: SourceFile[] = [];
    for (const path of INTERESTING_PATHS) {
      const buffer = await sandbox.readFileToBuffer({ path });
      if (buffer) {
        files.push({ path: path.replace(/^repo\//, ''), content: buffer.toString('utf8') });
      }
    }

    const pm = await detectPackageManager(sandbox);
    const install = await sandbox.runCommand(pm.install);
    if (install.exitCode !== 0) {
      throw new Error(`Install failed: ${await install.stderr()}`);
    }

    // A failing test run is a finding, not a crash, so exit codes are not thrown on here.
    const test = await sandbox.runCommand(pm.test);
    const testResult: TestResult = {
      exitCode: test.exitCode,
      stdout: await test.stdout(),
      stderr: await test.stderr(),
      packageManager: pm.name
    };

    return {
      sandboxName: sandbox.name,
      cloneExitCode: clone.exitCode,
      files,
      testResult,
      usedSnapshot
    };
  } finally {
    await sandbox.stop();
  }
}
