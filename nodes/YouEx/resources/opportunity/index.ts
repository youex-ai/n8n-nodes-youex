import type { INodeProperties } from 'n8n-workflow';
import { OPPORTUNITY_STAGE_OPTIONS, dateWindowFilters, searchFilter } from '../../shared/fields';
import { listPaginationFields } from '../../shared/pagination';

const showOnlyForOpportunities = { resource: ['opportunity'] };

/**
 * The 16 fields of `insertOpportunitySchema`, alphabetized.
 *
 * Unlike Account, every field here is a business field, so the whole schema is
 * exposed. `closeDate` is a plain `z.string()` on the backend, so a `dateTime`
 * parameter is safe — n8n sends ISO 8601, which satisfies it.
 *
 * `probability` is **not** normalized by the API routes:
 * `normalizeOpportunityProbabilityForStage` exists but the CRM handlers never
 * call it, so a `Closed Won` opportunity with `probability: 30` persists exactly
 * as sent. Pre-existing and shared with Zapier; documented in the README rather
 * than corrected here.
 */
const opportunityFields: INodeProperties[] = [
	{
		displayName: 'Account ID',
		name: 'companyId',
		type: 'string',
		default: '',
		description: 'ID of the account this opportunity belongs to',
		routing: { request: { body: { companyId: '={{$value}}' } } },
	},
	{
		displayName: 'Account Name',
		name: 'companyName',
		type: 'string',
		default: '',
		description: 'Account name as free text, for when no account record exists yet',
		routing: { request: { body: { companyName: '={{$value}}' } } },
	},
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'number',
		default: 0,
		description: 'Monetary value of the opportunity',
		typeOptions: { minValue: 0 },
		routing: { request: { body: { amount: '={{$value}}' } } },
	},
	{
		displayName: 'Close Date',
		name: 'closeDate',
		type: 'dateTime',
		default: '',
		description: 'Expected close date of the opportunity',
		routing: { request: { body: { closeDate: '={{$value}}' } } },
	},
	{
		displayName: 'Close Plan',
		name: 'closePlan',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Plan for closing the opportunity',
		routing: { request: { body: { closePlan: '={{$value}}' } } },
	},
	{
		displayName: 'Closing Notes',
		name: 'closingNotes',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Notes recorded when the opportunity was closed',
		routing: { request: { body: { closingNotes: '={{$value}}' } } },
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		description: 'ID of the primary contact for this opportunity',
		routing: { request: { body: { contactId: '={{$value}}' } } },
	},
	{
		displayName: 'Contact Name',
		name: 'contactName',
		type: 'string',
		default: '',
		description: 'Contact name as free text, for when no contact record exists yet',
		routing: { request: { body: { contactName: '={{$value}}' } } },
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
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Name of the opportunity',
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	{
		displayName: 'Notes',
		name: 'notes',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Free-text notes about the opportunity',
		routing: { request: { body: { notes: '={{$value}}' } } },
	},
	{
		displayName: 'Probability',
		name: 'probability',
		type: 'number',
		default: 0,
		description: 'Win probability as a percentage from 0 to 100',
		typeOptions: { minValue: 0, maxValue: 100 },
		routing: { request: { body: { probability: '={{$value}}' } } },
	},
	{
		displayName: 'Source Conversation ID',
		name: 'sourceConversationId',
		type: 'string',
		default: '',
		description: 'ID of the conversation this opportunity came from',
		routing: { request: { body: { sourceConversationId: '={{$value}}' } } },
	},
	{
		displayName: 'Source Lead ID',
		name: 'sourceLeadId',
		type: 'string',
		default: '',
		description: 'ID of the lead this opportunity came from',
		routing: { request: { body: { sourceLeadId: '={{$value}}' } } },
	},
	{
		displayName: 'Stage',
		name: 'stage',
		type: 'options',
		default: 'Prospecting',
		description: 'Pipeline stage of the opportunity',
		options: OPPORTUNITY_STAGE_OPTIONS,
		routing: { request: { body: { stage: '={{$value}}' } } },
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		typeOptions: { multipleValues: true },
		default: [],
		description: 'Tags to attach to the opportunity',
		routing: { request: { body: { tags: '={{$value}}' } } },
	},
];

const opportunityCreateFields = opportunityFields.filter((field) => field.name !== 'name');

export const opportunityDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForOpportunities },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an opportunity',
				description: 'Create a new opportunity',
				routing: { request: { method: 'POST', url: '/crm/opportunity' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an opportunity',
				description: 'Delete an existing opportunity',
				routing: {
					request: { method: 'DELETE', url: '=/crm/opportunity/{{$parameter["recordId"]}}' },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an opportunity',
				description: 'Retrieve a single opportunity by ID',
				routing: {
					request: { method: 'GET', url: '=/crm/opportunity/{{$parameter["recordId"]}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many opportunities',
				description: 'Retrieve many opportunities',
				routing: {
					request: { method: 'GET', url: '/crm/opportunities' },
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
				action: 'Update an opportunity',
				description: 'Update an existing opportunity',
				routing: {
					request: { method: 'PATCH', url: '=/crm/opportunity/{{$parameter["recordId"]}}' },
				},
			},
		],
		default: 'create',
	},
	{
		displayName: 'Opportunity ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the opportunity to act on',
		displayOptions: {
			show: { ...showOnlyForOpportunities, operation: ['delete', 'get', 'update'] },
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the opportunity',
		displayOptions: { show: { ...showOnlyForOpportunities, operation: ['create'] } },
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForOpportunities, operation: ['create'] } },
		options: opportunityCreateFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForOpportunities, operation: ['update'] } },
		options: opportunityFields,
	},
	...listPaginationFields('opportunity'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { ...showOnlyForOpportunities, operation: ['getAll'] } },
		options: [
			...dateWindowFilters,
			searchFilter,
			{
				displayName: 'Stage',
				name: 'stage',
				type: 'options',
				default: 'Prospecting',
				description: 'Only return opportunities in this stage',
				options: OPPORTUNITY_STAGE_OPTIONS,
				routing: { request: { qs: { stage: '={{$value}}' } } },
			},
		],
	},
];
