import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";

const content: DirectionContent = {
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
export const metadata = v6meta({title:content.eyebrow,description:content.intro,path:"/adversarial-security"});
export default function Page() { return <DirectionPage content={content} />; }
