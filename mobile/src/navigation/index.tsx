import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  Text,
  ActivityIndicator,
  View,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { supabase } from "../services/supabase";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { setSession, clearAuth } from "../store/slices/authSlice";
import { audioPlayer } from "../services/audioPlayer";

import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import WelcomeScreen from "../screens/auth/WelcomeScreen";
import PhoneLoginScreen from "../screens/auth/PhoneLoginScreen";
import OtpVerifyScreen from "../screens/auth/OtpVerifyScreen";
import ProfileCompletionScreen from "../screens/auth/ProfileCompletionScreen";
import HomeScreen from "../screens/home/HomeScreen";
import SearchScreen from "../screens/search/SearchScreen";
import LibraryScreen from "../screens/library/LibraryScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import PlayerScreen from "../screens/player/PlayerScreen";
import MiniPlayer from "../components/player/MiniPlayer";
import OfflineIndicator from "../components/common/OfflineIndicator";
import BecomeArtistScreen from "../screens/creator/BecomeArtistScreen";
import CreatorDashboardScreen from "../screens/creator/CreatorDashboardScreen";
import UploadTrackScreen from "../screens/creator/UploadTrackScreen";
import PlaylistDetailScreen from "../screens/library/PlaylistDetailScreen";
import AlbumDetailScreen from "../screens/album/AlbumDetailScreen";
import ArtistScreen from "../screens/artist/ArtistScreen";
import UploadAlbumScreen from "../screens/creator/UploadAlbumScreen";
import UploadArtistPlaylistScreen from "../screens/creator/UploadArtistPlaylistScreen";
import BulkUploadScreen from "../screens/creator/BulkUploadScreen";
import BrowseResultsScreen from "../screens/browse/BrowseResultsScreen";
import { needsProfileCompletion } from "../utils/profile";
import { normalizeAuthUser } from "../utils/roles";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminUsersScreen from "../screens/admin/AdminUsersScreen";
import AdminUserDetailScreen from "../screens/admin/AdminUserDetailScreen";
import AdminEditUserProfileScreen from "../screens/admin/AdminEditUserProfileScreen";
import AdminContentScreen from "../screens/admin/AdminContentScreen";
import AdminModerationScreen from "../screens/admin/AdminModerationScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const { height } = Dimensions.get("window");

// ── MiniPlayerContainer ───────────────────────────────────────
function MiniPlayerContainer({ onOpen }: { onOpen: () => void }) {
  const currentTrack = useAppSelector((s: any) => s.player.currentTrack as any);
  const isPlaying = useAppSelector((s: any) => s.player.isPlaying) as boolean;
  const position = useAppSelector((s: any) => s.player.position) as number;
  const duration = useAppSelector((s: any) => s.player.duration) as number;
  const dispatch = useAppDispatch();

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      await audioPlayer.pause();
      dispatch({ type: "player/setIsPlaying", payload: false });
    } else {
      await audioPlayer.resume();
      dispatch({ type: "player/setIsPlaying", payload: true });
    }
  }, [isPlaying, dispatch]);

  if (!currentTrack) return null;

  return (
    <MiniPlayer
      track={currentTrack}
      isPlaying={isPlaying}
      position={position}
      duration={duration}
      onPress={onOpen}
      onPlayPause={handlePlayPause}
    />
  );
}

// ── PlayerOverlay ─────────────────────────────────────────────
// Renders as a slide-up overlay — no Modal, no flash
function PlayerOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(height)).current;
  const lastY = useRef(height);
  const [shouldRender, setShouldRender] = useState(visible);

  // Show / hide animation
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      lastY.current = 0;
    } else {
      Animated.timing(translateY, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShouldRender(false));
      lastY.current = height;
    }
  }, [visible]);

  // Swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),

      onPanResponderGrant: () => {
        translateY.setOffset(lastY.current);
        translateY.setValue(0);
      },

      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },

      onPanResponderRelease: (_, g) => {
        translateY.flattenOffset();
        if (g.dy > 120 || g.vy > 0.8) {
          lastY.current = height;
          Animated.timing(translateY, {
            toValue: height,
            duration: 280,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          lastY.current = 0;
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        }
      },

      onPanResponderTerminate: (_, g) => {
        translateY.flattenOffset();
        lastY.current = 0;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#080808",
        transform: [{ translateY }],
        zIndex: 999,
      }}
      {...panResponder.panHandlers}
    >
      <PlayerScreen
        onClose={() => {
          lastY.current = height;
          onClose();
        }}
      />
    </Animated.View>
  );
}

