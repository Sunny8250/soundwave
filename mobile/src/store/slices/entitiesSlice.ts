import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "../index";

interface Track {
  id: string;
  title: string;
  duration_ms?: number;
  cover_art_url?: string;
  file_url?: string;
  album_id?: string | null;
  artist_ids?: string[];
}

interface Artist {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface Album {
  id: string;
  title: string;
  cover_art_url?: string | null;
  artist_id?: string | null;
}

const tracksAdapter = createEntityAdapter<Track, string>({
  selectId: (t) => t.id,
});
const artistsAdapter = createEntityAdapter<Artist, string>({
  selectId: (a) => a.id,
});
const albumsAdapter = createEntityAdapter<Album, string>({
  selectId: (a) => a.id,
});

const entitiesSlice = createSlice({
  name: "entities",
  initialState: {
    tracks: tracksAdapter.getInitialState(),
    artists: artistsAdapter.getInitialState(),
    albums: albumsAdapter.getInitialState(),
  },
  reducers: {
    upsertTracks(state, action) {
      tracksAdapter.upsertMany(state.tracks, action.payload);
    },
    upsertTrack(state, action) {
      tracksAdapter.upsertOne(state.tracks, action.payload);
    },
    removeTrack(state, action) {
      tracksAdapter.removeOne(state.tracks, action.payload);
    },
    upsertArtists(state, action) {
      artistsAdapter.upsertMany(state.artists, action.payload);
    },
    upsertAlbums(state, action) {
      albumsAdapter.upsertMany(state.albums, action.payload);
    },
  },
});

export const {
  upsertTracks,
  upsertTrack,
  removeTrack,
  upsertArtists,
  upsertAlbums,
} = entitiesSlice.actions;

export const tracksSelectors = tracksAdapter.getSelectors<RootState>(
  (state) => state.entities.tracks,
);
export const artistsSelectors = artistsAdapter.getSelectors<RootState>(
  (state) => state.entities.artists,
);
export const albumsSelectors = albumsAdapter.getSelectors<RootState>(
  (state) => state.entities.albums,
);

export default entitiesSlice.reducer;
