import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const jar = await cookies();
  const token = jar.get("spotify_token")?.value;
  if (!token) return NextResponse.json({ authed: false });

  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return NextResponse.json({ authed: false });
  const user = await res.json();
  return NextResponse.json({ authed: true, name: user.display_name });
}
