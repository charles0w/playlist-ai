"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type SpotifyTrack = {
  uri: string;
  artist: string;
  track: string;
  album: string;
  image: string | null;
};

type PlaylistResult = {
  playlist_id: string;
  playlist_name: string;
  playlist_description: string;
  url: string;
  tracks: SpotifyTrack[];
};

type Vibe = { label: string; glyph: string; photo: string };

// ─────────────────────────────────────────────────────────────────────────────
// Vibes — each one points to a baked-in photo in /public/photos
// ─────────────────────────────────────────────────────────────────────────────
const VIBES: Vibe[] = [
  { label: "Late Night Drive", glyph: "◐", photo: "/photos/late-night-drive.png" },
  { label: "Morning Run",      glyph: "↗", photo: "/photos/morning-run.webp" },
  { label: "Deep Focus",       glyph: "✱", photo: "/photos/deep-focus.webp" },
  { label: "Heartbreak",       glyph: "◇", photo: "/photos/heartbreak.webp" },
  { label: "Sunday Jazz",      glyph: "♬", photo: "/photos/sunday-jazz.webp" },
  { label: "Gym Beast",        glyph: "▲", photo: "/photos/gym-beast.webp" },
  { label: "Rainy Window",     glyph: "◊", photo: "/photos/rainy-window.webp" },
  { label: "Summer Cruise",    glyph: "○", photo: "/photos/summer-cruise.webp" },
  { label: "Dinner Party",     glyph: "✺", photo: "/photos/dinner-party.webp" },
  { label: "Rooftop Sunset",   glyph: "☼", photo: "/photos/rooftop-sunset.webp" },
  { label: "Cold Plunge",      glyph: "❄", photo: "/photos/cold-plunge.webp" },
  { label: "Studio Session",   glyph: "✦", photo: "/photos/studio-session.webp" },
];

const SHIFTS: { label: string; hue: number; mono?: boolean }[] = [
  { label: "more aggressive",  hue: 12  },
  { label: "more chill",       hue: 215 },
  { label: "more emotional",   hue: 295 },
  { label: "more upbeat",      hue: 55  },
  { label: "more underground", hue: 0, mono: true },
  { label: "more melodic",     hue: 145 },
];

const LOADING_STEPS = [
  "Reading your vibe",
  "Cross-referencing 12.4M tracks",
  "Sequencing the opener",
  "Tuning the back half",
  "Smoothing the transitions",
];

const RANDOM_IDEAS = [
  "Sunday morning jazz with a window open and slow coffee",
  "Hardstyle gym session — no melody, just fists",
  "Long drive through the mountains at sunset",
  "Studio session: lo-fi beats with vinyl crackle",
  "Late night philosophy with a single lamp on",
  "Rooftop sunset, soft house, friends arriving",
  "Heartbreak walk home, slow strings, honest writing",
];

