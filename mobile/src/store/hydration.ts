import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppDispatch, RootState } from "./index";
import { setCurrentTrack, setPosition } from "./slices/playerSlice";
import { setScrollPosition } from "./slices/uiSlice";

const STORAGE_KEYS = {
  PLAYER: "app:player",
  UI: "app:ui",
  THEME: "app:theme",
};

export async function loadPersistedState(dispatch: AppDispatch) {
  try {
    const playerJson = await AsyncStorage.getItem(STORAGE_KEYS.PLAYER);
    if (playerJson) {
      const p = JSON.parse(playerJson);
      if (p.currentTrack) dispatch(setCurrentTrack(p.currentTrack));
      if (typeof p.position === "number") dispatch(setPosition(p.position));
    }

    const uiJson = await AsyncStorage.getItem(STORAGE_KEYS.UI);
    if (uiJson) {
      const u = JSON.parse(uiJson);
      if (u.scrollPositions) {
        Object.entries(u.scrollPositions).forEach(([key, pos]) => {
          dispatch(setScrollPosition({ key, pos: Number(pos) }));
        });
      }
    }

    const themeJson = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
    if (themeJson) {
      const t = JSON.parse(themeJson);
      if (typeof t.isDark === "boolean") {
        if (t.isDark) dispatch({ type: "theme/setDark" });
        else dispatch({ type: "theme/setLight" });
      }
    }
  } catch (err) {
    // ignore errors for now
    console.warn("Failed to hydrate state", err);
  }
}

export async function persistPlayerState(getState: () => RootState) {
  try {
    const s = getState();
    const toSave = {
      currentTrack: s.player.currentTrack,
      position: s.player.position,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYER, JSON.stringify(toSave));
  } catch (err) {
    console.warn("Failed to persist player state", err);
  }
}

export async function persistUIState(getState: () => RootState) {
  try {
    const s = getState();
    const toSave = { scrollPositions: s.ui.scrollPositions };
    await AsyncStorage.setItem(STORAGE_KEYS.UI, JSON.stringify(toSave));
  } catch (err) {
    console.warn("Failed to persist ui state", err);
  }
}

export async function persistThemeState(getState: () => RootState) {
  try {
    const s = getState();
    const toSave = { isDark: s.theme.isDark };
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(toSave));
  } catch (err) {
    console.warn("Failed to persist theme state", err);
  }
}
