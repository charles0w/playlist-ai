import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const jar = await cookies();
  jar.delete("spotify_token");
  return NextResponse.redirect(new URL("/", process.env.SPOTIFY_REDIRECT_URI!.replace("/api/auth/callback", "")));
}
