#!/usr/bin/env node
/**
 * Unit tests for the webhook signature verifier.
 *
 * The fixtures are built with the **sender's** construction — HMAC-SHA256 over
 * `` `${timestampSeconds}.${body}` ``, hex-encoded, carried as `sha256=<hex>` —
 * mirroring `buildWebhookSignatureHeaders` in
 * `server/domains/integrations/webhooks/webhookSignature.ts`. A test that signs
 * with the verifier's own logic proves nothing.
 *
 * The rejection cases matter more than the happy path: fail-open code passes a
 * happy-path-only suite. Run against the build, so what is tested is what ships.
 *
 * Uses `node:test` and `node:assert` so the package gains no dev dependency.
 */

import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { verifyWebhookSignature, TIMESTAMP_TOLERANCE_SECONDS } = require(
	'../dist/nodes/YouEx/shared/signature.js',
);

const SECRET = 'yx-webhook-secret-fixture';
const NOW = 1_760_000_000;

/** The envelope the delivery worker sends, serialized exactly as it serializes it. */
const RAW_BODY = JSON.stringify({
	event_id: 'evt_1',
	workspaceId: 'ws_1',
	workspace_id: 'ws_1',
	record_id: 'lead_1',
	entity_type: 'lead',
	event_type: 'created',
	occurred_at: '2026-08-18T00:00:00.000Z',
	changed_fields: [],
	record: { name: 'Ada Lovelace' },
});

function sign(body, timestampSeconds, secret = SECRET) {
	const digest = createHmac('sha256', secret)
		.update(`${timestampSeconds}.${body}`, 'utf-8')
		.digest('hex');
	return `sha256=${digest}`;
}

function check(overrides = {}) {
	return verifyWebhookSignature({
		rawBody: RAW_BODY,
		signatureHeader: sign(RAW_BODY, NOW),
		timestampHeader: String(NOW),
		secret: SECRET,
		nowSeconds: NOW,
		...overrides,
	});
}

test('accepts a delivery signed by the sender construction', () => {
	assert.deepEqual(check(), { ok: true });
});

test('accepts a signature without the sha256= prefix', () => {
	const bare = sign(RAW_BODY, NOW).slice('sha256='.length);
	assert.deepEqual(check({ signatureHeader: bare }), { ok: true });
});

test('accepts a timestamp at the edge of the tolerance window', () => {
	const edge = NOW - TIMESTAMP_TOLERANCE_SECONDS;
	assert.deepEqual(
		check({ timestampHeader: String(edge), signatureHeader: sign(RAW_BODY, edge) }),
		{ ok: true },
	);
});

test('rejects a digest mismatch', () => {
	const result = check({ signatureHeader: sign(RAW_BODY, NOW, 'the-wrong-secret') });
	assert.equal(result.ok, false);
});

test('rejects a body that differs by one byte from the signed one', () => {
	const tampered = RAW_BODY.replace('Ada Lovelace', 'Ada Lovelacf');
	assert.equal(check({ rawBody: tampered }).ok, false);
});

test('rejects re-serialized bytes when key order differs', () => {
	// The fallback this verifier refuses to make: same data, different byte
	// sequence. It must not validate.
	const reordered = JSON.stringify({ record: { name: 'Ada Lovelace' }, event_id: 'evt_1' });
	assert.equal(check({ rawBody: reordered }).ok, false);
});

test('rejects a missing raw body instead of reconstructing it', () => {
	assert.equal(check({ rawBody: undefined }).ok, false);
	assert.equal(check({ rawBody: '' }).ok, false);
});

test('rejects a missing signature header', () => {
	assert.equal(check({ signatureHeader: undefined }).ok, false);
	assert.equal(check({ signatureHeader: '' }).ok, false);
});

test('rejects a missing timestamp header', () => {
	assert.equal(check({ timestampHeader: undefined }).ok, false);
});

test('rejects a non-numeric timestamp', () => {
	assert.equal(check({ timestampHeader: 'not-a-number' }).ok, false);
});

test('rejects a timestamp beyond the tolerance, in both directions', () => {
	const stale = NOW - TIMESTAMP_TOLERANCE_SECONDS - 1;
	const future = NOW + TIMESTAMP_TOLERANCE_SECONDS + 1;
	assert.equal(
		check({ timestampHeader: String(stale), signatureHeader: sign(RAW_BODY, stale) }).ok,
		false,
	);
	assert.equal(
		check({ timestampHeader: String(future), signatureHeader: sign(RAW_BODY, future) }).ok,
		false,
	);
});

test('rejects when no secret is stored', () => {
	assert.equal(check({ secret: undefined }).ok, false);
});

test('rejects a short or non-hex signature without throwing', () => {
	// `timingSafeEqual` throws on unequal buffer lengths, so the length guard is
	// load-bearing rather than an optimization.
	assert.equal(check({ signatureHeader: 'sha256=abcd' }).ok, false);
	assert.equal(check({ signatureHeader: 'sha256=zzzz' }).ok, false);
});
