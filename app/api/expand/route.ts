import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { getAppToken, searchAll } from "../_spotify";

export const maxDuration = 60;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const userToken = jar.get("spotify_token")?.value;
    if (!userToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { playlist_id, mood, existing = [], type, shift } = await req.json();
    if (!playlist_id || !mood || !type) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    let prompt: string;
    if (type === "more") {
      prompt = `Add 15 more songs to a playlist with this mood: "${mood}"

Already in playlist (do NOT repeat):
${existing.join("\n")}

Return ONLY valid JSON (no markdown fences): {"tracks": [{"artist": "...", "track": "..."}, ...]}
Rules: Exactly 15 tracks. Real songs on Spotify. No repeats. Max 1 per artist.`;
    } else if (type === "trending") {
      prompt = `Find 15 trending/viral songs (2022-2025) matching this mood: "${mood}"

Already in playlist (do NOT repeat):
${existing.join("\n")}

Return ONLY valid JSON (no markdown fences): {"tracks": [{"artist": "...", "track": "..."}, ...]}
Rules: Exactly 15 tracks. Prioritize viral/TikTok/charting songs. Real songs on Spotify. No repeats. Max 1 per artist.`;
    } else if (type === "shift") {
      prompt = `Playlist vibe: "${mood}". Now shift it to be: ${shift}

Already in playlist (do NOT repeat):
${existing.join("\n")}

Return ONLY valid JSON (no markdown fences): {"shift_description": "one sentence", "tracks": [{"artist": "...", "track": "..."}, ...]}
Rules: Exactly 15 tracks. Real songs on Spotify. No repeats. Max 1 per artist.`;
    } else {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }

    const msg = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    if (msg.stop_reason === "max_tokens") {
      throw new Error("Claude response was truncated. Please try again.");
    }

    let raw = (msg.content[0] as { text: string }).text.trim();
    if (raw.startsWith("```")) {
      raw = raw.split("```")[1];
      if (raw.startsWith("json")) raw = raw.slice(4);
      raw = raw.split("```")[0].trim();
    }
    let generated: { tracks: { artist: string; track: string }[]; shift_description?: string };
    try {
      generated = JSON.parse(raw);
    } catch {
      throw new Error("Claude returned invalid JSON. Please try again.");
    }
    // Search using Client Credentials app token
    const appToken = await getAppToken();
    const foundTracks = await searchAll(appToken, generated.tracks);
    const uris = foundTracks.map((t) => t.uri);

    // Add to playlist using user token
    if (uris.length > 0) {
      for (let i = 0; i < uris.length; i += 100) {
        const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
        });
        if (!addRes.ok) {
          if (addRes.status === 403) {
            jar.delete("spotify_token");
            return NextResponse.json({ error: "reauth" }, { status: 401 });
          }
          const raw = await addRes.text().catch(() => "");
          throw new Error(`Add tracks (${addRes.status}): ${raw || "unknown error"}`);
        }
      }
    }

    return NextResponse.json({
      tracks: foundTracks,
      ...(generated.shift_description ? { shift_description: generated.shift_description } : {}),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
