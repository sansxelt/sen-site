"use client";

import { useId, useState } from "react";
import { EXTRA_FLOW_CENTS, PASS_INCLUDED_FLOWS, RERUN_PER_FLOW_CENTS, passPriceCents, rerunPriceCents } from "@/lib/preflight/pass-pricing";
import { usdFromCents } from "@/lib/preflight/pass-pricing-format";

/** An estimate of catalog charges; it never launches a run or starts checkout. */
export function PricingEstimate() {
  const id = useId();
  const [flows, setFlows] = useState(PASS_INCLUDED_FLOWS);
  const [failedFlows, setFailedFlows] = useState(1);
  const reruns = Math.min(failedFlows, flows);
  const extra = Math.max(0, flows - PASS_INCLUDED_FLOWS);
  const fullPrice = passPriceCents(flows);
  const rerunPrice = reruns ? rerunPriceCents(reruns) : 0;

  return (
    <div className="v6-estimate">
      <div className="v6-estimate__controls">
        <p className="v6-eyebrow">Pay as you go</p>
        <h3>See the cost before you run.</h3>
        <p>A flow is one browser journey through a system. Change the selection to compare a full check with a targeted rerun.</p>
        <div className="v6-estimate__control">
          <label htmlFor={`${id}-flows`}>Flows in the full check <output htmlFor={`${id}-flows`} data-no-translate>{flows}</output></label>
          <input id={`${id}-flows`} type="range" min={1} max={30} value={flows} onChange={(e) => setFlows(Number(e.target.value))} />
          <div className="v6-estimate__scale" aria-hidden="true"><span>1</span><span>30</span></div>
        </div>
        <div className="v6-estimate__control">
          <label htmlFor={`${id}-rerun`}>Failed flows to rerun <output htmlFor={`${id}-rerun`} data-no-translate>{reruns}</output></label>
          <input id={`${id}-rerun`} type="range" min={0} max={flows} value={reruns} onChange={(e) => setFailedFlows(Number(e.target.value))} />
          <div className="v6-estimate__scale" aria-hidden="true"><span>0</span><span data-no-translate>{flows}</span></div>
        </div>
        <p className="v6-estimate__note">This estimates browser-verification charges. Local recording reviews are a separate beta workflow.</p>
      </div>
      <div className="v6-estimate__receipt" aria-live="polite" aria-atomic="true">
        <div className="v6-estimate__receipt-head"><span>Full browser check</span><span data-no-translate>{`${flows} ${flows === 1 ? "flow" : "flows"}`}</span></div>
        <div className="v6-estimate__flowmap" aria-hidden="true">
          {Array.from({ length: flows }, (_, i) => <span key={i} data-included={i < PASS_INCLUDED_FLOWS} />)}
        </div>
        <dl className="v6-estimate__breakdown">
          <div><dt>{`Base price, up to ${PASS_INCLUDED_FLOWS} flows`}</dt><dd data-no-translate>{usdFromCents(passPriceCents(PASS_INCLUDED_FLOWS))}</dd></div>
          <div><dt>{`${extra} additional ${extra === 1 ? "flow" : "flows"}`}</dt><dd data-no-translate>{usdFromCents(extra * EXTRA_FLOW_CENTS)}</dd></div>
          <div className="v6-estimate__total"><dt>Full check</dt><dd data-no-translate>{usdFromCents(fullPrice)}</dd></div>
        </dl>
        <div className="v6-estimate__rerun"><div><span>Targeted rerun</span><p>{`${reruns} selected ${reruns === 1 ? "flow" : "flows"}`}</p></div><strong data-no-translate>{usdFromCents(rerunPrice)}</strong></div>
        <p className="v6-estimate__note">{`${usdFromCents(RERUN_PER_FLOW_CENTS)} per selected failed flow, capped at the price of a comparable full check. A full check and its rerun are separate charges.`}</p>
      </div>
    </div>
  );
}
