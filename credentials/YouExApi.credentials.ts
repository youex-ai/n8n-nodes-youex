import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * The base URL is normalized here rather than trusted as typed.
 *
 * YouEx serves the SPA's index.html with HTTP 200 on every unmatched route, and
 * a credential test with no `rules` accepts any 2xx. A trailing slash in
 * `baseUrl` produces `…//api/integrations/v1/account`, whose double slash sits
 * mid-path where nothing normalizes it: Express never matches it, the SPA
 * answers 200 text/html, and the test would go green without the API ever being
 * reached. Stripping the slashes closes the likely case; the `rules` block below
 * closes the rest by requiring a field only the real endpoint returns.
 */
const BASE_URL = '={{ $credentials.baseUrl.replace(/\\/+$/, "") }}/api/integrations/v1';

export class YouExApi implements ICredentialType {
	name = 'youExApi';

	displayName = 'YouEx API';

	documentationUrl = 'https://github.com/youex-ai/n8n-nodes-youex?tab=readme-ov-file#credentials';

	// Resolved from `dist/credentials/`, where the build places this file, to the
	// icons the build copies alongside the node.
	icon: Icon = {
		light: 'file:../nodes/YouEx/youex.svg',
		dark: 'file:../nodes/YouEx/youex.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Workspace API key. Create one in YouEx under Workspace Settings > Integrations. The key is bound to a single workspace and is shown only once.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://app.youex.ai',
			description: 'URL of your YouEx instance. A trailing slash is ignored.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: BASE_URL,
			url: '/account',
		},
		rules: [
			{
				// Fires when `workspaceCount` is absent, which is what a 200 carrying
				// the SPA's HTML looks like. The real endpoint always returns it.
				type: 'responseSuccessBody',
				properties: {
					key: 'workspaceCount',
					value: undefined,
					message:
						'Connected, but the response did not come from the YouEx integrations API. Check that Base URL points at your YouEx instance.',
				},
			},
		],
	};
}
