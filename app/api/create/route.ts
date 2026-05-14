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

    const { mood } = await req.json();
    if (!mood) return NextResponse.json({ error: "missing mood" }, { status: 400 });

    // 1. Claude generates track list
    const msg = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: `You are a music curator. Create a Spotify playlist for this mood/vibe: "${mood}"

Return ONLY valid JSON (no markdown fences):
{
  "playlist_name": "short catchy name with emoji",
  "playlist_description": "one sentence description",
  "tracks": [{"artist": "Artist Name", "track": "Track Title"}, ...]
}

Rules: Exactly 25 tracks. Real songs on Spotify. Match the mood. Max 2 tracks per artist.`,
      }],
    });

    let raw = (msg.content[0] as { text: string }).text.trim();
    if (raw.startsWith("```")) {
      raw = raw.split("```")[1];
      if (raw.startsWith("json")) raw = raw.slice(4);
      raw = raw.split("```")[0].trim();
    }
    const generated = JSON.parse(raw) as {
      playlist_name: string;
      playlist_description: string;
      tracks: { artist: string; track: string }[];
    };

    // 2. Search catalog using app token (Client Credentials — no user scope needed)
    const appToken = await getAppToken();
    const foundTracks = await searchAll(appToken, generated.tracks);
    if (foundTracks.length === 0) {
      throw new Error("Spotify couldn't find any of those tracks. Try a different description.");
    }

    // 3. Create playlist using user token
    const createRes = await fetch("https://api.spotify.com/v1/me/playlists", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: generated.playlist_name,
        description: generated.playlist_description,
        public: false,
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`Create playlist (${createRes.status}): ${err.error?.message ?? "unknown error"}`);
    }
    const playlist = await createRes.json();

    // 4. Add tracks using user token
    const uris = foundTracks.map((t) => t.uri);
    for (let i = 0; i < uris.length; i += 100) {
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      });
      if (!addRes.ok) {
        const raw = await addRes.text().catch(() => "");
        throw new Error(`Add tracks (${addRes.status}): ${raw || "Forbidden"}`);
      }
    }

    return NextResponse.json({
      playlist_id: playlist.id,
      playlist_name: playlist.name,
      playlist_description: generated.playlist_description,
      url: playlist.external_urls.spotify,
      tracks: foundTracks,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
