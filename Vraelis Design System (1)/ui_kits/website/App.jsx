// App.jsx — Vraelis v3 (instrument-grade dark).

function App() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const joinWaitlist = () => scrollTo("top"); // signup lives in the hero now

  return (
    <main id="product">
      <InstrumentBar />
      <Nav onJoin={joinWaitlist} />
      <Hero onJoin={joinWaitlist} />
      <ManifestoBlock />

      <FeatureRow
        index={1}
        label="Record"
        icon="ph-video-camera"
        headline={<>Eight cameras.<br/>One memory.</>}
        body="A ring of micro-cameras captures the room — not just the frame. Replay any angle later. Who was on your left, what was behind you, what the speaker pointed at."
        specs={[
          { label: "Array",       value: "8 × micro-camera" },
          { label: "Coverage",    value: "360° horizontal" },
          { label: "Resolution",  value: "4K per stream" },
        ]}
        diagram={<RecordDiagram />}
      />

      <FeatureRow
        index={2}
        label="Listen"
        icon="ph-headphones"
        headline={<>Stereo audio.<br/>Only <span className="em">you</span> hear it.</>}
        body="Near-field bone-conducted audio delivers directional stereo to the wearer and the wearer alone. No earbuds. No leakage. The person across from you hears nothing."
        specs={[
          { label: "Output",   value: "Bone-conducted stereo" },
          { label: "Leakage",  value: "Inaudible @ 30 cm" },
          { label: "Latency",  value: "< 20 ms" },
        ]}
        diagram={<ListenDiagram />}
        reverse
      />

      <FeatureRow
        index={3}
        label="Speak"
        icon="ph-microphone"
        headline={<>Talk to it.<br/>Or just whisper.</>}
        body="A four-mic array tuned to your voice picks up sub-vocal speech and full speech alike. Reply to a message in a meeting without making a sound. Vraelis recognizes you, not the room."
        specs={[
          { label: "Microphones", value: "4 × beamformed array" },
          { label: "Threshold",   value: "26 dB SPL · whisper" },
          { label: "Identity",    value: "Voiceprint-locked" },
        ]}
        diagram={<SpeakDiagram />}
      />

      <FeatureRow
        index={4}
        label="See"
        icon="ph-eye"
        headline={<>An ambient display<br/><span className="em">over your sight.</span></>}
        body="A transparent waveguide layers a soft heads-up display in your peripheral. Captions, directions, replies. Big enough to read, quiet enough to ignore."
        specs={[
          { label: "Type",        value: "Transparent waveguide" },
          { label: "Field",       value: "28° diagonal" },
          { label: "Brightness",  value: "3,500 nits peak" },
        ]}
        diagram={<SeeDiagram />}
        reverse
      />

      <Spec />
      <SiteFooter />
    </main>
  );
}

Object.assign(window, { App });
