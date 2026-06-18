import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../../services/api";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

interface TrackItem {
  id: string;
  file: any;
  title: string;
  artistNames: string;
  albumName: string;
  explicit: boolean;
  status: "idle" | "uploading" | "done" | "error" | "duplicate";
  error?: string;
  progress: number;
}

interface Props {
  navigation: any;
}

export default function BulkUploadScreen({ navigation }: Props) {
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [sharedAlbum, setSharedAlbum] = useState("");
  const [sharedArtists, setSharedArtists] = useState("");
  const [useSharedMeta, setUseSharedMeta] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.type === "cancel") return;
      if (!Array.isArray(result.output) && result.type !== "success") return;

      const assets = Array.isArray(result.output) ? result.output : [result];

      const newTracks: TrackItem[] = assets.map((asset) => ({
        id: Math.random().toString(36).slice(2),
        file: asset,
        title: asset.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        artistNames: sharedArtists,
        albumName: sharedAlbum,
        explicit: false,
        status: "idle",
        progress: 0,
      }));

      setTracks((prev) => [...prev, ...newTracks]);
    } catch (err) {
      Alert.alert("Error", "Could not pick files");
    }
  };

  const removeTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTrack = (id: string, field: keyof TrackItem, value: any) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
  };

  const applySharedMeta = () => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        albumName: sharedAlbum || t.albumName,
        artistNames: sharedArtists || t.artistNames,
      })),
    );
  };

  const handleUpload = async () => {
    const validTracks = tracks.filter(
      (t) => t.title.trim() && t.status === "idle",
    );

    if (validTracks.length === 0) {
      Alert.alert(
        "Nothing to upload",
        "Add some tracks and fill in their titles first.",
      );
      return;
    }

    if (
      !sharedArtists.trim() &&
      validTracks.some((t) => !t.artistNames.trim())
    ) {
      Alert.alert(
        "Missing artists",
        "Please enter artist names for all tracks or set a shared artist.",
      );
      return;
    }

    setUploading(true);
    setSummary(null);

    setTracks((prev) =>
      prev.map((t) =>
        t.status === "idle" ? { ...t, status: "uploading", progress: 0 } : t,
      ),
    );

    try {
      const files = validTracks.map((t) => ({
        uri: t.file.uri,
        name: t.file.name,
        type: t.file.mimeType || "audio/mpeg",
      }));

      const metadata = validTracks.map((t) => ({
        title: t.title.trim(),
        artist_names:
          useSharedMeta && sharedArtists.trim()
            ? sharedArtists.trim()
            : t.artistNames.trim(),
        album_name:
          useSharedMeta && sharedAlbum.trim()
            ? sharedAlbum.trim()
            : t.albumName.trim() || undefined,
        explicit: t.explicit,
      }));

      const response = await api.bulkUpload(files, metadata);

      const resultMap = new Map(response.results.map((r: any) => [r.index, r]));
      let resultIndex = 0;

      setTracks((prev) =>
        prev.map((t) => {
          if (t.status !== "uploading") return t;
          const result = resultMap.get(resultIndex++);
          if (!result) return t;
          if (result.success) {
            return { ...t, status: "done", progress: 100 };
          }
          if (result.duplicate_track_id) {
            return {
              ...t,
              status: "duplicate",
              error: result.error,
              progress: 0,
            };
          }
          return { ...t, status: "error", error: result.error, progress: 0 };
        }),
      );

      setSummary(response.summary);
    } catch (err: any) {
      Alert.alert(
        "Upload failed",
        err.message || "An unexpected error occurred",
      );
      setTracks((prev) =>
        prev.map((t) =>
          t.status === "uploading"
            ? { ...t, status: "error", error: "Upload failed" }
            : t,
        ),
      );
    } finally {
      setUploading(false);
    }
  };

  const clearDone = () => {
    setTracks((prev) => prev.filter((t) => t.status !== "done"));
    setSummary(null);
  };

  const statusColor = (status: TrackItem["status"]) => {
    switch (status) {
      case "done":
        return colors.primary;
      case "error":
        return colors.red;
      case "duplicate":
        return colors.yellow;
      case "uploading":
        return colors.blue;
      default:
        return colors.textTertiary;
    }
  };

  const statusLabel = (status: TrackItem["status"]) => {
    switch (status) {
      case "done":
        return "✓ Done";
      case "error":
        return "✕ Error";
      case "duplicate":
        return "⚠ Duplicate";
      case "uploading":
        return "Uploading...";
      default:
        return "Waiting";
    }
  };

  const idleCount = tracks.filter((t) => t.status === "idle").length;
  const doneCount = tracks.filter((t) => t.status === "done").length;
  const errorCount = tracks.filter(
    (t) => t.status === "error" || t.status === "duplicate",
  ).length;
  const uploadingCount = tracks.filter((t) => t.status === "uploading").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bulk Upload</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{tracks.length} tracks</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {summary && (
          <View
            style={[
              styles.summaryBanner,
              summary.failed === 0
                ? styles.summarySuccess
                : styles.summaryPartial,
            ]}
          >
            <Text style={styles.summaryTitle}>
              {summary.failed === 0
                ? `✓ All ${summary.succeeded} tracks uploaded successfully!`
                : `${summary.succeeded} uploaded · ${summary.failed} failed`}
            </Text>
            {doneCount > 0 && (
              <TouchableOpacity onPress={clearDone}>
                <Text style={styles.summaryClear}>Clear completed</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Shared Metadata</Text>
            <TouchableOpacity
              style={[styles.toggleBtn, useSharedMeta && styles.toggleBtnOn]}
              onPress={() => setUseSharedMeta((prev) => !prev)}
            >
              <Text
                style={[
                  styles.toggleText,
                  useSharedMeta && styles.toggleTextOn,
                ]}
              >
                {useSharedMeta ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSub}>
            Apply the same album and artists to all tracks
          </Text>

          <Text style={styles.fieldLabel}>ALBUM / FILM NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Aashiqui 2, Cocktail 2"
            placeholderTextColor={colors.textDisabled}
            value={sharedAlbum}
            onChangeText={setSharedAlbum}
            editable={!uploading}
          />

          <Text style={styles.fieldLabel}>ARTISTS (comma separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Arijit Singh, Pritam"
            placeholderTextColor={colors.textDisabled}
            value={sharedArtists}
            onChangeText={setSharedArtists}
            editable={!uploading}
          />

          {tracks.length > 0 && (
            <TouchableOpacity style={styles.applyBtn} onPress={applySharedMeta}>
              <Text style={styles.applyBtnText}>Apply to all tracks</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.addFilesBtn, uploading && styles.addFilesBtnDisabled]}
          onPress={pickFiles}
          disabled={uploading}
          activeOpacity={0.8}
        >
          <Text style={styles.addFilesBtnIcon}>＋</Text>
          <View>
            <Text style={styles.addFilesBtnText}>Add Audio Files</Text>
            <Text style={styles.addFilesBtnSub}>
              MP3, AAC, WAV, FLAC · Max 50MB each
            </Text>
          </View>
        </TouchableOpacity>

        {tracks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Tracks</Text>
              <View style={styles.countRow}>
                {doneCount > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: colors.primaryDim },
                    ]}
                  >
                    <Text
                      style={[styles.countBadgeText, { color: colors.primary }]}
                    >
                      ${doneCount} done
                    </Text>
                  </View>
                )}
                {errorCount > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: colors.red + "22" },
                    ]}
                  >
                    <Text
                      style={[styles.countBadgeText, { color: colors.red }]}
                    >
                      ${errorCount} failed
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {tracks.map((track, index) => (
              <View
                key={track.id}
                style={[
                  styles.trackCard,
                  track.status === "done" && styles.trackCardDone,
                  track.status === "error" && styles.trackCardError,
                  track.status === "duplicate" && styles.trackCardWarn,
                ]}
              >
                <View style={styles.trackHeader}>
                  <View style={styles.trackIndexBadge}>
                    <Text style={styles.trackIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.trackFileName} numberOfLines={1}>
                    {track.file.name}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColor(track.status) + "22" },
                    ]}
                  >
                    {track.status === "uploading" ? (
                      <ActivityIndicator size="small" color={colors.blue} />
                    ) : (
                      <Text
                        style={[
                          styles.statusText,
                          { color: statusColor(track.status) },
                        ]}
                      >
                        {statusLabel(track.status)}
                      </Text>
                    )}
                  </View>
                  {track.status === "idle" && !uploading && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeTrack(track.id)}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {track.error && (
                  <View style={styles.errorRow}>
                    <Text style={styles.errorText}>{track.error}</Text>
                  </View>
                )}

                {(track.status === "idle" || track.status === "error") && (
                  <View style={styles.trackFields}>
                    <Text style={styles.fieldLabel}>TITLE *</Text>
                    <TextInput
                      style={styles.input}
                      value={track.title}
                      onChangeText={(v) => updateTrack(track.id, "title", v)}
                      placeholder="Track title"
                      placeholderTextColor={colors.textDisabled}
                      editable={!uploading}
                    />

                    {!useSharedMeta && (
                      <>
                        <Text style={styles.fieldLabel}>ARTISTS</Text>
                        <TextInput
                          style={styles.input}
                          value={track.artistNames}
                          onChangeText={(v) =>
                            updateTrack(track.id, "artistNames", v)
                          }
                          placeholder="e.g. Arijit Singh, Pritam"
                          placeholderTextColor={colors.textDisabled}
                          editable={!uploading}
                        />
                        <Text style={styles.fieldLabel}>ALBUM</Text>
                        <TextInput
                          style={styles.input}
                          value={track.albumName}
                          onChangeText={(v) =>
                            updateTrack(track.id, "albumName", v)
                          }
                          placeholder="Album name"
                          placeholderTextColor={colors.textDisabled}
                          editable={!uploading}
                        />
                      </>
                    )}

                    <TouchableOpacity
                      style={styles.explicitToggle}
                      onPress={() =>
                        updateTrack(track.id, "explicit", !track.explicit)
                      }
                    >
                      <View
                        style={[
                          styles.explicitBox,
                          track.explicit && styles.explicitBoxOn,
                        ]}
                      >
                        {track.explicit && (
                          <Text style={styles.explicitCheck}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.explicitLabel}>Explicit content</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {tracks.length > 0 && (
          <TouchableOpacity
            style={[
              styles.uploadBtn,
              (uploading || idleCount === 0) && styles.uploadBtnDisabled,
            ]}
            onPress={handleUpload}
            disabled={uploading || idleCount === 0}
            activeOpacity={0.85}
          >
            {uploading ? (
              <View style={styles.uploadBtnInner}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.uploadBtnText}>
                  Uploading {uploadingCount} tracks...
                </Text>
              </View>
            ) : (
              <Text style={styles.uploadBtnText}>
                Upload {idleCount} Track{idleCount !== 1 ? "s" : ""}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backBtn: { padding: spacing.sm },
  backText: { fontSize: 22, color: colors.primary, fontWeight: "600" },
  headerTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  headerBadge: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerBadgeText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
  },
  summaryBanner: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },
  summarySuccess: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primaryMid,
  },
  summaryPartial: {
    backgroundColor: colors.yellow + "15",
    borderColor: colors.yellow + "44",
  },
  summaryTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  summaryClear: { ...typography.sm, color: colors.primary, fontWeight: "600" },
  section: { marginTop: spacing.xl },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  sectionSub: {
    ...typography.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  countRow: { flexDirection: "row", gap: spacing.xs },
  countBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  countBadgeText: { ...typography.xs, ...typography.bold },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  toggleBtnOn: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  toggleText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
  },
  toggleTextOn: { color: colors.primary },
  fieldLabel: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.md,
    color: colors.textPrimary,
  },
  applyBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.full,
  },
  applyBtnText: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.primary,
  },
  addFilesBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    padding: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  addFilesBtnDisabled: { borderColor: colors.border, opacity: 0.5 },
  addFilesBtnIcon: { fontSize: 32, color: colors.primary },
  addFilesBtnText: {
    ...typography.lg,
    ...typography.bold,
    color: colors.primary,
  },
  addFilesBtnSub: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  trackCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  trackCardDone: {
    borderColor: colors.primaryMid,
    backgroundColor: colors.primaryDim,
  },
  trackCardError: {
    borderColor: colors.red + "44",
    backgroundColor: colors.red + "11",
  },
  trackCardWarn: {
    borderColor: colors.yellow + "44",
    backgroundColor: colors.yellow + "11",
  },
  trackHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trackIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  trackIndexText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
  },
  trackFileName: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    minWidth: 72,
    alignItems: "center",
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  removeBtn: { padding: spacing.xs },
  removeBtnText: { fontSize: 16, color: colors.textTertiary },
  errorRow: {
    backgroundColor: colors.red + "22",
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: { ...typography.xs, color: colors.red },
  trackFields: { marginTop: spacing.md, gap: spacing.xs },
  explicitToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  explicitBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  explicitBoxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  explicitCheck: { fontSize: 12, color: "#000", fontWeight: "700" },
  explicitLabel: { ...typography.sm, color: colors.textSecondary },
  uploadBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.green,
  },
  uploadBtnDisabled: { opacity: 0.4, ...shadows.sm },
  uploadBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  uploadBtnText: { ...typography.lg, ...typography.bold, color: "#000" },
});
