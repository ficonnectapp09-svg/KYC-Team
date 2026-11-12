#!/usr/bin/env node
/**
 * Security Validation Test Suite (Section 10 - All 17 Scenarios)
 * Runs synthetic checks in an isolated temporary Git sandbox + live repo .gitignore checks.
 * Uses only synthetic non-production test data and never touches real secrets or remotes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectFileEntry, verifyGitignoreCoverage } from './git-security-scan.mjs';

const REPO_ROOT = process.cwd();
const SCANNER_PATH = path.join(REPO_ROOT, 'scripts', 'git-security-scan.mjs');

let passed = 0;
let failed = 0;

const assert = (cond, label, detail = '') => {
  if (cond) {
    console.log(`✅ [PASS] ${label}`);
    passed += 1;
  } else {
    console.error(`❌ [FAIL] ${label}${detail ? ` -> ${detail}` : ''}`);
    failed += 1;
  }
};

const runCmd = (cmd, args, cwd, input = undefined) => {
  return execFileSync(cmd, args, {
    cwd,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
};

const setupSandboxRepo = () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-git-sec-'));
  const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-git-remote-'));

  runCmd('git', ['init', '--bare'], remoteDir);
  runCmd('git', ['init'], tmpDir);
  runCmd('git', ['config', 'user.name', 'SecTest'], tmpDir);
  runCmd('git', ['config', 'user.email', 'sectest@example.local'], tmpDir);
  runCmd('git', ['remote', 'add', 'origin', remoteDir], tmpDir);

  // Mirror repository .gitignore files and hooks into sandbox
  fs.copyFileSync(path.join(REPO_ROOT, '.gitignore'), path.join(tmpDir, '.gitignore'));
  fs.mkdirSync(path.join(tmpDir, 'backend'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'frontend'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, 'backend', '.gitignore'), path.join(tmpDir, 'backend', '.gitignore'));
  fs.copyFileSync(path.join(REPO_ROOT, 'frontend', '.gitignore'), path.join(tmpDir, 'frontend', '.gitignore'));
  fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
  fs.copyFileSync(SCANNER_PATH, path.join(tmpDir, 'scripts', 'git-security-scan.mjs'));
  fs.mkdirSync(path.join(tmpDir, '.githooks'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, '.githooks', 'pre-commit'), path.join(tmpDir, '.githooks', 'pre-commit'));
  fs.copyFileSync(path.join(REPO_ROOT, '.githooks', 'pre-push'), path.join(tmpDir, '.githooks', 'pre-push'));

  runCmd('git', ['config', 'core.hooksPath', '.githooks'], tmpDir);

  // Initial clean baseline commit & push
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Security Sandbox\n');
  runCmd('git', ['add', '.'], tmpDir);
  runCmd('git', ['commit', '-m', 'chore: sandbox baseline'], tmpDir);
  const currentBranch = runCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD'], tmpDir).trim();
  runCmd('git', ['push', '-u', 'origin', currentBranch], tmpDir);

  return { tmpDir, remoteDir, currentBranch };
};

const cleanupSandbox = (dirs) => {
  for (const d of dirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors on Windows file locks
    }
  }
};

const isIgnoredInRepo = (relPath) => {
  try {
    runCmd('git', ['check-ignore', '-q', relPath], REPO_ROOT);
    return true;
  } catch {
    return false;
  }
};

const runTests = () => {
  console.log('===================================================================');
  console.log('CONNECT APP BACKOFFICE - GIT SECURITY VALIDATION TEST SUITE');
  console.log('===================================================================\n');

  const { tmpDir, remoteDir, currentBranch } = setupSandboxRepo();

  try {
    // 1. Real .env file must be ignored & blocked if force-staged
    assert(isIgnoredInRepo('.env') && isIgnoredInRepo('backend/.env') && isIgnoredInRepo('frontend/.env'), '1a. Real .env files are ignored in root, backend, and frontend');
    fs.writeFileSync(path.join(tmpDir, 'backend', '.env'), 'PORT=8007\n');
    runCmd('git', ['add', '-f', 'backend/.env'], tmpDir);
    let blockedRealEnv = false;
    try {
      runCmd('node', ['scripts/git-security-scan.mjs', '--staged'], tmpDir);
    } catch {
      blockedRealEnv = true;
    }
    runCmd('git', ['reset', 'HEAD', 'backend/.env'], tmpDir);
    assert(blockedRealEnv, '1b. Force-staged real .env file is blocked by pre-commit scanner');

    // 2. .env.example with safe placeholders must be allowed
    assert(
      !isIgnoredInRepo('.env.example') &&
        !isIgnoredInRepo('backend/.env.example') &&
        !isIgnoredInRepo('frontend/.env.example'),
      '2a. .env.example files are NOT ignored'
    );
    const backendExampleViolations = inspectFileEntry(
      'backend/.env.example',
      fs.readFileSync(path.join(REPO_ROOT, 'backend', '.env.example'))
    );
    const frontendExampleViolations = inspectFileEntry(
      'frontend/.env.example',
      fs.readFileSync(path.join(REPO_ROOT, 'frontend', '.env.example'))
    );
    assert(
      backendExampleViolations.length === 0 && frontendExampleViolations.length === 0,
      '2b. backend/.env.example & frontend/.env.example contain only safe placeholders and pass scanner'
    );

    // 3, 4, 5. AGENT.md, AGENTS.md, CHANGELOG.md must be ignored
    assert(isIgnoredInRepo('AGENT.md'), '3. AGENT.md is ignored');
    assert(isIgnoredInRepo('AGENTS.md'), '4. AGENTS.md is ignored');
    assert(isIgnoredInRepo('CHANGELOG.md'), '5. CHANGELOG.md is ignored');

    // 6, 7. node_modules/ and dist/ must be ignored
    assert(
      isIgnoredInRepo('node_modules/') && isIgnoredInRepo('backend/node_modules/') && isIgnoredInRepo('frontend/node_modules/'),
      '6. node_modules/ ignored in root, backend, and frontend'
    );
    assert(
      isIgnoredInRepo('dist/') && isIgnoredInRepo('backend/dist/') && isIgnoredInRepo('frontend/dist/'),
      '7. dist/ ignored in root, backend, and frontend'
    );

    // 8. Database backup files must be ignored and blocked
    const dumpViolations = inspectFileEntry('backups/prod_snapshot.dump', Buffer.from('binary-dump'));
    assert(
      isIgnoredInRepo('backups/prod_snapshot.dump') && isIgnoredInRepo('test.sqlite3') && dumpViolations.length > 0,
      '8. Database backup files are ignored and blocked by path scanner'
    );

    // 9. Private KYC documents must be ignored and blocked
    const kycDocViolations = inspectFileEntry('kyc-documents/vendor_pan_card.png', Buffer.from('img'));
    assert(
      isIgnoredInRepo('kyc-documents/vendor_pan_card.png') &&
        isIgnoredInRepo('aadhaar-documents/sample.pdf') &&
        kycDocViolations.length > 0,
      '9. Private KYC/Aadhaar/PAN documents are ignored and blocked'
    );

    // 10. AWS secret keys must be detected (synthetic value built dynamically)
    const synthAwsId = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
    const synthAwsSecret = ['wJalrXUtnFEMI', 'K7MDENG', 'bPxRfiCYEXAMPLEKEY'].join('/');
    const awsViolations = inspectFileEntry(
      'backend/src/config/awsTest.ts',
      Buffer.from(`const k = "${synthAwsId}";\nconst AWS_SECRET_ACCESS_KEY = "${synthAwsSecret}";\n`)
    );
    assert(awsViolations.length >= 2, '10. AWS Access Key ID & Secret Key detected (synthetic)');

    // 11. MongoDB credentials must be detected (synthetic URI)
    const synthMongo = ['mongodb+srv://', 'syntheticUser', ':', 'SynthPass123', '@cluster.example.net/db'].join('');
    const mongoViolations = inspectFileEntry('backend/src/config/dbTest.ts', Buffer.from(`const uri = "${synthMongo}";\n`));
    assert(mongoViolations.length >= 1, '11. MongoDB connection URI with credentials detected (synthetic)');

    // 12. JWT secrets & literals must be detected (synthetic)
    const synthJwtSecret = ['JWT', 'SECRET'].join('_') + ' = "' + ['synthetic', 'signing', 'key', 'value', '999'].join('_') + '"';
    const synthJwtToken = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QifQ',
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    ].join('.');
    const jwtViolations = inspectFileEntry('backend/src/utils/jwtTest.ts', Buffer.from(`${synthJwtSecret}\nconst t = "${synthJwtToken}";\n`));
    assert(jwtViolations.length >= 2, '12. Hardcoded JWT secret and JWT literal detected (synthetic)');

    // 13. Private keys must be detected (synthetic PEM header)
    const synthPemHeader = ['-----BEGIN ', 'RSA PRIVATE ', 'KEY-----'].join('');
    const pemViolations = inspectFileEntry('certs/server.pem', Buffer.from(`${synthPemHeader}\nMIIE...\n`));
    assert(pemViolations.some((v) => v.rule.includes('Private Key')), '13. Private key files and PEM headers detected');

    // 14. Force-staging an ignored secret must still be blocked by pre-commit AND pre-push hooks
    fs.mkdirSync(path.join(tmpDir, 'kyc-documents'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'kyc-documents', 'secret_id.txt'), `${synthAwsId}\n`);
    runCmd('git', ['add', '-f', 'kyc-documents/secret_id.txt'], tmpDir);

    let preCommitBlocked = false;
    try {
      runCmd('git', ['commit', '-m', 'test: should fail hook'], tmpDir);
    } catch {
      preCommitBlocked = true;
    }
    assert(preCommitBlocked, '14a. Actual git pre-commit hook blocked force-staged ignored secret');

    // Simulate a commit bypassing pre-commit (e.g. --no-verify) and verify pre-push blocks it
    runCmd('git', ['commit', '--no-verify', '-m', 'test: bypass pre-commit for pre-push check'], tmpDir);
    let prePushBlocked = false;
    try {
      runCmd('git', ['push', 'origin', currentBranch], tmpDir);
    } catch {
      prePushBlocked = true;
    }
    assert(prePushBlocked, '14b. Actual git pre-push hook blocked outgoing commit containing prohibited secret');

    // Reset sandbox branch back to clean baseline before testing legitimate commit
    runCmd('git', ['reset', '--hard', `origin/${currentBranch}`], tmpDir);

    // 15. Legitimate source-code change must pass
    fs.mkdirSync(path.join(tmpDir, 'frontend', 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'frontend', 'src', 'cleanHelper.ts'),
      'export const formatAmount = (val: number) => `INR ${val.toFixed(2)}`;\n'
    );
    runCmd('git', ['add', 'frontend/src/cleanHelper.ts'], tmpDir);
    let cleanCommitSucceeded = false;
    let cleanPushSucceeded = false;
    try {
      runCmd('git', ['commit', '-m', 'feat: add clean helper'], tmpDir);
      cleanCommitSucceeded = true;
      runCmd('git', ['push', 'origin', currentBranch], tmpDir);
      cleanPushSucceeded = true;
    } catch {
      cleanCommitSucceeded = false;
    }
    assert(cleanCommitSucceeded && cleanPushSucceeded, '15. Legitimate source-code commit & push passed both hooks');

    // 16. Dependency manifests & lockfiles remain eligible for commits
    assert(
      !isIgnoredInRepo('backend/package.json') &&
        !isIgnoredInRepo('backend/package-lock.json') &&
        !isIgnoredInRepo('frontend/package.json') &&
        !isIgnoredInRepo('frontend/package-lock.json'),
      '16. package.json and package-lock.json remain tracked/eligible in backend and frontend'
    );

    // 17. CI security workflow & .gitignore verification coverage check
    const ciWorkflowPath = path.join(REPO_ROOT, '.github', 'workflows', 'git-security.yml');
    const ciContent = fs.existsSync(ciWorkflowPath) ? fs.readFileSync(ciWorkflowPath, 'utf8') : '';
    const gitignoreCoverage = verifyGitignoreCoverage();
    assert(
      ciContent.includes('--redact') &&
        ciContent.includes('--ci --verify-gitignore') &&
        gitignoreCoverage.unignored.length === 0 &&
        gitignoreCoverage.exampleIgnored.length === 0,
      '17. GitHub Actions CI workflow configured with redacted failure reporting & 100% .gitignore coverage'
    );
  } finally {
    cleanupSandbox([tmpDir, remoteDir]);
  }

  console.log('\n===================================================================');
  console.log(`SECURITY VALIDATION SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('===================================================================');
  process.exit(failed > 0 ? 1 : 0);
};

runTests();

