"use client";

import { useMemo, useState } from "react";
import {
  PayPalButtons,
  PayPalScriptProvider,
  type ReactPayPalScriptOptions,
} from "@paypal/react-paypal-js";

type Props = {
  clientId: string;
  addonKey: string;
  addonName: string;
  amountUsd: number;
  onActivated: () => void;
};

/**
 * Compact PayPal Smart Button for buying an addon. Renders inline
 * inside the billing-panel addon row alongside the Stripe "Add"
 * button. Uses Orders API (intent CAPTURE) so the user sees a
 * one-click PayPal popup, no plan setup needed.
 *
 * Flow:
 *   1. createOrder → POST /api/paypal/create-addon-order, returns orderId
 *   2. PayPal popup opens with that order
 *   3. onApprove → POST /api/paypal/capture-addon-order to finalize +
 *      activate the addon server-side (writes boost_credits row)
 *   4. onActivated() callback → caller refreshes billing state
 */
export function PayPalAddonButton({
  clientId,
  addonKey,
  addonName,
  amountUsd,
  onActivated,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const scriptOptions = useMemo<ReactPayPalScriptOptions>(() => ({
    clientId,
    currency: "USD",
    intent: "capture",
    components: "buttons",
    "disable-funding": "credit,paylater",
  }), [clientId]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="w-[140px]">
        <PayPalScriptProvider options={scriptOptions}>
          <PayPalButtons
            style={{
              layout: "horizontal",
              color:  "gold",
              shape:  "pill",
              label:  "paypal",
              height: 32,
              tagline: false,
            }}
            createOrder={async () => {
              setError(null);
              setWorking(true);
              try {
                const res = await fetch("/api/paypal/create-addon-order", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ addonKey }),
                });
                const data = (await res.json()) as { orderId?: string; error?: string };
                if (!res.ok || !data.orderId) {
                  throw new Error(data.error ?? "Could not start PayPal order.");
                }
                return data.orderId;
              } catch (e) {
                setError(e instanceof Error ? e.message : "PayPal order failed.");
                throw e;
              } finally {
                setWorking(false);
              }
            }}
            onApprove={async (data) => {
              setWorking(true);
              try {
                const res = await fetch("/api/paypal/capture-addon-order", {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ orderId: data.orderID, addonKey }),
                });
                const body = (await res.json()) as { status?: string; error?: string };
                if (!res.ok) {
                  throw new Error(body.error ?? "Could not activate addon.");
                }
                onActivated();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Capture failed.");
              } finally {
                setWorking(false);
              }
            }}
            onCancel={() => {
              setError(`PayPal canceled for ${addonName}. You weren't charged.`);
            }}
            onError={(err) => {
              console.error("[paypal addon button] error:", err);
              setError("PayPal error. Try again or use card.");
            }}
          />
        </PayPalScriptProvider>
      </div>
      {working && (
        <span className="text-[10px] text-neutral-500">Working… ${amountUsd.toFixed(2)}</span>
      )}
      {error && (
        <span className="text-[10px] text-red-300 max-w-[200px] text-right">{error}</span>
      )}
    </div>
  );
}
