export type SpotifyTrack = {
  uri: string;
  artist: string;
  track: string;
  album: string;
  image: string | null;
};

/** Client Credentials token — used for catalog search (no user scope needed). */
export async function getAppToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID!;
  const secret = process.env.SPOTIFY_CLIENT_SECRET!;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error_description ?? `Failed to get Spotify app token (${res.status})`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function spotifySearchTrack(
  appToken: string,
  artist: string,
  track: string
): Promise<SpotifyTrack | null> {
  async function doSearch(q: string): Promise<SpotifyTrack | null> {
    const params = new URLSearchParams({ q, type: "track", limit: "1" });
    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${appToken}` },
    });
    if (!res.ok) return null; // skip silently on any error
    const data = await res.json();
    const item = data.tracks?.items?.[0];
    if (!item) return null;
    const images: { url: string; width: number; height: number }[] =
      item.album?.images ?? [];
    return {
      uri: item.uri as string,
      artist: (item.artists?.[0]?.name as string) ?? artist,
      track: (item.name as string) ?? track,
      album: (item.album?.name as string) ?? "",
      image: images[2]?.url ?? images[0]?.url ?? null,
    };
  }

  const result = await doSearch(`track:${track} artist:${artist}`);
  if (result) return result;
  return doSearch(`${track} ${artist}`);
}

/** Batch search — 5 concurrent requests at a time to stay under rate limits. */
export async function searchAll(
  appToken: string,
  tracks: { artist: string; track: string }[]
): Promise<SpotifyTrack[]> {
  const found: SpotifyTrack[] = [];
  for (let i = 0; i < tracks.length; i += 5) {
    const batch = tracks.slice(i, i + 5);
    const results = await Promise.all(
      batch.map((t) => spotifySearchTrack(appToken, t.artist, t.track))
    );
    found.push(...(results.filter(Boolean) as SpotifyTrack[]));
  }
  return found;
}
