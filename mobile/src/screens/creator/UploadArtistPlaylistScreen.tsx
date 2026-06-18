import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../services/supabase";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { setUser } from "../../store/slices/authSlice";
import { colors, radius, spacing, typography } from "../../utils/theme";
import { isCreator } from "../../utils/roles";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const API_PREFIX = process.env.EXPO_PUBLIC_API_PREFIX || "/api/v2";
const API_BASE = API_URL ? `${API_URL}${API_PREFIX}` : "";

export default function UploadArtistPlaylistScreen({ navigation }: any) {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();

  const [artistName, setArtistName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("India");
  const [artwork, setArtwork] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");

  if (!isCreator(user)) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.accessDenied}>
          <Text style={styles.pageTitle}>Creator access required</Text>
          <Text style={styles.helpText}>
            Ask an admin to make your account a creator before creating artist
            profiles.
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
    if (user?.id) {
      setArtistName("");
    }
  }, [user?.id]);

  const pickArtwork = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) setArtwork(result.assets[0]);
  };

  const uploadArtwork = async (token: string, artistId: string) => {
    if (!artwork) return null;

    const formData = new FormData();
    await appendPickedFile(
      formData,
      "artwork",
      artwork,
      `artist_playlist_${Date.now()}.jpg`,
      "image/jpeg",
    );
    formData.append("artist_id", artistId);

    const res = await fetch(`${API_BASE}/upload/artwork`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Artwork upload failed");
    return json.artworkUrl as string;
  };

  const ensureArtist = async (token: string) => {
    const res = await fetch(`${API_BASE}/artists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: artistName.trim(),
        bio: bio.trim(),
        country: country.trim(),
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not create artist");
    dispatch(setUser({ ...user!, is_artist: true }));
    return json.data;
  };

  const handleUpload = async () => {
    if (!artistName.trim()) {
      Alert.alert("Artist name required", "Enter the artist name");
      return;
    }

    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || !user?.id) throw new Error("Not logged in");

      setProgressLabel("Creating artist profile...");
      const artist = await ensureArtist(session.access_token);

      setProgressLabel(artwork ? "Uploading artist image..." : "Finishing...");
      const artworkUrl = await uploadArtwork(session.access_token, artist.id);
      if (artworkUrl) {
        await supabase
          .from("artists")
          .update({ avatar_url: artworkUrl, header_image_url: artworkUrl })
          .eq("id", artist.id);
      }

      Alert.alert(
        "Artist profile created",
        `${artistName.trim()} is ready. Upload tracks or albums and credit this artist by name.`,
        [
          {
            text: "View Artist",
            onPress: () =>
              navigation.replace("ArtistProfile", { artistId: artist.id }),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert("Upload failed", err.message);
    } finally {
      setUploading(false);
      setProgressLabel("");
    }
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
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Artist Profile</Text>
            <View style={{ width: 52 }} />
          </View>

          <TouchableOpacity style={styles.artworkPicker} onPress={pickArtwork}>
            {artwork ? (
              <Image source={{ uri: artwork.uri }} style={styles.artwork} />
            ) : (
              <View style={styles.artworkEmpty}>
                <Text style={styles.artworkIcon}>◎</Text>
                <Text style={styles.artworkText}>Add artist image</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>ARTIST NAME *</Text>
          <TextInput
            style={styles.input}
            value={artistName}
            onChangeText={setArtistName}
            placeholder="Artist name"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={styles.label}>BIO</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="Short artist bio"
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={styles.label}>COUNTRY</Text>
          <TextInput
            style={styles.input}
            value={country}
            onChangeText={setCountry}
            placeholder="India"
            placeholderTextColor={colors.textDisabled}
          />

          {uploading && (
            <View style={styles.progressBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.progressText}>{progressLabel}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.uploadBtn,
              (uploading || !artistName.trim()) && styles.uploadBtnDisabled,
            ]}
            onPress={handleUpload}
            disabled={uploading || !artistName.trim()}
          >
            <Text style={styles.uploadBtnText}>Create Artist Profile</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  accessDenied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  pageTitle: {
    ...typography.xxl,
    ...typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  helpText: {
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
  scroll: { padding: spacing.xl, flexGrow: 1 },
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
  artworkPicker: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 280,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  artwork: { width: "100%", height: "100%" },
  artworkEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  artworkIcon: { fontSize: 48, color: colors.textSecondary },
  artworkText: { ...typography.md, color: colors.textSecondary },
  label: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.md,
  },
  textArea: { minHeight: 96, textAlignVertical: "top" },
  tracksHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  sectionSub: { ...typography.sm, color: colors.textSecondary },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBtnText: { ...typography.sm, ...typography.bold, color: "#000" },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  trackIndex: {
    width: 24,
    textAlign: "center",
    ...typography.sm,
    color: colors.textSecondary,
  },
  trackInput: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.md,
    paddingVertical: spacing.xs,
  },
  genreWrap: { marginTop: spacing.md },
  genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  genreChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  genreChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  genreText: { ...typography.sm, color: colors.textSecondary },
  genreTextActive: { color: colors.primary, fontWeight: "700" },
  progressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  progressText: { ...typography.sm, color: colors.textPrimary, flex: 1 },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { ...typography.md, ...typography.bold, color: "#000" },
});
