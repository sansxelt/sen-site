import { EDITORIAL_PHOTOGRAPHS } from "./editorial-photography";

// Licensed photographs, independently of product evidence. Full sources and usage are in
// public/site/photography/CREDITS.md. These pictures never represent a Vraelis run or customer.
const ROOT = "/site/photography";
export const PHOTOGRAPHS = {
  ...EDITORIAL_PHOTOGRAPHS,
  robotArm: { file: "robot-arm", w: 2400, h: 1600, alt: "An industrial robot arm inside a manufacturing cell.", author: "Freek Wolsink", id: "34207359" },
  robotCell: { file: "robot-cell", w: 2400, h: 1800, alt: "Industrial robotic arms and machinery in a factory.", author: "Ludovic Delot", id: "18471441" },
  robotDetail: { file: "robot-detail", w: 2400, h: 1800, alt: "A close-up of an industrial robotic arm and its tool.", author: "KJ Brix", id: "16544056" },
  robotGrinding: { file: "robot-grinding", w: 2400, h: 1530, alt: "An industrial robotic arm working metal, with sparks.", author: "alex", id: "11951215" },
  powerGrid: { file: "power-grid", w: 2400, h: 1800, alt: "An electrical substation at sunset.", author: "Kindel Media", id: "9889066" },
  windFarm: { file: "wind-farm", w: 2400, h: 1800, alt: "Wind turbines and transmission towers in a desert landscape.", author: "Kindel Media", id: "9800091" },
  helicopter: { file: "helicopter", w: 2400, h: 1576, alt: "A Chinook helicopter flying above a wooded landscape.", author: "Veronika Andrews", id: "35608749" },
  satelliteStation: { file: "satellite-station", w: 2400, h: 2400, alt: "A large communications dish above a building.", author: "dabatepatfotos", id: "7633266" },
  hardwareInspection: { file: "hardware-inspection", w: 2400, h: 1600, alt: "A technician inspecting a printed circuit board.", author: "Willquezada", id: "11679113" },
  electronicsBench: { file: "electronics-bench", w: 2268, h: 4032, alt: "A technician working on a circuit board at an electronics bench.", author: "Bulat843", id: "32391505" },
  serverRack: { file: "server-rack", w: 2400, h: 1600, alt: "Network servers and cabling in a data center.", author: "Sergei Starostin", id: "6466141" },
  networkEngineer: { file: "network-engineer", w: 2400, h: 1597, alt: "An engineer holding a circuit board beside network equipment.", author: "panumas nikhomkhai", id: "19226354" },
  checkout: { file: "checkout", w: 2400, h: 1600, alt: "A person paying by card at a checkout.", author: "cottonbro studio", id: "8657363" },
  drone: { file: "drone", w: 2400, h: 3600, alt: "A drone silhouetted against the evening sky.", author: "Stuffedbox NG", id: "16238128" },
  signup: { file: "signup", w: 2400, h: 1600, alt: "Hands working on a laptop in a dark room.", author: "Sora Shimazaki", id: "5926398" },
  agent: { file: "agent", w: 2400, h: 1600, alt: "Code photographed on a computer screen.", author: "Nemuel Sereti", id: "6424588" },
  client: { file: "client", w: 2400, h: 1600, alt: "A person working at a computer beneath a blue light.", author: "cottonbro studio", id: "5473301" },
  vehicle: { file: "vehicle", w: 2400, h: 1800, alt: "A truck on a road at dusk.", author: "Sergei Skrynnik", id: "11053643" },
  mission: { file: "mission", w: 2400, h: 1800, alt: "Operators inside a ship's control room.", author: "Sergii", id: "14606488" },
  flight: { file: "flight", w: 2400, h: 3200, alt: "An aircraft's instrument panel illuminated at night.", author: "Larisa Andreou", id: "9497767" },
  groundstation: { file: "groundstation", w: 2400, h: 1600, alt: "A person operating a flight simulator.", author: "ThisIsEngineering", id: "3862634" },
  banking: { file: "banking", w: 1952, h: 3100, alt: "A person using a calculator on a phone beside a notebook.", author: "Jakub Zerdzicki", id: "35028998" },
  public: { file: "public", w: 2400, h: 1600, alt: "The interior of the Wisconsin State Capitol.", author: "Quang Vuong", id: "18845129" },
  aiapp: { file: "aiapp", w: 2400, h: 1799, alt: "A music editor running on a tablet.", author: "Egor Komarov", id: "13003485" },
  robotfleet: { file: "robotfleet", w: 2400, h: 3200, alt: "Delivery robots lined up outside.", author: "Kindel Media", id: "8566633" },
  firmware: { file: "firmware", w: 2400, h: 1600, alt: "A microcontroller and tools on a work surface.", author: "Tanha Tamanna Syed", id: "35652456" },
} as const;
export type PhotographKey = keyof typeof PHOTOGRAPHS;
export function photograph(key: PhotographKey) {
  const p = PHOTOGRAPHS[key];
  return { ...p, src: `${ROOT}/${p.file}.jpg`, source: `https://www.pexels.com/photo/${p.id}/` };
}
export function photographHero(key: PhotographKey, position = "50% 50%") {
  const p = photograph(key === "client" ? "agent" : key);
  return {
    picture: { src: p.src, portrait: p.src, alt: p.alt, position, portraitPosition: position },
  };
}

export const SECTOR_PHOTOGRAPHS: Record<string, PhotographKey> = {
  defense: "helicopter", fleets: "robotArm", commerce: "checkout", "public-sector": "powerGrid",
  "ai-built-apps": "aiapp", saas: "signup", agencies: "client", enterprise: "satelliteStation",
};

export const USE_CASE_PHOTOGRAPHS: Record<string, PhotographKey> = {
  "only-the-confirmed-target": "groundstation", "checkout-that-forgets": "checkout",
  "notes-that-survive-sign-out": "aiapp", "project-that-vanishes": "signup",
};
