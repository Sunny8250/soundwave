import { Audio } from "expo-av";

let soundInstance: Audio.Sound | null = null;

export const audioPlayer = {
  async play(url: string, onPlaybackUpdate?: (status: any) => void) {
    try {
      if (soundInstance) {
        await soundInstance.stopAsync();
        await soundInstance.unloadAsync();
        soundInstance = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        onPlaybackUpdate,
      );

      soundInstance = sound;
      return sound;
    } catch (err) {
      console.error("audioPlayer.play error:", err);
      throw err;
    }
  },

  async pause() {
    try {
      if (soundInstance) await soundInstance.pauseAsync();
    } catch (err) {
      console.error("audioPlayer.pause error:", err);
    }
  },

  async resume() {
    try {
      if (soundInstance) await soundInstance.playAsync();
    } catch (err) {
      console.error("audioPlayer.resume error:", err);
    }
  },

  async stop() {
    try {
      if (soundInstance) {
        await soundInstance.stopAsync();
        await soundInstance.unloadAsync();
        soundInstance = null;
      }
    } catch (err) {
      console.error("audioPlayer.stop error:", err);
    }
  },

  async seekTo(positionMs: number) {
    try {
      if (soundInstance) {
        await soundInstance.setPositionAsync(positionMs);
      }
    } catch (err) {
      console.error("audioPlayer.seekTo error:", err);
    }
  },

  isLoaded() {
    return soundInstance !== null;
  },

  getInstance() {
    return soundInstance;
  },
};
