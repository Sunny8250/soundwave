import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./useAppDispatch";
import {
  setCurrentTrack,
  setIsPlaying,
  setPosition,
  setDuration,
  setIsLoading,
  setQueue,
} from "../store/slices/playerSlice";
import { api } from "../services/api";
import { audioPlayer } from "../services/audioPlayer";
import {
  selectCurrentTrack,
  selectIsPlaying,
  selectPosition,
  selectDuration,
  selectQueue,
  selectShuffleOn,
  selectRepeatMode,
} from "../store/selectors/playerSelectors";

export const usePlayer = () => {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const isPlaying = useAppSelector(selectIsPlaying);
  const position = useAppSelector(selectPosition);
  const duration = useAppSelector(selectDuration);
  const queue = useAppSelector(selectQueue);
  const shuffleOn = useAppSelector(selectShuffleOn);
  const repeatMode = useAppSelector(selectRepeatMode);

  const playTrack = useCallback(
    async (track: any) => {
      try {
        dispatch(setCurrentTrack(track));
        dispatch(setIsPlaying(false));
        dispatch(setIsLoading(true));

        const res = await api.getStreamUrl(track.id);
        if (!res.data?.url) throw new Error("No stream URL");

        await audioPlayer.play(res.data.url, (status: any) => {
          if (!status.isLoaded) return;
          dispatch(setPosition(status.positionMillis || 0));
          dispatch(setDuration(status.durationMillis || 0));
          dispatch(setIsPlaying(status.isPlaying));
          dispatch(setIsLoading(false));
        });

        dispatch(setIsPlaying(true));
        dispatch(setIsLoading(false));

        api.recordPlay(track.id, 0, false).catch(() => {});
      } catch (err) {
        console.error("playTrack error:", err);
        dispatch(setIsLoading(false));
      }
    },
    [dispatch],
  );

  const togglePlayPause = useCallback(async () => {
    if (!audioPlayer.isLoaded()) return;
    if (isPlaying) {
      await audioPlayer.pause();
      dispatch(setIsPlaying(false));
    } else {
      await audioPlayer.resume();
      dispatch(setIsPlaying(true));
    }
  }, [isPlaying, dispatch]);

  const seekTo = useCallback(
    async (positionMs: number) => {
      if (audioPlayer.isLoaded()) {
        await audioPlayer.seekTo(positionMs);
        dispatch(setPosition(positionMs));
      }
    },
    [dispatch],
  );

  // const playNext = useCallback(async () => {
  //   if (!currentTrack || queue.length === 0) return;
  //   const idx = queue.findIndex((t) => t.id === currentTrack.id);
  //   if (idx < queue.length - 1) await playTrack(queue[idx + 1]);
  // }, [currentTrack, queue, playTrack]);

  const playNext = useCallback(async () => {
    if (!currentTrack || queue.length === 0) return;
    if (repeatMode === "track") {
      await playTrack(currentTrack);
      return;
    }
    if (shuffleOn && queue.length > 1) {
      const others = queue.filter((t: any) => t.id !== currentTrack.id);
      await playTrack(others[Math.floor(Math.random() * others.length)]);
      return;
    }
    const idx = queue.findIndex((t: any) => t.id === currentTrack.id);
    if (idx !== -1 && idx < queue.length - 1) {
      await playTrack(queue[idx + 1]);
    } else if (repeatMode === "queue") {
      await playTrack(queue[0]);
    }
  }, [currentTrack, queue, repeatMode, shuffleOn, playTrack]);

  const playPrev = useCallback(async () => {
    if (!currentTrack || queue.length === 0) return;
    if (position > 3000) {
      await seekTo(0);
      return;
    }
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    if (shuffleOn && queue.length > 1) {
      const others = queue.filter((t: any) => t.id !== currentTrack.id);
      await playTrack(others[Math.floor(Math.random() * others.length)]);
    } else if (idx > 0) {
      await playTrack(queue[idx - 1]);
    } else if (repeatMode === "queue") {
      await playTrack(queue[queue.length - 1]);
    }
  }, [currentTrack, queue, position, repeatMode, shuffleOn, playTrack, seekTo]);

  return {
    currentTrack,
    isPlaying,
    position,
    duration,
    queue,
    playTrack,
    togglePlayPause,
    seekTo,
    playNext,
    playPrev,
  };
};
