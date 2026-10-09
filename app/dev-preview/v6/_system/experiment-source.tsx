import "./experiment-source.css";

/** Actual source excerpt, not a simulated terminal or product screen. */
export function ExperimentSource() {
  return <aside className="experiment-source" aria-label="Current ONNX loader source">
    <header><span>Current engineering</span><span>worker.py · source excerpt</span></header>
    <h3>Inspect the loader.</h3>
    <p>The local experiment checks the model digest before creating an ONNX Runtime CPU session from the same bytes.</p>
    <pre><code>{`if metadata['modelSha256'] != sha(raw) or metadata['configurationSha256'] != sha(req['configurationJson'].encode()):
    raise ValueError('Model/configuration digest mismatch')
output_shape = validate_graph(raw, dimension)
options = ort.SessionOptions()
options.intra_op_num_threads = 1
options.inter_op_num_threads = 1
session = ort.InferenceSession(raw, sess_options=options, providers=['CPUExecutionProvider'])`}</code></pre>
    <nav aria-label="Experiment files"><a href="/research/onnx-release-runtime/worker.py">Full loader source ↗</a><a href="/research/onnx-release-runtime/measurements.json">Recorded measurements ↗</a><a href="/research/onnx-release-runtime/README.md">Method and limitations ↗</a></nav>
    <small>Local synthetic experiment recorded October 7, 2026. These files are not a live service, customer validation or hardware attestation.</small>
  </aside>;
}
