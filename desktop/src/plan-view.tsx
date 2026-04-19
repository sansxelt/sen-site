import { useCallback, useEffect, useState } from "react";
import { DesktopBillingPanel } from "./billing-panel";
import { getDesktopBillingState, type DesktopBillingState } from "./billing-api";
import type { DesktopSession } from "./auth";

export function DesktopPlanView({ session }: { session: DesktopSession }) {
  const [billing, setBilling] = useState<DesktopBillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getDesktopBillingState(session.token);
      setBilling(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  return (
    <div className="view">
      <div className="view-head">
        <h1>Plan</h1>
        <p>
          Manage your plan, card, addons, and upgrades without leaving the
          desktop app.
        </p>
      </div>
      <div className="view-body">
        {loading && <div className="view-loading">Loading...</div>}
        {!loading && billing && (
          <DesktopBillingPanel
            token={session.token}
            billing={billing}
            onRefresh={loadBilling}
          />
        )}
        {error && <div className="view-error">{error}</div>}
      </div>
    </div>
  );
}
