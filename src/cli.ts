import { Command } from 'commander';
import { runSandboxLifecycle } from './sandbox-lifecycle';
import { analyzeRepository } from './analyze';
import { parseTestFailures } from './test-runner';
import { printReview, type CombinedReview } from './reporter';

// Logs how long fn took, even when it throws, so a failing stage still shows where the time went.
async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`⏱  ${label}: ${Date.now() - start}ms`);
  }
}

// Runs fn, and on error logs a warning and returns the fallback so the rest of the run can continue.
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠  ${label} failed: ${message}`);
    return fallback;
  }
}

function isValidGitHubRepoUrl(input: string): boolean {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(input);
}

const program = new Command();

program
  .name('repo-review')
  .description('Clone and review a GitHub repository in a Sandbox')
  .version('0.1.0');

program
  .command('review <repoUrl>')
  .description('Run a Sandbox review against a GitHub repository URL')
  .action(async (repoUrl: string) => {
    const totalStart = Date.now();
    const printTotal = () => console.log(`Total: ${Date.now() - totalStart}ms`);

    if (!isValidGitHubRepoUrl(repoUrl)) {
      console.error(`Invalid GitHub repository URL: ${repoUrl}`);
      console.error('Expected format: https://github.com/<owner>/<repo>');
      process.exitCode = 2;
      return;
    }

    console.log(`Reviewing ${repoUrl}...`);

    try {
      const lifecycle = await time('sandbox lifecycle', () => runSandboxLifecycle(repoUrl));
      console.log(`Sandbox: ${lifecycle.sandboxName}`);
      console.log(`Collected ${lifecycle.files.length} file(s) for analysis.`);

      const lowRiskFallback = { overallRisk: 'low' as const, findings: [] };
      const aiReview =
        lifecycle.files.length > 0
          ? await time('ai analysis', () =>
              safe('ai analysis', () => analyzeRepository(lifecycle.files), lowRiskFallback)
            )
          : lowRiskFallback;

      const { testResult } = lifecycle;
      const testFindings = await safe(
        'test parsing',
        async () => parseTestFailures(`${testResult.stdout}\n${testResult.stderr}`),
        []
      );

      // Some runners (plain `node` + assert, mocha) fail without the markers the parser
      // knows. Record the non-zero exit as a finding so the report never says "clean".
      if (testResult.exitCode !== 0 && testFindings.length === 0) {
        testFindings.push({
          severity: 'high',
          category: 'test-failure',
          summary: 'Automated test failure',
          details: `Test command exited with code ${testResult.exitCode}; no individual failures were recognized in its output.`
        });
      }

      // A failing test run (non-zero exit or a parsed failure) escalates the overall risk,
      // so a green AI review cannot hide a failing build.
      const combined = {
        overallRisk: testFindings.length > 0 || testResult.exitCode !== 0 ? 'high' : aiReview.overallRisk,
        aiFindings: aiReview.findings,
        testFindings
      };

      console.log(`Tests (${testResult.packageManager}): exit code ${testResult.exitCode}`);
      printReview(combined as CombinedReview);
      printTotal();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('could not read Username')) {
        console.error('Review failed: repository not found, or it is private (public repos only).');
      } else {
        console.error('Review failed:', message);
      }
      printTotal();
      process.exitCode = 1;
    }
  });

await program.parseAsync();
