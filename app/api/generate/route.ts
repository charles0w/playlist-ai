import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NUM_TRACKS = 30;

export async function POST(req: NextRequest) {
  const { mood } = await req.json();
  if (!mood) return NextResponse.json({ error: "missing mood" }, { status: 400 });

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

Rules: Exactly ${NUM_TRACKS} tracks. Real songs on Spotify. Match the mood. Max 2 tracks per artist.`,
    }],
  });

  let raw = (msg.content[0] as { text: string }).text.trim();
  if (raw.startsWith("```")) { raw = raw.split("```")[1]; if (raw.startsWith("json")) raw = raw.slice(4); raw = raw.split("```")[0].trim(); }

  return NextResponse.json(JSON.parse(raw));
}
