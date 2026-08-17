import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
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
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'youExApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}/api/integrations/v1',
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
						name: 'Workspace',
						value: 'workspace',
					},
				],
				default: 'workspace',
			},
			...workspaceDescription,
		],
	};
}
