import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class YouExApi implements ICredentialType {
	name = 'youExApi';

	displayName = 'YouEx API';

	// Resolved from `dist/credentials/`, where the build places this file, to the
	// icons the build copies alongside the node.
	icon: Icon = {
		light: 'file:../nodes/YouEx/youex.svg',
		dark: 'file:../nodes/YouEx/youex.dark.svg',
	};

	documentationUrl = 'https://github.com/youex-ai/n8n-nodes-youex?tab=readme-ov-file#credentials';

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
			description: 'URL of your YouEx instance, without a trailing slash',
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
			baseURL: '={{$credentials.baseUrl}}/api/integrations/v1',
			url: '/account',
		},
	};
}
