"use client";

import { useMemo, useState } from "react";
import {
  PayPalButtons,
  PayPalScriptProvider,
  type ReactPayPalScriptOptions,
} from "@paypal/react-paypal-js";

/**
 * Wrapper around PayPalScriptProvider hoisted to a single instance
 * for the entire addons list. PayPal's SDK is a global singleton
 * mounting multiple <PayPalScriptProvider>s on one page caused only
 * one button row to actually render (the others stayed blank). One
 * provider, many buttons inside.
 */
export function PayPalAddonsProvider({
  clientId,
  children,
}: {
  clientId: string;
  children: React.ReactNode;
}) {
  const scriptOptions = useMemo<ReactPayPalScriptOptions>(() => ({
    clientId,
    currency: "USD",
    intent: "capture",
    components: "buttons",
    "disable-funding": "credit,paylater",
  }), [clientId]);
  return (
    <PayPalScriptProvider options={scriptOptions}>
      {children}
    </PayPalScriptProvider>
  );
}

type Props = {
  addonKey: string;
  addonName: string;
  amountUsd: number;
  onActivated: () => void;
};

/**
 * Compact PayPal Smart Button for buying an addon. Must be rendered
 * INSIDE a <PayPalAddonsProvider> (one per page).
 *
 * Flow:
 *   1. createOrder → POST /api/paypal/create-addon-order, returns orderId
 *   2. PayPal popup opens with that order
 *   3. onApprove → POST /api/paypal/capture-addon-order to finalize +
 *      activate the addon server-side (writes boost_credits row)
 *   4. onActivated() callback → caller refreshes billing state
 */
export function PayPalAddonButton({
  addonKey,
  addonName,
  amountUsd,
  onActivated,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  return (
    <div className="paypal-addon-wrap">
      <div className="paypal-addon-btn">
        <PayPalButtons
          fundingSource="paypal"
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
