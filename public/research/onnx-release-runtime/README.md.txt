# Vraelis Contour: private ONNX CPU experiment

This is a non-actuating experiment in approved release loading and honest session observation. It is not a shipping product, a hostile-model sandbox, a robot integration, host attestation or adversarial perception protection. Nothing here should enter the public website repository or a production runtime.

It extends the earlier signed release experiment with ONNX Runtime 1.23.2 on CPU. A small regressor is trained from deterministic local synthetic data and exported to real ONNX. Its four inputs and single output exercise model/configuration binding; its training error establishes neither robotics relevance nor security efficacy. Negative fixture files deliberately contain external weights, unsupported custom operators or a declared output shape contradicted by broadcasting.

## Run privately

Requires Linux, Node 24 and an isolated Python 3.12 environment. From the repository root:

```sh
python -m venv /tmp/vraelis-onnx-venv
/tmp/vraelis-onnx-venv/bin/pip install -r experiments/onnx-release-runtime/requirements.lock
/tmp/vraelis-onnx-venv/bin/python experiments/onnx-release-runtime/build_fixture.py
node --test experiments/model-release/boundary.test.mjs experiments/onnx-release-runtime/runtime.test.mjs
node experiments/onnx-release-runtime/benchmark.mjs
```

Set `VRAELIS_ONNX_PYTHON` to the absolute interpreter path for another isolated environment. The direct dependencies are listed in `requirements.txt`; `requirements.lock` records the installed direct and transitive versions from this run. Version pins alone do not attest their supply chain or provide a reproducible production distribution. Build fixtures locally; no remote model/dataset downloads occur. The worker is launched with Python `-I`, one CPU thread per session and no caller-selected provider, custom-op library or cache path.

## Actual authority and observation

| Actor or component | Authority | What it does not establish |
|---|---|---|
| Pinned publisher key | Signs exact embedded model bytes and preprocessing | Benign model, training provenance, reviewed behavior |
| Pinned deployment key | Signs release, destination and policy binding | Human/operator identity outside the lab pins |
| Separate approval key | Approves exact deployment request with validity window | Distinct human review or buyer acceptance |
| SQLite boundary and receipt key | Atomically records desired release and consumed approval | A running ORT session or global rollback prevention |
| Node adapter with public keys | Verifies persisted history and supplies exact bytes to trusted worker | Enforcement on other processes or independent attestation |
| Local Python worker | Constructs a CPU session; reports its actual active pointer and outputs | Signature authentication, compromised-host integrity or physical behavior |
| Service/host owner | Controls files, executable, environment, pins, DB and IPC | Treated as trusted; can bypass every managed path |

No claim of OS privilege separation is made. A read-only database connection is not a separate OS account. Direct ONNX construction outside the adapter is successfully exercised without approval; Contour cannot prevent it. A hostile model may exploit the native runtime despite the graph restrictions: the Python process is not sandboxed, resource isolated or a parser security boundary.

`observe()` reports `managed-onnx-session-self-report`: the approved desired metadata and the worker's actual loaded session metadata. `matched` means those records agree within the trusted managed process; `pending` means they do not agree or no session is loaded; `unknown` means the store/process/protocol cannot establish that comparison. If authorization-store verification fails, available worker metadata is separately marked `worker-self-report-not-compared` and status stays unknown. Neither `matched` nor a signed receipt means a model is safe or an arbitrary robot runs it. The earlier receipt scope remains `reference-loader-persisted-release`.

## Supported and excluded paths

Only bounded inline ONNX bytes plus signed affine offsets/scales are admitted. Models use IR 10/opset 13, fixed batch-one float32 input/output, bounded embedded float32 initializers, and a small arithmetic operator allowlist. External tensor files, caller paths/URLs, custom domains/libraries, subgraphs/control flow, functions, dynamic shapes and caller providers are unsupported. The allowlist is a compatibility restriction, not general malicious-model detection.

The supported managed paths are cold session construction, warm session reuse, explicit synchronization and serialized new-session swaps. ORT may optimize in memory; no persistent optimized-model cache is exposed. This does not test TensorRT, CUDA, compiled on-disk caches, GPU/Jetson hardware, arbitrary preprocessing, multi-model ensembles, shared runtimes, concurrent native inference or robot deadlines. Ordinary direct `InferenceSession` construction outside the process is unrestricted and is a demonstrated bypass.

There is no mutable source model path to re-open between verification and session construction. Worker metadata includes model/configuration digests and the verified receipt digest; controller checks metadata and session ID at prepare, activation and inference. The worker does not independently authenticate signatures, and a compromised worker could lie about all of these.

## Recovery and availability contract

Approval consumption and desired-release persistence happen before native runtime loading. A valid signature can authorize an incompatible or corrupt ONNX model: persistence succeeds but loading fails and observation remains pending against the old loaded session. This is an unresolved acceptance workflow, not a successful activation. Recover by a new approved corrected release; consumed deployment approval cannot be replayed.

The worker builds a candidate before swapping its active pointer. Lost activation acknowledgement leaves controller knowledge invalidated. Process exit at prepare, before activation, after activation or after inference yields no successful caller result and unknown observation. A fresh worker can load the latest already approved persisted release without re-deploying it. This is reconciliation, not exactly-once execution. The harness tests actual process termination at four trusted fault points and SIGKILL of a warm worker, not power failure or real device crashes.

Each managed call returns the actual session ID and release generation used. A request can linearize against generation one while a subsequent deployment authorizes generation two; its output remains labeled generation one, and the next call can reconcile. There is no instantaneous latest-release guarantee across the store and process.

Two modes deliberately expose a tradeoff:

- `reconcile` (experiment default) verifies the full bounded history for every inference and loads a changed desired release. Corrupt/unavailable storage denies inference even when an old session exists. Requests are serialized. This is a diagnostic mode; the measured overhead argues against putting it on a device's inference hot path.
- `approved-session` is the stronger simpler baseline: the same signed approval, destination, model/configuration and worker admission at startup/explicit `synchronize()`, then reuse of that approved session. Outputs identify the actual loaded release. Explicit observation reports pending when a newer release is desired; store failure yields unknown comparison while the approved session may continue. Staleness alone is not an attack or failure of this contract.

Both modes rely on trusted host/clock/pins, available store at admission and unbroken receipt history. Revocation affects new deployments, not an existing approved session. Reconciliation does not turn key revocation into emergency revocation of executing models. Whole-store restore, OS compromise, key rotation and actual identity-provider authorization remain unresolved.

## Measured evidence and next decision

See [measurements.json](measurements.json) and [REVIEW.md](REVIEW.md). Measurements are one local run on a synthetic CPU fixture, sequential modes with ten warmups and 150 inference samples each, histories of 1/10/100 releases. They are not randomized cross-host/device benchmarks, throughput targets, customer deadlines or a latency guarantee. No retrospective pass threshold is invented.

The useful technical result is controlled real-format loading plus distinct desired/loaded evidence and explicit crash ambiguity. The negative results are equally important: ordinary same-owner bypass, unnecessary hot-path history cost and incompatible desired releases that block reconcile-mode inference. A simpler approved-session loader reproduces most demonstrated controls.

Keep the product provisional. Before adding more runtimes or claims of continuous runtime security, identify a real recurring acceptance failure, the paying/deployment owner, the existing loader's limits, the threat actor's actual permissions, and an agreed availability contract. The next integration must make its ordinary load/reload paths enforceable under that threat model. AI review and local tests cannot substitute for these facts.
