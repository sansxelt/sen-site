/* THE MISSION PICTURE, AS LINE ART (strike-story.tsx's back two sheets).

   Drawn from the strike fixture's own geometry (lib/fixtures/strike-console.ts: STRIKE_MAP, STRIKE_CONTACTS),
   so the sheets show exactly the picture the console shows and the screenshots in the front sheet agree with
   them. The only colour is the battlefield convention the console itself uses (hostile red, friendly blue,
   civilian green, unknown yellow): it is there because it says what each contact is. */
import { STRIKE_CONTACTS, STRIKE_MAP, type StrikeContact } from "@/lib/fixtures/strike-console";

const M = STRIKE_MAP;
const CLS: Record<StrikeContact["cls"], string> = { Hostile: "#FF6B6B", Friendly: "#6EA8FF", Civilian: "#4FD28A", Unknown: "#F0C850" };

function Symbol({ cls }: { cls: StrikeContact["cls"] }) {
  const c = CLS[cls];
  if (cls === "Hostile") return <path d="M0 -10L10 0 0 10 -10 0z" fill={`${c}26`} stroke={c} strokeWidth="1.6" />;
  if (cls === "Friendly") return <rect x="-13" y="-8" width="26" height="16" rx="1" fill={`${c}26`} stroke={c} strokeWidth="1.6" />;
  if (cls === "Civilian") return <rect x="-8.5" y="-8.5" width="17" height="17" fill={`${c}24`} stroke={c} strokeWidth="1.6" />;
  return <path d="M0 -9a4.5 4.5 0 014.2 2.9A4.5 4.5 0 018.1 0a4.5 4.5 0 01-3.9 6.1A4.5 4.5 0 010 9a4.5 4.5 0 01-4.2-2.9A4.5 4.5 0 01-8.1 0a4.5 4.5 0 013.9-6.1A4.5 4.5 0 010 -9z" fill={`${c}24`} stroke={c} strokeWidth="1.5" />;
}

/** The area of operations: the sector grid, the terrain's contours, the river and the road. */
export function AreaLayer() {
  const { w, h, top } = M.cell;
  return (
    <svg className="sm" viewBox={M.viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke="rgba(255,255,255,0.075)" strokeWidth="1.1">
        {M.contours.map((d) => <path key={d} d={d} />)}
      </g>
      <path d={M.river} fill="none" stroke="rgba(110,168,255,0.22)" strokeWidth="6" strokeLinecap="round" />
      <path d={M.road} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2.2" />
      <g stroke="rgba(255,255,255,0.12)" strokeWidth="1">
        {M.cols.map((_, i) => <line key={`v${i}`} x1={i * w} y1={top} x2={i * w} y2={top + M.rows.length * h} />)}
        {M.rows.map((_, i) => <line key={`h${i}`} x1={0} y1={top + i * h} x2={M.cols.length * w} y2={top + i * h} />)}
      </g>
      <g className="sm__gl">
        {M.cols.map((c, i) => <text key={c} x={i * w + w / 2} y={16}>{c}</text>)}
        {M.rows.map((r, i) => <text key={r} x={46} y={top + i * h + 42}>{r}</text>)}
      </g>
    </svg>
  );
}

/**
 * The live picture: the aircraft, its sensor's field of view and the four contacts. `mark` draws a thin
 * box and a line of text beside one contact (the finding, when there is one); `sector` outlines one grid
 * square.
 */
export function PictureLayer({ mark, sector }: { mark?: { id: string; text: string } | null; sector?: string | null }) {
  const { w, h, top } = M.cell;
  const sec = sector ? { col: M.cols.indexOf(sector[0]), row: Number(sector.slice(1)) - 1 } : null;
  const a = M.aircraft;
  return (
    <svg className="sm" viewBox={M.viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="sm-fov" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${a.x} ${a.y}) rotate(55) scale(300 170)`}>
          <stop offset="0" stopColor="rgba(190,210,235,0.16)" /><stop offset="1" stopColor="rgba(190,210,235,0)" />
        </radialGradient>
      </defs>
      {sec && sec.col >= 0 ? (
        <rect x={sec.col * w} y={top + sec.row * h} width={w} height={h} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.32)" strokeDasharray="4 5" />
      ) : null}
      <path d={M.fov} fill="url(#sm-fov)" />
      <g transform={`translate(${a.x} ${a.y})`}>
        <circle r="16" fill="none" stroke="rgba(223,231,239,0.4)" />
        <path d="M0 -9 L7 6 L0 3 L-7 6 Z" fill="#DFE7EF" />
        <text x="21" y="-6" className="sm__lab">{a.id}</text>
        <text x="21" y="8" className="sm__gl">{a.alt}</text>
      </g>
      {STRIKE_CONTACTS.map((c) => (
        <g key={c.id} transform={`translate(${c.x} ${c.y})`}>
          <Symbol cls={c.cls} />
          <text x={mark?.id === c.id ? 22 : 15} y={mark?.id === c.id ? -14 : -11} className="sm__lab">{c.id}</text>
          {mark?.id === c.id ? (
            // The flag reads leftwards, into the part of the picture the front sheet never covers.
            <g className="sm__mark">
              <rect x="-17" y="-17" width="34" height="34" rx="3" fill="none" stroke="#FF8A6A" strokeWidth="1.4" />
              <line x1="-17" y1="0" x2="-30" y2="22" stroke="#FF8A6A" strokeWidth="1.2" />
              <text x="-34" y="36" textAnchor="end" className="sm__flag">{mark.text}</text>
            </g>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
