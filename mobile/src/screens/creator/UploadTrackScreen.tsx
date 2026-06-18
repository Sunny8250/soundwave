import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../services/supabase";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const API_PREFIX = process.env.EXPO_PUBLIC_API_PREFIX || "/api/v2";
const API_BASE = API_URL ? `${API_URL}${API_PREFIX}` : "";

export default function UploadTrackScreen({ navigation }: any) {
  const [file, setFile] = useState<any>(null);
  const [artwork, setArtwork] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [artistNames, setArtistNames] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [explicit, setExplicit] = useState(false);
  const [artists, setArtists] = useState<any[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState("");
  const [genres, setGenres] = useState<any[]>([]);
  const [selGenres, setSelGenres] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const appendPickedFile = async (
    formData: FormData,
    fieldName: string,
    asset: any,
    fallbackName: string,
    fallbackType: string,
  ) => {
    const name = asset.name || asset.fileName || fallbackName;
    const type = asset.mimeType || asset.file?.type || fallbackType;

    if (Platform.OS === "web") {
      if (asset.file) {
        formData.append(fieldName, asset.file, asset.file.name || name);
        return;
      }

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      formData.append(fieldName, blob, name);
      return;
    }

    formData.append(fieldName, {
      uri: asset.uri,
      name,
      type,
    } as any);
  };

  useEffect(() => {
    supabase
      .from("genres")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setGenres(data);
      });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      supabase
        .from("artists")
        .select("id, name")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setArtists(data || []);
          if (data?.length) {
            setSelectedArtistId((prev) => prev || data[0].id);
            setArtistNames((prev) => prev || data[0].name);
          }
        });
    });
  }, []);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "audio/mpeg",
          "audio/wav",
          "audio/flac",
          "audio/x-flac",
          "audio/aiff",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setFile(asset);
      if (!title) {
        setTitle(asset.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      Alert.alert("Error", "Could not pick file");
    }
  };

  const pickArtwork = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow access to your photo library",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      setArtwork(result.assets[0]);
    } catch (err) {
      Alert.alert("Error", "Could not pick image");
    }
  };

  const uploadArtwork = async (artistId: string, trackId: string) => {
    if (!artwork) return null;
    try {
      const ext = artwork.uri.split(".").pop()?.toLowerCase() || "jpg";

      const formData = new FormData();
      await appendPickedFile(
        formData,
        "artwork",
        artwork,
        `artwork_${trackId}.${ext}`,
        artwork.mimeType || "image/jpeg",
      );
      formData.append("artist_id", artistId);

      // Upload through backend which has service role permissions
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const uploadResponse = await fetch(`${API_BASE}/upload/artwork`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Artwork upload failed");
      }

      const { artworkUrl } = await uploadResponse.json();
      return artworkUrl;
    } catch (err) {
      console.error("Artwork upload error:", err);
      return null;
    }
  };

  const toggleGenre = (id: string) => {
    setSelGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const handleUpload = async () => {
    if (!file) {
      Alert.alert("Error", "Please select an audio file");
      return;
    }
    if (!title) {
      Alert.alert("Error", "Track title is required");
      return;
    }
    if (!selectedArtistId) {
      Alert.alert("Error", "Please select an artist");
      return;
    }

    setUploading(true);
    setProgress(10);
    setProgressLabel("Getting ready...");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const artist = artists.find((item) => item.id === selectedArtistId);

      if (!artist) throw new Error("Artist profile not found");

      setProgress(25);
      setProgressLabel(
        artwork ? "Uploading artwork..." : "Preparing artwork...",
      );

      // Optional artwork. Album songs can inherit the album cover.
      const trackId = uuidv4();
      const artworkUrl = await uploadArtwork(artist.id, trackId);

      setProgress(45);
      setProgressLabel("Uploading audio...");

      // Build form data
      const formData = new FormData();
      await appendPickedFile(
        formData,
        "file",
        file,
        file.name || `${title}.mp3`,
        file.mimeType || "audio/mpeg",
      );
      formData.append("title", title);
      formData.append("artist_id", artist.id);
      formData.append("artist_names", artistNames.trim() || artist.name);
      formData.append("track_id", trackId);
      formData.append("explicit", explicit ? "true" : "false");
      if (albumName) formData.append("album_name", albumName);
      if (artworkUrl) formData.append("artwork_url", artworkUrl);
      if (selGenres.length > 0) {
        formData.append("genre_ids", JSON.stringify(selGenres));
      }

      setProgress(60);
      setProgressLabel("Processing...");

      const res = await fetch(`${API_BASE}/upload/track`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      setProgress(90);
      const json = await res.json();

      if (!res.ok) {
        Alert.alert("Upload failed", json.error || "Something went wrong");
        return;
      }

      setProgress(100);
      setProgressLabel("Done!");

      Alert.alert(
        "🎉 Upload successful!",
        `"${title}" has been uploaded successfully.`,
        [{ text: "Done", onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
      setProgress(0);
      setProgressLabel("");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isWeb = Platform.OS === "web";

  const webScreenStyle = isWeb
    ? ({ height: "100vh", maxHeight: "100vh", overflow: "hidden" } as any)
    : undefined;

  const keyboardStyle = isWeb
    ? ({ flex: 1, minHeight: 0, height: "100%" } as any)
    : { flex: 1 };

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
  const artworkPickerStyle = isWeb
    ? [styles.artworkPicker, styles.artworkPickerWeb]
    : styles.artworkPicker;

  return (
    <SafeAreaView style={[styles.container, webScreenStyle]} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "web"
              ? undefined
              : "height"
        }
        style={keyboardStyle}
      >
        <ScrollView
          style={webScrollStyle}
          contentContainerStyle={[styles.scroll, webScrollContentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Upload Track</Text>
            <View style={{ width: 50 }} />
          </View>

          {artists.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Artist</Text>
              <Text style={styles.sectionSub}>
                This track will be attached to the selected artist.
              </Text>
              <View style={styles.artistGrid}>
                {artists.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.artistChip,
                      selectedArtistId === item.id && styles.artistChipSelected,
                    ]}
                    onPress={() => {
                      const previousArtistName = artists.find(
                        (artist) => artist.id === selectedArtistId,
                      )?.name;
                      setSelectedArtistId(item.id);
                      setArtistNames((prev) =>
                        !prev || prev === previousArtistName ? item.name : prev,
                      );
                    }}
                    disabled={uploading}
                  >
                    <Text
                      style={[
                        styles.artistChipText,
                        selectedArtistId === item.id &&
                          styles.artistChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Artwork picker */}
          <TouchableOpacity
            style={artworkPickerStyle}
            onPress={pickArtwork}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {artwork ? (
              <>
                <Image
                  source={{ uri: artwork.uri }}
                  style={styles.artworkImage}
                />
                <View style={styles.artworkOverlay}>
                  <Text style={styles.artworkOverlayText}>📷 Change</Text>
                </View>
              </>
            ) : (
              <View style={styles.artworkEmpty}>
                <Text style={styles.artworkEmptyIcon}>🖼</Text>
                <Text style={styles.artworkEmptyTitle}>
                  Add Album / Track Art
                </Text>
                <Text style={styles.artworkEmptySubtitle}>
                  Optional. Album songs use the album cover automatically.
                </Text>
                <Text style={styles.artworkEmptyHint}>
                  Square image recommended (1:1)
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Audio file picker */}
          <TouchableOpacity
            style={[styles.filePicker, file && styles.filePickerSelected]}
            onPress={pickFile}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {file ? (
              <View style={styles.fileInfo}>
                <View style={styles.fileIconBox}>
                  <Text style={styles.fileIcon}>🎵</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {formatFileSize(file.size || 0)}
                  </Text>
                </View>
                <Text style={styles.changeText}>Change</Text>
              </View>
            ) : (
              <View style={styles.filePickerEmpty}>
                <Text style={styles.filePickerIcon}>📁</Text>
                <Text style={styles.filePickerTitle}>Select Audio File</Text>
                <Text style={styles.filePickerSub}>MP3, WAV, FLAC, AIFF</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Progress bar */}
          {uploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBg}>
                <View
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
              <Text style={styles.progressText}>
                {progressLabel} {progress}%
              </Text>
            </View>
          )}

          {/* Track details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Track Details</Text>

            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Track title"
              placeholderTextColor={colors.textDisabled}
              value={title}
              onChangeText={setTitle}
              editable={!uploading}
            />

            <Text style={styles.label}>Artists *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Arijit Singh, Mithoon"
              placeholderTextColor={colors.textDisabled}
              value={artistNames}
              onChangeText={setArtistNames}
              editable={!uploading}
            />
            <Text style={styles.artistHint}>
              Separate multiple artists with commas
            </Text>

            <Text style={styles.label}>Album / Film Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cocktail 2, Aashiqui 3"
              placeholderTextColor={colors.textDisabled}
              value={albumName}
              onChangeText={setAlbumName}
              editable={!uploading}
            />
            <Text style={styles.artistHint}>
              Songs with the same album name are grouped together automatically
            </Text>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setExplicit(!explicit)}
              disabled={uploading}
            >
              <View>
                <Text style={styles.toggleLabel}>Explicit Content</Text>
                <Text style={styles.toggleSub}>
                  Contains strong language or adult themes
                </Text>
              </View>
              <View style={[styles.toggle, explicit && styles.toggleOn]}>
                <View
                  style={[styles.toggleDot, explicit && styles.toggleDotOn]}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Genre selection */}
          {genres.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <Text style={styles.sectionSub}>Select all that apply</Text>
              <View style={styles.genreGrid}>
                {genres.map((genre) => (
                  <TouchableOpacity
                    key={genre.id}
                    style={[
                      styles.genreChip,
                      selGenres.includes(genre.id) && styles.genreChipSelected,
                    ]}
                    onPress={() => toggleGenre(genre.id)}
                    disabled={uploading}
                  >
                    <Text
                      style={[
                        styles.genreChipText,
                        selGenres.includes(genre.id) &&
                          styles.genreChipTextSelected,
                      ]}
                    >
                      {genre.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Upload button */}
          <TouchableOpacity
            style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
            onPress={handleUpload}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.uploadBtnText}>🚀 Upload Track</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  backText: { ...typography.md, color: colors.primary },
  headerTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },

  // Artwork
  artworkPicker: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  artworkPickerWeb: {
    width: 320,
    height: 320,
    maxWidth: "100%",
    alignSelf: "center",
    aspectRatio: undefined,
  },
  artworkImage: { width: "100%", height: "100%" },
  artworkOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  artworkOverlayText: { ...typography.lg, ...typography.bold, color: "#fff" },
  artworkEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  artworkEmptyIcon: { fontSize: 48 },
  artworkEmptyTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  artworkEmptySubtitle: { ...typography.sm, color: colors.textSecondary },
  artworkEmptyHint: { ...typography.xs, color: colors.textTertiary },

  // File picker
  filePicker: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  filePickerSelected: { borderColor: colors.primary, borderStyle: "solid" },
  filePickerEmpty: { alignItems: "center", gap: spacing.sm },
  filePickerIcon: { fontSize: 32 },
  filePickerTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  filePickerSub: { ...typography.sm, color: colors.textSecondary },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDim,
    justifyContent: "center",
    alignItems: "center",
  },
  fileIcon: { fontSize: 24 },
  fileName: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  fileSize: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  changeText: { ...typography.sm, color: colors.primary },

  // Progress
  progressContainer: { marginBottom: spacing.lg },
  progressBg: {
    height: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },

  // Form
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionSub: {
    ...typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  artistHint: {
    ...typography.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleLabel: {
    ...typography.md,
    ...typography.medium,
    color: colors.textPrimary,
  },
  toggleSub: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
    maxWidth: "80%",
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: colors.primary },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textSecondary,
  },
  toggleDotOn: {
    backgroundColor: "#000",
    alignSelf: "flex-end",
  },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  artistGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  artistChip: {
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  artistChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  artistChipText: {
    ...typography.sm,
    color: colors.textSecondary,
  },
  artistChipTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  genreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  genreChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  genreChipText: { ...typography.sm, color: colors.textSecondary },
  genreChipTextSelected: { color: colors.primary, fontWeight: "600" },

  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.green,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { ...typography.md, ...typography.bold, color: "#000" },
});
