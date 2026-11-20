import { Sandbox } from '@vercel/sandbox';

export type SourceFile = { path: string; content: string };

export type LifecycleResult = {
  sandboxName: string;
  cloneExitCode: number;
  files: SourceFile[];
};

const INTERESTING_PATHS = [
  'repo/package.json',
  'repo/src/index.ts',
  'repo/src/app.ts',
  'repo/lib/auth.ts'
];

export async function runSandboxLifecycle(repoUrl: string): Promise<LifecycleResult> {
  const sandbox = await Sandbox.create({
    name: `repo-review-${Date.now()}`,
    persistent: false,
    timeout: 10 * 60 * 1000
  });

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

    return {
      sandboxName: sandbox.name,
      cloneExitCode: clone.exitCode,
      files
    };
  } finally {
    await sandbox.stop();
  }
}
