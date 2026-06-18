import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface User {
  id: string;
  email?: string;
  phone?: string;
  phone_verified?: boolean;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  subscription_tier?: string;
  is_artist?: boolean;
  role?: "admin" | "creator" | "listener";
  app_role?: "admin" | "creator" | "listener";
  admin_role?: "super_admin" | "admin" | "moderator" | null;
  account_status?: "active" | "blocked" | "deleted";
}

interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  session: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<{ user: User; session: any }>) {
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.error = null;
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    clearAuth(state) {
      state.user = null;
      state.session = null;
      state.error = null;
    },
  },
});

export const { setSession, setUser, setLoading, setError, clearAuth } =
  authSlice.actions;
export default authSlice.reducer;
