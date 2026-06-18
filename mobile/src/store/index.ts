import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import playerReducer from "./slices/playerSlice";
import themeReducer from "./slices/themeSlice";
import entitiesReducer from "./slices/entitiesSlice";
import uiReducer from "./slices/uiSlice";
import {
  persistPlayerState,
  persistUIState,
  persistThemeState,
} from "./hydration";

let persistTimer: NodeJS.Timeout | null = null;

export const store = configureStore({
  reducer: {
    auth: authReducer,
    player: playerReducer,
    theme: themeReducer,
    entities: entitiesReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Subscribe and persist a small set of state with a debounce to avoid excessive writes
store.subscribe(() => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistPlayerState(store.getState as any);
    persistUIState(store.getState as any);
    persistThemeState(store.getState as any);
  }, 500);
});
