#!/usr/bin/env node
/**
 * Runs the verification scanner's LINT LEG against this working tree, before
 * anything is published.
 *
 * `npm run lint` is not a substitute. It pins
 * @n8n/eslint-plugin-community-nodes 0.28.0 through @n8n/node-cli, while the
 * scanner pins 0.29.0 — which added, among others, "trigger nodes must not set
 * usableAsTool: true", exactly the surface Phase 4 introduces. Running the
 * scanner's own config closes that gap here instead of discovering it at
 * submission.
 *
 * What this does NOT cover, and what keeps `scan:published` necessary: the
 * scanner's other two legs are the npm provenance attestation and the published
 * tarball's compiled output. Both need a published version.
 *
 * The scanner is not a dependency of this package — adding it would drag eslint,
 * typescript and axios into the dev tree for one CI step. Pass the path to its
 * `scanner.mjs` instead; CI installs it into a temp prefix.
 *
 * Usage: node scripts/scan-source.mjs <path to .../scan-community-package/scanner/scanner.mjs>
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const write = (line) => process.stdout.write(`${line}\n`);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const scannerPath = process.argv[2];
if (!scannerPath) {
	write('scan-source: pass the path to @n8n/scan-community-package/scanner/scanner.mjs');
	write('CI does this; locally:');
	write('  npm install --prefix /tmp/scan --no-save @n8n/scan-community-package@0.32.0');
	write('  node scripts/scan-source.mjs /tmp/scan/node_modules/@n8n/scan-community-package/scanner/scanner.mjs');
	process.exit(1);
}

if (!existsSync(scannerPath)) {
	write(`scan-source: ${scannerPath} does not exist`);
	process.exit(1);
}

const scanner = await import(pathToFileURL(path.resolve(scannerPath)).href);

if (typeof scanner.analyzePackage !== 'function' || !Array.isArray(scanner.SOURCE_FILE_PATTERNS)) {
	write('scan-source: this scanner build does not export analyzePackage/SOURCE_FILE_PATTERNS.');
	write('Its API changed — check the version before treating a pass as meaningful.');
	process.exit(1);
}

write(`Scanning ${repoRoot} with the verification ruleset…`);
const result = await scanner.analyzePackage(repoRoot, scanner.SOURCE_FILE_PATTERNS);

if (!result.passed) {
	write('');
	write(`scan-source: FAILED — ${result.message ?? 'no reason reported'}`);
	if (result.details) write(result.details);
	process.exit(1);
}

write('');
write('scan-source: passed');
