# Recorded evidence, version 1

Open `/verifications/recorded` in the Vraelis app. This local tool evaluates reported task states in a supplied JSON recording. It uploads no recording, sends no device command, consumes no verification credits and saves no cloud history. Closing or reloading the tab clears the recording and comparison baseline. Export a report before leaving.

## Workflow

1. Import a normalized JSON recording, import an uncompressed MCAP with supported JSON topics, or open an explicitly simulated example.
2. Review the suggested asset and task, completion window, and optional assets that must stay unchanged. Source coverage and the shared clock are declarations from the file author.
3. Confirm review and select **Verify recording**.
4. Inspect each criterion and its cited source events. **Criteria met** applies only to these assertions and supplied evidence.
5. Keep a result as a baseline, import the next recording, and evaluate identical criteria. Comparisons are blocked when criteria differ.
6. Export evidence. The JSON report includes the evaluated criteria, findings, normalized recording, exact original source text, and SHA-256 of its UTF-8 bytes. The hash establishes integrity relative to those bytes; it does not authenticate the producer.

## Supported input

Download the format example in the workspace. The normalized recording format uses UTF-8 JSON (an optional byte-order mark is retained for hashing): at most 1 MB, 2,000 events, 100 coverage intervals and 20 unchanged assets. The MCAP importer described below supplies the same normalized data. ROS bag/CDR decoding and live connectors remain unsupported.

```json
{
  "schemaVersion": 1,
  "runId": "capture-104",
  "buildId": "build-12",
  "clock": "unix-ms",
  "window": { "startMs": 1791194400000, "endMs": 1791194412000 },
  "coverage": [
    { "source": "control", "startMs": 1791194400000, "endMs": 1791194412000 },
    { "source": "service", "startMs": 1791194400000, "endMs": 1791194412000 },
    { "source": "device", "startMs": 1791194400000, "endMs": 1791194412000 }
  ],
  "events": [
    { "id": "request", "timeMs": 1791194401000, "source": "control", "assetId": "Robot A", "taskId": "task-104", "state": "requested" },
    { "id": "accept", "timeMs": 1791194401200, "source": "service", "assetId": "Robot A", "taskId": "task-104", "state": "accepted" },
    { "id": "device-result", "timeMs": 1791194406000, "source": "device", "assetId": "Robot A", "taskId": "task-104", "state": "completed" },
    { "id": "control-result", "timeMs": 1791194406500, "source": "control", "assetId": "Robot A", "taskId": "task-104", "state": "completed" }
  ]
}
```

Identifiers are nonempty strings, up to 120 characters, with no control characters. Times are nonnegative safe integers in Unix milliseconds. Events require unique IDs and must fall inside the recording window and a coverage interval for their source. Supported sources are `control`, `service`, `device`; supported states are `idle`, `requested`, `accepted`, `completed`, `failed`, `cancelled`. Other fields are ignored during normalization but retained in the original source text in an export.

## Evaluation semantics

The selected task and asset must have exactly one recorded control request. No request or repeated requests produces an inconclusive identity result. Events before the request cannot establish successful completion.

The approved completion window starts at that request. The service must report acceptance, the device completion, and the control interface completion by the deadline, in that order. Equal timestamps are permitted. A matching failed or cancelled event within the window fails that source criterion even if it also reported completion. A late required event fails timing. A missing required event fails when declared source capture spans the whole window; otherwise it is inconclusive. Even when the required event exists, partial source capture remains inconclusive because it cannot exclude contradictory task states during the window.

For an unchanged asset, the latest device observation at or before the request establishes its baseline. Conflicting observations at that baseline timestamp are inconclusive. Every later device observation through the deadline must retain the same task ID and state. A recorded change fails; absent baseline or discontinuous capture is inconclusive. Assertions cover only the approved time window.

Any failed criterion makes the overall result failed. Otherwise, any inconclusive criterion makes it inconclusive. Only all met criteria produces **Criteria met**. Evaluation uses deterministic rules, not an AI model verdict.

## Boundaries

A file author can omit or fabricate events and coverage. Clock synchronization and source truth are not independently established. Device reports are not independent measurements of physical motion. A successful result cannot establish physical safety, certification, firmware correctness or the absence of other defects. A real pilot needs reviewed protocol mapping, trustworthy capture and a customer-defined requirement before these rules can support a release decision.

## Native MCAP import

Import an uncompressed `.mcap` file up to 5 MB. Review topic descriptions and preview payloads, then assign supported JSON topics to control, service or reported-device evidence. Topics default to skipped. Each selected payload needs `timeMs`, `assetId`, `taskId`, and one supported `state`; any payload `id` or `source` is ignored in favor of generated file references and the reviewed source mapping. MCAP log/publish times are not substituted for payload time.

Import a companion UTF-8 JSON capture manifest up to 100 KB. It has the same `schemaVersion`, `runId`, `buildId`, `clock`, `window` and `coverage` fields as the example above, **without `events`**. Edit the downloadable manifest example to match your capture; it deliberately declares no coverage by default. The UI exposes that declaration before applying the mapping. Source coverage is still supplied by the author, not independently measured.

The converter rejects selected malformed events, events outside declared coverage, unsupported encodings and compressed chunks. Limits are 100 channels, 10,000 messages, 20,000 inspected records and 2,000 selected task events. ROS 2 CDR, ROS 1 serialization, arbitrary payload field mappings and LZ4/Zstandard remain unsupported.

After mapping, review the task criteria and evaluate normally. Exports set `sourceFormat` to `mcap`, include the original bytes in `sourceMcapBase64`, their SHA-256, and the reviewed `mapping`. They omit `sourceRawJson`, which applies to normalized JSON imports. Decode the base64 to recover the original binary file. Neither a container import nor a report hash authenticates the source or establishes physical behavior.
