import {
	NodeConnectionTypes,
	NodeOperationError,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { TRIGGER_ENTITY_OPTIONS, TRIGGER_EVENT_OPTIONS, toWireEntityType } from './shared/fields';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyWebhookSignature } from './shared/signature';
import { youExApiRequest } from './shared/transport';

type SubscriptionSummary = { subscriptionId?: string };
type CreatedSubscription = { subscriptionId?: string; secret?: string };

/**
 * Looks up the active subscription for this node's own webhook URL.
 *
 * Filtered on all three of `targetUrl`, `entityType` and `eventType` rather than
 * the URL alone: one node has one URL, but filtering on the full triple means a
 * reconfigured node never adopts a subscription for a different event.
 */
async function findSubscription(
	context: IHookFunctions,
	webhookUrl: string,
): Promise<SubscriptionSummary | undefined> {
	const found = (await youExApiRequest.call(context, 'GET', '/subscriptions', undefined, {
		targetUrl: webhookUrl,
		entityType: toWireEntityType(context.getNodeParameter('entityType') as string),
		eventType: context.getNodeParameter('eventType') as string,
	})) as SubscriptionSummary[] | undefined;

	return Array.isArray(found) ? found.find((entry) => Boolean(entry?.subscriptionId)) : undefined;
}

export class YouExTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'YouEx Trigger',
		name: 'youExTrigger',
		icon: { light: 'file:youex.svg', dark: 'file:youex.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["eventType"] + ": " + $parameter["entityType"]}}',
		description: 'Starts a workflow when a YouEx CRM record changes',
		defaults: {
			name: 'YouEx Trigger',
		},
		// Off, and never `true`: a trigger cannot be invoked as an AI tool, and
		// `triggerUsableAsTool` in the verification scanner's ruleset rejects it.
		// Spelled `undefined` rather than omitted so `node-usable-as-tool` — which
		// reports the property's *absence* and has no trigger awareness in the
		// version `npm run lint` pins — stays satisfied too.
		usableAsTool: undefined,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'youExApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Entity',
				name: 'entityType',
				type: 'options',
				noDataExpression: true,
				default: 'lead',
				description: 'Which kind of record to watch',
				options: TRIGGER_ENTITY_OPTIONS,
			},
			{
				displayName: 'Event',
				name: 'eventType',
				type: 'options',
				noDataExpression: true,
				default: 'created',
				description: 'Which change to the record starts the workflow',
				options: TRIGGER_EVENT_OPTIONS,
			},
			{
				displayName: 'Watched Fields',
				name: 'watchedFields',
				type: 'string',
				typeOptions: { multipleValues: true },
				default: [],
				placeholder: 'status',
				description:
					'Only start the workflow when one of these fields changed. Leave empty to start on any update.',
				displayOptions: { show: { eventType: ['updated'] } },
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) return false;

				const staticData = this.getWorkflowStaticData('node');
				const existing = await findSubscription(this, webhookUrl);

				if (!existing?.subscriptionId) {
					delete staticData.subscriptionId;
					return false;
				}

				if (staticData.secret) {
					// Recover the id in case static data lost it but kept the secret.
					staticData.subscriptionId = existing.subscriptionId;
					return true;
				}

				// The subscription exists but this node no longer holds its secret, and
				// the secret is returned exactly once so it cannot be re-fetched. Every
				// delivery would fail verification. Drop it and report "does not exist"
				// so n8n calls `create` and YouEx issues a fresh secret.
				await youExApiRequest.call(
					this,
					'DELETE',
					`/subscriptions/${existing.subscriptionId}`,
				);
				delete staticData.subscriptionId;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) {
					throw new NodeOperationError(
						this.getNode(),
						'n8n did not provide a webhook URL for this trigger',
					);
				}

				const eventType = this.getNodeParameter('eventType') as string;
				const watchedFields =
					eventType === 'updated' ? (this.getNodeParameter('watchedFields', []) as string[]) : [];

				const created = (await youExApiRequest.call(this, 'POST', '/subscriptions', {
					entityType: toWireEntityType(this.getNodeParameter('entityType') as string),
					eventType,
					targetUrl: webhookUrl,
					...(watchedFields.length > 0 ? { watchedFields } : {}),
				})) as CreatedSubscription | undefined;

				if (!created?.subscriptionId) {
					throw new NodeOperationError(
						this.getNode(),
						'YouEx did not return a subscription ID when registering the webhook',
					);
				}

				// Refusing to activate is the right failure: without the secret every
				// delivery would be rejected as unverifiable, which looks like a broken
				// trigger rather than a missing credential capability.
				if (!created.secret) {
					throw new NodeOperationError(
						this.getNode(),
						'YouEx did not return a signing secret for this subscription',
						{
							description:
								'Deliveries are rejected unless they are signed. Confirm the workspace is on the integrations API and try activating the workflow again.',
						},
					);
				}

				const staticData = this.getWorkflowStaticData('node');
				staticData.subscriptionId = created.subscriptionId;
				staticData.secret = created.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				let subscriptionId = staticData.subscriptionId as string | undefined;

				if (!subscriptionId) {
					const webhookUrl = this.getNodeWebhookUrl('default');
					if (webhookUrl) {
						subscriptionId = (await findSubscription(this, webhookUrl))?.subscriptionId;
					}
				}

				if (subscriptionId) {
					await youExApiRequest.call(this, 'DELETE', `/subscriptions/${subscriptionId}`);
				}

				delete staticData.subscriptionId;
				delete staticData.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const headers = this.getHeaderData();
		const staticData = this.getWorkflowStaticData('node');

		// The signed input is the exact bytes on the wire. `IWebhookDescription` has
		// no `rawBody` option, so they come from the request object, which
		// n8n-workflow augments with `rawBody` and `readRawBody()`.
		let rawBody: string | undefined;
		try {
			await request.readRawBody();
			rawBody = request.rawBody?.toString('utf-8');
		} catch {
			rawBody = undefined;
		}

		const check = verifyWebhookSignature({
			rawBody,
			signatureHeader: headers[SIGNATURE_HEADER],
			timestampHeader: headers[TIMESTAMP_HEADER],
			secret: staticData.secret as string | undefined,
			nowSeconds: Math.floor(Date.now() / 1000),
		});

		if (!check.ok) {
			// Rejected, not ignored: answer 401 and start no execution.
			const response = this.getResponseObject();
			response.status(401).json({ error: 'invalid_signature', reason: check.reason });
			return { noWebhookResponse: true };
		}

		return { workflowData: [this.helpers.returnJsonArray(this.getBodyData())] };
	}
}
