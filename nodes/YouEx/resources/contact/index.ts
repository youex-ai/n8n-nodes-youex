import type { INodeProperties } from 'n8n-workflow';
import { CONTACT_STATUS_OPTIONS, dateWindowFilters, searchFilter } from '../../shared/fields';
import { listPaginationFields } from '../../shared/pagination';

const showOnlyForContacts = { resource: ['contact'] };

/**
 * The 14 fields of `createContactActionSchema`, alphabetized for
 * `node-param-collection-type-unsorted-items`.
 *
 * Note this schema is narrower than `contactSchema`: it exposes neither
 * `customFields` nor `doNotContact`, and none of the enrichment or research
 * state. That is the backend's own explicit action schema, not a choice made
 * here — unlike Account, which needs curating.
 */
const contactFields: INodeProperties[] = [
	{
		displayName: 'Account ID',
		name: 'companyId',
		type: 'string',
		default: '',
		description: 'ID of an existing account to link this contact to',
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
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description: 'Primary email address of the contact',
		routing: { request: { body: { email: '={{$value}}' } } },
	},
	{
		displayName: 'LinkedIn URL',
		name: 'linkedinUrl',
		type: 'string',
		default: '',
		description: 'LinkedIn profile URL of the contact',
		routing: { request: { body: { linkedinUrl: '={{$value}}' } } },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Full name of the contact',
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	{
		displayName: 'Notes',
		name: 'notes',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Free-text notes about the contact',
		routing: { request: { body: { notes: '={{$value}}' } } },
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		description: 'Primary phone number of the contact',
		routing: { request: { body: { phone: '={{$value}}' } } },
	},
	{
		displayName: 'Secondary Email',
		name: 'secondaryEmail',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
		description: 'Additional email address of the contact',
		routing: { request: { body: { secondaryEmail: '={{$value}}' } } },
	},
	{
		displayName: 'Secondary Phone',
		name: 'secondaryPhone',
		type: 'string',
		default: '',
		description: 'Additional phone number of the contact',
		routing: { request: { body: { secondaryPhone: '={{$value}}' } } },
	},
	{
		displayName: 'Source Conversation ID',
		name: 'sourceConversationId',
		type: 'string',
		default: '',
		description: 'ID of the conversation this contact came from',
		routing: { request: { body: { sourceConversationId: '={{$value}}' } } },
	},
	{
		displayName: 'Source Lead ID',
		name: 'sourceLeadId',
		type: 'string',
		default: '',
		description: 'ID of the lead this contact was converted from',
		routing: { request: { body: { sourceLeadId: '={{$value}}' } } },
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'Active',
		description: 'Contact status',
		options: CONTACT_STATUS_OPTIONS,
		routing: { request: { body: { status: '={{$value}}' } } },
	},
	{
		displayName: 'Tags',
		name: 'tags',
		type: 'string',
		typeOptions: { multipleValues: true },
		default: [],
		description: 'Tags to attach to the contact',
		routing: { request: { body: { tags: '={{$value}}' } } },
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'Job title of the contact',
		routing: { request: { body: { title: '={{$value}}' } } },
	},
];

const contactCreateFields = contactFields.filter((field) => field.name !== 'name');

export const contactDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForContacts },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a contact',
				description: 'Create a new contact',
				routing: { request: { method: 'POST', url: '/crm/contact' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a contact',
				description: 'Delete an existing contact',
				routing: {
					request: { method: 'DELETE', url: '=/crm/contact/{{$parameter["recordId"]}}' },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a contact',
				description: 'Retrieve a single contact by ID',
				routing: {
					request: { method: 'GET', url: '=/crm/contact/{{$parameter["recordId"]}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many contacts',
				description: 'Retrieve many contacts',
				routing: {
					request: { method: 'GET', url: '/crm/contacts' },
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
				action: 'Update a contact',
				description: 'Update an existing contact',
				routing: {
					request: { method: 'PATCH', url: '=/crm/contact/{{$parameter["recordId"]}}' },
				},
			},
		],
		default: 'create',
	},
	{
		displayName: 'Contact ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the contact to act on',
		displayOptions: {
			show: { ...showOnlyForContacts, operation: ['delete', 'get', 'update'] },
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Full name of the contact',
		displayOptions: { show: { ...showOnlyForContacts, operation: ['create'] } },
		routing: { request: { body: { name: '={{$value}}' } } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForContacts, operation: ['create'] } },
		options: contactCreateFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForContacts, operation: ['update'] } },
		options: contactFields,
	},
	...listPaginationFields('contact'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { ...showOnlyForContacts, operation: ['getAll'] } },
		options: [
			{
				displayName: 'Account ID',
				name: 'companyId',
				type: 'string',
				default: '',
				description: 'Only return contacts linked to this account',
				routing: { request: { qs: { companyId: '={{$value}}' } } },
			},
			...dateWindowFilters,
			searchFilter,
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'Active',
				description: 'Only return contacts with this status',
				options: CONTACT_STATUS_OPTIONS,
				routing: { request: { qs: { status: '={{$value}}' } } },
			},
		],
	},
];
