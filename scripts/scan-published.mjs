#!/usr/bin/env node
/**
 * Runs the n8n verification scanner against the PUBLISHED package and turns its
 * verdict into an exit code.
 *
 * The wrapper exists because the scanner's own CLI cannot be used as a gate:
 *
 *   - `analyzePackageByName` catches its own failures and returns
 *     `{ passed: false }` instead of throwing, so the CLI's `process.exit(1)` is
 *     unreachable on every realistic failure path — it exits 0 when the scan fails.
 *   - It writes progress lines that contain ✅ ("Provenance check passed",
 *     "Downloaded", "Analyzed") before the verdict, so grepping for ✅ matches a
 *     failed scan too.
 *
 * So the only trustworthy signal is the verdict line itself, matched whole, with
 * ❌ anywhere in the output treated as failure.
 *
 * Usage: node scripts/scan-published.mjs [package-name[@version]]
 */

import { spawnSync } from 'node:child_process';

/** Pinned so the verdict strings this script matches cannot drift under it. */
const SCANNER_VERSION = '0.32.0';
const DEFAULT_TARGET = 'n8n-nodes-youex';

const write = (line) => process.stdout.write(`${line}\n`);

function fail(reason) {
	write('');
	write(`scan gate: FAILED — ${reason}`);
	process.exit(1);
}

const target = process.argv[2] ?? DEFAULT_TARGET;

// The target reaches a shell on Windows, and is interpolated into a RegExp
// below. Both are reasons to accept only what an npm spec can legally contain.
if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+(@[a-z0-9.^~*<>= -]+)?$/i.test(target)) {
	fail(`"${target}" is not a valid package spec`);
}

const versionSeparator = target.lastIndexOf('@');
const packageName = versionSeparator > 0 ? target.slice(0, versionSeparator) : target;

write(`Scanning ${target} with @n8n/scan-community-package@${SCANNER_VERSION}…`);

const result = spawnSync(
	'npx',
	['-y', `@n8n/scan-community-package@${SCANNER_VERSION}`, target],
	{ encoding: 'utf8', shell: process.platform === 'win32' },
);

if (result.error) {
	fail(`could not run the scanner: ${result.error.message}`);
}

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
process.stdout.write(output.endsWith('\n') || output === '' ? output : `${output}\n`);

if (result.status !== 0) {
	fail(`the scanner exited with code ${result.status}`);
}

if (output.includes('❌')) {
	fail('the scanner reported a failed check');
}

const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const verdict = new RegExp(
	`^✅ Package ${escapedName}@\\S+ has passed all security checks\\s*$`,
	'm',
);

if (!verdict.test(output)) {
	fail(
		'the scanner never printed its success verdict — it may have crashed, or its output format changed. ' +
			'Read the output above; do not treat this as a pass.',
	);
}

write('');
write('scan gate: passed');
