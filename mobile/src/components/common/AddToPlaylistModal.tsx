import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { useAppSelector } from "../../hooks/useAppDispatch";
import { playlistService } from "../../services/playlistService";

const { height } = Dimensions.get("window");

interface Props {
  visible: boolean;
  track: any;
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddToPlaylistModal({
  visible,
  track,
  onClose,
  onAdded,
}: Props) {
  const user = useAppSelector((s) => s.auth.user);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const loadPlaylists = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await playlistService.getUserPlaylists(user.id);
    setPlaylists(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (visible) loadPlaylists();
  }, [visible, loadPlaylists]);

  const handleAddToPlaylist = async (playlist: any) => {
    if (!user?.id || !track?.id) return;
    setAddingTo(playlist.id);
    try {
      const { error } = await playlistService.addTrackToPlaylist(
        playlist.id,
        track.id,
        user.id,
      );
      if (error && (error as any).code === "23505") {
        Alert.alert(
          "Already added",
          `"${track.title}" is already in "${playlist.title}"`,
        );
      } else if (error) {
        Alert.alert("Error", "Could not add track to playlist");
      } else {
        onAdded?.();
        onClose();
        // Toast is shown by parent
      }
    } finally {
      setAddingTo(null);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newName.trim() || !user?.id) return;
    setCreating(true);
    try {
      const { data, error } = await playlistService.createPlaylist(
        user.id,
        newName,
      );
      if (error) {
        Alert.alert("Error", "Could not create playlist");
        return;
      }
      setNewName("");
      setShowCreate(false);
      await loadPlaylists();
      // Add track to newly created playlist
      if (data && track?.id) {
        await playlistService.addTrackToPlaylist(data.id, track.id, user.id);
        Alert.alert(
          "✅ Done!",
          `Playlist "${newName}" created and track added!`,
          [
            {
              text: "OK",
              onPress: () => {
                onAdded?.();
                onClose();
              },
            },
          ],
        );
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Save to playlist</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {track?.title}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Create new playlist */}
        {showCreate ? (
          <View style={styles.createRow}>
            <TextInput
              style={styles.createInput}
              placeholder="Playlist name..."
              placeholderTextColor="#666"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TouchableOpacity
              style={styles.createConfirmBtn}
              onPress={handleCreatePlaylist}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.createConfirmText}>Create</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createCancelBtn}
              onPress={() => {
                setShowCreate(false);
                setNewName("");
              }}
            >
              <Text style={styles.createCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.newPlaylistBtn}
            onPress={() => setShowCreate(true)}
          >
            <View style={styles.newPlaylistIcon}>
              <Text style={styles.newPlaylistIconText}>+</Text>
            </View>
            <Text style={styles.newPlaylistText}>Create new playlist</Text>
          </TouchableOpacity>
        )}

        {/* Playlists list */}
        {loading ? (
          <ActivityIndicator color="#1DB954" style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.playlistRow}
                onPress={() => handleAddToPlaylist(item)}
                disabled={addingTo === item.id}
              >
                <View style={styles.playlistIcon}>
                  <Text style={styles.playlistIconText}>
                    {item.title === "Liked Songs" ? "♥" : "♪"}
                  </Text>
                </View>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistTitle}>{item.title}</Text>
                  <Text style={styles.playlistCount}>
                    {item.total_tracks || 0} tracks
                  </Text>
                </View>
                {addingTo === item.id ? (
                  <ActivityIndicator color="#1DB954" size="small" />
                ) : (
                  <Text style={styles.addIcon}>+</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.emptyText}>
                No playlists yet. Create one above.
              </Text>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.75,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#444",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2, maxWidth: 250 },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 16, color: "#666" },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },
  createInput: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
  },
  createConfirmBtn: {
    backgroundColor: "#1DB954",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createConfirmText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  createCancelBtn: { padding: 10 },
  createCancelText: { color: "#888", fontSize: 13 },
  newPlaylistBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },
  newPlaylistIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  newPlaylistIconText: { fontSize: 24, color: "#1DB954", fontWeight: "300" },
  newPlaylistText: { fontSize: 15, color: "#fff", fontWeight: "500" },
  list: { maxHeight: height * 0.4 },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
  },
  playlistIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  playlistIconText: { fontSize: 20 },
  playlistInfo: { flex: 1 },
  playlistTitle: { fontSize: 15, fontWeight: "500", color: "#fff" },
  playlistCount: { fontSize: 12, color: "#888", marginTop: 2 },
  addIcon: { fontSize: 22, color: "#1DB954", fontWeight: "300" },
  emptyText: { textAlign: "center", color: "#666", padding: 24, fontSize: 14 },
});
