import { redirect } from "next/navigation";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: "playlist-modify-public playlist-modify-private user-read-private user-read-email",
    show_dialog: "true",
  });

  redirect(`https://accounts.spotify.com/authorize?${params}`);
}
