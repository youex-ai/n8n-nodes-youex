# n8n-nodes-youex

This is an n8n community node. It lets you use [YouEx](https://youex.ai) in your n8n workflows.

YouEx is an AI-powered CRM. This package talks to the YouEx integrations API, so a workflow can read and
write leads, contacts, accounts and opportunities in a YouEx workspace, and start on CRM changes.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow
automation platform.

[Installation](#installation)
[Operations](#operations)
[Trigger](#trigger)
[Credentials](#credentials)
[Example workflow](#example-workflow)
[Compatibility](#compatibility)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n
community nodes documentation.

## Operations

The **YouEx** node covers full CRUD on the four CRM records, plus one workspace lookup.

| Resource | Create | Get | Get Many | Update | Delete |
|---|---|---|---|---|---|
| Lead | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contact | ✓ | ✓ | ✓ | ✓ | ✓ |
| Account | ✓ | ✓ | ✓ | ✓ | ✓ |
| Opportunity | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workspace | — | Get Current | — | — | — |

**Get Many** supports `Return All`, a `Limit` of up to 200 per page, and filters: free-text `Search`, a
status/type/stage filter per resource, `Account ID` on Contact, and a date window over either `createdAt` or
`updatedAt`. With `Return All` on, the node follows the API's cursor automatically.

`Workspace: Get Current` returns the workspace and user the API key is bound to. It is the quickest way to
confirm a credential works.

### Notes on specific fields

- **Lead status** accepts `New`, `VIP`, `Hot`, `Warm`, `Cold` and `Opportunity`. Existing records may hold
  `Medium`, `Converted` or `Lost` — you will see those on read, but the API does not accept them on write.
- **Opportunity probability** is stored exactly as sent and is *not* reconciled with the stage. A
  `Closed Won` opportunity with `probability: 30` persists that way, so set both together if you care.
- **Account** exposes its business fields only. The enrichment and research fields on the underlying record
  are internal to YouEx and are not writable through this node.
- **Get Many** returns one item per record for every resource. The API is not uniform underneath — leads come
  back as a bare list while the other three arrive wrapped — but the node normalizes that, so workflows do not
  have to care.

## Trigger

The **YouEx Trigger** node starts a workflow on a CRM change: pick an **Entity** (Lead, Contact, Account,
Opportunity) and an **Event** (Created, Updated, Deleted) — twelve combinations.

On `Updated` you can set **Watched Fields** to only start the workflow when one of those fields changed.
Leave it empty to start on any update.

### `Created` is not always immediate

For **Lead**, the `Created` event is held back until YouEx finishes enriching the record — research, scoring
and routing, depending on what the workspace has enabled. That is deliberate: it stops the workflow from
receiving a lead that is still half-populated. The practical consequence is that `Lead` + `Created` can take
noticeably longer than the change itself, and will not fire at all while those workers are stalled.

`Updated` and `Deleted` fire straight away. So does `Created` on records that trigger no automatic
enrichment — an **Account** with no website, for instance.

### Security

Every delivery is signed. The trigger verifies an HMAC-SHA256 signature over the request body and a
timestamp, and **rejects** any delivery that is unsigned, carries a bad signature, or has a timestamp more
than five minutes from now. That last one is what makes a captured delivery unreplayable.

The signing secret is issued once, when the workflow is activated, and is stored with the workflow. It cannot
be retrieved again. If it is ever lost, deactivate and reactivate the workflow — the trigger drops the stale
subscription and registers a new one with a fresh secret.

### Testing the trigger

n8n's **Listen for test event** registers a temporary webhook that expires after about 120 seconds, so make
the CRM change in YouEx while n8n is listening. Activating the workflow registers a permanent subscription;
deactivating removes it.

## Credentials

Authentication is a **per-workspace API key**. One key equals one workspace, which is why these nodes have no
workspace selector: the credential already determines it. To use several workspaces, create several
credentials.

1. In YouEx, open **Workspace Settings > Integrations**.
2. Create an API key, give it a label (for example `n8n production`) and pick its scopes.
3. Copy the key. **It is shown exactly once** — YouEx stores only a hash of it.
4. In n8n, create a **YouEx API** credential:
   - **API Key** — the key you just copied (`yx-live-…` in production, `yx-test-…` elsewhere).
   - **Base URL** — your YouEx instance, `https://app.youex.ai` by default.
5. Click **Test**. A green result means the key is valid and active, its workspace has the integration
   enabled, and the Base URL really points at the YouEx integrations API.

**Pointing at a YouEx on the same machine?** Use `http://127.0.0.1:5000`, not `http://localhost:5000`. Node
resolves `localhost` to IPv6 first, and a server listening only on IPv4 refuses the connection — the node
reports it as the service being offline, which is a confusing way to learn about a DNS preference.

**Get the Base URL wrong and both the Test and the operations will tell you.** A YouEx address without the
integrations API answers with the web app instead — an HTML page, with a `200`. The credential test rejects
it, and since `0.1.3` so does every operation, rather than handing your workflow a page of markup where it
expected records.

### Scopes

| Scope | Needed for |
|---|---|
| `crm:read` | `Get`, `Get Many` |
| `crm:write` | `Create`, `Update`, `Delete` |
| `crm:hooks` | The trigger node |

Scopes are fixed when the key is created and cannot be added later — create a new key instead.

**The credential test cannot check scopes.** `Workspace: Get Current` needs none, so a key with no scopes at
all still tests green and then fails at run time with `403 insufficient_scope`. If an operation fails that
way, the key is valid but missing the scope in the table above.

### Requirements

- A workspace on a plan that includes the n8n integration.
- An **Owner** or **Admin** role to create keys.
- A workspace can hold up to 5 active keys at a time.

### Rate limits

600 requests per minute per key. A `429` is retryable, and the node says so rather than failing opaquely.

## Example workflow

Sync every new lead into a Slack channel, and keep a daily digest of the whole pipeline.

**Trigger half** — two nodes:

1. **YouEx Trigger** — Entity `Lead`, Event `Created`. Activating the workflow registers the webhook with
   YouEx; deactivating removes it. Deliveries are signature-checked before the workflow runs.
2. **Slack** — post `{{ $json.record.name }} ({{ $json.record.email }})` to `#sales`.

The trigger emits one item per event, shaped like this:

```json
{
  "event_id": "3f2a…",
  "record_id": "6a86…",
  "entity_type": "lead",
  "event_type": "created",
  "occurred_at": "2026-08-19T17:04:11.000Z",
  "changed_fields": [],
  "record": { "_id": "6a86…", "name": "Ada Lovelace", "email": "ada@example.com", "status": "New" }
}
```

Note `entity_type` is `company` for accounts — that is the wire value; the node's own parameter says
`Account`.

**Digest half** — three nodes:

1. **Schedule Trigger** — every morning.
2. **YouEx** — Resource `Lead`, Operation `Get Many`, **Return All** on, Filters → Status `Hot`. The node
   follows YouEx's cursor for you and emits one item per record, however many pages that takes.
3. **Slack** — summarise the items.

A lead created in YouEx reaches the first workflow within seconds. Bear in mind the caveat above: for
**Lead**, `Created` waits on enrichment, so use `Updated` if you need immediacy.

## Compatibility

Tested against n8n 1.x on Node 22. Requires the YouEx integrations API (`/api/integrations/v1`).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [YouEx](https://youex.ai)

## Version history

| Version | Changes |
|---|---|
| 0.1.0 | `YouEx API` credential, the `YouEx` node with 21 operations, and the `YouEx Trigger` node with 12 events |
| 0.1.1 | No functional change. Publishing moved to npm trusted publishing (OIDC), removing the long-lived token from the release path |
| 0.1.2 | The brand icons, replacing the placeholder artwork |
| 0.1.3 | Operations now reject a response that did not come from the integrations API |
