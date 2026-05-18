import { execSync } from 'child_process';

const runCommand = (cmd: string) => {
  console.log(`\x1b[36m> ${cmd}\x1b[0m`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
};

let success = true;

// 1. Run main checks
success = runCommand('tsc --noEmit && eslint .') && success;

// 2. Check if workers changed
const hasWorkerChanges = () => {
  try {
    // Check for uncommitted changes in workers/
    const uncommitted = execSync('git status --porcelain workers/', { encoding: 'utf-8' });
    if (uncommitted.trim().length > 0) return true;

    // Check for committed changes compared to main (if we are on a branch)
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    if (currentBranch !== 'main') {
      const diff = execSync('git diff --name-only main...HEAD workers/', { encoding: 'utf-8' });
      if (diff.trim().length > 0) return true;
    }
    
    // Check if we are running with a specific flag, e.g., --force-workers
    if (process.argv.includes('--force-workers')) return true;

    return false;
  } catch (error) {
    // If git commands fail, default to running the checks just in case
    return true;
  }
};

if (hasWorkerChanges()) {
  console.log('\n\x1b[33mChanges detected in workers/ (or git check failed), running worker checks...\x1b[0m');
  success = runCommand('npm run check:workers') && success;
} else {
  console.log('\n\x1b[32mNo changes in workers/ detected, skipping worker checks. (Run `npm run check:workers` manually to force)\x1b[0m');
}

if (!success) {
  process.exit(1);
}
