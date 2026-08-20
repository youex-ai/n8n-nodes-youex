import {
	NodeApiError,
	type IExecuteSingleFunctions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
} from 'n8n-workflow';

/**
 * Rejects a `200` that did not come from the integrations API.
 *
 * A YouEx address without the `/api/integrations/v1` mount — the wrong host, an
 * instance where it is not deployed, a `baseUrl` typo — answers with the web
 * application instead: an HTML document, with a `200`. Nothing about that is an
 * error as far as HTTP is concerned, so without this check the operation
 * *succeeds* and hands the workflow a page of markup where it expected records.
 * Observed against a real n8n before this existed.
 *
 * The credential's `test` block catches the same thing on the Test button, but
 * only there. This is the equivalent for the 21 operations, and it is attached
 * to the `resource` parameter — which every operation displays — rather than
 * repeated on each one.
 *
 * Deliberately narrow: it looks for a response that is HTML, not for one that
 * fails to match an expected schema. A stricter shape check would have to know
 * what each of the 21 operations returns, and would turn every future field the
 * API adds into a node-side breakage.
 *
 * Verified from a real n8n, both ways: the call that previously finished
 * `success` carrying a page of markup now fails with the message below, and
 * legitimate operations are untouched — including the list ones, whose
 * `rootProperty` unwrapping runs after this and still sees its `records`.
 */
export async function assertApiResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const contentType = String(response.headers?.['content-type'] ?? '').toLowerCase();
	const body = response.body;
	const looksLikeHtml = typeof body === 'string' && /^\s*<(!doctype|html)\b/i.test(body);

	if (contentType.includes('text/html') || looksLikeHtml) {
		throw new NodeApiError(
			this.getNode(),
			{ message: 'Response was not JSON', contentType },
			{
				message: 'The response did not come from the YouEx integrations API',
				description:
					'The Base URL answered with a web page instead of API data. Check the Base URL on the credential: it must be the root of your YouEx instance, and that instance must have the integrations API enabled. Pressing Test on the credential checks exactly this.',
				httpCode: String(response.statusCode),
			},
		);
	}

	return items;
}
