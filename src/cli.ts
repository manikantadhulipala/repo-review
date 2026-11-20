import { Command } from 'commander';
import { runSandboxLifecycle } from './sandbox-lifecycle';
import { analyzeRepository } from './analyze';
import { parseTestFailures } from './test-runner';

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
    if (!isValidGitHubRepoUrl(repoUrl)) {
      console.error(`Invalid GitHub repository URL: ${repoUrl}`);
      console.error('Expected format: https://github.com/<owner>/<repo>');
      process.exitCode = 2;
      return;
    }

    console.log(`Reviewing ${repoUrl}...`);

    try {
      const lifecycle = await runSandboxLifecycle(repoUrl);
      console.log(`Sandbox: ${lifecycle.sandboxName}`);

      console.log(`Collected ${lifecycle.files.length} file(s) for analysis.`);

      const aiReview =
        lifecycle.files.length > 0
          ? await analyzeRepository(lifecycle.files)
          : { overallRisk: 'low' as const, findings: [] };
      const { testResult } = lifecycle;
      const testFindings = parseTestFailures(`${testResult.stdout}\n${testResult.stderr}`);

      // A failing test run (non-zero exit or a parsed failure) escalates the overall risk,
      // so a green AI review cannot hide a failing build.
      const combined = {
        overallRisk: testFindings.length > 0 || testResult.exitCode !== 0 ? 'high' : aiReview.overallRisk,
        aiFindings: aiReview.findings,
        testFindings
      };

      console.log(`Tests (${testResult.packageManager}): exit code ${testResult.exitCode}`);
      console.log('');
      console.log(`Overall risk: ${combined.overallRisk}`);
      console.log(`AI findings: ${combined.aiFindings.length}`);
      for (const f of combined.aiFindings) {
        console.log(`  [${f.severity}] ${f.summary} (${f.file})`);
      }
      console.log(`Test findings: ${combined.testFindings.length}`);
      for (const f of combined.testFindings) {
        console.log(`  [${f.severity}] ${f.details}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('could not read Username')) {
        console.error('Review failed: repository not found, or it is private (public repos only).');
      } else {
        console.error('Review failed:', message);
      }
      process.exitCode = 1;
    }
  });

await program.parseAsync();
