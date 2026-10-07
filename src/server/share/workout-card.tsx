import type { WorkoutShareView } from "@/lib/share-card";

const BG = "#0a0b0d";
const SURFACE = "#121418";
const FG = "#f3f4f6";
const MUTED = "#a0a8b4";
const SUBTLE = "#6f7885";
const ACCENT = "#c8f031";

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", background: SURFACE, borderRadius: 20, padding: "20px 22px", minWidth: 160 }}>
      <div style={{ color: SUBTLE, fontSize: 18, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: FG, fontSize: 42, fontWeight: 800, marginTop: 6, letterSpacing: -1 }}>{value}</div>
    </div>
  );
}

export function WorkoutOgCard({ card }: { card: WorkoutShareView }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: FG,
        padding: 56,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
          <div style={{ color: ACCENT, fontSize: 28, fontWeight: 900, letterSpacing: 4 }}>LIFTED</div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, marginTop: 16, lineHeight: 1.05 }}>{card.title}</div>
          <div style={{ color: MUTED, fontSize: 26, marginTop: 14 }}>
            {card.displayName} · @{card.username} · {card.dateLabel}
          </div>
        </div>
        {card.prCount > 0 ? (
          <div style={{ background: ACCENT, color: BG, borderRadius: 999, padding: "10px 18px", fontSize: 22, fontWeight: 800 }}>
            {card.prCount} PR{card.prCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 36 }}>
        <StatBox label="Time" value={card.duration} />
        <StatBox label="Volume" value={card.volume} />
        <StatBox label="Sets" value={String(card.setCount)} />
        <StatBox label="Exercises" value={String(card.exerciseCount)} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: "auto", flexWrap: "wrap" }}>
        {card.highlights.slice(0, 4).map((h) => (
          <div key={h.name} style={{ display: "flex", background: SURFACE, borderRadius: 999, padding: "8px 16px", color: MUTED, fontSize: 20 }}>
            {h.name} · {h.detail}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkoutStoryCard({ card }: { card: WorkoutShareView }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: FG,
        padding: 72,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: ACCENT, fontSize: 32, fontWeight: 900, letterSpacing: 5 }}>LIFTED</div>
        {card.prCount > 0 ? (
          <div style={{ background: ACCENT, color: BG, borderRadius: 999, padding: "10px 20px", fontSize: 24, fontWeight: 800 }}>
            {card.prCount} PR{card.prCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
      <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: -2, marginTop: 36, lineHeight: 1.05 }}>{card.title}</div>
      <div style={{ color: MUTED, fontSize: 28, marginTop: 16 }}>
        {card.displayName} · @{card.username}
      </div>
      <div style={{ color: SUBTLE, fontSize: 24, marginTop: 6 }}>{card.dateLabel}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 48 }}>
        <StatBox label="Time" value={card.duration} />
        <StatBox label="Volume" value={card.volume} />
        <StatBox label="Sets" value={`${card.setCount}`} />
        <StatBox label="Reps" value={`${card.repCount}`} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 48 }}>
        {card.highlights.slice(0, 6).map((h) => (
          <div key={h.name} style={{ display: "flex", justifyContent: "space-between", background: SURFACE, borderRadius: 18, padding: "18px 22px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{h.name}</div>
              <div style={{ color: SUBTLE, fontSize: 20, marginTop: 4 }}>{h.sets} sets</div>
            </div>
            <div style={{ color: ACCENT, fontSize: 28, fontWeight: 800 }}>{h.detail}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto", color: SUBTLE, fontSize: 22 }}>{card.publicUrl.replace(/^https?:\/\//, "")}</div>
    </div>
  );
}

export function GenericOgCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: BG,
        color: ACCENT,
        padding: 80,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 6 }}>LIFTED</div>
      <div style={{ color: FG, fontSize: 64, fontWeight: 800, marginTop: 16, letterSpacing: -2 }}>A workout on Lifted</div>
      <div style={{ color: MUTED, fontSize: 28, marginTop: 12 }}>Sign in to see the details.</div>
    </div>
  );
}
