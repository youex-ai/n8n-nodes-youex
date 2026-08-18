import { createHmac, timingSafeEqual } from 'crypto';

export const SIGNATURE_HEADER = 'x-youex-signature';
export const TIMESTAMP_HEADER = 'x-youex-timestamp';

/** Matches the tolerance the sender recommends. */
export const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

const SIGNATURE_PREFIX = 'sha256=';

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

/**
 * Verifies `X-YouEx-Signature` over `` `${timestamp}.${rawBody}` ``.
 *
 * **Fails closed in every case.** In particular, a missing or empty `rawBody` is
 * a rejection and must never fall back to re-serializing the parsed body. That
 * fallback would *usually* work — the sender stringifies with no spacing and Node
 * preserves key insertion order — which is exactly what makes it dangerous: it
 * passes every test and then either validates bytes that were never signed, or
 * fails in production on an ordering nobody reproduced. The sender is explicit
 * that it signs "the exact bytes put on the wire"; the receiver owes it the same.
 *
 * A delivery with no signature is also a rejection rather than an unsigned
 * legacy delivery: on the neutral prefix every subscription is issued a secret,
 * so an unsigned request is anomalous.
 *
 * Pure and clock-injected so the rejection paths are unit-testable without
 * waiting on real time.
 */
export function verifyWebhookSignature(args: {
	rawBody: string | undefined;
	signatureHeader: unknown;
	timestampHeader: unknown;
	secret: string | undefined;
	nowSeconds: number;
}): SignatureCheck {
	const { rawBody, signatureHeader, timestampHeader, secret, nowSeconds } = args;

	if (!secret) {
		return {
			ok: false,
			reason:
				'no signing secret is stored for this trigger. Deactivate and reactivate the workflow so YouEx issues a new subscription secret',
		};
	}

	if (typeof rawBody !== 'string' || rawBody.length === 0) {
		return {
			ok: false,
			reason: 'the raw request body was unavailable, so the signature could not be verified',
		};
	}

	if (typeof signatureHeader !== 'string' || signatureHeader.length === 0) {
		return { ok: false, reason: `the ${SIGNATURE_HEADER} header is missing` };
	}

	if (typeof timestampHeader !== 'string' || timestampHeader.length === 0) {
		return { ok: false, reason: `the ${TIMESTAMP_HEADER} header is missing` };
	}

	const timestampSeconds = Number(timestampHeader);
	if (!Number.isFinite(timestampSeconds)) {
		return { ok: false, reason: `the ${TIMESTAMP_HEADER} header is not a number` };
	}

	if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_TOLERANCE_SECONDS) {
		return {
			ok: false,
			reason: `the ${TIMESTAMP_HEADER} header is outside the ${TIMESTAMP_TOLERANCE_SECONDS / 60} minute tolerance`,
		};
	}

	const provided = signatureHeader.startsWith(SIGNATURE_PREFIX)
		? signatureHeader.slice(SIGNATURE_PREFIX.length)
		: signatureHeader;

	const expected = createHmac('sha256', secret)
		.update(`${timestampHeader}.${rawBody}`, 'utf-8')
		.digest('hex');

	const providedBuffer = Buffer.from(provided, 'hex');
	const expectedBuffer = Buffer.from(expected, 'hex');

	// `timingSafeEqual` throws on a length mismatch, so the guard is required
	// rather than an optimization.
	if (providedBuffer.length !== expectedBuffer.length) {
		return { ok: false, reason: 'the signature did not match' };
	}

	if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
		return { ok: false, reason: 'the signature did not match' };
	}

	return { ok: true };
}
