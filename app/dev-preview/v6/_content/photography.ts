// Licensed photographs, independently of product evidence. Full sources and usage are in
// public/site/photography/CREDITS.md. These pictures never represent a Vraelis run or customer.
const ROOT = "/site/photography";
export const PHOTOGRAPHS = {
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
  const p = photograph(key);
  return {
    picture: { src: p.src, portrait: p.src, alt: p.alt, position, portraitPosition: position },
    credit: `${p.author} / Pexels`,
  };
}

export const SECTOR_PHOTOGRAPHS: Record<string, PhotographKey> = {
  defense: "groundstation", fleets: "vehicle", commerce: "checkout", "public-sector": "public",
  "ai-built-apps": "aiapp", saas: "signup", agencies: "client", enterprise: "mission",
};

export const USE_CASE_PHOTOGRAPHS: Record<string, PhotographKey> = {
  "only-the-confirmed-target": "groundstation", "checkout-that-forgets": "checkout",
  "notes-that-survive-sign-out": "aiapp", "project-that-vanishes": "signup",
};
