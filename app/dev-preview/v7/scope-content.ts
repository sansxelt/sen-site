import type { DirectionContent } from "../v6/_system/direction-page";

// Existing public scope, rendered in the isolated design preview.
const modelIntegrity: DirectionContent = {
  eyebrow:"Model integrity", title:"Know which model is running.",
  intro:"Model files, configurations and dependencies can change between development and deployment. We are investigating how to establish provenance, verify approved artifacts and make changes reviewable.",
  photo:"releaseInspection", heading:"Integrity begins before deployment.",
  lead:"An authentic artifact can still behave unsafely. Provenance, tamper checks and behavioral evaluation answer different questions.",
  items:[
    {label:"Provenance",title:"Establish the source",body:"Record where an artifact came from, how it was produced and which dependencies it includes. A version label supplied by the workload is insufficient evidence."},
    {label:"Verification",title:"Compare the approved artifact",body:"Bind deployment to a reviewed model and configuration. Signatures and hashes can establish authenticity and change; they cannot establish freedom from backdoors or adversarial vulnerabilities."},
    {label:"Change",title:"Review what changed",body:"Preserve the relationship between an update, its authorization and the evidence used to evaluate it. Model weights, preprocessing and runtime configuration all affect behavior."},
  ],
  story:{photo:"boardComponents",eyebrow:"Deployment context",title:"The artifact is part of a running system.",paragraphs:[
    "A verified model file does not establish which workload has loaded it or whether the surrounding software is intact. Runtime identity and trustworthy measurements need a defined source and integration.",
    "Model integrity is a development priority. We do not offer a deployed attestation service, universal model scanner or verified support for specific edge hardware.",
  ]},
  nextTitle:"Test the integrity boundary.",nextLead:"Define the model format, runtime and threat before choosing the verification mechanism.",
  next:[
    {label:"Baseline",title:"Identify the reviewed configuration",body:"Name the artifact, preprocessing, dependencies and intended environment. Document what the available evidence can authenticate."},
    {label:"Evaluation",title:"Exercise unauthorized changes",body:"Use controlled tests to check altered artifacts, mismatched configurations and invalid provenance. Record which changes remain outside coverage."},
    {label:"Operations",title:"Preserve independent recovery",body:"Integrate update and recovery procedures with the system owner. Verification failures need a system-specific response that respects existing operating controls."},
  ],
};

const adversarialThreats: DirectionContent = {
  eyebrow:"Adversarial threats",title:"Investigate how AI can be manipulated.",
  intro:"Untrusted inputs, compromised training data and malicious model changes introduce distinct attack paths. Our research focuses on evaluating those threats in the conditions where an AI system operates.",
  photo:"robotDetail",heading:"Match the attack to the input path.",
  lead:"Text instructions, camera inputs and training data require different evaluations. An anomaly is a reason to investigate; it does not by itself establish an attack.",
  items:[
    {label:"Inputs",title:"Manipulated observations",body:"Evaluate how a defined perception model responds to altered sensor inputs. Lighting, viewpoint, normal variation and sensor faults belong in the baseline."},
    {label:"Data",title:"Poisoned learning material",body:"Investigate training-data provenance, unexpected changes and controlled poisoning cases. Runtime input filtering cannot establish that a training set is trustworthy."},
    {label:"Agents",title:"Untrusted instructions",body:"Study prompt injection in workloads that consume external text or tool results. Keep resource permissions and consequential approval independent of model output."},
  ],
  story:{photo:"groundstation",eyebrow:"Controlled evaluation",title:"A result needs its conditions.",paragraphs:[
    "A useful evaluation identifies the model, attacker access, input path and expected outcome. Test normal operation alongside attack cases so protection is assessed against both missed attacks and false alarms.",
    "This is research and development. We do not claim universal adversarial detection, guaranteed protection against unknown attacks or sub-millisecond performance on edge devices.",
  ]},
  nextTitle:"Measure protection and operating cost.",nextLead:"Evidence should establish both the security result and the constraints of the proposed control.",
  next:[
    {label:"Coverage",title:"Define what was tested",body:"Document the attacks, model versions and conditions covered. Include attacks adapted to the proposed protection rather than relying only on a fixed example set."},
    {label:"Performance",title:"Measure the whole input path",body:"Assess detection delay, inference impact, memory and compute consumption on the intended device. Software adds operating costs even when no new hardware is required."},
    {label:"Response",title:"Keep recovery within the safety design",body:"Use security findings to inform investigation and independently authorized responses. Preserve the system owner's existing safety and operating mechanisms."},
  ],
};

const recordedEvidence: DirectionContent = {
  "eyebrow": "Recorded evidence",
  "title": "Evidence for security investigation.",
  "intro": "Recorded behavior supports investigation alongside access controls and policy decisions. Our private evaluator compares supported task reports against reviewed criteria.",
  "photo": "robotDetail",
  "heading": "Follow the finding to its source.",
  "lead": "The product is being developed privately. Integration requirements must be established for the system being secured.",
  "items": [
    {
      "label": "Identity",
      "title": "Review the same task and asset",
      "body": "The evaluator checks task and asset identifiers, the completion window and assets that should remain unchanged."
    },
    {
      "label": "Sources",
      "title": "Expose conflicting reports",
      "body": "Compare supplied control, service and device states. Missing capture can make the outcome inconclusive."
    },
    {
      "label": "Comparison",
      "title": "Inspect a changed build",
      "body": "Compare recordings using the same reviewed criteria. Current local recordings and comparison baselines are cleared when the tab closes."
    }
  ],
  "nextTitle": "Connect the foundation to a complete workflow.",
  "nextLead": "The next work is an authenticated, controlled test integration with a decision and outcome that reviewers can inspect.",
  "next": [
    {
      "label": "Context",
      "title": "Identify the workload and resource",
      "body": "Document the identity source, model version, allowed operations and environment."
    },
    {
      "label": "Control",
      "title": "Test the security boundary",
      "body": "Verify that authorized actions succeed and changed or unauthorized proposals are denied before dispatch."
    },
    {
      "label": "Evidence",
      "title": "Review the decision and outcome",
      "body": "Retain the exact policy and action bindings alongside the observations available to the reviewer."
    }
  ],
  "showStatus": true
};

export const SCOPE_CONTENT: Record<string, DirectionContent> = {"model-integrity":modelIntegrity,"adversarial-security":adversarialThreats,"recorded-evidence":recordedEvidence};
