import type { INodeProperties } from 'n8n-workflow';
import {
	COMPANY_STATUS_OPTIONS,
	COMPANY_TYPE_OPTIONS,
	dateWindowFilters,
	searchFilter,
} from '../../shared/fields';
import { listPaginationFields } from '../../shared/pagination';

const showOnlyForAccounts = { resource: ['account'] };

/**
 * The **curated** Account surface: 15 business fields (`name` plus the 14 below).
 *
 * `createAccountActionSchema` is `insertCompanySchema.omit({workspaceId}).strict()`,
 * which carries 26 fields. Eleven of them are internal enrichment and research
 * state and are deliberately absent here, per D5:
 *
 *   enrichmentStatus, enrichmentId, pendingEnrichmentReservation, enrichedAt,
 *   enrichmentData, researchStatus, pendingResearchReservation, researchedAt,
 *   researchReport, researchExecutiveSummary, researchSources
 *
 * Two of those are usage reservations tied to billing. Do not add them back: the
 * backend still accepts them from a direct caller, and hardening it there is
 * tracked as follow-up because it changes the API Zapier consumes.
 */
const accountFields: INodeProperties[] = [
	{
		displayName: 'City',
		name: 'city',
		type: 'string',
		default: '',
		description: 'City of the account address',
		routing: { request: { body: { city: '={{$value}}' } } },
	},
	{
		displayName: 'Country',
		name: 'country',
		type: 'string',
		default: '',
		description: 'Country of the account address',
		routing: { request: { body: { country: '={{$value}}' } } },
	},
	{
		displayName: 'Custom Fields',
		name: 'customFields',
		type: 'json',
		default: '{}',
		description: 'Custom fields as a JSON object of string keys and string values',
		routing: { request: { body: { customFields: '={{ JSON.parse($value) }}' } } },
	},
	{
		displayName: 'Industry',
		name: 'industry',
		type: 'string',
		default: '',
		description: 'Industry the account operates in',
		routing: { request: { body: { industry: '={{$value}}' } } },
	},
	{
		displayName: 'Notes',
		name: 'notes',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Free-text notes about the account',
		routing: { request: { body: { notes: '={{$value}}' } } },
	},
	{
		displayName: 'Primary Contact ID',
		name: 'primaryContactId',
		type: 'string',
		default: '',
		description: 'ID of the contact who is the main point of contact',
		routing: { request: { body: { primaryContactId: '={{$value}}' } } },
	},
	{
		displayName: 'Source Lead ID',
		name: 'sourceLeadId',
		type: 'string',
		default: '',
		description: 'ID of the lead this account came from',
		routing: { request: { body: { sourceLeadId: '={{$value}}' } } },
	},
	{
		displayName: 'State',
		name: 'state',
		type: 'string',
		default: '',
		description: 'State or region of the account address',
		routing: { request: { body: { state: '={{$value}}' } } },
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'Prospect',
		description: 'Relationship status of the account',
		options: COMPANY_STATUS_OPTIONS,
		routing: { request: { body: { status: '={{$value}}' } } },
	},
	{
		displayName: 'Street Address 1',
		name: 'streetAddress1',
		type: 'string',
		default: '',
		description: 'First line of the account street address',
		routing: { request: { body: { streetAddress1: '={{$value}}' } } },
	},
	{
		displayName: 'Street Address 2',
		name: 'streetAddress2',
		type: 'string',
		default: '',
		description: 'Second line of the account street address',
		routing: { request: { body: { streetAddress2: '={{$value}}' } } },
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		typeOptions: { multipleValues: true },
		default: [],
		description: 'Tags to attach to the account',
		routing: { request: { body: { tags: '={{$value}}' } } },
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		default: 'Other',
		description: 'What kind of relationship this account represents',
		options: COMPANY_TYPE_OPTIONS,
		routing: { request: { body: { type: '={{$value}}' } } },
	},
	{
		displayName: 'Website',
		name: 'website',
		type: 'string',
		default: '',
		description: 'Website of the account',
		routing: { request: { body: { website: '={{$value}}' } } },
	},
];

const accountUpdateFields: INodeProperties[] = [
	...accountFields.slice(0, 4),
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Name of the account',
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	...accountFields.slice(4),
];

export const accountDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForAccounts },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an account',
				description: 'Create a new account',
				routing: { request: { method: 'POST', url: '/crm/account' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an account',
				description: 'Delete an existing account',
				routing: {
					request: { method: 'DELETE', url: '=/crm/account/{{$parameter["recordId"]}}' },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an account',
				description: 'Retrieve a single account by ID',
				routing: {
					request: { method: 'GET', url: '=/crm/account/{{$parameter["recordId"]}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many accounts',
				description: 'Retrieve many accounts',
				routing: {
					request: { method: 'GET', url: '/crm/accounts' },
					// This resource answers with `{ records, total, hasMore, nextCursor }`,
					// unlike `/crm/leads`, which answers with a bare array. Without this
					// the node would emit one item holding the wrapper instead of N
					// records. Verified against the running API, not assumed.
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'records' } }] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an account',
				description: 'Update an existing account',
				routing: {
					request: { method: 'PATCH', url: '=/crm/account/{{$parameter["recordId"]}}' },
				},
			},
		],
		default: 'create',
	},
	{
		displayName: 'Account ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the account to act on',
		displayOptions: {
			show: { ...showOnlyForAccounts, operation: ['delete', 'get', 'update'] },
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the account',
		displayOptions: { show: { ...showOnlyForAccounts, operation: ['create'] } },
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForAccounts, operation: ['create'] } },
		options: accountFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForAccounts, operation: ['update'] } },
		options: accountUpdateFields,
	},
	...listPaginationFields('account'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { ...showOnlyForAccounts, operation: ['getAll'] } },
		options: [
			...dateWindowFilters,
			searchFilter,
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'Other',
				description: 'Only return accounts of this type',
				options: COMPANY_TYPE_OPTIONS,
				routing: { request: { qs: { type: '={{$value}}' } } },
			},
		],
	},
];