// ── MainTabs ──────────────────────────────────────────────────
function MainTabs({
  onTrackPress,
  onArtistPress,
}: {
  onTrackPress: (track: any) => void;
  onArtistPress: (artistId: string) => void;
}) {
  const [playerVisible, setPlayerVisible] = useState(false);
  const currentTrack = useAppSelector((s) => s.player.currentTrack);

  return (
    <View style={{ flex: 1, backgroundColor: "#080808" }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#0A0A0A",
            borderTopWidth: 0.5,
            borderTopColor: "#282828",
            height: 64,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: "#1DB954",
          tabBarInactiveTintColor: "#727272",
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "500",
            marginTop: 2,
          },
        }}
      >
        <Tab.Screen
          name="Home"
          options={{
            tabBarLabel: "Home",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 22, color }}>⌂</Text>
            ),
          }}
        >
          {(props) => <HomeScreen {...props} onTrackPress={onTrackPress} />}
        </Tab.Screen>

        <Tab.Screen
          name="Search"
          options={{
            tabBarLabel: "Search",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 20, color }}>⌕</Text>
            ),
          }}
        >
          {(props) => (
            <SearchScreen
              {...props}
              onTrackPress={onTrackPress}
              onArtistPress={onArtistPress}
            />
          )}
        </Tab.Screen>

        {/* Center Player Tab */}
        <Tab.Screen
          name="NowPlaying"
          options={{
            tabBarLabel: "Player",
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#1DB954",
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: -16,
                  shadowColor: "#1DB954",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                  elevation: 8,
                  borderWidth: 3,
                  borderColor: focused ? "#fff" : "#0A0A0A",
                }}
              >
                <Text style={{ fontSize: 22, color: "#000" }}>
                  {currentTrack ? "♪" : "▶"}
                </Text>
              </View>
            ),
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "500",
              marginTop: 6,
              color: "#1DB954",
            },
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setPlayerVisible(true);
            },
          }}
        >
          {() => <View style={{ flex: 1, backgroundColor: "#0A0A0A" }} />}
        </Tab.Screen>

        <Tab.Screen
          name="Library"
          options={{
            tabBarLabel: "Library",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 20, color }}>⊟</Text>
            ),
          }}
        >
          {(props) => <LibraryScreen {...props} />}
        </Tab.Screen>

        <Tab.Screen
          name="Profile"
          options={{
            tabBarLabel: "Profile",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 20, color }}>◉</Text>
            ),
          }}
        >
          {(props) => <ProfileScreen {...props} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Mini player */}
      {!playerVisible && (
        <MiniPlayerContainer onOpen={() => setPlayerVisible(true)} />
      )}

      <OfflineIndicator />

      {/* Player overlay — no Modal, smooth slide */}
      <PlayerOverlay
        visible={playerVisible}
        onClose={() => setPlayerVisible(false)}
      />
    </View>
  );
}

// ── MainTabsWrapper ───────────────────────────────────────────
function MainTabsWrapper({ navigation, onTrackPress }: any) {
  const handleArtistPress = useCallback(
    (artistId: string) => {
      navigation.navigate("ArtistProfile", { artistId });
    },
    [navigation],
  );

  return (
    <MainTabs onTrackPress={onTrackPress} onArtistPress={handleArtistPress} />
  );
}

