import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const REQUIRED_SCOPES = ["playlist-modify-public", "playlist-modify-private"];

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?error=denied", req.url));

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body,
  });

  const data = await res.json();
  if (!data.access_token) return NextResponse.redirect(new URL("/?error=token", req.url));

  // Verify Spotify actually granted the scopes we need.
  // If not (e.g. stale auth from before scopes were added), force re-auth.
  const granted = (data.scope as string ?? "").split(" ");
  const missing = REQUIRED_SCOPES.filter((s) => !granted.includes(s));
  if (missing.length > 0) {
    return NextResponse.redirect(new URL("/?error=permissions", req.url));
  }

  const jar = await cookies();
  jar.set("spotify_token", data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: data.expires_in,
    path: "/",
  });

  return NextResponse.redirect(new URL("/", req.url));
}
