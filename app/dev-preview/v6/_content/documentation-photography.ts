import type { PhotographKey } from "./photography";

// Editorial context only. Each article has its own pair; no screenshots or product evidence.
export const DOCUMENTATION_PHOTOGRAPHS: Record<string, readonly [PhotographKey, PhotographKey]> = {
  "ai-security": ["robotAssembly", "instrumentControls"],
  "recorded-reports": ["developerDesk", "networkLinks"],
  "getting-started": ["engineeringLaptop", "laboratoryRoom"],
  "the-loop": ["softwareWorkstation", "fiberPanel"],
  "what-you-can-check": ["programmerDesk", "ethernetPorts"],
  "ai-assistants": ["codeReview", "codeMonitor"],
  cli: ["laptopDevelopment", "laptopKeyboard"],
  api: ["serverWorkstation", "networkPorts"],
  ci: ["computeCabinets", "memoryModules"],
  webhooks: ["ethernetLink", "fiberConnections"],
  review: ["robotReview", "laboratoryDesks"],
  "run-activity": ["computeHardware", "computeIndicators"],
  completion: ["serverAisle", "networkSwitch"],
  findings: ["boardTraces", "processorDetail"],
  repair: ["benchSoldering", "circuitRepair"],
  recheck: ["microscopeInspection", "boardTesting"],
  systems: ["factoryAssembly", "gridEquipment"],
  guarantees: ["boardInspection", "labWorkstations"],
  memory: ["computerMemory", "processorBoard"],
};

export const DOCUMENTATION_INDEX_PHOTOGRAPHS: Record<string, PhotographKey> = {
  "ai-security": "electronicsWorkbench",
  "recorded-reports": "engineeringTeam",
};
