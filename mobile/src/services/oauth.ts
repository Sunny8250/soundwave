import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "./supabase";
import { normalizeAuthUser } from "../utils/roles";

WebBrowser.maybeCompleteAuthSession();

const getRedirectTo = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  return makeRedirectUri({
    scheme: "soundwave",
    path: "auth/callback",
  });
};

const createSessionFromUrl = async (url: string) => {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    throw new Error("Google sign-in did not return a valid session.");
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return data.session;
};

export const loadProfileForAuthUser = async (authUser: any) => {
  const { data: profile } = await supabase
    .from("users")
    .select("*, admin_roles(role)")
    .eq("id", authUser.id)
    .single();

  return normalizeAuthUser(
    profile || {
      id: authUser.id,
      email: authUser.email || "",
      phone: authUser.phone || "",
      username:
        authUser.user_metadata?.user_name ||
        authUser.user_metadata?.name ||
        authUser.email ||
        authUser.phone ||
        "Soundwave User",
      display_name:
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email ||
        authUser.phone ||
        "Soundwave User",
      avatar_url: authUser.user_metadata?.avatar_url || "",
      phone_verified: !!authUser.phone_confirmed_at,
    },
  );
};

export const signInWithGoogle = async () => {
  const redirectTo = getRedirectTo();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error("Google sign-in URL was not created.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== "success") {
    throw new Error("Google sign-in was cancelled.");
  }

  const session = await createSessionFromUrl(result.url);

  if (!session?.user) {
    throw new Error("Google sign-in completed without a user session.");
  }

  const user = await loadProfileForAuthUser(session.user);

  return { session, user };
};
