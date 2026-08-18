import type { INodeProperties } from 'n8n-workflow';

/**
 * `Return All` / `Limit` for a resource's list operation.
 *
 * The API answers a list with a **bare array** and puts the cursor in headers:
 * `x-has-more` is `"true"` / `"false"` and `x-next-cursor` appears only when
 * there is another page. `type: 'generic'` is the pagination mode that can read
 * them, so no hand-rolled loop is needed — see the Phase 4 plan §4.3.
 *
 * `send.paginate` is what makes it conditional: the pagination block hangs off
 * the parameter but only engages when the parameter's own value is true.
 *
 * With `Return All` on, `Limit` is hidden and therefore never sent, so the
 * backend applies its own default page size of 50. Forcing the 200 maximum would
 * mean putting a `limit` in this parameter's routing, which also fires when the
 * toggle is off and would then fight the `Limit` parameter below.
 *
 * Taken as a function rather than a constant so each resource supplies its own
 * `resource` gate instead of callers merging `displayOptions` by hand.
 */
export function listPaginationFields(resource: string): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show: { resource: [resource], operation: ['getAll'] } },
			routing: {
				send: { paginate: '={{$value}}' },
				operations: {
					pagination: {
						type: 'generic',
						properties: {
							continue: '={{ $response.headers["x-has-more"] === "true" }}',
							request: {
								qs: { cursor: '={{ $response.headers["x-next-cursor"] }}' },
							},
						},
					},
				},
			},
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			description: 'Max number of results to return',
			typeOptions: { minValue: 1, maxValue: 200 },
			displayOptions: { show: { resource: [resource], operation: ['getAll'], returnAll: [false] } },
			routing: { request: { qs: { limit: '={{$value}}' } } },
		},
	];
}
