import type { INodeProperties } from 'n8n-workflow';

const showOnlyForWorkspaces = {
	resource: ['workspace'],
};

export const workspaceDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForWorkspaces,
		},
		options: [
			{
				name: 'Get Current',
				value: 'getCurrent',
				action: 'Get the current workspace',
				description: 'Get the workspace and user this API key is bound to',
				routing: {
					request: {
						method: 'GET',
						url: '/account',
					},
				},
			},
		],
		default: 'getCurrent',
	},
];
