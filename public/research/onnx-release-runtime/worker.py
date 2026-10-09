"""Trusted local IPC worker. NOT a sandbox, attestation service or signature authority."""
import base64
import hashlib
import json
import math
import os
import sys
import uuid
import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, numpy_helper

LIMIT = 4 * 1024 * 1024
active = None
pending = None
META = {'generation', 'releaseSha256', 'releaseId', 'modelSha256', 'configurationSha256', 'receiptSha256'}

def strict(value, fields):
    if not isinstance(value, dict) or set(value) != set(fields):
        raise ValueError('Unsupported fields')

def vector(value, dimension):
    if not isinstance(value, list) or len(value) != dimension or any(type(v) not in (int, float) or not math.isfinite(v) or abs(v) > 1e6 for v in value):
        raise ValueError('Invalid numeric vector')
    return np.array(value, dtype=np.float32)

def sha(value):
    return hashlib.sha256(value).hexdigest()

def crash(phase):
    # Trusted harness-only process environment, never an inference caller argument.
    if os.environ.get('VRAELIS_ONNX_TEST_CRASH_AT') == phase:
        os._exit(91)

def shape(value):
    tensor = value.type.tensor_type
    dims = [d.dim_value if not d.dim_param else 0 for d in tensor.shape.dim]
    if tensor.elem_type != TensorProto.FLOAT or len(dims) != 2 or dims[0] != 1 or not 1 <= dims[1] <= 16:
        raise ValueError('Only fixed batch-one float32 tensors are supported')
    return dims

def validate_graph(raw, dimension):
    value = onnx.load_model_from_string(raw)
    if value.ir_version != 10 or len(value.opset_import) != 1 or value.opset_import[0].domain != '' or value.opset_import[0].version != 13 or value.functions or value.training_info:
        raise ValueError('Unsupported model version/domain/functions')
    graph = value.graph
    if len(graph.input) != 1 or len(graph.output) != 1 or graph.input[0].name != 'features' or graph.output[0].name != 'scores' or shape(graph.input[0]) != [1, dimension]:
        raise ValueError('Unsupported interface')
    output_shape = shape(graph.output[0])
    if graph.sparse_initializer or graph.value_info or not 1 <= len(graph.node) <= 16 or not 1 <= len(graph.initializer) <= 16:
        raise ValueError('Unsupported graph structure')
    for tensor in graph.initializer:
        if tensor.data_location == TensorProto.EXTERNAL or tensor.external_data or tensor.data_type != TensorProto.FLOAT or not tensor.dims or len(tensor.dims) > 2 or any(not 1 <= d <= 16 for d in tensor.dims):
            raise ValueError('Only bounded embedded float32 weights are supported')
        if not np.isfinite(numpy_helper.to_array(tensor)).all():
            raise ValueError('Non-finite weights')
    for node in graph.node:
        if node.domain or node.op_type not in {'MatMul', 'Add', 'Sub', 'Mul', 'Relu', 'Sigmoid'} or node.attribute:
            raise ValueError('Unsupported operator/domain/attributes')
    # Default checker does not reject every declared/inferred shape mismatch.
    onnx.checker.check_model(value, full_check=True)
    inferred = onnx.shape_inference.infer_shapes(value, check_type=True, strict_mode=True, data_prop=True)
    if shape(inferred.graph.output[0]) != output_shape:
        raise ValueError("Inferred output does not match the declared fixed interface")
    return tuple(output_shape)

for line in iter(lambda: sys.stdin.buffer.readline(LIMIT + 1), b''):
    request_id = None
    try:
        if len(line) > LIMIT or not line.endswith(b'\n'):
            raise ValueError('Protocol limit exceeded')
        req = json.loads(line, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Non-finite JSON')))
        request_id = req.get('id') if isinstance(req, dict) else None
        if type(request_id) is not int or request_id < 1:
            raise ValueError('Invalid request identifier')
        command = req.get('command')
        if command == 'prepare':
            strict(req, {'id', 'command', 'bytesBase64', 'inputDimension', 'configurationJson', 'metadata'})
            strict(req['metadata'], META)
            dimension = req['inputDimension']
            if type(dimension) is not int or not 1 <= dimension <= 16:
                raise ValueError('Invalid input dimension')
            raw = base64.b64decode(req['bytesBase64'], validate=True)
            if not raw or len(raw) > 3 * 1024 * 1024:
                raise ValueError('Model size limit')
            config = json.loads(req['configurationJson'])
            strict(config, {'format', 'offsets', 'scales'})
            if config['format'] != 'affine-input-v1':
                raise ValueError('Unsupported configuration')
            offsets, scales = vector(config['offsets'], dimension), vector(config['scales'], dimension)
            metadata = req['metadata']
            if metadata['modelSha256'] != sha(raw) or metadata['configurationSha256'] != sha(req['configurationJson'].encode()):
                raise ValueError('Model/configuration digest mismatch')
            output_shape = validate_graph(raw, dimension)
            options = ort.SessionOptions()
            options.intra_op_num_threads = 1
            options.inter_op_num_threads = 1
            session = ort.InferenceSession(raw, sess_options=options, providers=['CPUExecutionProvider'])
            if session.get_providers() != ['CPUExecutionProvider']:
                raise ValueError('Unexpected provider')
            pending = {'session': session, 'offsets': offsets, 'scales': scales, 'dimension': dimension, 'outputShape': output_shape, 'metadata': metadata, 'sessionId': uuid.uuid4().hex, 'token': uuid.uuid4().hex}
            crash('prepare-after')
            result = {'token': pending['token'], 'sessionId': pending['sessionId'], 'metadata': metadata}
        elif command == 'activate':
            strict(req, {'id', 'command', 'token'})
            if pending is None or req['token'] != pending['token']:
                raise ValueError('No matching prepared session')
            crash('activate-before')
            active, pending = pending, None
            crash('activate-after')
            result = {'sessionId': active['sessionId'], 'metadata': active['metadata']}
        elif command == 'status':
            strict(req, {'id', 'command'})
            result = None if active is None else {'sessionId': active['sessionId'], 'metadata': active['metadata']}
        elif command == 'infer':
            strict(req, {'id', 'command', 'features'})
            if active is None:
                raise ValueError('No active session')
            features = vector(req['features'], active['dimension'])
            tensor = ((features - active['offsets']) * active['scales']).reshape(1, -1)
            scores = active['session'].run(['scores'], {'features': tensor})[0]
            if scores.shape != active['outputShape'] or scores.dtype != np.float32 or not np.isfinite(scores).all():
                raise ValueError('Inference output violates the approved fixed interface')
            crash('infer-after')
            result = {'sessionId': active['sessionId'], 'metadata': active['metadata'], 'scores': scores[0].tolist()}
        else:
            raise ValueError('Unsupported command')
        print(json.dumps({'id': request_id, 'ok': True, 'result': result}, allow_nan=False), flush=True)
    except Exception as error:
        print(json.dumps({'id': request_id, 'ok': False, 'error': type(error).__name__}), flush=True)
