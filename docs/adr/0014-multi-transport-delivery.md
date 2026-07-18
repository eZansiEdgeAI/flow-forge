# 0014. Multi-transport delivery — email, messaging, and portal as KernelApi adapters

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

FlowForge was designed for education, but the target audience is wider: any small organisation
(school, micro-business, NGO) that needs orchestrated AI-assisted workflows with human-in-the-loop
steps. The original deployment model assumed a Raspberry Pi per site with a desktop UI. Two
problems make this fragile:

1. **Hardware cost is escalating.** A Raspberry Pi 5 with SD card, case, and power supply now
   costs £80–100+. For rural or under-resourced organisations, per-site hardware is a meaningful
   barrier.

2. **A desktop UI is only one access model.** For users on low-end Android devices, intermittent
   connectivity, or feature phones (common in target markets), a desktop Electron app is
   impractical. Email, SMS, WhatsApp, and basic web portals have near-universal reach.

The alternative: one central server (a $5–10/month VPS) runs FlowForge and serves many
organisations. Users interact via whatever channel they already have — email, a messaging
platform, a lightweight web portal, a mobile app. The question is how to model this without
coupling the kernel to any specific delivery mechanism.

**Key insight already in the architecture:**
The `KernelApi` is already transport-agnostic. Today it has two adapters: the CLI (direct
function call) and the Electron desktop (Electron IPC). Every transport decision is at the
adapter layer; the kernel is untouched. This is ADR-0004 ("everything behind an interface")
extended to communication transports.

**What was evaluated:**

- **Self-hosted sendmail/Postfix:** technically viable but operationally high-risk. Running a
  mail server requires DKIM, SPF, DMARC, PTR records, and ongoing IP reputation management.
  A new server IP is frequently blacklisted; silent delivery failure is common. Rejected as a
  *required* component; accepted as an *optional* transport if operators choose to self-host.

- **Managed email relay (Mailgun, SendGrid, AWS SES, Brevo):** Removes deliverability risk.
  Cost is negligible at small scale (Mailgun: 1,000 emails/month free; AWS SES: ~$0.10/1,000).
  This is the recommended default for the email transport adapter.

- **IRC:** rejected as an end-user channel. IRC is effectively dead outside developer circles;
  asking teachers and students to use IRC is a non-starter for the target audience.

- **Matrix (matrix.org):** accepted as the recommended real-time messaging channel.
  Self-hostable (Synapse), federated, E2E encrypted, excellent mobile clients (Element),
  bot APIs, email bridge available. Runs on a single VPS. This is what "IRC-like" should
  actually mean in this context.

- **XMPP:** viable alternative to Matrix, lower bandwidth, proven self-hosted deployments,
  good bot support. Named as an option.

