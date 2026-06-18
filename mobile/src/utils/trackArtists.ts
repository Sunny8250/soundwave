export interface TrackArtistCredit {
  role?: string;
  artists?: {
    id?: string;
    name?: string;
    avatar_url?: string | null;
  } | null;
}

export interface TrackArtistLike {
  artists?: {
    id?: string;
    name?: string;
    avatar_url?: string | null;
  } | null;
  track_artists?: TrackArtistCredit[] | null;
}

export const getTrackArtistNames = (
  track?: TrackArtistLike | null,
  fallback = "Unknown Artist",
) => {
  const names =
    track?.track_artists
      ?.map((credit) => credit.artists?.name?.trim())
      .filter((name): name is string => !!name) || [];

  const uniqueNames = names.filter(
    (name, index) =>
      names.findIndex((item) => item.toLowerCase() === name.toLowerCase()) ===
      index,
  );

  if (uniqueNames.length > 0) return uniqueNames.join(", ");
  return track?.artists?.name || fallback;
};

export const getTrackArtistAvatar = (track?: TrackArtistLike | null) =>
  track?.track_artists?.find((credit) => credit.artists?.avatar_url)?.artists
    ?.avatar_url ||
  track?.artists?.avatar_url ||
  undefined;
