import { createSelector } from "reselect";
import type { RootState } from "../index";

export const selectPlayerState = (state: RootState) => state.player;

export const selectCurrentTrack = createSelector(
  selectPlayerState,
  (p) => p.currentTrack,
);

export const selectIsPlaying = createSelector(
  selectPlayerState,
  (p) => p.isPlaying,
);

export const selectPosition = createSelector(
  selectPlayerState,
  (p) => p.position,
);

export const selectDuration = createSelector(
  selectPlayerState,
  (p) => p.duration,
);

export const selectQueue = createSelector(selectPlayerState, (p) => p.queue);
export const selectShuffleOn = createSelector(
  selectPlayerState,
  (p) => p.shuffleOn,
);
export const selectRepeatMode = createSelector(
  selectPlayerState,
  (p) => p.repeatMode,
);
