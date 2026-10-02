// THE STRIKE CHECK, AS RECORDED (homepage "how a check works", _system/strike-story.tsx).
//
// Every value here was read out of ONE production verification, vrf_51705517-329b-4dcf-b9ce-4442e53439ed, run on
// 2026-10-02 against Larkspur, the simulated mission console Vraelis serves as a demo fixture
// (lib/fixtures/strike-console.ts, broken mode). Its plan, rvp_959221e7-19d2-4cc7-a36f-2e4456f434c8, was approved by a person
// in the console at 2026-10-02T02:03:47.996+00:00; nothing about it was scripted to look better.
//
//   cli           the Vraelis CLI's own output while it waited for that approval, colour codes included
//   plan          the plan's requirements and journeys as the API returns them
//   run.journeys  the first journey's steps, in the record page's wording, with their recorded timings
//   run.failure   the record's critical issue, verbatim; "shown" is what the run's screenshot shows there
//   shots         the run's own screenshot, and the contact list cut from it
//   repairPrompt  the record's repair prompt, verbatim
//
// The record holds two more failures: the withdraw and reset journeys could not press Confirm target,
// because the console kept T-1 confirmed from the first journey. The panel says so.
import strikeConsole from "./demos/strike-console.png";
import strikeContacts from "./demos/strike-contacts.png";
import { STRIKE_LINKS, type StrikeRecord } from "../_system/strike-story";

