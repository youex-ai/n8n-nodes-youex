import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

/**
 * Option lists mirroring the backend enums.
 *
 * Lists of five or more are alphabetized by `name` because
 * `node-param-options-type-unsorted-items` requires it above that threshold.
 */

/**
 * The **write** surface, `createLeadStatusOptions` — six values.
 *
 * Deliberately not `leadStatusSchema`, which has nine: records can hold
 * `Medium`, `Converted` and `Lost`, but create, update and the list filter all
 * reject them. Offering nine here would produce 400s; the node must not validate
 * what it reads back either.
 */
export const LEAD_STATUS_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Cold', value: 'Cold' },
	{ name: 'Hot', value: 'Hot' },
	{ name: 'New', value: 'New' },
	{ name: 'Opportunity', value: 'Opportunity' },
	{ name: 'VIP', value: 'VIP' },
	{ name: 'Warm', value: 'Warm' },
];

export const CONTACT_STATUS_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Active', value: 'Active' },
	{ name: 'Do Not Contact', value: 'Do Not Contact' },
	{ name: 'Inactive', value: 'Inactive' },
];

export const COMPANY_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Competitor', value: 'Competitor' },
	{ name: 'Customer', value: 'Customer' },
	{ name: 'Other', value: 'Other' },
	{ name: 'Partner', value: 'Partner' },
	{ name: 'Vendor', value: 'Vendor' },
];

export const COMPANY_STATUS_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Active', value: 'Active' },
	{ name: 'Former', value: 'Former' },
	{ name: 'Inactive', value: 'Inactive' },
	{ name: 'Prospect', value: 'Prospect' },
];

export const OPPORTUNITY_STAGE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Closed Lost', value: 'Closed Lost' },
	{ name: 'Closed Won', value: 'Closed Won' },
	{ name: 'Needs Analysis', value: 'Needs Analysis' },
	{ name: 'Negotiation', value: 'Negotiation' },
	{ name: 'Proposal', value: 'Proposal' },
	{ name: 'Prospecting', value: 'Prospecting' },
	{ name: 'Qualification', value: 'Qualification' },
];

/**
 * The `Account` / `company` split lives here and nowhere else.
 *
 * The CRM routes say `account` but the webhook `entityType` enum says `company`.
 * The parameter carries `account`, so nothing user-visible — the option label,
 * the node subtitle, an expression a user writes — can ever read `company`.
 * `toWireEntityType` is applied at the one boundary that talks to
 * `/subscriptions`.
 */
export const TRIGGER_ENTITY_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Account', value: 'account' },
	{ name: 'Contact', value: 'contact' },
	{ name: 'Lead', value: 'lead' },
	{ name: 'Opportunity', value: 'opportunity' },
];

/** Translates the parameter value into the `entityType` the API expects. */
export function toWireEntityType(entityType: string): string {
	return entityType === 'account' ? 'company' : entityType;
}

export const TRIGGER_EVENT_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Created', value: 'created' },
	{ name: 'Deleted', value: 'deleted' },
	{ name: 'Updated', value: 'updated' },
];

/**
 * The date window shared by all four list operations.
 *
 * Sent only when set: the backend query schemas are `.strict()`, so an empty
 * string is a 400 rather than an omitted filter.
 */
export const dateWindowFilters: INodeProperties[] = [
	{
		displayName: 'Date Field',
		name: 'dateField',
		type: 'options',
		default: 'createdAt',
		description: 'Which timestamp the date range applies to',
		options: [
			{ name: 'Created At', value: 'createdAt' },
			{ name: 'Updated At', value: 'updatedAt' },
		],
		routing: { request: { qs: { dateField: '={{$value}}' } } },
	},
	{
		displayName: 'Date From',
		name: 'dateFrom',
		type: 'dateTime',
		default: '',
		description: 'Only return records at or after this moment',
		routing: { request: { qs: { dateFrom: '={{$value}}' } } },
	},
	{
		displayName: 'Date To',
		name: 'dateTo',
		type: 'dateTime',
		default: '',
		description: 'Only return records at or before this moment',
		routing: { request: { qs: { dateTo: '={{$value}}' } } },
	},
];

/** `search` is offered by every list operation. */
export const searchFilter: INodeProperties = {
	displayName: 'Search',
	name: 'search',
	type: 'string',
	default: '',
	description: 'Free-text search across the record',
	routing: { request: { qs: { search: '={{$value}}' } } },
};
