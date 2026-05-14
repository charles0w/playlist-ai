import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const userToken = jar.get("spotify_token")?.value;
    if (!userToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { playlist_id, uris } = await req.json();
    if (!playlist_id || !Array.isArray(uris) || uris.length === 0) {
      return NextResponse.json({ error: "missing playlist_id or uris" }, { status: 400 });
    }

    for (let i = 0; i < uris.length; i += 100) {
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      });
      if (!addRes.ok) {
        const body = await addRes.json().catch(() => ({}));
        throw new Error(`Spotify ${addRes.status}: ${body?.error?.message ?? "unknown error"}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
