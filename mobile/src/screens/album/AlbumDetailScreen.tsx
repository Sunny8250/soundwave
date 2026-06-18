import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import {
  selectCurrentTrack,
  selectIsPlaying,
} from "../../store/selectors/playerSelectors";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";
import NowPlayingIndicator from "../../components/common/NowPlayingIndicator";
import { getTrackArtistNames } from "../../utils/trackArtists";

const { width } = Dimensions.get("window");

interface Props {
  navigation: any;
  route: any;
  onTrackPress?: (track: any) => void;
}

const formatDuration = (ms?: number) => {
  if (!ms) return "";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatTotalDuration = (tracks: any[]) => {
  const total = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
  const mins = Math.floor(total / 60000);
  return mins > 60
    ? `${Math.floor(mins / 60)} hr ${mins % 60} min`
    : `${mins} min`;
};

export default function AlbumDetailScreen({
  navigation,
  route,
  onTrackPress,
}: Props) {
  const { albumId } = route.params;
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const isPlaying = useAppSelector(selectIsPlaying);

  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlbum = useCallback(async () => {
    try {
      const { data: albumData } = await supabase
        .from("albums")
        .select(
          `
          *,
          artists!albums_artist_id_fkey ( id, name, avatar_url, is_verified )
        `,
        )
        .eq("id", albumId)
        .single();

      setAlbum(albumData);

      const { data: tracksData } = await supabase
        .from("tracks")
        .select(
          `
          id, title, duration_ms, track_number, status, processing_error, cover_art_url,
          play_count, like_count, explicit,
          artists!tracks_artist_id_fkey ( id, name, avatar_url ),
          track_artists (
            role,
            artists ( id, name, avatar_url )
          )
        `,
        )
        .eq("album_id", albumId)
        .order("track_number", { ascending: true });

      setTracks(tracksData || []);
    } catch (err) {
      console.error("AlbumDetail load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [albumId]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAlbum();
  };

  const withAlbumFallback = useCallback(
    (track: any) => ({
      ...track,
      artists: track.artists || album?.artists,
      cover_art_url: track.cover_art_url,
      albums: { cover_art_url: album?.cover_art_url },
    }),
    [album],
  );

  const handlePlayAll = () => {
    const playableTracks = tracks.filter(
      (track) => track.status === "published",
    );
    if (playableTracks.length === 0) return;
    // Set all tracks as queue
    dispatch({
      type: "player/setQueue",
      payload: playableTracks.map(withAlbumFallback),
    });
    // Play first track
    if (onTrackPress) onTrackPress(withAlbumFallback(playableTracks[0]));
  };

  const handleShuffle = () => {
    const playableTracks = tracks.filter((t) => t.status === "published");
    if (playableTracks.length === 0) return;
    // Fisher-Yates-ish shuffle via sort
    const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);
    dispatch({
      type: "player/setQueue",
      payload: shuffled.map(withAlbumFallback),
    });
    if (onTrackPress) onTrackPress(withAlbumFallback(shuffled[0]));
  };

  const handleTrackPress = (track: any) => {
    if (track.status !== "published") return;
    // Set queue from this track onwards
    const playableTracks = tracks.filter((item) => item.status === "published");
    const idx = playableTracks.findIndex((t) => t.id === track.id);
    const queueFromHere = playableTracks.slice(idx).map(withAlbumFallback);
    dispatch({ type: "player/setQueue", payload: queueFromHere });
    if (onTrackPress) onTrackPress(withAlbumFallback(track));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!album) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: colors.textPrimary }}>Album not found</Text>
      </View>
    );
  }

  const isWeb = Platform.OS === "web";
  const webScreenStyle = isWeb
    ? ({ height: "100vh", maxHeight: "100vh", overflow: "hidden" } as any)
    : undefined;
  const webScrollStyle = isWeb
    ? ({
        flex: 1,
        minHeight: 0,
        height: "100%",
        maxHeight: "100%",
        overflow: "auto",
      } as any)
    : undefined;
  const webContentStyle = isWeb
    ? ({
        maxWidth: 980,
        width: "100%",
        alignSelf: "center",
        paddingBottom: 160,
      } as any)
    : undefined;
  const albumArtStyle = isWeb
    ? [styles.albumArt, styles.albumArtWeb]
    : styles.albumArt;

  return (
    <SafeAreaView style={[styles.container, webScreenStyle]} edges={["top"]}>
      <ScrollView
        style={webScrollStyle}
        contentContainerStyle={webContentStyle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Album hero */}
        <View style={styles.hero}>
          <Image
            source={{
              uri:
                album.cover_art_url ||
                "https://via.placeholder.com/300/141414/444?text=♪",
            }}
            style={albumArtStyle}
          />
          <Text style={styles.albumTitle}>{album.title}</Text>

          {/* Artist row */}
          <TouchableOpacity
            style={styles.artistRow}
            onPress={() =>
              navigation.navigate("ArtistProfile", {
                artistId: album.artists?.id,
              })
            }
          >
            <View style={styles.artistAvatar}>
              <Text style={styles.artistAvatarText}>
                {album.artists?.name?.[0]?.toUpperCase() || "A"}
              </Text>
            </View>
            <Text style={styles.artistName}>{album.artists?.name}</Text>
            {album.artists?.is_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Meta */}
          {/* Safely render release year */}
          <Text style={styles.albumMeta}>
            {album.type?.toUpperCase()}
            {album.release_date
              ? ` · ${new Date(album.release_date).getFullYear()}`
              : ""}
            {tracks.length > 0 && `  ·  ${tracks.length} songs`}
            {tracks.length > 0 && `  ·  ${formatTotalDuration(tracks)}`}
          </Text>

          {/* Play controls */}
          <View style={styles.playControls}>
            <TouchableOpacity style={styles.shuffleBtn} onPress={handleShuffle}>
              <Text style={styles.shuffleBtnText}>⇄ Shuffle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll}>
              <Text style={styles.playAllBtnText}>▶ Play All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Track list */}
        <View style={styles.trackList}>
          {tracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            const isPlayable = track.status === "published";
            const trackStatus =
              !isPlayable &&
              (track.processing_error
                ? `${track.status}: ${track.processing_error}`
                : track.status);
            return (
              <TouchableOpacity
                key={track.id}
                style={[
                  styles.trackRow,
                  isCurrentTrack && styles.trackRowActive,
                  !isPlayable && styles.trackRowUnavailable,
                ]}
                onPress={() => handleTrackPress(track)}
                activeOpacity={isPlayable ? 0.7 : 1}
                accessibilityHint={trackStatus || undefined}
              >
                {/* Track number or now playing */}
                <View style={styles.trackIndex}>
                  {isCurrentTrack ? (
                    <NowPlayingIndicator isPlaying={isPlaying} size={16} />
                  ) : (
                    <Text style={styles.trackIndexText}>{index + 1}</Text>
                  )}
                </View>

                {/* Track info */}
                <View style={styles.trackInfo}>
                  <Text
                    style={[
                      styles.trackTitle,
                      isCurrentTrack && styles.trackTitleActive,
                      !isPlayable && styles.trackTitleUnavailable,
                    ]}
                    numberOfLines={1}
                  >
                    {track.title}
                    {track.explicit && <Text style={styles.explicit}> E</Text>}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {getTrackArtistNames(withAlbumFallback(track))}
                    {track.status !== "published" && ` · ${track.status}`}
                    {(track.play_count || 0) > 0 &&
                      ` · ${track.play_count?.toLocaleString()} plays`}
                  </Text>
                </View>

                {/* Duration */}
                <Text style={styles.trackDuration}>
                  {formatDuration(track.duration_ms)}
                </Text>

                {/* More */}
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => {
                    Alert.alert(
                      track.title,
                      getTrackArtistNames(withAlbumFallback(track)),
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Add to Playlist",
                          onPress: () => {
                            // Navigate to add to playlist — pass track via navigation
                            navigation.navigate("AddToPlaylistModal", {
                              track: withAlbumFallback(track),
                            });
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.moreBtnText}>⋮</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Album footer info */}
        {album.release_date && (
          <View style={styles.albumFooter}>
            <Text style={styles.footerDate}>
              Released{" "}
              {new Date(album.release_date).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
            {album.label && (
              <Text style={styles.footerLabel}>℗ {album.label}</Text>
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
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

  backBtn: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backText: { ...typography.md, color: colors.primary },

  hero: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  albumArt: {
    width: width - 80,
    height: width - 80,
    borderRadius: radius.xl,
    backgroundColor: colors.bgElevated,
    marginBottom: spacing.xl,
    ...shadows.lg,
  },
  albumArtWeb: {
    width: 360,
    height: 360,
    maxWidth: "100%",
    alignSelf: "center",
  },
  albumTitle: {
    ...typography.xxl,
    ...typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  artistAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  artistAvatarText: { fontSize: 12, fontWeight: "700", color: "#000" },
  artistName: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedText: { fontSize: 9, color: "#000", fontWeight: "700" },
  albumMeta: {
    ...typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  playControls: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  shuffleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  shuffleBtnText: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  playAllBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.green,
  },
  playAllBtnText: { ...typography.md, ...typography.bold, color: "#000" },

  trackList: { paddingHorizontal: spacing.lg },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  trackRowActive: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  trackRowUnavailable: {
    opacity: 0.55,
  },
  trackIndex: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  trackIndexText: {
    ...typography.sm,
    color: colors.textTertiary,
    textAlign: "center",
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    ...typography.md,
    ...typography.medium,
    color: colors.textPrimary,
  },
  trackTitleActive: { color: colors.primary },
  trackTitleUnavailable: { color: colors.textSecondary },
  explicit: { fontSize: 10, color: colors.textTertiary },
  trackArtist: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  trackDuration: { ...typography.xs, color: colors.textTertiary },
  moreBtn: { padding: spacing.xs },
  moreBtnText: { fontSize: 18, color: colors.textTertiary },

  albumFooter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  footerDate: { ...typography.sm, color: colors.textSecondary },
  footerLabel: { ...typography.sm, color: colors.textSecondary },
});