// ── AppContent ────────────────────────────────────────────────
function AppContent() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isDark = useAppSelector((state) => state.theme.isDark);
  const [checking, setChecking] = useState(true);
  const finishingTrackRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase
          .from("users")
          .select("*, admin_roles(role)")
          .eq("id", session.user.id)
          .single();
        if (profile?.account_status && profile.account_status !== "active") {
          await supabase.auth.signOut();
          dispatch(clearAuth());
        } else {
          dispatch(
            setSession({
              user: normalizeAuthUser(profile || session.user),
              session,
            }),
          );
        }
      }
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") dispatch(clearAuth());
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleTrackPress = useCallback(
    async (track: any) => {
      try {
        const { api } = await import("../services/api");
        const { audioPlayer } = await import("../services/audioPlayer");
        const { Audio } = await import("expo-av");

        finishingTrackRef.current = null;
        dispatch({ type: "player/setCurrentTrack", payload: track });
        dispatch({ type: "player/setIsPlaying", payload: false });
        dispatch({ type: "player/setIsLoading", payload: true });

        const res = await api.getStreamUrl(track.id);
        if (!res?.data?.url) throw new Error("No stream URL");

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        await audioPlayer.play(res.data.url, (status: any) => {
          if (!status.isLoaded) return;
          dispatch({
            type: "player/setPosition",
            payload: status.positionMillis || 0,
          });
          dispatch({
            type: "player/setDuration",
            payload: status.durationMillis || 0,
          });
          dispatch({ type: "player/setIsPlaying", payload: status.isPlaying });
          dispatch({ type: "player/setIsLoading", payload: false });

          // Feature 1 — Record play completion and update play count
          if (status.didJustFinish) {
            api.recordPlayComplete(track.id).catch(() => {});

            dispatch({ type: "player/setIsPlaying", payload: false });
            // Get current queue state and play next
            const store = require("../store").store;
            const state = store.getState();
            const queue = state.player.queue;
            const currentId = state.player.currentTrack?.id;
            if (!currentId || finishingTrackRef.current === currentId) return;
            finishingTrackRef.current = currentId;

            if (queue.length > 0 && currentId) {
              const idx = queue.findIndex((t: any) => t.id === currentId);
              if (idx !== -1 && idx < queue.length - 1) {
                handleTrackPress(queue[idx + 1]);
              }
            }
          }
        });

        dispatch({ type: "player/setIsPlaying", payload: true });
        dispatch({ type: "player/setIsLoading", payload: false });

        api.recordPlay(track.id, 0, false).catch(() => {});
      } catch (err) {
        console.error("handleTrackPress error:", err);
        dispatch({ type: "player/setIsLoading", payload: false });
      }
    },
    [dispatch],
  );

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#080808",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🎵</Text>
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user && needsProfileCompletion(user) ? (
          <Stack.Screen
            name="ProfileCompletion"
            component={ProfileCompletionScreen}
          />
        ) : user ? (
          <>
            <Stack.Screen name="Main">
              {(props) => (
                <MainTabsWrapper {...props} onTrackPress={handleTrackPress} />
              )}
            </Stack.Screen>
            <Stack.Screen name="BecomeArtist" component={BecomeArtistScreen} />
            <Stack.Screen
              name="CreatorDashboard"
              component={CreatorDashboardScreen}
            />
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboardScreen}
            />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            <Stack.Screen
              name="AdminUserDetail"
              component={AdminUserDetailScreen}
            />
            <Stack.Screen
              name="AdminEditUserProfile"
              component={AdminEditUserProfileScreen}
            />
            <Stack.Screen name="AdminContent" component={AdminContentScreen} />
            <Stack.Screen
              name="AdminModeration"
              component={AdminModerationScreen}
            />
            <Stack.Screen name="UploadTrack" component={UploadTrackScreen} />
            <Stack.Screen
              name="UploadArtistPlaylist"
              component={UploadArtistPlaylistScreen}
            />
            <Stack.Screen name="BulkUpload" component={BulkUploadScreen} />
            <Stack.Screen name="PlaylistDetail">
              {(props) => (
                <PlaylistDetailScreen
                  {...props}
                  onTrackPress={(track) => {
                    handleTrackPress(track);
                    props.navigation.navigate("Main");
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="UploadAlbum" component={UploadAlbumScreen} />
            <Stack.Screen name="BrowseResults">
              {(props) => {
                const params = (props.route?.params ?? {}) as {
                  source?: string;
                  genreSlug?: string;
                };
                return (
                  <BrowseResultsScreen
                    key={`${params.source || ""}-${params.genreSlug || ""}`}
                    {...props}
                    onTrackPress={(track) => {
                      handleTrackPress(track);
                      props.navigation.navigate("Main");
                    }}
                  />
                );
              }}
            </Stack.Screen>
            <Stack.Screen name="AlbumDetail">
              {(props) => (
                <AlbumDetailScreen
                  {...props}
                  onTrackPress={(track) => {
                    handleTrackPress(track);
                    props.navigation.navigate("Main");
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="ArtistProfile">
              {(props) => (
                <ArtistScreen
                  {...props}
                  onTrackPress={(track) => {
                    handleTrackPress(track);
                    props.navigation.navigate("Main");
                  }}
                />
              )}
            </Stack.Screen>
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
            <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function Navigation() {
  return <AppContent />;
}
