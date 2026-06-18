import { createSelector } from "reselect";
import type { RootState } from "../index";

// Basic selectors
export const selectTracksEntities = (state: RootState) =>
  state.entities.tracks.entities;
export const selectArtistsEntities = (state: RootState) =>
  state.entities.artists.entities;
export const selectAlbumsEntities = (state: RootState) =>
  state.entities.albums.entities;

// Memoized list of tracks as array
export const selectTracksArray = createSelector(
  selectTracksEntities,
  (tracks) => Object.values(tracks || {}),
);

// Denormalized track with artist and album data
export const selectDenormalizedTrack = (trackId: string) =>
  createSelector(
    selectTracksEntities,
    selectArtistsEntities,
    selectAlbumsEntities,
    (tracks, artists, albums) => {
      const t = tracks?.[trackId];
      if (!t) return null;
      const artistObjs = (t.artist_ids || [])
        .map((id: string) => artists?.[id])
        .filter(Boolean);
      const albumObj = t.album_id ? albums?.[t.album_id] : null;
      return { ...t, artists: artistObjs, album: albumObj };
    },
  );

export const selectTracksForArtist = (artistId: string) =>
  createSelector(selectTracksArray, (tracks) =>
    tracks.filter((t: any) => (t.artist_ids || []).includes(artistId)),
  );
