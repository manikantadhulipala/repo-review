import { Sandbox } from '@vercel/sandbox';

const REPO_URL = 'https://github.com/vercel/examples';

async function main() {
  const sandbox = await Sandbox.create({
    name: `repo-review-${Date.now()}`,
    persistent: false,
    timeout: 10 * 60 * 1000
  });
  console.log(`Sandbox created: ${sandbox.name}`);

  const clone = await sandbox.runCommand('git', ['clone', '--depth', '1', REPO_URL, 'repo']);
  if (clone.exitCode !== 0) {
    console.error(`Clone failed: ${await clone.stderr()}`);
    await sandbox.stop();
    return;
  }

  const ls = await sandbox.runCommand('ls', ['-la', 'repo']);
  console.log('--- repo contents ---');
  console.log(await ls.stdout());

  let readmePreview = '(no README found)';
  const readme = await sandbox.readFileToBuffer({ path: 'repo/README.md' });
  if (readme) {
    readmePreview = readme.toString('utf8').slice(0, 300);
  } else {
    console.warn('Warning: repo/README.md not found in the cloned repo.');
  }

  console.log('--- README preview ---');
  console.log(readmePreview);

  await sandbox.stop();
}

main();
