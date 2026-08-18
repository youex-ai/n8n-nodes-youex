import {
	NodeOperationError,
	type IAllExecuteFunctions,
	type IDataObject,
	type IHttpRequestMethods,
} from 'n8n-workflow';

export const INTEGRATIONS_PREFIX = '/api/integrations/v1';

/**
 * The trigger node is programmatic, so it has no `requestDefaults` to inherit.
 * This rebuilds the same base URL the action node uses, including the trailing
 * slash normalization — without it a `baseUrl` ending in `/` produces a double
 * slash mid-path, which Express does not route and the SPA answers with 200 HTML.
 */
async function resolveBaseUrl(context: IAllExecuteFunctions): Promise<string> {
	const credentials = await context.getCredentials('youExApi');
	return String(credentials.baseUrl ?? '').replace(/\/+$/, '');
}

function readStatusCode(error: unknown): number | undefined {
	const candidate = error as {
		httpCode?: unknown;
		statusCode?: unknown;
		response?: { status?: unknown; statusCode?: unknown };
	};
	const raw =
		candidate?.httpCode ??
		candidate?.statusCode ??
		candidate?.response?.status ??
		candidate?.response?.statusCode;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Turns the two API failures a user cannot diagnose from the raw response into
 * errors that say what to do.
 *
 * `403 insufficient_scope` is the important one: a key without `crm:hooks` fails
 * every subscription call, and the generic 403 sends people looking at n8n
 * instead of at their key's scopes.
 */
function describeApiError(context: IAllExecuteFunctions, error: unknown): Error {
	const status = readStatusCode(error);
	const message = String((error as { message?: unknown })?.message ?? error);
	const node = context.getNode();

	if (status === 403 || message.includes('insufficient_scope')) {
		return new NodeOperationError(
			node,
			'The YouEx API key is missing a required scope',
			{
				description:
					'Managing webhook subscriptions needs the "crm:hooks" scope. Create a new key with it in YouEx under Workspace Settings > Integrations — scopes cannot be added to an existing key.',
			},
		);
	}

	if (status === 429) {
		return new NodeOperationError(node, 'The YouEx API rate limit was reached', {
			description:
				'The limit is 600 requests per minute per API key. This is retryable — wait and run again, or reduce how often the workflow calls YouEx.',
		});
	}

	return error instanceof Error ? error : new Error(message);
}

export async function youExApiRequest(
	this: IAllExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<unknown> {
	const baseUrl = await resolveBaseUrl(this);

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'youExApi', {
			method,
			url: `${baseUrl}${INTEGRATIONS_PREFIX}${endpoint}`,
			headers: { Accept: 'application/json' },
			...(body === undefined ? {} : { body }),
			...(qs === undefined ? {} : { qs }),
		});
	} catch (error) {
		throw describeApiError(this, error);
	}
}
