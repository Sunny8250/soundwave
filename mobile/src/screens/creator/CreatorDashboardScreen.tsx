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
  Platform,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { setUser } from "../../store/slices/authSlice";
import { api } from "../../services/api";
import { colors, spacing, radius, typography } from "../../utils/theme";
import { isCreator } from "../../utils/roles";

export default function CreatorDashboardScreen({ navigation }: any) {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();

  const [artist, setArtist] = useState<any>(null);
  const [artists, setArtists] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTrack, setEditingTrack] = useState<any>(null);
  const [editingArtistRecord, setEditingArtistRecord] = useState<any>(null);
  const [editingArtist, setEditingArtist] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtistName, setEditArtistName] = useState("");
  const [editArtistBio, setEditArtistBio] = useState("");
  const [editArtistCountry, setEditArtistCountry] = useState("");
  const [editAlbumTitle, setEditAlbumTitle] = useState("");
  const [editAlbumType, setEditAlbumType] = useState("album");
  const [editAlbumDate, setEditAlbumDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  if (!isCreator(user)) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.accessDenied}>
          <Text style={styles.title}>Creator access required</Text>
          <Text style={styles.mutedText}>
            Ask an admin to make your account a creator before uploading music.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const loadData = useCallback(async () => {
    try {
      // Get all artists owned by this studio/user.
      const { data: artistsData } = await supabase
        .from("artists")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      setArtists(artistsData || []);
      setArtist(artistsData?.[0] || null);

      const artistIds = (artistsData || []).map((item) => item.id);

      if (artistIds.length > 0) {
        // Get this studio's tracks
        const { data: tracksData } = await supabase
          .from("tracks")
          .select(
            "id, title, status, play_count, like_count, created_at, duration_ms, album_id",
          )
          .in("artist_id", artistIds)
          .order("created_at", { ascending: false });

        setTracks(tracksData || []);

        const { data: albumsData } = await supabase
          .from("albums")
          .select("id, title, type, cover_art_url, release_date, total_tracks")
          .in("artist_id", artistIds)
          .order("release_date", { ascending: false });

        setAlbums(albumsData || []);
      } else {
        setTracks([]);
        setAlbums([]);
      }
    } catch (err) {
      console.error("CreatorDashboard load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalPlays = tracks.reduce((sum, t) => sum + (t.play_count || 0), 0);
  const totalLikes = tracks.reduce((sum, t) => sum + (t.like_count || 0), 0);
  const singles = tracks.filter((track) => !track.album_id);

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Home");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "#1DB954";
      case "processing":
        return "#F59E0B";
      case "rejected":
        return "#EF4444";
      default:
        return "#888";
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return "--:--";
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const openEditTrack = (track: any) => {
    setEditingTrack(track);
    setEditTitle(track.title || "");
  };

  const openEditArtist = (artistToEdit: any) => {
    setEditingArtistRecord(artistToEdit);
    setEditArtistName(artistToEdit?.name || "");
    setEditArtistBio(artistToEdit?.bio || "");
    setEditArtistCountry(artistToEdit?.country || "");
    setEditingArtist(true);
  };

  const openEditAlbum = (album: any) => {
    setEditingAlbum(album);
    setEditAlbumTitle(album.title || "");
    setEditAlbumType(album.type || "album");
    setEditAlbumDate(album.release_date || "");
  };

  const handleSaveTrack = async () => {
    const title = editTitle.trim();
    if (!editingTrack || !title) {
      Alert.alert("Title required", "Please enter a track title");
      return;
    }

    setSavingEdit(true);
    const { error } = await supabase
      .from("tracks")
      .update({ title })
      .eq("id", editingTrack.id);

    setSavingEdit(false);

    if (error) {
      Alert.alert("Update failed", error.message);
      return;
    }

    setEditingTrack(null);
    setEditTitle("");
    loadData();
  };

  const handleSaveArtist = async () => {
    const name = editArtistName.trim();
    if (!editingArtistRecord?.id || !name) {
      Alert.alert("Artist name required", "Please enter an artist name");
      return;
    }

    setSavingEdit(true);
    const result = await api.updateArtist(editingArtistRecord.id, {
      name,
      bio: editArtistBio.trim(),
      country: editArtistCountry.trim(),
    });
    setSavingEdit(false);

    if (result?.error) {
      Alert.alert("Update failed", result.error);
      return;
    }

    setEditingArtist(false);
    setEditingArtistRecord(null);
    loadData();
  };

  const handleSaveAlbum = async () => {
    const title = editAlbumTitle.trim();
    if (!editingAlbum?.id || !title) {
      Alert.alert("Album title required", "Please enter an album title");
      return;
    }

    setSavingEdit(true);
    const result = await api.updateAlbum(editingAlbum.id, {
      title,
      type: editAlbumType,
      release_date: editAlbumDate.trim() || null,
    });
    setSavingEdit(false);

    if (result?.error) {
      Alert.alert("Update failed", result.error);
      return;
    }

    setEditingAlbum(null);
    loadData();
  };

  const confirmDelete = (
    title: string,
    message: string,
    onConfirm: () => Promise<void>,
  ) => {
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) {
        void onConfirm();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void onConfirm();
        },
      },
    ]);
  };

  const handleDeleteAlbum = (album: any) => {
    confirmDelete(
      "Delete album",
      `Delete "${album.title}" and all songs inside it? This cannot be undone.`,
      async () => {
        const result = await api.deleteAlbum(album.id);
        if (result?.error) {
          Alert.alert("Delete failed", result.error);
          return;
        }
        loadData();
      },
    );
  };

  const handleDeleteArtist = (artistToDelete: any) => {
    if (!artistToDelete?.id) return;
    confirmDelete(
      "Delete artist",
      `Delete "${artistToDelete.name}" and all uploaded music? This cannot be undone.`,
      async () => {
        const result = await api.deleteArtist(artistToDelete.id);
        if (result?.error) {
          Alert.alert("Delete failed", result.error);
          return;
        }
        loadData();
      },
    );
  };

  const handleDeleteTrack = (track: any) => {
    confirmDelete(
      "Delete track",
      `Delete "${track.title}"? This removes it from playlists too.`,
      async () => {
        const result = await api.deleteTrack(track.id);

        if (result?.error) {
          Alert.alert("Delete failed", result.error);
          return;
        }

        loadData();
      },
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#1DB954" size="large" />
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
  const webScrollContentStyle = isWeb
    ? ({ paddingBottom: 160 } as any)
    : undefined;

  return (
    <SafeAreaView style={[styles.container, webScreenStyle]} edges={["top"]}>
      <ScrollView
        style={webScrollStyle}
        contentContainerStyle={webScrollContentStyle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Creator Dashboard</Text>
            <Text style={styles.headerTitle}>My Studio</Text>
          </View>
        </View>

        {/* Stats cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{albums.length}</Text>
            <Text style={styles.statLabel}>Albums</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalPlays.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Plays</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalLikes.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Likes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{artist?.follower_count || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
        </View>

        {/* Upload options */}
        <View style={styles.uploadRow}>
          <TouchableOpacity
            style={styles.uploadBtnSingle}
            onPress={() => navigation.navigate("UploadTrack")}
          >
            <Text style={styles.uploadBtnIcon}>🎵</Text>
            <Text style={styles.uploadBtnLabel}>Single Track</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadBtnAlbum}
            onPress={() => navigation.navigate("UploadAlbum")}
          >
            <Text style={styles.uploadBtnIcon}>💿</Text>
            <Text style={styles.uploadBtnLabel}>Full Album</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadBtnArtist}
            onPress={() => navigation.navigate("UploadArtistPlaylist")}
          >
            <Text style={styles.uploadBtnIcon}>◎</Text>
            <Text style={styles.uploadBtnLabel}>Create Artist Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate("BulkUpload")}
          >
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionLabel}>Bulk Upload</Text>
            <Text style={styles.actionSub}>Upload multiple songs at once</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Artists</Text>

          {artists.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>◎</Text>
              <Text style={styles.emptyText}>No artists yet</Text>
              <Text style={styles.emptySub}>
                Upload an artist to start building your catalog
              </Text>
            </View>
          ) : (
            artists.map((item) => (
              <View key={item.id} style={styles.artistRow}>
                {item.avatar_url ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    style={styles.artistAvatar}
                  />
                ) : (
                  <View style={styles.artistAvatarFallback}>
                    <Text style={styles.artistAvatarText}>
                      {item.name?.[0]?.toUpperCase() || "A"}
                    </Text>
                  </View>
                )}
                <View style={styles.albumInfo}>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.albumMeta}>
                    Artist • {(item.follower_count || 0).toLocaleString()}{" "}
                    followers
                  </Text>
                </View>
                <View style={styles.trackActions}>
                  <TouchableOpacity
                    style={styles.trackActionBtn}
                    onPress={() => openEditArtist(item)}
                  >
                    <Text style={styles.trackActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.trackActionBtn, styles.deleteActionBtn]}
                    onPress={() => handleDeleteArtist(item)}
                  >
                    <Text style={[styles.trackActionText, styles.deleteText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Albums list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Albums</Text>

          {albums.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💿</Text>
              <Text style={styles.emptyText}>No albums yet</Text>
              <Text style={styles.emptySub}>
                Upload an album to group songs under one release
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate("UploadAlbum")}
              >
                <Text style={styles.emptyBtnText}>Upload Album</Text>
              </TouchableOpacity>
            </View>
          ) : (
            albums.map((album) => (
              <TouchableOpacity
                key={album.id}
                style={styles.albumRow}
                onPress={() =>
                  navigation.navigate("AlbumDetail", { albumId: album.id })
                }
                activeOpacity={0.8}
              >
                <Image
                  source={{
                    uri:
                      album.cover_art_url ||
                      "https://via.placeholder.com/120/141414/444?text=%E2%99%AA",
                  }}
                  style={styles.albumCover}
                />
                <View style={styles.albumInfo}>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {album.title}
                  </Text>
                  <Text style={styles.albumMeta}>
                    {(album.type || "album").toUpperCase()} •{" "}
                    {album.total_tracks || 0} song
                    {(album.total_tracks || 0) === 1 ? "" : "s"}
                    {album.release_date
                      ? ` • ${new Date(album.release_date).getFullYear()}`
                      : ""}
                  </Text>
                </View>
                <View style={styles.trackActions}>
                  <TouchableOpacity
                    style={styles.trackActionBtn}
                    onPress={(event: any) => {
                      event.stopPropagation?.();
                      openEditAlbum(album);
                    }}
                  >
                    <Text style={styles.trackActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.trackActionBtn, styles.deleteActionBtn]}
                    onPress={(event: any) => {
                      event.stopPropagation?.();
                      handleDeleteAlbum(album);
                    }}
                  >
                    <Text style={[styles.trackActionText, styles.deleteText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Singles list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Singles</Text>

          {singles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎵</Text>
              <Text style={styles.emptyText}>No singles yet</Text>
              <Text style={styles.emptySub}>
                Upload a standalone track when it is not part of an album
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate("UploadTrack")}
              >
                <Text style={styles.emptyBtnText}>Upload First Track</Text>
              </TouchableOpacity>
            </View>
          ) : (
            singles.map((track, index) => (
              <View key={track.id} style={styles.trackRow}>
                <View style={styles.trackNum}>
                  <Text style={styles.trackNumText}>{index + 1}</Text>
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <View style={styles.trackMeta}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(track.status) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(track.status) },
                      ]}
                    >
                      {track.status}
                    </Text>
                    <Text style={styles.trackDuration}>
                      {formatDuration(track.duration_ms)}
                    </Text>
                  </View>
                </View>
                <View style={styles.trackStats}>
                  <Text style={styles.trackStatText}>
                    ▶ {track.play_count || 0}
                  </Text>
                  <Text style={styles.trackStatText}>
                    ♡ {track.like_count || 0}
                  </Text>
                </View>
                <View style={styles.trackActions}>
                  <TouchableOpacity
                    style={styles.trackActionBtn}
                    onPress={() => openEditTrack(track)}
                  >
                    <Text style={styles.trackActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.trackActionBtn, styles.deleteActionBtn]}
                    onPress={() => handleDeleteTrack(track)}
                  >
                    <Text style={[styles.trackActionText, styles.deleteText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={!!editingTrack}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingTrack(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.modalTitle}>Edit Track</Text>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Track title"
              placeholderTextColor="#666"
              editable={!savingEdit}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingTrack(null)}
                disabled={savingEdit}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveTrack}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editingArtist}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingArtist(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.modalTitle}>Edit Artist</Text>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editArtistName}
              onChangeText={setEditArtistName}
              placeholder="Artist name"
              placeholderTextColor="#666"
              editable={!savingEdit}
            />
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.modalTextArea]}
              value={editArtistBio}
              onChangeText={setEditArtistBio}
              placeholder="Artist bio"
              placeholderTextColor="#666"
              multiline
              editable={!savingEdit}
            />
            <Text style={styles.inputLabel}>Country</Text>
            <TextInput
              style={styles.input}
              value={editArtistCountry}
              onChangeText={setEditArtistCountry}
              placeholder="Country"
              placeholderTextColor="#666"
              editable={!savingEdit}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingArtist(false)}
                disabled={savingEdit}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveArtist}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!editingAlbum}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingAlbum(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.modalTitle}>Edit Album</Text>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={editAlbumTitle}
              onChangeText={setEditAlbumTitle}
              placeholder="Album title"
              placeholderTextColor="#666"
              editable={!savingEdit}
            />
            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeRow}>
              {["album", "ep", "single", "compilation"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    editAlbumType === type && styles.typeChipActive,
                  ]}
                  onPress={() => setEditAlbumType(type)}
                  disabled={savingEdit}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      editAlbumType === type && styles.typeChipTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Release date</Text>
            <TextInput
              style={styles.input}
              value={editAlbumDate}
              onChangeText={setEditAlbumDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#666"
              editable={!savingEdit}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingAlbum(null)}
                disabled={savingEdit}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveAlbum}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  accessDenied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    ...typography.xxl,
    ...typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  mutedText: {
    ...typography.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  backButtonText: {
    ...typography.md,
    ...typography.bold,
    color: "#000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backText: {
    fontSize: 14,
    color: "#1DB954",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
  },
  headerSub: { fontSize: 13, color: "#888" },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 2 },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#1DB95422",
  },
  headerDeleteBtn: {
    backgroundColor: "rgba(239,68,68,0.14)",
  },
  headerActionText: { fontSize: 12, color: "#1DB954", fontWeight: "700" },
  uploadRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  uploadBtnSingle: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    gap: 8,
  },
  uploadBtnAlbum: {
    flex: 1,
    backgroundColor: "#1DB95422",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1DB954",
    gap: 8,
  },
  uploadBtnArtist: {
    flex: 1,
    backgroundColor: "#3B82F622",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3B82F6",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#FBBF2455",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F59E0B",
    gap: 8,
  },
  uploadBtnIcon: { fontSize: 28 },
  actionIcon: { fontSize: 28 },
  uploadBtnLabel: { fontSize: 13, fontWeight: "600", color: "#fff" },
  actionLabel: { fontSize: 13, fontWeight: "600", color: "#fff" },
  actionSub: { fontSize: 11, color: "#F3F4F6", textAlign: "center" },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  albumRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
    gap: 12,
  },
  albumCover: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
  },
  albumInfo: { flex: 1 },
  albumTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  albumMeta: { fontSize: 12, color: "#888", marginTop: 4 },
  albumChevron: { fontSize: 28, color: "#666" },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
    gap: 12,
  },
  artistAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#1a1a1a",
  },
  artistAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
  },
  artistAvatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  emptySub: { fontSize: 13, color: "#888", marginTop: 4, textAlign: "center" },
  emptyBtn: {
    backgroundColor: "#1DB954",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
    gap: 12,
  },
  trackNum: { width: 28, alignItems: "center" },
  trackNumText: { fontSize: 13, color: "#666" },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 14, fontWeight: "600", color: "#fff" },
  trackMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "500" },
  trackDuration: { fontSize: 12, color: "#666", marginLeft: 4 },
  trackStats: {
    alignItems: "flex-end",
    gap: 4,
  },
  trackStatText: { fontSize: 12, color: "#888" },
  trackActions: {
    flexDirection: "row",
    gap: 6,
  },
  trackActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#1DB95422",
  },
  deleteActionBtn: {
    backgroundColor: "rgba(239,68,68,0.14)",
  },
  trackActionText: { fontSize: 12, color: "#1DB954", fontWeight: "700" },
  deleteText: { color: "#EF4444" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 20,
  },
  editModal: {
    backgroundColor: "#161616",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 15,
  },
  modalTextArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#242424",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  typeChipActive: {
    backgroundColor: "#1DB95422",
    borderColor: "#1DB954",
  },
  typeChipText: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  typeChipTextActive: {
    color: "#1DB954",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#242424",
  },
  cancelBtnText: { color: "#fff", fontWeight: "700" },
  saveBtn: {
    minWidth: 80,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#1DB954",
  },
  saveBtnText: { color: "#000", fontWeight: "800" },
});
