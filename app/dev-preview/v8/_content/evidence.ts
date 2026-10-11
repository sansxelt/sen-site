// Excerpts of the recorded trace from the controlled synthetic ONNX CPU experiment, captured 2026-10-10 at
// 07:41:29 UTC (bot-mailbox object fd808472..., console/evidence.json). Values are unchanged. These are worker
// self-reports, not attestation and not a customer deployment. The experiment's source code stays private
// (founder, 2026-10-10); only recorded evidence and the app's own test output appear on the site.

export const OBSERVATION_2 = `{
  "id": 2,
  "title": "Update awaiting reload",
  "action": "Approved cpu-2. The baseline continues serving its loaded cpu-1 until explicit reload.",
  "receivedAt": "2026-10-10T07:41:29.613Z",
  "observation": {
    "scope": "managed-onnx-session-self-report",
    "status": "pending",
    "desired": {
      "generation": 2,
      "releaseSha256": "375de916f3f9128dd8284a9dae474c1fe5edcf253c8a7ab69a1c5f720f31ea12",
      "releaseId": "cpu-2",
      "modelSha256": "444602040ca9aaa4b1a990799fbe6b697763d1a08144ee1f9711eb12adc49d2d",
      "configurationSha256": "6289dfd4c088e75fa4725c3269d9ba6316e0d9e11d863c17af0b2955315bd382",
      "receiptSha256": "d621d4c70a127586002f1261b79ff6cf1e48f258cf819b184f0ff8a68a819e33"
    },
    "loaded": {
      "runtime": {
        "ortVersion": "1.23.2",
        "executionProviders": ["CPUExecutionProvider"],
        "pythonVersion": "3.12.14"
      },
      "sessionId": "4ef27956b34246b5be6c64a6109d9212",
      "metadata": {
        "generation": 1,
        "releaseSha256": "611e3ac6eb818530873c76bac0cd3f328ce87ce99cbcad6407ad47abb96dc0e1",
        "releaseId": "cpu-1",
        "modelSha256": "c1b943a655da728daea6b43332ff557af3da6466b4f9e0c938b42595222dc5ac",
        "configurationSha256": "6289dfd4c088e75fa4725c3269d9ba6316e0d9e11d863c17af0b2955315bd382",
        "receiptSha256": "15357f4908031bbeeb5aae187cb2c28d3d0ea17c5c2bea120176b1a750754ab7"
      }
    }
  }
}`;

export const POLICY = `{
  "schemaVersion": 1,
  "policyId": "cpu-lab",
  "version": "1",
  "environmentId": "non-actuating-lab",
  "resourceId": "onnx-cpu",
  "publishers": ["publisher"],
  "deployers": ["deployer"],
  "approvers": ["approver"],
  "maxAgeMs": 60000,
  "runtime": {
    "ortVersion": "1.23.2",
    "executionProviders": ["CPUExecutionProvider"]
  }
}`;

export const TRACE_TESTS = `$ node --test trace.test.mjs
✔ captured worker observations are internally consistent
✔ a pending release cannot be imported as matched
✔ wrong reported runtime cannot be imported as matched
✔ missing evidence cannot be imported as matched
✔ a trace without a runtime policy is refused
✔ a policy without a runtime is refused
✔ a matched observation without a reported runtime is refused
✔ a pending observation without a reported runtime is refused
✔ a malformed runtime version is refused
✔ a self-consistent edited trace validates, so imports must be labelled unverified
✔ an unavailable observation without an approved identity is refused
✔ an unavailable observation carrying a loaded report is refused
✔ a malformed reason code is refused
✔ the captured reason code is accepted
ℹ tests 14
ℹ pass 14
ℹ fail 0`;
