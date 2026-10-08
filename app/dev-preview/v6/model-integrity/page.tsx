import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";

const content: DirectionContent = {
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
export const metadata = v6meta({title:content.eyebrow,description:content.intro,path:"/model-integrity"});
export default function Page() { return <DirectionPage content={content} />; }