export const STRIKE: StrikeRecord = {
  url: "https://vraelis.com/api/fixtures/strike?mode=broken",
  claim: "When the operator confirms T-1 as a target, only T-1 shows Cleared to engage: the civilian bus T-3 and the friendly patrol T-2 still show Do not engage, and nothing changes after the page is reloaded.",
  cli: {
    command: "vraelis verify --url \"https://vraelis.com/api/fixtures/strike?mode=broken\" --claim \"When the operator confirms T-1 as a target, only T-1 shows Cleared to engage: the civilian bus T-3 and the friendly patrol T-2 still show Do not engage, and nothing changes after the page is reloaded.\" --wait",
    lines: [
      "  \u001b[1mPlan ready\u001b[0m  When the operator confirms T-1 as a target, only T-1 shows Cleared to engage: the civilian bus T-3 and the friendly patrol T-2 still show Do not engage, and nothing changes after the page is reloaded.",
      "  \u001b[2magainst\u001b[0m     \u001b[36mhttps://vraelis.com/api/fixtures/strike?mode=broken\u001b[0m",
      "",
      "    \u001b[2m-\u001b[0m When operator confirms T-1 as target, T-1 must show 'Cleared to engage' while T-2 and T-3 remain 'Do not engage'",
      "    \u001b[2m-\u001b[0m Engagement status must persist across page reload",
      "    \u001b[2m-\u001b[0m Operator can confirm a target via Confirm target control",
      "    \u001b[2m-\u001b[0m Operator can withdraw a confirmation via Withdraw confirmation control",
      "    \u001b[2m-\u001b[0m Operator can reset simulation state via Reset simulation control",
      "    \u001b[2m-\u001b[0m T-1 displays as 'Armoured vehicle Hold' before confirmation",
      "    \u001b[2m-\u001b[0m T-2 displays as 'Patrol, 4 people Do not engage' and must remain unchanged when T-1 is confirmed",
      "    \u001b[2m-\u001b[0m T-3 displays as 'Bus, civilian Do not engage' and must remain unchanged when T-1 is confirmed",
      "    \u001b[2m-\u001b[0m T-4 displays as 'Vehicle, unidentified Hold'",
      "",
      "  \u001b[33mA person has to approve this plan before it runs.\u001b[0m",
      "  \u001b[2mApprove it here:\u001b[0m \u001b[36mhttps://app.vraelis.com/review/rvp_959221e7-19d2-4cc7-a36f-2e4456f434c8\u001b[0m",
      "",
      "  \u001b[32mApproved.\u001b[0m \u001b[2mStarting the check.\u001b[0m"
    ],
  },
  plan: {
    id: "rvp_959221e7-19d2-4cc7-a36f-2e4456f434c8",
    requirements: [
      "When operator confirms T-1 as target, T-1 must show 'Cleared to engage' while T-2 and T-3 remain 'Do not engage'",
      "Engagement status must persist across page reload",
      "Operator can confirm a target via Confirm target control",
      "Operator can withdraw a confirmation via Withdraw confirmation control",
      "Operator can reset simulation state via Reset simulation control",
      "T-1 displays as 'Armoured vehicle Hold' before confirmation",
      "T-2 displays as 'Patrol, 4 people Do not engage' and must remain unchanged when T-1 is confirmed",
      "T-3 displays as 'Bus, civilian Do not engage' and must remain unchanged when T-1 is confirmed",
      "T-4 displays as 'Vehicle, unidentified Hold'"
    ],
    flows: [
      {
            "name": "Confirm T-1 target and verify state persists",
            "steps": 12
      },
      {
            "name": "Reset simulation clears engagement state",
            "steps": 6
      },
      {
            "name": "Withdraw confirmation reverts target state",
            "steps": 5
      }
    ],
    approvedAt: "2026-10-02T02:03:47.996+00:00",
  },
  run: {
    id: "vrf_51705517-329b-4dcf-b9ce-4442e53439ed",
    recorded: "2026-10-02",
    seconds: 40.8,
    journeys: [{
      name: "Confirm T-1 target and verify state persists",
      steps: [
        {
                "say": "Open /api/fixtures/strike?mode=broken",
                "ms": 953,
                "ok": true
        },
        {
                "say": "Confirm T-1 Armoured vehicle Hold is visible",
                "ms": 306,
                "ok": true
        },
        {
                "say": "Confirm T-2 Patrol, 4 people Do not engage is visible",
                "ms": 135,
                "ok": true
        },
        {
                "say": "Confirm T-3 Bus, civilian Do not engage is visible",
                "ms": 133,
                "ok": true
        },
        {
                "say": "Click Confirm target",
                "ms": 337,
                "ok": true
        },
        {
                "say": "Confirm T-1 Armoured vehicle Cleared to engage is visible",
                "ms": 133,
                "ok": true
        },
        {
                "say": "Confirm T-2 Patrol, 4 people Do not engage is visible",
                "ms": 130,
                "ok": true
        },
        {
                "say": "Confirm T-3 Bus, civilian Do not engage is visible",
                "ms": 9597,
                "ok": false
        }
      ],
    }],
    failure: {
      contact: "T-3",
      at: "Confirm T-1 target and verify state persists",
      expected: "Expected \"T-3 Bus, civilian Do not engage\" to be visible",
      observed: "\"T-3 Bus, civilian Do not engage\" was not visible",
      shown: "Cleared to engage",
      more: "The record holds two more failures: the withdraw and reset journeys could not press Confirm target, because T-1 was still confirmed from this one.",
    },
    shots: { run: strikeConsole, failure: strikeContacts },
    repairPrompt: "A check of this application failed on https://vraelis.com/api/fixtures/strike?mode=broken. It ran in a real browser against the deployed app, from the outside, as a user would.\n\nWHAT WAS BEING CHECKED\nExpected \"T-3 Bus, civilian Do not engage\" to be visible\n\nWHAT HAPPENED INSTEAD\n\"T-3 Bus, civilian Do not engage\" was not visible\n\nHOW TO REPRODUCE\n1. Open /api/fixtures/strike?mode=broken\n2. Confirm T-1 Armoured vehicle Hold is visible\n3. Confirm T-2 Patrol, 4 people Do not engage is visible\n4. Confirm T-3 Bus, civilian Do not engage is visible\n5. Click Confirm target\n6. Confirm T-1 Armoured vehicle Cleared to engage is visible\n7. Confirm T-2 Patrol, 4 people Do not engage is visible\n8. Confirm T-3 Bus, civilian Do not engage is visible\n9. Refresh the page\n10. Confirm T-1 Armoured vehicle Cleared to engage is visible\n11. Confirm T-2 Patrol, 4 people Do not engage is visible\n12. Confirm T-3 Bus, civilian Do not engage is visible\n\nWHERE IT FAILED\nStep 8 (assert_visible) is where it stopped.\n\nBROWSER CONSOLE\n- The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy.\n\nWHAT I NEED\nThis was observed from outside the app, so I know the symptom and not the cause. You have the source. Find why this happens, fix the underlying cause rather than the symptom, and tell me what you changed and why. If reproducing it needs something I have not given you, say what.",
  },
};

// The four chapters under the scene, and the line under it that says why a team would let Vraelis do this.
// Every claim in them is in the record above: the rule is the claim, the plan was approved by a person,
// the browser read every contact before and after confirming T-1, and the bus showed "Cleared to engage".
export const STRIKE_CHAPTERS = [
  { eyebrow: "The rule", t: "Only the confirmed target is cleared.", d: "The mission team writes it as one sentence and hands it to Vraelis from the terminal, or their coding agent does.", link: STRIKE_LINKS.cli },
  { eyebrow: "The plan", t: "A person approves every step first.", d: "Vraelis writes the plan. Nothing touches the console until someone on the team says yes, and an agent never can.", link: STRIKE_LINKS.approval },
  { eyebrow: "The run", t: "A browser works the console like an operator.", d: "On the simulation, never the aircraft: it reads every contact, confirms T-1, and reads them all again.", link: STRIKE_LINKS.coverage },
  { eyebrow: "The finding", t: "The civilian bus was cleared too.", d: "Confirming T-1 also cleared T-3, the bus in the same grid square. The record keeps the step, the screen and a repair prompt for the team's agent." },
];

export const STRIKE_CAPTION = "Vraelis does not make mission software. It checks it: on a simulation or a staging build, on steps a person approved, with the record kept in the team's own workspace. A real run on Larkspur, a Vraelis demo fixture.";
