import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { mood, existing = [], shift } = await req.json();

  const msg = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Playlist vibe: "${mood}". Now shift it to be: ${shift}

Already in playlist (do NOT repeat):
${existing.join("\n")}

Return ONLY valid JSON: {"shift_description": "one sentence", "tracks": [{"artist": "...", "track": "..."}, ...]}
Rules: Exactly 15 tracks. Real songs on Spotify. No repeats. Max 1 per artist.`,
    }],
  });

  let raw = (msg.content[0] as { text: string }).text.trim();
  if (raw.startsWith("```")) { raw = raw.split("```")[1]; if (raw.startsWith("json")) raw = raw.slice(4); raw = raw.split("```")[0].trim(); }
  return NextResponse.json(JSON.parse(raw));
}
