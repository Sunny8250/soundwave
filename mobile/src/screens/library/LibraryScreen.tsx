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
  TextInput,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSelector } from "../../hooks/useAppDispatch";
import { playlistService } from "../../services/playlistService";
import { supabase } from "../../services/supabase";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";
import { getProfileInitial } from "../../utils/profile";

const { width } = Dimensions.get("window");
const FILTER_TABS = ["Playlists", "Artists", "Albums"];

const PLAYLIST_COLORS: Record<string, string> = {
  "Liked Songs": colors.primary,
};

const getPlaylistColor = (title: string) =>
  PLAYLIST_COLORS[title] ||
  [colors.purple, colors.blue, colors.orange, colors.pink][
    title.charCodeAt(0) % 4
  ];

export default function LibraryScreen({ navigation }: any) {
  const user = useAppSelector((s) => s.auth.user);
  const profileInitial = getProfileInitial(user);

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("Playlists");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadPlaylists = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await playlistService.getUserPlaylists(user.id);
    setPlaylists(
      (data || []).filter(
        (playlist) => !playlist.description?.startsWith("Songs by "),
      ),
    );

    const { data: artist } = await supabase
      .from("artists")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (artist?.id) {
      const { data: albumData } = await supabase
        .from("albums")
        .select("id, title, type, cover_art_url, release_date, total_tracks")
        .eq("artist_id", artist.id)
        .eq("is_published", true)
        .order("release_date", { ascending: false });
      setAlbums(albumData || []);
    } else {
      setAlbums([]);
    }

    const { data: artistData } = await supabase
      .from("artists")
      .select(
        `
        id, user_id, name, avatar_url, is_verified, follower_count, created_at,
        tracks!tracks_artist_id_fkey!inner ( id )
      `,
      )
      .eq("tracks.status", "published")
      .order("created_at", { ascending: false })
      .limit(50);
    setArtists(
      [...(artistData || [])].sort((a, b) => {
        if (a.user_id === user.id && b.user_id !== user.id) return -1;
        if (b.user_id === user.id && a.user_id !== user.id) return 1;
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      }),
    );

    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPlaylists();
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user?.id) return;
    setCreating(true);
    await playlistService.createPlaylist(user.id, newName);
    setCreating(false);
    setNewName("");
    setShowCreate(false);
    loadPlaylists();
  };

  const handleDelete = (playlist: any) => {
    if (playlist.title === "Liked Songs") {
      Alert.alert("Cannot delete", "Liked Songs cannot be deleted");
      return;
    }
    Alert.alert("Delete Playlist", `Delete "${playlist.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await playlistService.deletePlaylist(playlist.id);
          loadPlaylists();
        },
      },
    ]);
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {profileInitial}
              </Text>
            </View>
            <Text style={styles.headerTitle}>Your Library</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => {}}>
              <Text style={styles.headerBtnText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowCreate(!showCreate)}
            >
              <Text style={styles.headerBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Create form */}
        {showCreate && activeTab === "Playlists" && (
          <View style={styles.createForm}>
            <TextInput
              style={styles.createInput}
              placeholder="My playlist name..."
              placeholderTextColor={colors.textTertiary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.createBtns}>
              <TouchableOpacity
                style={styles.createConfirm}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.createConfirmText}>Create</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createCancel}
                onPress={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
              >
                <Text style={styles.createCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recently section */}
        <View style={styles.recentHeader}>
          <Text style={styles.recentLabel}>Recents</Text>
          <TouchableOpacity style={styles.viewToggle}>
            <Text style={styles.viewToggleText}>⊞</Text>
          </TouchableOpacity>
        </View>

        {/* Add new playlist row */}
        <TouchableOpacity
          style={[
            styles.addPlaylistRow,
            activeTab !== "Playlists" && styles.hidden,
          ]}
          onPress={() => setShowCreate(true)}
        >
          <View style={styles.addPlaylistIcon}>
            <Text style={styles.addPlaylistIconText}>+</Text>
          </View>
          <View style={styles.addPlaylistInfo}>
            <Text style={styles.addPlaylistTitle}>Add New Playlist</Text>
          </View>
        </TouchableOpacity>

        {/* Playlists */}
        {activeTab === "Playlists" && playlists.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>No playlists yet</Text>
            <Text style={styles.emptySub}>
              Create your first playlist above
            </Text>
          </View>
        ) : activeTab === "Playlists" ? (
          playlists.map((playlist) => {
            const color = getPlaylistColor(playlist.title);
            return (
              <TouchableOpacity
                key={playlist.id}
                style={styles.playlistRow}
                onPress={() =>
                  navigation.navigate("PlaylistDetail", {
                    playlistId: playlist.id,
                  })
                }
                onLongPress={() => handleDelete(playlist)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.playlistIcon,
                    { backgroundColor: color + "22" },
                  ]}
                >
                  <Text style={[styles.playlistIconEmoji, { color }]}>
                    {playlist.title === "Liked Songs" ? "♥" : "♪"}
                  </Text>
                </View>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistTitle}>{playlist.title}</Text>
                  <Text style={styles.playlistMeta}>
                    Playlist • {playlist.total_tracks || 0} songs
                    {playlist.title === "Liked Songs" ? "  •  Soundwave" : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : null}

        {activeTab === "Albums" && albums.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💿</Text>
            <Text style={styles.emptyTitle}>No albums yet</Text>
            <Text style={styles.emptySub}>
              Your uploaded albums will appear here
            </Text>
          </View>
        ) : activeTab === "Albums" ? (
          albums.map((album) => (
            <TouchableOpacity
              key={album.id}
              style={styles.playlistRow}
              onPress={() =>
                navigation.navigate("AlbumDetail", { albumId: album.id })
              }
              activeOpacity={0.7}
            >
              <Image
                source={{
                  uri:
                    album.cover_art_url ||
                    "https://via.placeholder.com/120/141414/444?text=%E2%99%AA",
                }}
                style={styles.albumCover}
              />
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistTitle}>{album.title}</Text>
                <Text style={styles.playlistMeta}>
                  {(album.type || "album").toUpperCase()} •{" "}
                  {album.total_tracks || 0} song
                  {(album.total_tracks || 0) === 1 ? "" : "s"}
                  {album.release_date
                    ? ` • ${new Date(album.release_date).getFullYear()}`
                    : ""}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : null}

        {activeTab === "Artists" && artists.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>◎</Text>
            <Text style={styles.emptyTitle}>No artists yet</Text>
            <Text style={styles.emptySub}>
              Uploaded artists will appear here
            </Text>
          </View>
        ) : activeTab === "Artists" ? (
          artists.map((artist) => (
            <TouchableOpacity
              key={artist.id}
              style={styles.playlistRow}
              onPress={() =>
                navigation.navigate("ArtistProfile", { artistId: artist.id })
              }
              activeOpacity={0.7}
            >
              {artist.avatar_url ? (
                <Image
                  source={{ uri: artist.avatar_url }}
                  style={styles.artistAvatar}
                />
              ) : (
                <View style={styles.artistAvatarFallback}>
                  <Text style={styles.artistAvatarText}>
                    {artist.name?.[0]?.toUpperCase() || "A"}
                  </Text>
                </View>
              )}
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistTitle}>{artist.name}</Text>
                <Text style={styles.playlistMeta}>
                  Artist • {(artist.follower_count || 0).toLocaleString()} followers
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : null}

        {activeTab === "Playlists" && (
          <Text style={styles.hint}>Long press a playlist to delete it</Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarText: { ...typography.sm, ...typography.bold, color: "#000" },
  headerTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  headerRight: { flexDirection: "row", gap: spacing.sm },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBtnText: { fontSize: 18, color: colors.textPrimary },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  tabText: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: { color: "#000" },
  createForm: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  createInput: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createBtns: { flexDirection: "row", gap: spacing.sm },
  createConfirm: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    ...shadows.green,
  },
  createConfirmText: { ...typography.sm, ...typography.bold, color: "#000" },
  createCancel: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  createCancelText: { ...typography.sm, color: colors.textSecondary },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  recentLabel: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  viewToggle: { padding: spacing.xs },
  viewToggleText: { fontSize: 20, color: colors.textSecondary },
  addPlaylistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  addPlaylistIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  addPlaylistIconText: { fontSize: 28, color: colors.textSecondary },
  addPlaylistInfo: { flex: 1 },
  addPlaylistTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  emptySub: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  playlistIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  playlistIconEmoji: { fontSize: 24 },
  albumCover: {
    width: 54,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  artistAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.bgElevated,
  },
  artistAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  artistAvatarText: {
    ...typography.lg,
    ...typography.bold,
    color: "#000",
  },
  playlistInfo: { flex: 1 },
  playlistTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  playlistMeta: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  hint: {
    textAlign: "center",
    color: colors.textDisabled,
    ...typography.xs,
    marginTop: spacing.lg,
  },
  hidden: { display: "none" },
});
