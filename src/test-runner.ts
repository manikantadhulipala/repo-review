export type TestFinding = {
  severity: 'medium' | 'high';
  category: 'test-failure';
  summary: string;
  details: string;
};

const FAILURE_MARKERS = ['FAIL ', '✕ ', '× '];

export function parseTestFailures(output: string): TestFinding[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => FAILURE_MARKERS.some((marker) => line.startsWith(marker)))
    .map((line) => ({
      severity: 'high' as const,
      category: 'test-failure' as const,
      summary: 'Automated test failure',
      details: line
    }));
}

export type CommandSpec = { cmd: string; args: string[]; cwd: string };

export type PackageManagerCommands = {
  name: 'pnpm' | 'npm' | 'yarn';
  install: CommandSpec;
  test: CommandSpec;
};

type SandboxFs = { exists(path: string): Promise<boolean> };

const LOCKFILE_CHECKS: { lockfile: string; build: (dir: string) => PackageManagerCommands }[] = [
  {
    lockfile: 'pnpm-lock.yaml',
    build: (cwd) => ({
      name: 'pnpm',
      install: { cmd: 'pnpm', args: ['install'], cwd },
      test: { cmd: 'pnpm', args: ['test'], cwd }
    })
  },
  {
    lockfile: 'yarn.lock',
    build: (cwd) => ({
      name: 'yarn',
      install: { cmd: 'corepack', args: ['yarn', 'install'], cwd },
      test: { cmd: 'corepack', args: ['yarn', 'test'], cwd }
    })
  },
  {
    lockfile: 'package-lock.json',
    build: (cwd) => ({
      name: 'npm',
      install: { cmd: 'npm', args: ['install'], cwd },
      test: { cmd: 'npm', args: ['test'], cwd }
    })
  }
];

// The first lockfile found wins. With no lockfile, fall back to npm, which may not reproduce the project's intended install.
export async function detectPackageManager(
  sandbox: { fs: SandboxFs },
  repoDir = 'repo'
): Promise<PackageManagerCommands> {
  for (const check of LOCKFILE_CHECKS) {
    if (await sandbox.fs.exists(`${repoDir}/${check.lockfile}`)) {
      return check.build(repoDir);
    }
  }
  return {
    name: 'npm',
    install: { cmd: 'npm', args: ['install'], cwd: repoDir },
    test: { cmd: 'npm', args: ['test'], cwd: repoDir }
  };
}
