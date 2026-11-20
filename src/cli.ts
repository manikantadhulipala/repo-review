import { Command } from 'commander';
import { runSandboxLifecycle } from './sandbox-lifecycle';
import { analyzeRepository } from './analyze';

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

      if (lifecycle.files.length === 0) {
        console.log('No source files matched the review list. Nothing to analyze.');
        return;
      }
      console.log(`Collected ${lifecycle.files.length} file(s) for analysis.`);

      const review = await analyzeRepository(lifecycle.files);
      console.log(`Overall risk: ${review.overallRisk}`);
      console.log(`Findings: ${review.findings.length}`);
      for (const finding of review.findings) {
        console.log(`  [${finding.severity}] ${finding.summary} (${finding.file})`);
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
