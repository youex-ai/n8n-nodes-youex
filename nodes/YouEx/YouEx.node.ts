import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { assertApiResponse } from './shared/response';
import { accountDescription } from './resources/account';
import { contactDescription } from './resources/contact';
import { leadDescription } from './resources/lead';
import { opportunityDescription } from './resources/opportunity';
import { workspaceDescription } from './resources/workspace';

export class YouEx implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'YouEx',
		name: 'youEx',
		icon: { light: 'file:youex.svg', dark: 'file:youex.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume the YouEx CRM API',
		defaults: {
			name: 'YouEx',
		},
		// Off, and a decision rather than an inheritance from the template: with the
		// CRM write and delete operations that follow, `true` would let an AI Agent
		// mutate a workspace's records under LLM control. n8n's type is
		// `true | UsableAsToolDescription | undefined` — there is no `false`, so
		// "off" is spelled `undefined`, written explicitly because
		// `node-usable-as-tool` reports the property's *absence* and because the
		// next person should see a decision, not an omission.
		// The trigger node must never set it to true: triggers cannot be invoked as
		// tools, and the verification scanner rejects it.
		usableAsTool: undefined,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'youExApi',
				required: true,
			},
		],
		requestDefaults: {
			// Same normalization as the credential's test — see YouExApi.credentials.ts.
			// A trailing slash in `baseUrl` would otherwise put a double slash
			// mid-path, which Express does not match and the SPA answers with 200
			// HTML.
			baseURL: '={{ $credentials.baseUrl.replace(/\\/+$/, "") }}/api/integrations/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Contact',
						value: 'contact',
					},
					{
						name: 'Lead',
						value: 'lead',
					},
					{
						name: 'Opportunity',
						value: 'opportunity',
					},
					{
						name: 'Workspace',
						value: 'workspace',
					},
				],
				default: 'lead',
				// Hung off `resource` because every operation shows it, so this runs
				// once per response without being repeated 21 times. It sits before the
				// operations' own `rootProperty` unwrapping, which is the order that
				// matters: an HTML body has no `records` to unwrap.
				routing: { output: { postReceive: [assertApiResponse] } },
			},
			...accountDescription,
			...contactDescription,
			...leadDescription,
			...opportunityDescription,
			...workspaceDescription,
		],
	};
}