// ─────────────────────────────────────────────────────────────────────────────
// Generative cover art — deterministic from a string seed.
// Used for track-row album thumbs + playlist hero fallback when Spotify
// doesn't return album art.
// ─────────────────────────────────────────────────────────────────────────────
function hashString(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type ColorOK = { h: number; c: number; l: number };
function ok(c: ColorOK, alpha = 1) {
  return `oklch(${c.l} ${c.c} ${c.h} / ${alpha})`;
}

function paletteFor(seed: number) {
  const r = seededRng(seed);
  const hueA = Math.floor(r() * 360);
  const hueB = (hueA + 60 + Math.floor(r() * 120)) % 360;
  const green: ColorOK = { h: 145, c: 0.16, l: 0.62 };
  const a: ColorOK = { h: hueA, c: 0.16 + r() * 0.06, l: 0.55 + r() * 0.15 };
  const b: ColorOK = { h: hueB, c: 0.14 + r() * 0.06, l: 0.45 + r() * 0.18 };
  const base: ColorOK = { h: (hueA + 240) % 360, c: 0.04, l: 0.08 };
  return { green, a, b, base, r };
}

type CoverStyle = "mesh" | "orbit";

function GenerativeCover({
  seed,
  size = 144,
  style = "mesh",
  animated = false,
}: {
  seed: string;
  size?: number;
  style?: CoverStyle;
  animated?: boolean;
}) {
  const h = hashString(seed || "Untitled");
  const pal = paletteFor(h);
  const r = seededRng(h ^ 0x9e3779b9);

  if (style === "orbit") {
    const rings = [0.4, 0.6, 0.82, 1.05];
    return (
      <div
        className="gen-cover"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 50% 55%, ${ok(pal.a, 0.4)} 0%, #050509 70%)`,
          position: "relative",
        }}
        aria-hidden
      >
        {rings.map((rad, i) => (
          <div
            key={i}
            className={animated ? "gen-ring gen-ring--anim" : "gen-ring"}
            style={{
              width: `${rad * 100}%`,
              height: `${rad * 100}%`,
              border: `1px solid ${ok(pal.green, 0.18 + (rings.length - i) * 0.05)}`,
              animationDelay: `${i * -4}s`,
            }}
          />
        ))}
        <div
          className="gen-nucleus"
          style={{
            background: `radial-gradient(circle, ${ok(pal.green, 1)} 0%, ${ok(pal.a, 0.6)} 40%, transparent 70%)`,
            boxShadow: `0 0 60px ${ok(pal.green, 0.6)}`,
          }}
        />
      </div>
    );
  }

  // mesh (default)
  const angle = Math.floor(r() * 360);
  return (
    <div
      className="gen-cover"
      style={{
        width: size,
        height: size,
        background: `
          linear-gradient(${angle}deg, ${ok(pal.green, 0.7)} 0%, ${ok(pal.a, 0.7)} 50%, ${ok(pal.b, 0.7)} 100%),
          radial-gradient(circle at 30% 20%, ${ok(pal.green, 0.6)} 0%, transparent 50%),
          radial-gradient(circle at 75% 80%, ${ok(pal.b, 0.6)} 0%, transparent 60%),
          #060608
        `,
        backgroundBlendMode: "screen, screen, screen, normal",
      }}
      aria-hidden
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons + branding
// ─────────────────────────────────────────────────────────────────────────────
function SpotifyMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <div className="wordmark">
      <span className="wordmark__icon" style={{ width: size + 6, height: size + 6 }}>
        <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" aria-hidden>
          <rect x="4"  y="9"  width="3" height="6"  rx="1.2" fill="currentColor" />
          <rect x="9"  y="5"  width="3" height="14" rx="1.2" fill="currentColor" />
          <rect x="14" y="8"  width="3" height="8"  rx="1.2" fill="currentColor" />
          <rect x="19" y="11" width="3" height="2"  rx="1"   fill="currentColor" />
        </svg>
      </span>
      <span className="wordmark__text" style={{ fontSize: size * 0.85 }}>Playlist AI</span>
    </div>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" opacity={0.18} />
      <path d="M21 12 a9 9 0 0 0 -9 -9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Sparkle({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z" fill="currentColor" />
    </svg>
  );
}

