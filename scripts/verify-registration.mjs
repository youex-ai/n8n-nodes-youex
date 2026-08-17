#!/usr/bin/env node
/**
 * Asserts that n8n's own loader registers this package's nodes and credentials,
 * without needing an n8n account.
 *
 * `npm run dev` starts n8n and symlinks this package into
 * `~/.n8n-node-cli/.n8n/custom/node_modules/`, but every route that lists node
 * types is behind authentication and n8n's first run demands an owner account.
 * Driving `CustomDirectoryLoader` from `n8n-core` against `dist/` covers the same
 * ground: both classes load, the credential is wired to the node, the codex is
 * read, and the icons resolve.
 *
 * Requires `npm run build` first, and an `n8n-core` on disk — which `npm run dev`
 * leaves in the npx cache. Point at one explicitly with `--n8n-core=<path>`.
 *
 * Usage: node scripts/verify-registration.mjs [--n8n-core=<path to n8n-core>]
 */

import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(repoRoot, 'dist');

const write = (line) => process.stdout.write(`${line}\n`);
const failures = [];
const check = (ok, description, detail) => {
	if (ok) {
		write(`  ok   ${description}`);
	} else {
		write(`  FAIL ${description}${detail ? ` — ${detail}` : ''}`);
		failures.push(description);
	}
};

const LOADER_SUBPATH = path.join('dist', 'nodes-loader', 'custom-directory-loader.js');

/** npx caches n8n where `n8n-node dev` installed it; the location differs per platform. */
function npxCacheRoots() {
	const roots = [path.join(homedir(), '.npm', '_npx')];
	if (process.env.LOCALAPPDATA) {
		roots.push(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'));
	}
	return roots.filter((root) => existsSync(root));
}

function findN8nCore() {
	const flag = process.argv.find((arg) => arg.startsWith('--n8n-core='));
	if (flag) return flag.slice('--n8n-core='.length);

	try {
		return path.dirname(require.resolve('n8n-core/package.json'));
	} catch {
		// Not a dependency of this package, which is expected.
	}

	for (const root of npxCacheRoots()) {
		for (const entry of readdirSync(root)) {
			const candidate = path.join(root, entry, 'node_modules', 'n8n-core');
			if (existsSync(path.join(candidate, LOADER_SUBPATH))) return candidate;
		}
	}
	return null;
}

if (!existsSync(distDir)) {
	write('verify-registration: dist/ is missing. Run `npm run build` first.');
	process.exit(1);
}

const n8nCore = findN8nCore();
if (!n8nCore) {
	write('verify-registration: could not find n8n-core.');
	write('Run `npm run dev` once (it installs n8n), or pass --n8n-core=<path>.');
	process.exit(1);
}

const loaderPath = path.join(n8nCore, LOADER_SUBPATH);
if (!existsSync(loaderPath)) {
	write(`verify-registration: ${loaderPath} does not exist.`);
	write('n8n-core may have moved the loader; check the path before trusting this script.');
	process.exit(1);
}

const { CustomDirectoryLoader } = require(loaderPath);
const loader = new CustomDirectoryLoader(distDir);
await loader.loadAll();

const nodeNames = Object.keys(loader.nodeTypes);
const credentialNames = Object.keys(loader.credentialTypes);

write(`n8n-core: ${n8nCore}`);
write(`nodes:       ${nodeNames.join(', ') || '(none)'}`);
write(`credentials: ${credentialNames.join(', ') || '(none)'}`);
write('');

check(nodeNames.includes('youEx'), 'the YouEx node is registered', nodeNames.join(', '));
check(
	credentialNames.includes('youExApi'),
	'the youExApi credential is registered',
	credentialNames.join(', '),
);

const node = loader.nodeTypes.youEx?.type?.description;
if (node) {
	check(
		node.credentials?.some((entry) => entry.name === 'youExApi' && entry.required),
		'the node requires the youExApi credential',
		JSON.stringify(node.credentials),
	);
	check(
		typeof node.requestDefaults?.baseURL === 'string' &&
			node.requestDefaults.baseURL.includes('/api/integrations/v1'),
		'requestDefaults targets the neutral integrations prefix',
		node.requestDefaults?.baseURL,
	);
	check(
		typeof node.requestDefaults?.baseURL === 'string' &&
			node.requestDefaults.baseURL.includes('replace('),
		'the base URL is normalized against a trailing slash',
		node.requestDefaults?.baseURL,
	);
	check(
		Boolean(node.icon?.light && node.icon?.dark) || Boolean(node.iconUrl?.light && node.iconUrl?.dark),
		'both icon variants resolve',
		JSON.stringify(node.iconUrl ?? node.icon),
	);
}

const credential = loader.credentialTypes.youExApi?.type;
if (credential) {
	check(
		credential.test?.request?.url === '/account',
		'the credential test hits /account',
		credential.test?.request?.url,
	);
	check(
		Array.isArray(credential.test?.rules) && credential.test.rules.length > 0,
		'the credential test asserts the response body, not just a 2xx',
		JSON.stringify(credential.test?.rules),
	);
}

// Encodes the one rule where `n8n-node lint` and the verification scanner
// disagree today: the scanner's plugin (0.29.0+) rejects `usableAsTool: true` on
// a trigger node, the linter's (0.28.0) does not. Phase 4 adds the trigger.
for (const name of nodeNames) {
	const description = loader.nodeTypes[name]?.type?.description;
	const isTrigger = Array.isArray(description?.group) && description.group.includes('trigger');
	if (isTrigger) {
		check(
			description.usableAsTool !== true,
			`the ${name} trigger does not set usableAsTool: true`,
			'trigger nodes cannot be invoked as AI tools and the scanner rejects it',
		);
	}
}

write('');
if (failures.length > 0) {
	write(`verify-registration: FAILED (${failures.length})`);
	process.exit(1);
}
write('verify-registration: passed');
