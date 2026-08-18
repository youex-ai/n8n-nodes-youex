import type { INodeProperties } from 'n8n-workflow';
import { LEAD_STATUS_OPTIONS, dateWindowFilters, searchFilter } from '../../shared/fields';
import { listPaginationFields } from '../../shared/pagination';

const showOnlyForLeads = { resource: ['lead'] };

/**
 * The 15 fields of `createLeadActionSchema`, alphabetized so both collections
 * below satisfy `node-param-collection-type-unsorted-items`.
 *
 * `Create` takes every one of these except `name`, which is required and
 * therefore sits at the top level. `Update` takes all 15, since a patch requires
 * nothing but the record id.
 */
const leadFields: INodeProperties[] = [
	{
		displayName: 'Account ID',
		name: 'companyId',
		type: 'string',
		default: '',
		description: 'ID of an existing account to link this lead to',
		routing: { request: { body: { companyId: '={{$value}}' } } },
	},
	{
		displayName: 'Account Name',
		name: 'company',
		type: 'string',
		default: '',
		description: 'Account name as free text, for when no account record exists yet',
		routing: { request: { body: { company: '={{$value}}' } } },
	},
	{
		displayName: 'Account Website',
		name: 'companyWebsite',
		type: 'string',
		default: '',
		description: 'Website of the account this lead belongs to',
		routing: { request: { body: { companyWebsite: '={{$value}}' } } },
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		default: '',
		description: 'ID of an existing contact to link this lead to',
		routing: { request: { body: { contactId: '={{$value}}' } } },
	},
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description: 'Primary email address of the lead',
		routing: { request: { body: { email: '={{$value}}' } } },
	},
	{
		displayName: 'LinkedIn URL',
		name: 'linkedinUrl',
		type: 'string',
		default: '',
		description: 'LinkedIn profile URL of the lead',
		routing: { request: { body: { linkedinUrl: '={{$value}}' } } },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Full name of the lead',
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	{
		displayName: 'Notes',
		name: 'notes',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Free-text notes about the lead',
		routing: { request: { body: { notes: '={{$value}}' } } },
	},
	{
		displayName: 'Opportunity ID',
		name: 'opportunityId',
		type: 'string',
		default: '',
		description: 'ID of an existing opportunity to link this lead to',
		routing: { request: { body: { opportunityId: '={{$value}}' } } },
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		description: 'Primary phone number of the lead',
		routing: { request: { body: { phone: '={{$value}}' } } },
	},
	{
		displayName: 'Secondary Email',
		name: 'secondaryEmail',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description: 'Additional email address of the lead',
		routing: { request: { body: { secondaryEmail: '={{$value}}' } } },
	},
	{
		displayName: 'Secondary Phone',
		name: 'secondaryPhone',
		type: 'string',
		default: '',
		description: 'Additional phone number of the lead',
		routing: { request: { body: { secondaryPhone: '={{$value}}' } } },
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'New',
		description: 'Pipeline status of the lead',
		options: LEAD_STATUS_OPTIONS,
		routing: { request: { body: { status: '={{$value}}' } } },
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		typeOptions: { multipleValues: true },
		default: [],
		description: 'Tags to attach to the lead',
		routing: { request: { body: { tags: '={{$value}}' } } },
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'Job title of the lead',
		routing: { request: { body: { title: '={{$value}}' } } },
	},
];

const leadCreateFields = leadFields.filter((field) => field.name !== 'name');

export const leadDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForLeads },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a lead',
				description: 'Create a new lead',
				routing: { request: { method: 'POST', url: '/crm/lead' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a lead',
				description: 'Delete an existing lead',
				routing: {
					request: { method: 'DELETE', url: '=/crm/lead/{{$parameter["recordId"]}}' },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a lead',
				description: 'Retrieve a single lead by ID',
				routing: { request: { method: 'GET', url: '=/crm/lead/{{$parameter["recordId"]}}' } },
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many leads',
				description: 'Retrieve many leads',
				// No `rootProperty` here on purpose: `/crm/leads` returns a bare array,
				// while contacts, accounts and opportunities return a `{ records }`
				// wrapper. The inconsistency is the backend's, shared with Zapier.
				routing: { request: { method: 'GET', url: '/crm/leads' } },
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a lead',
				description: 'Update an existing lead',
				routing: {
					request: { method: 'PATCH', url: '=/crm/lead/{{$parameter["recordId"]}}' },
				},
			},
		],
		default: 'create',
	},
	{
		displayName: 'Lead ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the lead to act on',
		displayOptions: {
			show: { ...showOnlyForLeads, operation: ['delete', 'get', 'update'] },
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Full name of the lead',
		displayOptions: { show: { ...showOnlyForLeads, operation: ['create'] } },
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForLeads, operation: ['create'] } },
		options: leadCreateFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForLeads, operation: ['update'] } },
		options: leadFields,
	},
	...listPaginationFields('lead'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { ...showOnlyForLeads, operation: ['getAll'] } },
		options: [
			...dateWindowFilters,
			searchFilter,
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'New',
				description: 'Only return leads with this status',
				options: LEAD_STATUS_OPTIONS,
				routing: { request: { qs: { status: '={{$value}}' } } },
			},
		],
	},
];
