#!/usr/bin/env node
/**
 * Connect App Backoffice - Git Security & Push Protection Scanner
 * Zero external dependencies. Never prints raw secret values.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const NULL_SHA = '0000000000000000000000000000000000000000';

export const PROHIBITED_PATH_RULES = [
  {
    name: 'Prohibited Environment File',
    re: /(^|\/)\.env($|\.(?!example$).+)/i,
    reason: 'Actual .env files must stay local and never be committed or pushed.'
  },
  {
    name: 'Prohibited Private Instruction File',
    re: /(^|\/)(AGENT\.md|AGENTS\.md|CHANGELOG\.md)$/i,
    reason: 'Private project instruction files must remain local.'
  },
  {
    name: 'Prohibited Private Key or Certificate',
    re: /\.(pem|key|p12|pfx|jks|keystore)$/i,
    reason: 'Private keys, certificates, and keystores must never be committed.'
  },
  {
    name: 'Prohibited Service Account Key File',
    re: /(^|\/)(firebase-adminsdk[^/]*\.json|[^/]*service[-_]?account[^/]*\.json)$/i,
    reason: 'Service account credential JSON files must never be committed.'
  },
  {
    name: 'Prohibited Database Backup or Dump',
    re: /(\.(dump|bson|backup|sqlite|sqlite3)$|(^|\/)(database-backup|db-backup|backups|mongodb-dumps)\/)/i,
    reason: 'Database dumps and backups must never be committed or pushed.'
  },
  {
    name: 'Prohibited Private Document or Upload Path',
    re: /(^|\/)(private-uploads|secure-uploads|customer-documents|vendor-documents|kyc-documents|aadhaar-documents|pan-documents|private-storage)\//i,
    reason: 'Customer, vendor, agent, or employee private documents must never be committed.'
  },
  {
    name: 'Prohibited Dependency / Build / Log Artifact',
    re: /((^|\/)(node_modules|dist|dist-ssr|build|coverage|\.cache|\.tmp|\.temp)\/|(^|\/)logs\/|\.log$)/i,
    reason: 'Dependencies, build artifacts, caches, and log files must remain ignored.'
  }
];

export const SECRET_CONTENT_RULES = [
  {
    name: 'AWS Access Key ID',
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/
  },
  {
    name: 'AWS Secret Access Key',
    re: /(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{32,}['"]?/i
  },
  {
    name: 'MongoDB URI with Credentials',
    re: /mongodb(?:\+srv)?:\/\/(?!<username>|<user>)[^/\s<>'"`]+:(?!<password>|<pass>)[^@\s<>'"`]+@[^\s'"`]+/i
  },
  {
    name: 'Cloudinary URL with Credentials',
    re: /cloudinary:\/\/\d{6,}:(?!<api_secret>)[^@\s<>'"`]+@[^\s'"`]+/i
  },
  {
    name: 'Private Key Material',
    re: new RegExp(['-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?', 'PRIVATE KEY-----'].join(''))
  },
  {
    name: 'Firebase Service Account Private Key',
    re: new RegExp(['"private_key"\\s*:\\s*"-----BEGIN ', 'PRIVATE KEY-----'].join(''))
  },
  {
    name: 'JWT Token Literal',
    re: /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/
  },
  {
    name: 'Stripe Secret Key',
    re: /\bsk_(?:live|test)_[0-9a-zA-Z]{16,}\b/
  },
  {
    name: 'GitHub Personal / Fine-Grained Token',
    re: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/
  },
  {
    name: 'Google / Firebase API Key',
    re: /\bAIza[0-9A-Za-z\-_]{35}\b/
  },
  {
    name: 'Hardcoded Secret / Token Assignment',
    re: /\b(JWT_SECRET|REFRESH_TOKEN_SECRET|PAYMENT_SECRET_KEY|RAZORPAY_KEY_SECRET|STRIPE_SECRET_KEY|OAUTH_CLIENT_SECRET|SMTP_PASSWORD|CLOUDINARY_API_SECRET|PRIVATE_API_KEY)\b\s*[:=]\s*['"`]?(?!process\.env|<[a-z0-9_]+>|""|''|$)[^\s'"`#]{8,}/i
  },
  {
    name: 'Frontend Client-Exposed Secret Env Variable',
    re: /^VITE_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|PASSWORD|MONGODB_URI|AWS_SECRET|CLOUDINARY_API_SECRET|SERVICE_ROLE)\s*=\s*(?!""|''|$).+/i,
    frontendOnly: true
  }
];

export const REQUIRED_GITIGNORE_PATTERNS = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.staging',
  '.env.test',
  'backend/.env',
  'frontend/.env',
  'AGENT.md',
  'AGENTS.md',
  'CHANGELOG.md',
  'node_modules/',
  'backend/node_modules/',
  'frontend/node_modules/',
  'dist/',
  'backend/dist/',
  'frontend/dist/',
  'build/',
  'coverage/',
  '.cache/',
  '.tmp/',
  '.temp/',
  'test.log',
  'logs/',
  'test.pem',
  'test.key',
  'test.p12',
  'test.pfx',
  'test.jks',
  'test.keystore',
  'test.dump',
  'test.bson',
  'test.backup',
  'test.sqlite',
  'test.sqlite3',
  'database-backup/',
  'db-backup/',
  'backups/',
  'mongodb-dumps/',
  'private-uploads/',
  'secure-uploads/',
  'customer-documents/',
  'vendor-documents/',
  'kyc-documents/',
  'aadhaar-documents/',
  'pan-documents/',
  'private-storage/'
];

const runGit = (args, options = {}) => {
  return execFileSync('git', args, {
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 25 * 1024 * 1024,
    ...options
  });
};

const normalizePath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');

const isPlaceholderLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return false;
  return /process\.env\./.test(trimmed) && !/(\|\||\?\?)\s*['"`][A-Za-z0-9_@!#$%^&*-]{12,}['"`]/.test(trimmed);
};

export const inspectFileEntry = (filePath, contentBuffer) => {
  const normalized = normalizePath(filePath);
  const violations = [];

  for (const rule of PROHIBITED_PATH_RULES) {
    if (rule.re.test(normalized)) {
      violations.push({
        file: normalized,
        line: null,
        rule: rule.name,
        details: rule.reason
      });
    }
  }

  if (!contentBuffer || contentBuffer.length === 0) {
    return violations;
  }

  // Skip binary buffers cleanly after checking path rules
  if (contentBuffer.includes(0)) {
    return violations;
  }

  const text = contentBuffer.toString('utf8');
  const lines = text.split(/\r?\n/);
  const isFrontend = normalized.startsWith('frontend/') || normalized === '.env.example';

  lines.forEach((line, index) => {
    if (isPlaceholderLine(line)) return;

    for (const rule of SECRET_CONTENT_RULES) {
      if (rule.frontendOnly && !isFrontend) continue;
      if (rule.re.test(line)) {
        violations.push({
          file: normalized,
          line: index + 1,
          rule: rule.name,
          details: 'Potential secret or sensitive credential pattern detected [REDACTED].'
        });
      }
    }
  });

  return violations;
};

export const verifyGitignoreCoverage = () => {
  const unignored = [];
  for (const sample of REQUIRED_GITIGNORE_PATTERNS) {
    try {
      runGit(['check-ignore', '-q', sample]);
    } catch {
      unignored.push(sample);
    }
  }

  // Verify .env.example is allowed (must NOT be ignored)
  const exampleIgnored = [];
  for (const allowed of ['.env.example', 'backend/.env.example', 'frontend/.env.example']) {
    try {
      runGit(['check-ignore', '-q', allowed]);
      exampleIgnored.push(allowed);
    } catch {
      // Expected: not ignored
    }
  }

  return { unignored, exampleIgnored };
};

const readStagedBlob = (filePath) => {
  try {
    return runGit(['show', `:${normalizePath(filePath)}`], { encoding: null });
  } catch {
    return null;
  }
};

const readCommitBlob = (commitSha, filePath) => {
  try {
    return runGit(['show', `${commitSha}:${normalizePath(filePath)}`], { encoding: null });
  } catch {
    return null;
  }
};

const scanStagedFiles = () => {
  const out = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).trim();
  if (!out) return { scannedCount: 0, violations: [] };
  const files = out.split(/\r?\n/).filter(Boolean);
  const violations = [];
  for (const file of files) {
    const buf = readStagedBlob(file);
    violations.push(...inspectFileEntry(file, buf));
  }
  return { scannedCount: files.length, violations };
};

const getCommitsForPushStdin = (stdinText) => {
  const lines = stdinText.trim().split(/\r?\n/).filter(Boolean);
  const commits = new Set();

  for (const line of lines) {
    const [localRef, localSha, , remoteSha] = line.trim().split(/\s+/);
    if (!localSha || localSha === NULL_SHA || localRef === '(delete)') continue;

    const rangeArgs =
      !remoteSha || remoteSha === NULL_SHA
        ? ['rev-list', localSha, '--not', '--remotes']
        : ['rev-list', `${remoteSha}..${localSha}`];

    let listOut = '';
    try {
      listOut = runGit(rangeArgs).trim();
    } catch {
      listOut = runGit(['rev-list', '-n', '20', localSha]).trim();
    }

    for (const sha of listOut.split(/\r?\n/).filter(Boolean)) {
      commits.add(sha);
    }
  }

  return Array.from(commits);
};

const scanCommitRange = (commitShas) => {
  const violations = [];
  let scannedCount = 0;

  for (const sha of commitShas) {
    const filesOut = runGit([
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      '--root',
      '--diff-filter=ACMR',
      sha
    ]).trim();

    if (!filesOut) continue;
    const files = filesOut.split(/\r?\n/).filter(Boolean);
    for (const file of files) {
      scannedCount += 1;
      const buf = readCommitBlob(sha, file);
      for (const v of inspectFileEntry(file, buf)) {
        violations.push({ ...v, commit: sha.slice(0, 7) });
      }
    }
  }

  return { scannedCount, violations };
};

const scanTrackedWorkspace = () => {
  const filesOut = runGit(['ls-files']).trim();
  if (!filesOut) return { scannedCount: 0, violations: [] };
  const files = filesOut.split(/\r?\n/).filter(Boolean);
  const violations = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    violations.push(...inspectFileEntry(file, buf));
  }
  return { scannedCount: files.length, violations };
};

const printReport = (modeLabel, result, gitignoreCheck = null) => {
  if (gitignoreCheck && (gitignoreCheck.unignored.length > 0 || gitignoreCheck.exampleIgnored.length > 0)) {
    console.error(`[Git Security - ${modeLabel}] .gitignore protection check FAILED:`);
    for (const p of gitignoreCheck.unignored) {
      console.error(`  - Missing ignore rule for required path/pattern: ${p}`);
    }
    for (const p of gitignoreCheck.exampleIgnored) {
      console.error(`  - Template file must NOT be ignored: ${p}`);
    }
  }

  if (result.violations.length > 0) {
    console.error(
      `\n[Git Security - ${modeLabel}] BLOCKED: Detected ${result.violations.length} prohibited file or secret violation(s).`
    );
    for (const v of result.violations) {
      const loc = v.line ? `${v.file}:${v.line}` : v.file;
      const commitTag = v.commit ? ` [${v.commit}]` : '';
      console.error(`  [BLOCKED] ${loc}${commitTag} -> ${v.rule}: ${v.details}`);
    }
    console.error(
      '\nRemediation: Unstage or remove the secret/prohibited file (e.g., `git reset HEAD <file>`), move credentials to `.env`, and retry.'
    );
    return false;
  }

  if (gitignoreCheck && (gitignoreCheck.unignored.length > 0 || gitignoreCheck.exampleIgnored.length > 0)) {
    return false;
  }

  console.log(
    `[Git Security - ${modeLabel}] PASSED (${result.scannedCount} file inspection(s), 0 violations).`
  );
  return true;
};

const main = () => {
  const args = process.argv.slice(2);
  const mode = args.includes('--staged')
    ? 'staged'
    : args.includes('--pre-push')
    ? 'pre-push'
    : args.includes('--ci')
    ? 'ci'
    : 'all';

  if (mode === 'staged') {
    const res = scanStagedFiles();
    const ok = printReport('PRE-COMMIT', res);
    process.exit(ok ? 0 : 1);
  }

  if (mode === 'pre-push') {
    const rangeIdx = args.indexOf('--range');
    let commits = [];
    if (rangeIdx !== -1 && args[rangeIdx + 1]) {
      const out = runGit(['rev-list', args[rangeIdx + 1]]).trim();
      commits = out ? out.split(/\r?\n/).filter(Boolean) : [];
    } else {
      const stdinText = fs.readFileSync(0, 'utf8');
      commits = getCommitsForPushStdin(stdinText);
    }

    if (commits.length === 0) {
      console.log('[Git Security - PRE-PUSH] No outgoing commits to inspect. PASSED.');
      process.exit(0);
    }

    const res = scanCommitRange(commits);
    const ok = printReport('PRE-PUSH', res);
    process.exit(ok ? 0 : 1);
  }

  const verifyIgnore = args.includes('--verify-gitignore') || mode === 'ci';
  const gitignoreCheck = verifyIgnore ? verifyGitignoreCoverage() : null;
  const res = scanTrackedWorkspace();
  const ok = printReport(mode === 'ci' ? 'CI-SECURITY' : 'WORKSPACE-SCAN', res, gitignoreCheck);
  process.exit(ok ? 0 : 1);
};

// Only execute CLI entrypoint when run directly
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main();
}
