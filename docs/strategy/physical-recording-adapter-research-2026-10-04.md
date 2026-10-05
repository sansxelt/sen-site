# Physical recording adapter research and implementation

Research date: October 4, 2026, Pacific time. This continues the physical-systems assessment, whose original snapshot date is October 5 UTC. The product scope remains software behind robots, fleets, industrial equipment and defense applications.

## Decision from the research

Use the existing MCAP ecosystem as an input foundation. MCAP records timestamped publish/subscribe messages and supports separate channel, schema and message encodings. Reading its container is useful interoperability work; it is not a new robotics data platform or evidence of a moat.

The specification defines log time as the time a message was recorded and publish time as the time it was published. Those are distinct observations. Neither proves a task completed physically, synchronized device clocks, or uninterrupted capture. The format permits optional CRC fields and multiple encodings. A checksum is an integrity mechanism, not authenticated device identity.

ROS 2's standard profile uses CDR message encoding with ROS schema definitions. A JSON decoder cannot interpret those messages. Compression is a further independent concern. Advertising universal ROS/robot log support after implementing a JSON channel reader would be inaccurate.

## What is now built

The local recorded-evidence workspace accepts uncompressed MCAP containers, including uncompressed chunks and unchunked files. It inspects channel descriptions and message counts, exposes JSON payload previews, and requires a user to map each selected JSON topic to control, service or reported-device evidence. All topics start unselected. Unsupported encodings remain visible and cannot be mapped.

Selected JSON payloads must contain `timeMs`, `assetId`, `taskId` and `state`. The converter generates stable event references from channel ID and file message index. Evaluation time comes from the payload's declared Unix milliseconds; it does not silently substitute MCAP log or publish timestamps. The original binary file retains both native nanosecond timestamps exactly.

A separate capture manifest provides run identity, build identity, clock, recording window and source coverage. The downloadable template declares no coverage by default. Source coverage remains an author declaration rather than an independent continuity proof. Mapping errors reject the conversion rather than silently discarding selected malformed events.

After applying the mapping, the user reviews the same task/asset/timing criteria as the JSON workflow. A report includes the normalized recording, mapping, capture declaration, SHA-256 of the original MCAP bytes and the original file encoded as base64. Evaluation and export stay in the browser; no recording is uploaded and no device is controlled.

## Deliberate bounds

- Native input: 5 MB, at most 100 channels, 10,000 messages and 20,000 inspected records.
- Evaluation: 1 to 2,000 selected task events, subject to the existing normalized recording bounds.
- Supported message encoding: flat JSON task events with the fields above.
- Supported compression: none. LZ4/Zstandard are rejected before chunk expansion.
- ROS CDR, ROS 1 serialization, Protobuf, native firmware logs, arbitrary nested field mapping, live connectors and independently attested capture remain unbuilt.
- The tests use generated simulations, not a consenting customer's robot dataset.

These limits make an initial local workflow practical. Typical full robot recordings can be much larger and use compressed CDR. This release is consequently a narrow adapter beta, not general robot log ingestion.

## Viability implications

The useful product hypothesis remains verification across control/service/device reports with reviewed requirements and explicit missing-evidence handling. Container parsing and a log viewer are already available cheaply. A customer should be able to use an existing recording tool and bring evidence into Vraelis rather than replace their fleet stack.

The next adapter should be selected from an actual pilot workflow and its available identities, payload schema, clocks and capture guarantees. A ROS action result alone is a service report; treating it as independent physical ground truth would duplicate the original blind spot. Find a separate observable device/simulator signal where the requirement needs one.

For larger recordings, evaluate a bounded extraction workflow using indexed reads, topic/time-window selection, worker processing and controlled decompression. For CDR, review pinned schema/serialization libraries and one concrete ROS message family. Do not build a universal decoder before establishing the recurring customer defect and an existing-tool baseline. No discovery interviews, customer evidence requests or sales outreach were performed in this work.

## Validation

18 native-format checks exercise writer-generated chunked/unchunked files, exact timestamps, explicit mapping, capture gaps, chunk corruption, truncation, trailing bytes, file limits, invalid manifests, unsupported compression/encoding and malformed selected JSON. The existing 28 evaluator checks also pass.

Browser checks cover native file import, topic assignment, manifest review, criterion approval, evaluation, binary report/hash verification, malformed-file rejection, cancel and layouts at 390/320 pixels. The original JSON flow remains verified. The production build and new feature lint pass. These are implementation checks, not customer detection benchmarks or evidence of commercial differentiation.

## Primary sources

The official specification and registry were retrieved from the repository because the documentation site returned HTTP 403 in this environment. Sources are pinned to repository commit `60e73f4b4ec065c26324d71b57dfb53085008528`. The [source manifest](physical-recording-adapter-sources-2026-10-04.json) records retrieval hashes.

- [MCAP specification](https://github.com/foxglove/mcap/blob/60e73f4b4ec065c26324d71b57dfb53085008528/website/docs/spec/index.md): container structure, messages, separate timestamps and optional integrity fields.
- [Encoding registry and ROS profiles](https://github.com/foxglove/mcap/blob/60e73f4b4ec065c26324d71b57dfb53085008528/website/docs/spec/registry.md): JSON/CDR encodings, ROS profiles and compression formats.
- [Official TypeScript core library](https://github.com/foxglove/mcap/blob/60e73f4b4ec065c26324d71b57dfb53085008528/typescript/core/README.md): low-level reader/writer and MIT license. Implementation uses locked `@mcap/core` 2.3.0 and its installed `McapStreamReader` API documentation.