const ICONS = {
  play: (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  ),
  heart: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-4.5-9.5-9C.8 8.6 2.7 5 6 5c2 0 3.2 1 4 2.4C10.8 6 12 5 14 5c3.3 0 5.2 3.6 3.5 7-2.5 4.5-9.5 9-9.5 9z" />
    </svg>
  ),
  heartFilled: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-7-4.5-9.5-9C.8 8.6 2.7 5 6 5c2 0 3.2 1 4 2.4C10.8 6 12 5 14 5c3.3 0 5.2 3.6 3.5 7-2.5 4.5-9.5 9-9.5 9z" />
    </svg>
  ),
  more: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx={5} cy={12} r={1.6} /><circle cx={12} cy={12} r={1.6} /><circle cx={19} cy={12} r={1.6} />
    </svg>
  ),
  download: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" />
    </svg>
  ),
  copy: (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={9} y={9} width={13} height={13} rx={2} />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  checkSmall: (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  list: (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1={3} y1={6} x2={21} y2={6} /><line x1={3} y1={12} x2={21} y2={12} /><line x1={3} y1={18} x2={21} y2={18} />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function TopBar({ authed, userName }: { authed: boolean; userName: string }) {
  return (
    <header className="topbar">
      <Wordmark size={20} />
      <div className="topbar__right">
        <div className="topbar__pill" title="Spotify integration">
          <SpotifyMark size={12} />
          <span>{authed ? "Connected" : "Not connected"}</span>
          <span className={`dot ${authed ? "dot--on" : "dot--off"}`} />
        </div>
        {authed && (
          <>
            <span className="dim" style={{ fontSize: 12, fontWeight: 600 }}>{userName}</span>
            <a className="link" href="/api/auth/logout">logout</a>
          </>
        )}
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="eyebrow">
        <span className="eyebrow__dot" />
        <span>Powered by Claude · Spotify</span>
      </div>
      <h1 className="display">
        Describe a vibe. <em>Get a perfect playlist.</em>
      </h1>
      <p className="sub">
        Type what you&apos;re in the mood for. A small, attentive AI listens to a few
        words and composes a Spotify playlist that actually feels like you meant it.
      </p>
    </section>
  );
}

function AuthGate() {
  return (
    <div className="auth-card">
      <GenerativeCover seed="connect-spotify" size={140} style="mesh" />
      <div className="auth-card__body">
        <div className="mono up dim">Step 01</div>
        <h2 className="display display--sm">Link your Spotify.</h2>
        <p className="sub sub--sm">
          Strict minimum permissions — we create one playlist when you ask, and
          nothing else. Disconnect anytime.
        </p>
        <ul className="auth-list">
          <li><span className="check" /> Creates one playlist when you ask.</li>
          <li><span className="check" /> Never plays, scrobbles, or shares.</li>
          <li><span className="check" /> Token lives only in your session.</li>
        </ul>
        <a href="/api/auth/spotify" className="btn btn--green btn--lg" style={{ alignSelf: "flex-start" }}>
          <SpotifyMark size={16} />
          Connect with Spotify
        </a>
      </div>
    </div>
  );
}

function VibeCarousel({
  selected,
  onSelect,
  busy,
}: {
  selected: string;
  onSelect: (v: string) => void;
  busy: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  function scrollBy(dir: number) {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector(".vibe-card") as HTMLElement | null;
    const step = (card ? card.offsetWidth + 12 : 160) * 3 * dir;
    rail.scrollBy({ left: step, behavior: "smooth" });
  }
  return (
    <div className="vibes">
      <div className="vibes__head">
        <div className="vibes__title">Pick a vibe</div>
        <div className="vibes__nav">
          <button className="vibes__arrow" onClick={() => scrollBy(-1)} aria-label="Scroll left" disabled={busy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button className="vibes__arrow" onClick={() => scrollBy(1)} aria-label="Scroll right" disabled={busy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>
      <div className="vibes__rail no-scrollbar" ref={railRef}>
        {VIBES.map((v) => {
          const on = selected === v.label;
          return (
            <button
              key={v.label}
              className={`vibe-card ${on ? "vibe-card--on" : ""}`}
              onClick={() => onSelect(v.label)}
              disabled={busy}
              type="button"
            >
              <div className="vibe-card__art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.photo} alt="" className="vibe-card__photo" />
                <div className="vibe-card__shade" aria-hidden />
                <div className="vibe-card__glyph mono">{v.glyph}</div>
                {on && (
                  <div className="vibe-card__check" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                )}
              </div>
              <div className="vibe-card__label">{v.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Composer({
  mood,
  setMood,
  onGenerate,
  busy,
}: {
  mood: string;
  setMood: (s: string) => void;
  onGenerate: () => void;
  busy: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.max(86, taRef.current.scrollHeight) + "px";
  }, [mood]);

  function randomSuggestion() {
    return RANDOM_IDEAS[Math.floor(Math.random() * RANDOM_IDEAS.length)];
  }

  return (
    <div className="composer">
      <VibeCarousel selected={mood} onSelect={setMood} busy={busy} />
      <div className={`field ${busy ? "field--busy" : ""}`}>
        <textarea
          ref={taRef}
          className="field__input"
          value={mood}
          placeholder={"a long drive through the mountains at sunset, mostly instrumental"}
          onChange={(e) => setMood(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onGenerate();
            }
          }}
          disabled={busy}
          rows={3}
        />
        <div className="field__row">
          <div className="field__hints">
            <button type="button" className="ghost-btn" onClick={() => setMood(randomSuggestion())} disabled={busy}>
              <span className="dice">⤬</span>&nbsp;surprise me
            </button>
            <span className="dim" style={{ fontSize: 12 }}>⏎ to generate · ⇧⏎ for new line</span>
          </div>
          <button className="btn btn--green" disabled={busy || !mood.trim()} onClick={onGenerate}>
            {busy ? <><Spinner size={14} /> Composing</> : <>Compose <Sparkle size={13} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingPanel({ mood }: { mood: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="loading-card">
      <GenerativeCover seed={mood || "loading"} size={120} style="orbit" animated />
      <div className="loading-card__body">
        <div className="mono up dim">Composing</div>
        <div className="loading-steps">
          {LOADING_STEPS.map((s, i) => (
            <div key={s} className={`loading-step ${i < step ? "done" : i === step ? "active" : "queued"}`}>
              <span className="loading-step__bullet">
                {i < step ? "●" : i === step ? <Spinner size={11} /> : "○"}
              </span>
              <span>{s}{i === step ? "…" : ""}</span>
            </div>
          ))}
        </div>
        <div className="loading-bar"><div className="loading-bar__fill" /></div>
      </div>
    </div>
  );
}

function PlaylistHero({
  playlist,
  allTracks,
  vibePhoto,
  onCopy,
  copied,
  saved,
  onSave,
  lastAction,
}: {
  playlist: PlaylistResult;
  allTracks: SpotifyTrack[];
  vibePhoto: string | null;
  onCopy: () => void;
  copied: boolean;
  saved: boolean;
  onSave: () => void;
  lastAction: string;
}) {
  const min = Math.round(allTracks.length * 3.4);
  return (
    <>
      <div className="ph">
        <div className="ph__art-wrap">
          {vibePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vibePhoto} alt="" className="ph__art-photo" />
          ) : (
            <GenerativeCover seed={playlist.playlist_name} size={232} style="mesh" />
          )}
        </div>
        <div className="ph__meta">
          <div className="ph__kicker">Playlist</div>
          <h2 className="ph__name">{playlist.playlist_name}</h2>
          <p className="ph__desc">{playlist.playlist_description}</p>
          <div className="ph__stats">
            <span>Claude · Sonnet</span>
            <span className="ph__stats__bullet">•</span>
            <span className="dim">{allTracks.length} songs</span>
            <span className="ph__stats__bullet">•</span>
            <span className="dim">
              {Math.floor(min / 60) > 0 ? `${Math.floor(min / 60)} hr ` : ""}{min % 60} min
            </span>
          </div>
          {lastAction && (
            <div className="toast">
              <span className="toast__dot" />
              {lastAction}
            </div>
          )}
        </div>
      </div>
      <div className="actions">
        <a className="actions__play" title="Open in Spotify" href={playlist.url} target="_blank" rel="noopener noreferrer">
          {ICONS.play}
        </a>
        <button className={`actions__icon ${saved ? "is-on" : ""}`} title={saved ? "Saved" : "Save"} onClick={onSave}>
          {saved ? ICONS.heartFilled : ICONS.heart}
        </button>
        <button className="actions__icon" title="Open" onClick={() => window.open(playlist.url, "_blank")}>
          {ICONS.download}
        </button>
        <button className="actions__icon" title="Copy link" onClick={onCopy}>
          {copied ? ICONS.checkSmall : ICONS.copy}
        </button>
        <button className="actions__icon" title="More">
          {ICONS.more}
        </button>
        <div className="actions__spacer" />
        <button className="actions__view">
          List {ICONS.list}
        </button>
      </div>
    </>
  );
}

function AdjustPanel({
  onAddMore,
  onTrending,
  onShift,
  expanding,
}: {
  onAddMore: () => void;
  onTrending: () => void;
  onShift: (label: string) => void;
  expanding: string | null;
}) {
  return (
    <div className="adjust">
      <div className="adjust__row">
        <div className="adjust__label">Add</div>
        <div className="adjust__chips">
          <button className="adjust-pill adjust-pill--add" onClick={onAddMore} disabled={!!expanding}>
            {expanding === "more" ? <><Spinner size={11} /> Adding</> : <>+ 15 more songs</>}
          </button>
          <button className="adjust-pill adjust-pill--add" onClick={onTrending} disabled={!!expanding}>
            {expanding === "trending" ? <><Spinner size={11} /> Loading</> : <>↗ Trending picks</>}
          </button>
        </div>
      </div>
      <div className="adjust__row">
        <div className="adjust__label">Shift</div>
        <div className="adjust__chips">
          {SHIFTS.map((s) => {
            const c = s.mono ? "#ffffff" : `oklch(0.78 0.15 ${s.hue})`;
            const isOn = expanding === s.label;
            return (
              <button
                key={s.label}
                className="adjust-pill"
                style={{ ["--c" as string]: c } as React.CSSProperties}
                onClick={() => onShift(s.label)}
                disabled={!!expanding}
              >
                <span className="adjust-pill__dot" />
                {isOn ? <Spinner size={11} /> : null}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TrackRow({ track, index, isNew }: { track: SpotifyTrack; index: number; isNew: boolean }) {
  const trackId = track.uri.split(":")[2];
  return (
    <a
      className={`tr ${isNew ? "tr--new" : ""}`}
      href={`https://open.spotify.com/track/${trackId}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="tr__num">{index + 1}</span>
      <div className="tr__art">
        {track.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.image} alt={track.album} className="tr__art-img" />
        ) : (
          <GenerativeCover seed={`${track.artist}-${track.album}`} size={44} style="mesh" />
        )}
      </div>
      <div className="tr__title-block">
        <div className="tr__title">{track.track}</div>
        <div className="tr__artist">{track.artist}</div>
      </div>
      <div className="tr__album">{track.album}</div>
      <span className="tr__len">{/* duration not returned by API */ "—"}</span>
    </a>
  );
}

function TrackList({ tracks, newSet }: { tracks: SpotifyTrack[]; newSet: Set<number> }) {
  return (
    <div className="tracks">
      <div className="tracks__head">
        <div className="tracks__head__num">#</div>
        <div></div>
        <div>Title</div>
        <div className="tracks__head__album">Album</div>
        <div className="tracks__head__dur">⏱</div>
      </div>
      <div className="tracks__list">
        {tracks.map((t, i) => (
          <TrackRow key={`${t.uri}-${i}`} track={t} index={i} isNew={newSet.has(i)} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page — wires real API endpoints (/api/me, /api/create, /api/expand)
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [authed, setAuthed]       = useState<boolean | null>(null);
  const [userName, setUserName]   = useState("");
  const [mood, setMood]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<PlaylistResult | null>(null);
  const [allTracks, setAllTracks] = useState<SpotifyTrack[]>([]);
  const [newIdxSet, setNewIdxSet] = useState<Set<number>>(new Set());
  const [expanding, setExpanding] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [lastAction, setLast]     = useState("");
  const [error, setError]         = useState("");

  const matchedVibe = VIBES.find((v) => v.label.toLowerCase() === mood.toLowerCase());
  const heroPhoto = matchedVibe?.photo || null;

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d: { authed: boolean; name?: string }) => {
        setAuthed(!!d.authed);
        if (d.name) setUserName(d.name);
      })
      .catch(() => setAuthed(false));
  }, []);

  async function doGenerate() {
    if (!mood.trim()) return;
    setLoading(true);
    setResult(null);
    setAllTracks([]);
    setNewIdxSet(new Set());
    setLast("");
    setError("");
    try {
      const res = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood }),
      });
      const data = await res.json();
      if (res.status === 401 && data.error === "reauth") { window.location.href = "/api/auth/spotify"; return; }
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      const r = data as PlaylistResult;
      setResult(r);
      setAllTracks(r.tracks);
      setLast(`${r.tracks.length} tracks added`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function doExpand(label: string, isShift: boolean) {
    if (!result) return;
    setExpanding(label);
    setLast("");
    setError("");
    try {
      const body = isShift
        ? { playlist_id: result.playlist_id, mood, existing: allTracks.map((t) => `${t.artist} - ${t.track}`), type: "shift", shift: label }
        : { playlist_id: result.playlist_id, mood, existing: allTracks.map((t) => `${t.artist} - ${t.track}`), type: label };

      const res = await fetch("/api/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 401 && data.error === "reauth") { window.location.href = "/api/auth/spotify"; return; }
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      const newTracks = data.tracks as SpotifyTrack[];
      const startIdx = allTracks.length;
      setAllTracks((prev) => [...prev, ...newTracks]);
      setNewIdxSet(new Set(newTracks.map((_, i) => startIdx + i)));

      if (isShift) {
        setLast(data.shift_description ?? `shifted ${label} · +${newTracks.length}`);
      } else if (label === "more") {
        setLast(`+${newTracks.length} more songs added`);
      } else {
        setLast(`+${newTracks.length} trending picks added`);
      }
      setTimeout(() => setNewIdxSet(new Set()), 2400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setExpanding(null);
    }
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(result.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="shell">
      <TopBar authed={!!authed} userName={userName} />

      <main className="main">
        {authed === null && (
          <div className="dim" style={{ textAlign: "center", padding: 40 }}>Loading…</div>
        )}

        {authed === false && (
          <>
            <Hero />
            <AuthGate />
          </>
        )}

        {authed && !loading && !result && (
          <>
            <Hero />
            <Composer
              mood={mood}
              setMood={setMood}
              onGenerate={doGenerate}
              busy={false}
            />
            {error && <div className="error-card">{error}</div>}
          </>
        )}

        {authed && loading && <LoadingPanel mood={mood} />}

        {authed && !loading && result && (
          <div className="result">
            <div className="result-card">
              <PlaylistHero
                playlist={result}
                allTracks={allTracks}
                vibePhoto={heroPhoto}
                onCopy={copyLink}
                copied={copied}
                saved={saved}
                onSave={() => setSaved((s) => !s)}
                lastAction={lastAction}
              />
              <AdjustPanel
                onAddMore={() => doExpand("more", false)}
                onTrending={() => doExpand("trending", false)}
                onShift={(l) => doExpand(l, true)}
                expanding={expanding}
              />
              <TrackList tracks={allTracks} newSet={newIdxSet} />
            </div>
            {error && <div className="error-card">{error}</div>}
            <button
              className="reset-btn"
              onClick={() => { setResult(null); setAllTracks([]); setMood(""); setLast(""); }}
            >
              ← Start a new playlist
            </button>
          </div>
        )}
      </main>

      <footer className="foot dim" style={{ fontSize: 12 }}>
        <span>Playlist AI</span>
        <span style={{ opacity: 0.5, padding: "0 0.5em" }}>·</span>
        <span>built with Claude + Spotify</span>
      </footer>
    </div>
  );
}
