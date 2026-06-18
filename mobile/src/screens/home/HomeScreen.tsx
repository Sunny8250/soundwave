import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Image,
  Dimensions,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSelector } from "../../hooks/useAppDispatch";
import { selectCurrentTrack } from "../../store/selectors/playerSelectors";
import { api } from "../../services/api";
import AlbumCard from "../../components/cards/AlbumCard";
import TrackCard from "../../components/cards/TrackCard";
import GenreChip from "../../components/common/GenreChip";
import { HomeSkeleton } from "../../components/common/SkeletonLoader";
import { supabase } from "../../services/supabase";
import Toast from "../../components/common/Toast";
import { useToast } from "../../hooks/useToast";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

const { width } = Dimensions.get("window");

interface Props {
  navigation: any;
  onTrackPress?: (track: any) => void;
}

export default function HomeScreen({ navigation, onTrackPress }: Props) {
  const user = useAppSelector((s) => s.auth.user);
  const currentTrack = useAppSelector(selectCurrentTrack);
  const { toast, showToast, hideToast } = useToast();

  const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([]);
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [indieIndian, setIndieIndian] = useState<any[]>([]);
  const [bengali, setBengali] = useState<any[]>([]);
  const [bollywood, setBollywood] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [spotlight, setSpotlight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const checkApiConnectivity = async () => {
    if (typeof api.checkConnectivity === "function") {
      return api.checkConnectivity();
    }

    const candidateUrls = [
      `${process.env.EXPO_PUBLIC_API_URL}${process.env.EXPO_PUBLIC_API_PREFIX || "/api/v2"}/health`,
      `${process.env.EXPO_PUBLIC_API_URL}/api/health`,
      `${process.env.EXPO_PUBLIC_API_URL}/health`,
      `http://localhost:3000/api/v2/health`,
    ].filter(Boolean);

    const results: Array<{
      url: string;
      ok?: boolean;
      status?: number;
      err?: string;
    }> = [];
    for (const url of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) return { url, status: res.status };
        results.push({ url, ok: false, status: res.status });
      } catch (err: any) {
        results.push({ url, err: err?.message || String(err) });
      }
    }
    throw new Error(
      `No reachable API endpoints. Attempts: ${JSON.stringify(results)}`,
    );
  };

  const loadData = useCallback(async () => {
    setNetworkError(null);
    try {
      try {
        const conn = await checkApiConnectivity();
        console.info("API connectivity OK:", conn);
      } catch (connErr: any) {
        console.error("API connectivity check failed:", connErr);
        setNetworkError(connErr?.message || String(connErr));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const [
        recentRes,
        releasesRes,
        trendingRes,
        indieRes,
        bengaliRes,
        bollywoodRes,
        genresRes,
      ] = await Promise.all([
        api.getRecentlyPlayed(),
        api.getNewReleases(),
        api.getTrending(),
        api.getIndieIndian(),
        api.getBengali(),
        api.getByGenre("bollywood", 20),
        api.getGenres(),
      ]);

      setRecentlyPlayed(recentRes.data || []);
      setNewReleases(releasesRes.data || []);
      setTrending(trendingRes.data || []);
      setIndieIndian(indieRes.data || []);
      setBengali(bengaliRes.data || []);
      setBollywood(bollywoodRes.data || []);
      setGenres(genresRes.data || []);

      if (indieRes.data?.length > 0) setSpotlight(indieRes.data[0]);

      // Load albums separately from albums table
      const { data: albumData } = await supabase
        .from("albums")
        .select(
          `
          id, title, type, cover_art_url, total_tracks, release_date,
          artists!albums_artist_id_fkey ( id, name )
        `,
        )
        .eq("is_published", true)
        .order("release_date", { ascending: false })
        .limit(20);
      setAlbums(albumData || []);

      // Load artists separately — deduplicated
      const { data: artistData } = await supabase
        .from("artists")
        .select("id, name, avatar_url, is_verified, follower_count")
        .not("user_id", "is", null)
        .order("follower_count", { ascending: false })
        .limit(20);

      if (artistData && artistData.length > 0) {
        setArtists(artistData);
      } else {
        // Fallback — get artists from tracks, deduplicated
        const tracks = indieRes.data || [];
        const seen = new Set<string>();
        const unique = tracks
          .map((t: any) => t.artists)
          .filter((a: any) => {
            if (!a || seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          });
        setArtists(unique);
      }
    } catch (err) {
      console.error("HomeScreen load error:", err);
      setNetworkError(err?.message || String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleTrackPress = useCallback(
    (track: any) => {
      Vibration.vibrate(10);
      if (onTrackPress) onTrackPress(track);
    },
    [onTrackPress],
  );

  const handleGenrePress = useCallback(
    (genre: any) => {
      navigation.navigate("BrowseResults", {
        title: genre.name,
        source: "genre",
        genreSlug: genre.slug,
      });
    },
    [navigation],
  );

  if (loading) return <HomeSkeleton />;

  if (networkError) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <Text style={{ color: colors.textPrimary, marginBottom: 12 }}>
          Could not reach backend API:
        </Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
          {networkError}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            padding: 12,
            borderRadius: 8,
          }}
          onPress={() => {
            setLoading(true);
            setNetworkError(null);
            loadData();
          }}
        >
          <Text style={{ color: "#000", fontWeight: "700" }}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const renderSection = (
    title: string,
    tracks: any[],
    onSeeAll?: () => void,
  ) => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={styles.seeAll}>SEE ALL</Text>
          </TouchableOpacity>
        )}
      </View>
      {tracks.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hScroll}
        >
          {tracks.map((track) => (
            <AlbumCard
              key={track.id}
              item={track}
              subtitle={track.artists?.name}
              onPress={() => handleTrackPress(track)}
              size={140}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>No tracks yet</Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <Text style={styles.logoIcon}>🎵</Text>
            <Text style={styles.logoText}>Soundwave</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting */}
        <View style={styles.greetingArea}>
          <Text style={styles.greetingText}>{getGreeting()}</Text>
          <Text style={styles.greetingName}>
            {user?.display_name || user?.username || "Listener"}
          </Text>
        </View>

        {/* Recently Played — only show if user has history */}
        {recentlyPlayed.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Played</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {recentlyPlayed.map((track: any) => (
                <TouchableOpacity
                  key={track.id}
                  style={styles.recentCard}
                  onPress={() => handleTrackPress(track)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{
                      uri:
                        (track as any).albums?.cover_art_url ||
                        "https://via.placeholder.com/48/141414/444?text=♪",
                    }}
                    style={styles.recentImage}
                  />
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.recentArtist} numberOfLines={1}>
                      {(track as any).artists?.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Artist Spotlight */}
        {spotlight && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Artist Spotlight</Text>
            </View>
            <TouchableOpacity
              style={styles.spotlightCard}
              onPress={() => handleTrackPress(spotlight)}
              activeOpacity={0.9}
            >
              <Image
                source={{
                  uri:
                    spotlight.albums?.cover_art_url ||
                    "https://via.placeholder.com/400/1a1a1a/444?text=♪",
                }}
                style={styles.spotlightBg}
                blurRadius={2}
              />
              <View style={styles.spotlightOverlay}>
                <View style={styles.spotlightBadge}>
                  <Text style={styles.spotlightBadgeText}>TRENDING</Text>
                </View>
                <Text style={styles.spotlightTitle}>{spotlight.title}</Text>
                <Text style={styles.spotlightArtist}>
                  {spotlight.artists?.name}
                </Text>
                <TouchableOpacity
                  style={styles.spotlightBtn}
                  onPress={() => handleTrackPress(spotlight)}
                >
                  <Text style={styles.spotlightBtnText}>▶ Listen Now</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Browse Genres — now tappable */}
        {genres.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Browse Genres</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {genres.map((genre) => (
                <GenreChip
                  key={genre.id}
                  genre={genre}
                  onPress={() => handleGenrePress(genre)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* New Releases */}
        {renderSection("🆕 New Releases", newReleases, () =>
          navigation.navigate("BrowseResults", {
            title: "New Releases",
            source: "new",
          }),
        )}

        {/* New Albums — from albums table */}
        {albums.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>New Albums</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("BrowseResults", {
                    title: "New Albums",
                    source: "albums",
                  })
                }
              >
                <Text style={styles.seeAll}>SEE ALL</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {albums.map((album: any) => (
                <TouchableOpacity
                  key={album.id}
                  style={{ marginRight: spacing.md, width: 140 }}
                  onPress={() =>
                    navigation.navigate("AlbumDetail", { albumId: album.id })
                  }
                  activeOpacity={0.8}
                >
                  <View style={{ position: "relative" }}>
                    <Image
                      source={{
                        uri:
                          album.cover_art_url ||
                          "https://via.placeholder.com/140/141414/444?text=♪",
                      }}
                      style={{
                        width: 140,
                        height: 140,
                        borderRadius: radius.md,
                        backgroundColor: colors.bgElevated,
                      }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.primary,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{ fontSize: 12, color: "#000", marginLeft: 2 }}
                      >
                        ▶
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      ...typography.sm,
                      ...typography.semibold,
                      color: colors.textPrimary,
                      marginTop: spacing.sm,
                    }}
                    numberOfLines={1}
                  >
                    {album.title}
                  </Text>
                  <Text
                    style={{
                      ...typography.xs,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {album.artists?.name} · {album.total_tracks || 0} songs
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Popular Artists — from artists state */}
        {artists.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Artists</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("BrowseResults", {
                    title: "Popular Artists",
                    source: "artists",
                  })
                }
              >
                <Text style={styles.seeAll}>SEE ALL</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {artists.map((artist: any) => {
                const initials =
                  artist.name
                    ?.split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "A";
                return (
                  <TouchableOpacity
                    key={artist.id}
                    style={styles.artistCircleCard}
                    onPress={() =>
                      navigation.navigate("ArtistProfile", {
                        artistId: artist.id,
                      })
                    }
                    activeOpacity={0.8}
                  >
                    {artist.avatar_url ? (
                      <Image
                        source={{ uri: artist.avatar_url }}
                        style={styles.artistCircleImg}
                      />
                    ) : (
                      <View style={styles.artistCircleFallback}>
                        <Text style={styles.artistCircleText}>{initials}</Text>
                      </View>
                    )}
                    {artist.is_verified && (
                      <View style={styles.artistVerifiedBadge}>
                        <Text
                          style={{
                            fontSize: 9,
                            color: "#000",
                            fontWeight: "700",
                          }}
                        >
                          ✓
                        </Text>
                      </View>
                    )}
                    <Text style={styles.artistCircleName} numberOfLines={1}>
                      {artist.name}
                    </Text>
                    <Text style={styles.artistCircleRole}>
                      {(artist.follower_count || 0).toLocaleString()} followers
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Bollywood */}
        {renderSection("🎬 Bollywood Hits", bollywood, () =>
          navigation.navigate("BrowseResults", {
            title: "Bollywood Hits",
            source: "bollywood",
          }),
        )}

        {/* Bengali */}
        {renderSection("🎶 Bengali Music", bengali, () =>
          navigation.navigate("BrowseResults", {
            title: "Bengali Music",
            source: "bengali",
          }),
        )}

        {/* Best of Indian Indie */}
        {renderSection("🇮🇳 Best of Indian Indie", indieIndian, () =>
          navigation.navigate("BrowseResults", {
            title: "Best of Indian Indie",
            source: "indie",
          }),
        )}

        {/* 2x2 Mix grid */}
        {indieIndian.length >= 4 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Top Mixes</Text>
            </View>
            <View style={styles.mixGrid}>
              {indieIndian.slice(0, 4).map((track, i) => (
                <TouchableOpacity
                  key={track.id + "mix"}
                  style={styles.mixCard}
                  onPress={() => handleTrackPress(track)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{
                      uri:
                        track.albums?.cover_art_url ||
                        `https://via.placeholder.com/160/1${i}1${i}1${i}/444?text=♪`,
                    }}
                    style={styles.mixImage}
                  />
                  <View style={styles.mixOverlay}>
                    <Text style={styles.mixTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.mixSub} numberOfLines={1}>
                      {track.artists?.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Trending */}
        {trending.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Trending This Week</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("BrowseResults", {
                    title: "Trending",
                    source: "trending",
                  })
                }
              >
                <Text style={styles.seeAll}>SEE ALL</Text>
              </TouchableOpacity>
            </View>
            <View>
              {trending.slice(0, 6).map((track, i) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  showIndex={i}
                  onPress={handleTrackPress}
                  isPlaying={currentTrack?.id === track.id}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        onHide={hideToast}
        actionLabel={toast.actionLabel}
        onAction={toast.action ?? undefined}
        duration={toast.duration}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoIcon: { fontSize: 20 },
  logoText: { ...typography.lg, ...typography.bold, color: colors.primary },
  topBarRight: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnText: { fontSize: 16 },

  greetingArea: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  greetingText: { ...typography.sm, color: colors.textSecondary },
  greetingName: {
    ...typography.xxl,
    ...typography.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  seeAll: {
    ...typography.xs,
    ...typography.bold,
    color: colors.primary,
    letterSpacing: 0.8,
  },

  hScroll: { paddingHorizontal: spacing.lg },
  emptySection: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  emptySectionText: { ...typography.sm, color: colors.textTertiary },

  // Recently played
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginRight: spacing.sm,
    width: 200,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  recentImage: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  recentInfo: { flex: 1 },
  recentTitle: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  recentArtist: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },

  // Spotlight
  spotlightCard: {
    marginHorizontal: spacing.lg,
    height: 180,
    borderRadius: radius.xl,
    overflow: "hidden",
    ...shadows.lg,
  },
  spotlightBg: { position: "absolute", width: "100%", height: "100%" },
  spotlightOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: spacing.xl,
    justifyContent: "flex-end",
  },
  spotlightBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  spotlightBadgeText: {
    ...typography.xs,
    ...typography.bold,
    color: "#000",
    letterSpacing: 1,
  },
  spotlightTitle: {
    ...typography.xxl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  spotlightArtist: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  spotlightBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    ...shadows.green,
  },
  spotlightBtnText: { ...typography.sm, ...typography.bold, color: "#000" },

  // Artist circles
  artistCircleCard: {
    alignItems: "center",
    marginRight: spacing.lg,
    width: 80,
  },
  artistCircleImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgElevated,
    marginBottom: spacing.sm,
  },
  artistCircleFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  artistCircleText: { ...typography.lg, ...typography.bold, color: "#000" },
  artistCircleName: {
    ...typography.xs,
    ...typography.semibold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  artistCircleRole: {
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: 2,
  },
  artistVerifiedBadge: {
    position: "absolute",
    top: 52,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },

  // 2x2 mix grid
  mixGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  mixCard: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2,
    height: 160,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.md,
  },
  mixImage: { width: "100%", height: "100%" },
  mixOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  mixTitle: { ...typography.sm, ...typography.bold, color: colors.textPrimary },
  mixSub: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
});
