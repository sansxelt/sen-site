// App.jsx — Vraelis marketing site, single-product (the glasses).
//
// One product, one brand. No "Lens" or "Whisper" — the product IS Vraelis.
// Hero acts use real lifestyle/stock photography hot-linked from Unsplash;
// CinematicAct gracefully falls back to a radial-tint placeholder if any
// image fails (so the page still reads cleanly offline).

// Photo URLs — public Unsplash hotlinks. Each one is loaded at ~2000px wide
// with quality 80. If a URL fails the act falls back to its placeholderTint.
const PHOTOS = {
  // Hero — modern eyewear close-up, moody studio light
  hero:    "https://images.unsplash.com/photo-1577803645773-f96470509666?w=2000&q=80&fit=crop",
  // Capture — concert/crowd POV, the kind of moment you want to keep
  capture: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=2000&q=80&fit=crop",
  // Listen — city at night, headphones-without-headphones feeling
  listen:  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=2000&q=80&fit=crop",
  // Whisper — quiet cafe, someone in a meeting where they shouldn't speak
  whisper: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=2000&q=80&fit=crop",
};

function App() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main id="top" style={{ background: "var(--bg-0)", overflowX: "hidden" }}>
      <Header onSignIn={() => alert("Sign-in modal — prototype")} />

      {/* HERO — real photograph, bottom-center type slab. */}
      <CinematicAct
        eyebrow="VRAELIS · IN R&D"
        headline={<>See it. Hear it.<br/>Say it back.</>}
        body={<>Glasses with a 360° camera ring, near-field stereo audio only you hear, an ambient HUD layered over your sight, and on-device voice tuned to whisper.</>}
        accent="#c084fc"
        anchor="bottom-center"
        scrim="full"
        imageUrl={PHOTOS.hero}
        imageObjectPosition="center 35%"
        placeholderTint="#2a1e3a"
        showProductChips
        cta={{ label: "Join the waitlist", onClick: () => scrollTo("waitlist") }}
        minHeight="100svh"
      />

      {/* CAPTURE — 360° camera */}
      <CinematicAct
        eyebrow="360° CAPTURE"
        headline={<>Record what you saw.<br/>From every angle.</>}
        body={<>A ring of micro-cameras captures the room — not just the frame. Replay any angle later. Who was on your left, what was behind you, what the speaker pointed at.</>}
        accent="#c084fc"
        anchor="bottom-left"
        scrim="left"
        imageUrl={PHOTOS.capture}
        imageObjectPosition="center 40%"
        placeholderTint="#3a2418"
        minHeight="80vh"
      />

      {/* LISTEN — private audio */}
      <CinematicAct
        eyebrow="PRIVATE AUDIO"
        headline={<>Stereo sound,<br/>only you hear it.</>}
        body={<>Near-field bone-conducted audio delivers directional stereo to the wearer and the wearer alone. No earbuds. No leakage. The person across from you hears nothing.</>}
        accent="#22d3ee"
        anchor="bottom-right"
        scrim="right"
        imageUrl={PHOTOS.listen}
        imageObjectPosition="center"
        placeholderTint="#1a2a3a"
        minHeight="80vh"
      />

      {/* WHISPER — voice */}
      <CinematicAct
        eyebrow="VOICE · WHISPER"
        headline={<>Speak to it.<br/>Whisper if you'd rather.</>}
        body={<>A four-mic array tuned to your voice picks up sub-vocal speech and full speech alike. Reply to a message in a meeting without making a sound. Vraelis recognizes you, not the room.</>}
        accent="#a8c4ff"
        anchor="bottom-left"
        scrim="left"
        imageUrl={PHOTOS.whisper}
        imageObjectPosition="center 40%"
        placeholderTint="#1a1830"
        minHeight="80vh"
      />

      {/* Three modes */}
      <CapabilityModes />

      {/* Architecture: Glasses · Phone · Cloud */}
      <ArchitectureGrid />

      {/* Waitlist plate */}
      <WaitlistPlate />

      <Footer />
    </main>
  );
}

Object.assign(window, { App });
