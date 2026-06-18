import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { playlistService } from "../../services/playlistService";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { getTrackArtistNames } from "../../utils/trackArtists";

interface Props {
  navigation: any;
  route: any;
  onTrackPress?: (track: any) => void;
}

export default function PlaylistDetailScreen({
  navigation,
  route,
  onTrackPress,
}: Props) {
  const { playlistId } = route.params;

  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dispatch = useAppDispatch();

  const loadPlaylist = useCallback(async () => {
    const { data } = await playlistService.getPlaylist(playlistId);
    setPlaylist(data);
    setLoading(false);
    setRefreshing(false);
  }, [playlistId]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPlaylist();
  };

  const handleRemoveTrack = (track: any) => {
    Alert.alert("Remove track", `Remove "${track.title}" from this playlist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await playlistService.removeTrackFromPlaylist(playlistId, track.id);
          loadPlaylist();
        },
      },
    ]);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "";
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const tracks =
    playlist?.playlist_tracks?.map((pt: any) => pt.tracks).filter(Boolean) ||
    [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Playlist info */}
        <View style={styles.playlistHero}>
          <View style={styles.heroArt}>
            <Text style={styles.heroArtText}>
              {playlist?.title === "Liked Songs" ? "♥" : "♪"}
            </Text>
          </View>
          <Text style={styles.playlistTitle}>{playlist?.title}</Text>
          <Text style={styles.playlistMeta}>{tracks.length} tracks</Text>

          {tracks.length > 0 && (
            <TouchableOpacity
              style={styles.playAllBtn}
              onPress={() => {
                if (tracks.length > 0) {
                  // Set entire playlist as queue
                  dispatch({ type: "player/setQueue", payload: tracks });
                  // Play first track
                  if (onTrackPress) onTrackPress(tracks[0]);
                }
              }}
            >
              <Text style={styles.playAllBtnText}>▶ Play All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tracks */}
        <View style={styles.trackList}>
          {tracks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎵</Text>
              <Text style={styles.emptyTitle}>No tracks yet</Text>
              <Text style={styles.emptySub}>
                {playlist?.title === "Liked Songs"
                  ? "Like songs to add them here"
                  : "Add tracks from the player"}
              </Text>
            </View>
          ) : (
            tracks.map((track: any, index: number) => (
              <View key={track.id} style={styles.trackRow}>
                <TouchableOpacity
                  style={styles.trackPressable}
                  onPress={() => {
                    // Set queue from this track onwards
                    const idx = tracks.indexOf(track);
                    const queueFromHere = tracks.slice(idx);
                    dispatch({
                      type: "player/setQueue",
                      payload: queueFromHere,
                    });
                    if (onTrackPress) onTrackPress(track);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.trackIndex}>{index + 1}</Text>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {getTrackArtistNames(track)}
                    </Text>
                  </View>
                  <Text style={styles.trackDuration}>
                    {formatDuration(track.duration_ms)}
                  </Text>
                </TouchableOpacity>
                {/* Visible remove button */}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemoveTrack(track)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
  },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { marginBottom: 8 },
  backText: { color: "#1DB954", fontSize: 15 },
  playlistHero: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  heroArt: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#1DB95422",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1DB95444",
  },
  heroArtText: { fontSize: 48, color: "#1DB954" },
  playlistTitle: { fontSize: 24, fontWeight: "700", color: "#fff" },
  playlistMeta: { fontSize: 14, color: "#888", marginTop: 4 },
  playAllBtn: {
    backgroundColor: "#1DB954",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  playAllBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  trackList: { paddingHorizontal: 16 },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#fff" },
  emptySub: { fontSize: 13, color: "#888", marginTop: 4, textAlign: "center" },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
  },
  trackPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  trackIndex: { width: 24, fontSize: 13, color: "#666", textAlign: "center" },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 14, fontWeight: "600", color: "#fff" },
  trackArtist: { fontSize: 12, color: "#888", marginTop: 2 },
  trackDuration: { fontSize: 12, color: "#666" },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  removeBtnText: { fontSize: 16, color: "#555" },
  hint: { textAlign: "center", color: "#444", fontSize: 12, marginTop: 16 },
});
