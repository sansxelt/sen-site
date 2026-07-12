// Discovery orchestrator: drives ONE discovery run through its lifecycle
//   fetching -> extracting -> synthesizing -> persisting -> completed|partial
// wiring the already-verified crawl + synthesis + merge modules onto the owner-scoped discovery data
// layer. Server-only; safe-fetch only (no browser). Two invariants:
//   TRANSACTION BOUNDARY  a failed run only marks ITS OWN snapshot 'failed'. It never deletes the last
//                         successful discovery, and planMerge/applyMergePlan only insert+patch (never
//                         delete), so existing requirements always survive a bad run.
//   FAIL-SOFT AI          synthesize() returns null on any model error; discovery then finalizes on the
//                         deterministic crawl snapshot. Existing requirements are never rewritten on that
//                         path; the only additions are the DETERMINISTIC connection-signal suggestions
//                         (pure, no AI, origin "inference"), and merge only ever inserts + patches.
import { getApplication, getContract } from "../v-applications";
import { crawl } from "./discover-crawl";
import { makeSafeFetcher } from "./crawl-fetch";
import {
  synthesize, toSuggestions, availableProvenance, connectionSignalSuggestions, type SynthContext,
} from "./discover-synthesis";
import { planMerge, fingerprint, type Suggestion } from "./contract-merge";
import { listConnections } from "./connections-db";
import { readContextSources } from "./setup-read";
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

    // S7 context-aware synthesis inputs: the owner's product-definition sources (by kind) and the
    // connection presence signals ride into the prompt. Both reads degrade to empty on any miss.
    const [contextSources, connections] = await Promise.all([
      readContextSources(owner, appId),
      listConnections(owner, appId),
    ]);
    const providers = Array.from(new Set(connections.map((c) => c.provider)));
    const context: SynthContext = {
      sources: contextSources.map((s) => ({ kind: s.kind, content: s.content })),
      connections: providers,
    };

    await setDiscoveryState(owner, id, "synthesizing");
    const synth = await synthesize(snapshot.pages, contract?.source_prompt ?? null, context);
    if (!synth || !contract) {
      // AI unavailable, or no contract to attach to. Existing requirements stay exactly as they were;
      // the DETERMINISTIC path may still contribute the standard connection-signal suggestions (pure,
      // no AI, origin "inference", disabled until the owner approves).
      if (contract) {
        const det: (Suggestion & { enabledDefault: boolean })[] = connectionSignalSuggestions(providers);
        if (det.length) {
          const enabledByFp: Record<string, boolean> = {};
          for (const s of det) enabledByFp[fingerprint(s.category, s.requirement)] = s.enabledDefault;
          const existingReqs = await listRequirementsForMerge(owner, contract.id);
          const plan = planMerge(existingReqs, det, version);
          // A keyless pass carries only the connection signals, so it must NOT mark the last successful
          // AI discovery's suggestions stale: drop the stale-marking patches, keep inserts + refreshes.
          plan.updates = plan.updates.filter((u) => u.patch.stale !== true);
          await setDiscoveryState(owner, id, "persisting");
          await applyMergePlan(owner, contract.id, plan, version, enabledByFp);
        }
      }
      await setDiscoveryState(owner, id, finalState);
      return;
    }

    const suggestions = toSuggestions(synth, availableProvenance(contract.source_prompt ?? null, context));
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
