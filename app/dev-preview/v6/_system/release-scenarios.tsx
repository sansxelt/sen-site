"use client";
import { useState } from "react";
import "./release-scenarios.css";
const cases = [
 {name:"Match",verdict:"MATCHED",observed:"R42",tone:"ok",detail:"The session report matches the requested release.",events:["Release approved for Cell 07","R42 requested","R42 session reported"]},
 {name:"Mismatch",verdict:"WRONG RELEASE",observed:"R41",tone:"warn",detail:"R42 was requested. The service reports an older session.",events:["R42 requested","Reload did not replace R41","Mismatch recorded"]},
 {name:"Missing report",verdict:"MISSING EVIDENCE",observed:"Unknown",tone:"unknown",detail:"The reporting deadline passed. Activation remains unconfirmed.",events:["R42 requested","Waiting for session report","Deadline passed · no success recorded"]},
 {name:"Recovery",verdict:"RECOVERY RECORDED",observed:"R41",tone:"ok",detail:"An operator requested R41 in a new deployment attempt.",events:["R42 mismatch retained","Operator requested R41","New R41 session reported"]},
] as const;
export function ReleaseScenarios(){const [selected,setSelected]=useState(1);const c=cases[selected];return <div className="release-stage" data-tone={c.tone}>
 <div className="release-stage__top"><span>Contour / Cell 07</span><span>Workflow illustration</span></div>
 <div className="release-stage__tabs" role="group" aria-label="Release scenarios">{cases.map((v,i)=><button key={v.name} type="button" aria-pressed={selected===i} onClick={()=>setSelected(i)}>{v.name}</button>)}</div>
 <div className="release-stage__flow" aria-label="Approval to active session">
  <div className="release-stage__artifact"><span className="release-stage__label">Approved bundle</span><strong>{selected===3?"R41":"R42"}</strong><div className="release-stage__files"><span>model.onnx <i>sha256</i></span><span>preprocess <i>sha256</i></span><span>config <i>sha256</i></span></div></div>
  <div className="release-stage__connector" aria-hidden="true"><span/><span/><span/></div>
  <div className="release-stage__runtime"><span className="release-stage__label">Reported active session</span><strong key={c.observed}>{c.observed}</strong><div className="release-stage__signal" aria-hidden="true">{Array.from({length:15},(_,i)=><i key={i} style={{height:`${10+(i*17)%36}px`}}/>)}</div><span className="release-stage__label">Managed service report</span></div>
 </div>
 <div className="release-stage__result" aria-live="polite"><span className="release-stage__verdict">{c.verdict}</span><p>{c.detail}</p></div>
 <ol className="release-stage__events">{c.events.map((e,i)=><li key={e}><span>0{i+1}</span>{e}</li>)}</ol>
 <p className="release-stage__note">Fictional example. Reports depend on a trusted service; they do not prove host integrity.</p>
 </div>}
export function ScopeDiagram({index}:{index:number}){const labels=[['Model artifact','Release identity','Change detected'],['Test inputs','Model under test','Observed response'],['Workload identity','Permission boundary','Allow / deny'],['Source observations','Review criteria','Evidence record']][index];return <div className="scope-diagram" aria-label={labels.join(' to ')}>{labels.map((l,i)=><div key={l}><span>0{i+1}</span><strong>{l}</strong>{i<2&&<i aria-hidden="true"/>}</div>)}</div>}