- **SMS via gateway (Africa's Talking, Twilio, Vonage):** highest reach for low-connectivity
  markets. Can be wired as a transport adapter using the same interface.

- **Lightweight web portal / progressive web app:** the natural multi-device surface — works
  on any browser, mobile-friendly, no app store required. This is Milestone 5.3 extended to
  a server-rendered or SPA architecture rather than Electron.

- **Semantic Kernel, AutoGen, or similar orchestration frameworks:** evaluated as potential
  multi-agent messaging layers and rejected. They replace the `AgentRuntime`, `WorkflowEngine`,
  and `MemoryService` with their own abstractions, fighting every design rule. The transport
  problem is at the delivery layer, not the agent orchestration layer.

## Decision

### 1. The transport layer is a deployment adapter, not a kernel concern

All communication channels — email, Matrix, SMS, web portal, Electron, CLI — are adapters that
call the `KernelApi`. The kernel does not know or care which transport is in use. This extends
the existing pattern (CLI adapter, Electron adapter) to any number of delivery mechanisms.

A transport adapter is responsible for:
- Receiving inbound events (an email reply, a Matrix message, a form submission, a webhook).
- Translating them into `KernelApi` calls (`startRun`, `resumeRun`, `getAuditTrail`).
- Emitting outbound notifications (email, Matrix message, push notification) when the kernel
  emits workflow events (run started, waiting for human, completed, failed).

The `KernelApi` gains a notification/event subscription mechanism (a future extension, tracked
as task T.1 below) so that transport adapters can receive push events without polling.

### 2. Email is a notification-first transport, with structured inbound as a later extension

**Phase 1 (outbound only):** the email transport emits notifications when workflow events occur.
A teacher gets an email: "Assignment workflow is waiting for your approval — [approve] [reject]".
A learner gets: "Your feedback is ready — log in to see it." Delivery goes through a configurable
SMTP relay (operator chooses their provider; a sensible default config targets a managed relay).

This phase requires no inbound parsing and no security decisions beyond "is this address allowed
to receive notifications for this run?" It adds immediate value with low implementation risk.

**Phase 2 (structured inbound):** replies can carry structured commands
(e.g. `APPROVE [run-id]` in the email body, or a signed confirmation link in the outbound
notification). Email addresses are *not* used as standalone identity — they are hints that map
to an OIDC-verified `Principal`. The flow is: inbound email → extract run-id + command → look up
the Principal bound to that email via the `IdentityService` → call `KernelApi.resumeRun` with
the authenticated `Principal`. Email addresses without a matching Principal are rejected.

This preserves the full identity and audit guarantees of ADR-0010.

### 3. Matrix is the recommended real-time messaging channel

A FlowForge Matrix bot connects to a self-hosted or managed Matrix homeserver. It:
- Sends workflow notifications to relevant rooms or DMs.
- Accepts structured commands in room messages.
- Uses the same principal-lookup approach as the email transport for identity.

Matrix is preferred over IRC, Slack, or Teams because it is open-source, self-hostable,
federated, E2E encrypted, and has excellent mobile clients. It requires no per-seat licensing.

### 4. A web portal / PWA is the multi-device UI target for Phase 5

Phase 5's "mobile" milestone (5.3) is reframed as a **lightweight web portal / PWA** served by
a simple HTTP adapter over `KernelApi`. This serves mobile, tablet, desktop browser, and any
device with a browser — without Electron. The Electron desktop remains for users who want a
native experience. Both call the same `KernelApi` over their respective transports.

### 5. Deployment model shift: one central server, many clients

The recommended production deployment for small organisations is:
- One VPS running `FlowForgeKernel` as a persistent service.
- An HTTP transport adapter exposing `KernelApi` over HTTPS (REST or WebSocket).
- Configurable transport adapters per deployment: email relay, Matrix bot, web portal.
- All state, audit, memory, and package data in `~/.flowforge` or a configurable data directory.
- No Docker required for basic operation; Docker Compose provided for multi-service deployments
  (Dapr, pgvector if chosen).

This eliminates the per-site Raspberry Pi hardware cost while supporting more users per
deployment.

## Consequences

Easier:
- Any email provider, any messaging platform, any web framework can reach FlowForge without
  modifying the kernel.
- The deployment cost model changes from per-site hardware to per-month VPS — significantly
  lower for small organisations.
- Users interact via channels they already have (email, Matrix, browser) — no new app to install
  for basic usage.
- The architecture can evolve to new channels (WhatsApp Business API, SMS, Teams via
  integrations) by adding an adapter, not by changing the kernel.

Harder:
- An HTTP transport adapter (server-mode `KernelApi`) needs to be built — a new surface that
  must be secured (authentication middleware, rate limiting, TLS).
- Inbound email/messaging parsing is fragile (quoted signatures, HTML wrappers, forwarding
  headers) — the structured-command approach (signed links, explicit command format) mitigates
  this but is more complex to implement correctly.
- Email-as-identity is a tempting shortcut that would break the identity model. Discipline
  is required to always map email addresses to OIDC-verified Principals rather than treating
  the email address as authentication. This must be enforced by convention and code review.

Follow-up work:
- **T.1:** `KernelApi` event subscription / push notification mechanism — allows adapters to
  receive workflow events without polling (Phase 3 cross-cutting, alongside 3.2).
- **T.2:** HTTP/HTTPS transport adapter (`packages/server`) exposing `KernelApi` over REST +
  WebSocket (Phase 4, after kernel is stable).
- **T.3:** Email transport adapter: outbound notifications via configurable SMTP relay;
  inbound structured commands (Phase 4).
- **T.4:** Matrix bot adapter: outbound notifications + inbound commands (Phase 4 or community
  contribution).
- **T.5:** Web portal / PWA (Phase 5, as the multi-device UI target alongside or replacing the
  mobile Milestone 5.3).
- **T.6:** SMS transport adapter via Africa's Talking / Twilio (Phase 5 or community
  contribution, for low-connectivity market deployments).
