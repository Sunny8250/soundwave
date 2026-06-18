import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Track {
  id: string;
  title: string;
  duration_ms: number;
  artists?: { id?: string; name: string; avatar_url?: string | null };
  track_artists?: {
    role?: string;
    artists?: { id?: string; name?: string; avatar_url?: string | null } | null;
  }[];
  albums: { cover_art_url?: string };
  cover_art_url?: string;
  file_url?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  position: number;
  duration: number;
  isLoading: boolean;
  shuffleOn: boolean;
  repeatMode: "off" | "track" | "queue";
}

const initialState: PlayerState = {
  currentTrack: null,
  queue: [],
  isPlaying: false,
  position: 0,
  duration: 0,
  isLoading: false,
  shuffleOn: false,
  repeatMode: "off",
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    setCurrentTrack(state, action: PayloadAction<Track>) {
      state.currentTrack = action.payload;
      state.position = 0;
      state.isLoading = true;
    },
    setQueue(state, action: PayloadAction<Track[]>) {
      state.queue = action.payload;
    },
    addToQueue(state, action: PayloadAction<Track[]>) {
      state.queue.push(...action.payload);
    },
    playNext(state) {
      if (!state.currentTrack || state.queue.length === 0) return;
      const idx = state.queue.findIndex((t) => t.id === state.currentTrack!.id);
      if (idx < state.queue.length - 1) {
        state.currentTrack = state.queue[idx + 1];
      }
    },
    setIsPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    setPosition(state, action: PayloadAction<number>) {
      state.position = action.payload;
    },
    setDuration(state, action: PayloadAction<number>) {
      state.duration = action.payload;
    },
    setIsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    toggleShuffle(state) {
      state.shuffleOn = !state.shuffleOn;
    },
    toggleRepeat(state) {
      const modes: ("off" | "track" | "queue")[] = ["off", "track", "queue"];
      const idx = modes.indexOf(state.repeatMode);
      state.repeatMode = modes[(idx + 1) % modes.length];
    },
    clearPlayer(state) {
      state.currentTrack = null;
      state.isPlaying = false;
      state.position = 0;
      state.duration = 0;
    },
  },
});

export const {
  setCurrentTrack,
  setQueue,
  addToQueue,
  playNext,
  setIsPlaying,
  setPosition,
  setDuration,
  setIsLoading,
  toggleShuffle,
  toggleRepeat,
  clearPlayer,
} = playerSlice.actions;
export default playerSlice.reducer;
