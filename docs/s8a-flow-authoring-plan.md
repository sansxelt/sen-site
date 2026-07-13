# S8A — authenticated-flow authoring foundation (canary-critical slice of S8)

Goal: the MINIMUM real, customer-facing Flow Designer needed to author + approve + launch ONE authenticated
flow, so the live S6 canary can complete. Same production data model + ownership + draft/approve lifecycle
that full S8 will use. NOT a seed, bypass, founder tool, or fixture-only path. After deploy: resume + finish
the S6 canary, mark S6 PASS, then build S8B (full designer).

## What already exists (reuse, do not rebuild)
- v_test_flows schema: id, contract_id, user_id, name, goal, role, start_path, steps (jsonb ordered
  [{action,target,value?,expect?}]), expected, priority, enabled, order_index, requirement_ids. The `steps`
  shape and `role` are EXACTLY what the S6 worker consumes; the semantic auth actions (sign_in_as,
  verify_authenticated, verify_unauthorized, switch_role, sign_out, reset_context) are already in the worker
  StepAction union.
- Contract draft/approve lifecycle: POST /api/preflight/requirements {contract_id, approve:true} approves;
  approved contracts are IMMUTABLE (409 contract_approved on any edit); /contract/draft creates the next
  draft version. Flows must obey the SAME rule: editable only on a draft contract, frozen once approved.
- Auth-readiness gate (S6): the run launch route already blocks launch pre-hold when an authenticated flow's
  role has no active/decryptable credential. Flow authoring must set `role` so that gate can resolve it.
- lib/v-applications.ts: addRequirement/updateRequirement/deleteRequirement/approveContract patterns +
  owner-scoping (eq user_id) + contractStatusForRequirement immutability check. Flows mirror these.
- contract-editor.tsx: the client editor that POST/PATCH/DELETEs requirements; extend with a flows section.

## Data layer (lib/v-applications.ts, owner-scoped, mirror the requirement funcs)
- addFlow(owner, contractId, input) -> insert v_test_flows: name, goal, role (nullable; set for auth flows),
  steps (validated), priority, requirement_ids, order_index = max+1, enabled true, review_state 'approved'
  is NOT set here (draft flows are editable; approval is contract-level). Refuse when the contract is
  approved (immutable) -> return {error:'contract_approved'}. Validate steps server-side (see below).
- updateFlow(owner, flowId, patch) -> name/goal/role/priority/enabled/steps; refuse on approved contract.
- deleteFlow(owner, flowId) -> owner-scoped, honest zero-row; refuse on approved contract.
- listFlows already exists (reads for the run + report). contractStatusForFlow(owner, flowId) mirror of the
  requirement immutability helper.

## Step model + validation (pure, shared, tested) — lib/preflight/flow-steps.ts
- FLOW_ACTIONS: the customer-authorable semantic actions = navigate, click, fill, assert_visible,
  assert_text, refresh, sign_in_as, verify_authenticated, verify_unauthorized, switch_role, sign_out,
  reset_context. (A curated safe subset of the worker StepAction union; no raw Playwright selectors — spec:
  "Do not expose raw Playwright selectors as the primary editing experience".)
- validateSteps(steps, {rolesAvailable}) -> normalized [{action,target?,value?,expect?}] or a reason:
  each action known; sign_in_as/switch_role target must be a role that exists on the app's test accounts;
  navigate target relative or same-origin-only (the worker rebases anyway); fill needs target+value;
  assert_* needs target/expect; bounded count (<=30) and string lengths. A password/secret VALUE is NEVER
  entered here (sign_in_as pulls the sealed credential worker-side by role) -> reject any step whose value
  looks credential-shaped (reuse the connections redact/secret-detect).
- flowRequiresAuth(steps) = any auth action present (already in worker/types; re-export or mirror pure).

## Routes
- POST/PATCH/DELETE /api/preflight/flows (new): session-only owner; load the flow's contract owner-scoped;
  409 contract_approved when approved; validateSteps; addFlow/updateFlow/deleteFlow. NEVER trust client
  owner_id/app_id. Audit via logEvent (flow_added/updated/removed, application/contract id + flow name only,
  never step values). Trigger snapshotIfChanged (context changed) like the requirements route.
- Reuse POST /api/preflight/requirements {approve:true} for contract approval (unchanged) — it approves the
  whole draft incl. its flows. A flow with an unresolved role blocks nothing at approval; the S6 auth-
  readiness gate catches a missing credential at LAUNCH (correct: creds can be added/removed after approval).

## UI — contract-editor.tsx flows section (draft only) + a small FlowEditor
- On a DRAFT contract, a "Flows" section under requirements: list existing flows (name, role chip, step
  count, enabled), "Add flow", edit, delete. Approved contract: read-only flow list (matches requirement
  behavior; "Create new draft to change").
- FlowEditor (client): name, optional goal, role select (populated from the app's test-account roles via a
  small read; "no role / unauthenticated" default), a STEP BUILDER: add steps from FLOW_ACTIONS via a
  friendly picker — for sign_in_as/switch_role a role dropdown (no password field, ever); for
  navigate/click/fill/assert a target field (+ value/expect where the action needs it); reorder + remove
  steps. Save -> POST/PATCH /flows. Honest empty/validation/error states. This is the MINIMUM real editor;
  S8B adds duplication, viewport/env per flow, estimated cost, drag-reorder polish, coverage display.
- The canary flow the owner will build: sign_in_as "Standard user" -> verify_authenticated -> click
  "Create project" (the fixture's harmless authenticated action) -> assert_visible the created item ->
  sign_out -> verify_unauthorized. Priority critical, role "Standard user".

## Deployment identity note
No new migration (v_test_flows exists; role/steps columns exist). Editing flows produces a new context
snapshot (S3) automatically via the snapshot trigger; contract re-approval pins it. Historical runs
untouched.

## Tests — scripts/preflight-flow-authoring-verify.ts + package.json "flows:authoring:test"
- validateSteps: every FLOW_ACTION accepted with correct fields; unknown action rejected; sign_in_as with a
  nonexistent role rejected; a credential-shaped value in a step rejected; count/length bounds; the canary
  flow validates.
- addFlow/updateFlow/deleteFlow owner-scoping (static + pure): eq user_id everywhere; 409 on approved
  contract (immutability); cross-owner returns not-found/zero-row; audit events carry no step values.
- flowRequiresAuth correctness; a role set on an auth flow is what the S6 readiness gate reads.
- Route static checks: owner gate before mutation; no client owner/app trust; approved-immutable guard.
- Keep green: preflight:security:test, preflight:connect:test, context:test, deployments:test, routes:test,
  auth:flows:test (the worker side is unchanged; this only authors what it already executes).

## Definition of done (S8A)
tsc 0 / eslint clean / build 0 / new suite + all above green; an owner can, through app.vraelis.com UI
only, author the 6-step authenticated canary flow on a draft, approve the contract, and see it selectable
for a Production Pass with auth-readiness resolving the credential. Then: resume S6 canary to PASS, then S8B.
