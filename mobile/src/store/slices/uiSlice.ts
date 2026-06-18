import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UISliceState {
  scrollPositions: Record<string, number>;
}

const initialState: UISliceState = { scrollPositions: {} };

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setScrollPosition(
      state,
      action: PayloadAction<{ key: string; pos: number }>,
    ) {
      state.scrollPositions[action.payload.key] = action.payload.pos;
    },
    clearScrollPositions(state) {
      state.scrollPositions = {};
    },
  },
});

export const { setScrollPosition, clearScrollPositions } = uiSlice.actions;
export default uiSlice.reducer;
