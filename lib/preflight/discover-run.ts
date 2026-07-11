// Discovery orchestrator: drives ONE discovery run through its lifecycle
//   fetching -> extracting -> synthesizing -> persisting -> completed|partial
// wiring the already-verified crawl + synthesis + merge modules onto the owner-scoped discovery data
// layer. Server-only; safe-fetch only (no browser). Two invariants:
//   TRANSACTION BOUNDARY  a failed run only marks ITS OWN snapshot 'failed'. It never deletes the last
//                         successful discovery, and planMerge/applyMergePlan only insert+patch (never
//                         delete), so existing requirements always survive a bad run.
//   FAIL-SOFT AI          synthesize() returns null on any model error; discovery then finalizes on the
//                         deterministic crawl snapshot with requirements left exactly as they were.
import { getApplication, getContract } from "../v-applications";
import { crawl } from "./discover-crawl";
import { makeSafeFetcher } from "./crawl-fetch";
import { synthesize, toSuggestions } from "./discover-synthesis";
import { planMerge, fingerprint } from "./contract-merge";
import {
  createDiscovery, setDiscoveryState, persistDiscoverySnapshot, failDiscovery,
  listRequirementsForMerge, applyMergePlan, insertFlowSuggestions,
} from "./discovery-db";

// `existing` is the row the POST route already reserved (so it could return the id and hold the "one active
// per app" slot synchronously). Called standalone, runDiscovery creates its own record.
export async function runDiscovery(owner: string, appId: string, existing?: { id: string; version: number }): Promise<void> {
  const app = await getApplication(owner, appId);
  if (!app || !app.app_url) return;                       // ownership fails or nothing to crawl
  const contract = await getContract(owner, appId);

  const record = existing ?? (await createDiscovery(owner, appId));
  if (!record) return;                                    // DB unavailable — nothing created, nothing lost
  const { id, version } = record;

  try {
    await setDiscoveryState(owner, id, "fetching");
    const snapshot = await crawl(app.app_url, makeSafeFetcher(), { maxPages: 12, maxDepth: 2 });

    // Persist the deterministic snapshot right away (state -> extracting). This row is the durable
    // last-success; later lifecycle transitions only flip `state`, so pages/failures are never lost.
    await persistDiscoverySnapshot(owner, id, {
      pages: snapshot.pages, failures: snapshot.failures, contentHash: snapshot.contentHash,
      pagesCount: snapshot.pagesCount, sourceUrl: snapshot.sourceUrl, state: "extracting",
    });

    if (snapshot.pages.length === 0) {                    // crawl reached nothing usable -> fail this run only
      await failDiscovery(owner, id, snapshot.failures[0]?.reason || "no_pages_discovered");
      return;
    }
    const finalState = snapshot.state === "partial" ? "partial" : "completed";

    await setDiscoveryState(owner, id, "synthesizing");
    const synth = await synthesize(snapshot.pages, contract?.source_prompt ?? null);
    if (!synth || !contract) {
      // AI unavailable, or no contract to attach to: keep the last successful requirements untouched and
      // finalize on the deterministic snapshot. Requirements are unchanged.
      await setDiscoveryState(owner, id, finalState);
      return;
    }

    const suggestions = toSuggestions(synth);
    const enabledByFp: Record<string, boolean> = {};
    for (const s of suggestions) enabledByFp[fingerprint(s.category, s.requirement)] = s.enabledDefault;
    const existingReqs = await listRequirementsForMerge(owner, contract.id);
    const plan = planMerge(existingReqs, suggestions, version);

    await setDiscoveryState(owner, id, "persisting");
    await applyMergePlan(owner, contract.id, plan, version, enabledByFp);
    await insertFlowSuggestions(owner, contract.id, synth, version);
    await setDiscoveryState(owner, id, finalState);
  } catch (e) {
    await failDiscovery(owner, id, (e as Error)?.message?.slice(0, 300) || "discovery_error");
  }
}
