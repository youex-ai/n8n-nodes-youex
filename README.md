# n8n-nodes-youex

This is an n8n community node. It lets you use [YouEx](https://youex.ai) in your n8n workflows.

YouEx is an AI-powered CRM. This node talks to the YouEx integrations API, so a workflow can read and write
leads, contacts, accounts and opportunities in a YouEx workspace.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow
automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n
community nodes documentation.

## Operations

**This is a `0.1.0` scaffold release.** It ships a single operation, whose purpose is to verify that a
credential works end to end:

| Resource | Operation | Endpoint |
|---|---|---|
| Workspace | Get Current | `GET /api/integrations/v1/account` |

It returns the workspace and user the API key is bound to. CRM resources (lead, contact, account,
opportunity) and the trigger node land in a later release.

## Credentials

Authentication is a **per-workspace API key**. One key equals one workspace, which is why this node has no
workspace selector: the credential already determines it. To use several workspaces, create several
credentials.

1. In YouEx, open **Workspace Settings > Integrations**.
2. Create an API key, give it a label (for example `n8n production`) and pick its scopes.
3. Copy the key. **It is shown exactly once** — YouEx stores only a hash of it.
4. In n8n, create a **YouEx API** credential:
   - **API Key** — the key you just copied (`yx-live-…` in production, `yx-test-…` elsewhere).
   - **Base URL** — your YouEx instance, `https://app.youex.ai` by default. No trailing slash.
5. Click **Test**. A green result means the key is valid, active, and its workspace has the integration
   enabled.

### Scopes

| Scope | Grants |
|---|---|
| `crm:read` | Reading records |
| `crm:write` | Creating and updating records |
| `crm:hooks` | Managing webhook subscriptions (required by the trigger node) |

A request made with a key that lacks the required scope fails with `403 insufficient_scope`.

### Requirements

- A workspace on a plan that includes the n8n integration.
- An **Owner** or **Admin** role to create keys.
- A workspace can hold up to 5 active keys at a time.

## Compatibility

Tested against n8n 1.x. Requires the YouEx integrations API (`/api/integrations/v1`).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [YouEx](https://youex.ai)

## Version history

| Version | Changes |
|---|---|
| 0.1.0 | Scaffold: `YouEx API` credential and the `Workspace: Get Current` operation |
