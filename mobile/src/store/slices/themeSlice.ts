import { createSlice } from "@reduxjs/toolkit";

interface ThemeState {
  isDark: boolean;
}

const initialState: ThemeState = { isDark: true };

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.isDark = !state.isDark;
    },
    setDark: (state) => {
      state.isDark = true;
    },
    setLight: (state) => {
      state.isDark = false;
    },
  },
});

export const { toggleTheme, setDark, setLight } = themeSlice.actions;
export default themeSlice.reducer;
