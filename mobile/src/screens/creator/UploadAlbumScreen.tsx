import React, { useState, useEffect, useRef } from "react";
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
  FlatList,
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

type TrackUploadStatus =
  | "pending"
  | "checking"
  | "uploading"
  | "success"
  | "failed"
  | "skipped";

interface AudioFile {
  id: string;
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  title: string;
  artistNames: string;
  trackNum: number;
  file?: File;
  uploadStatus?: TrackUploadStatus;
  uploadError?: string;
  uploadedTrackId?: string;
}

export default function UploadAlbumScreen({ navigation }: any) {
  const [albumName, setAlbumName] = useState("");
  const [albumType, setAlbumType] = useState<"album" | "ep" | "single">(
    "album",
  );
  const [artwork, setArtwork] = useState<any>(null);
  const [artists, setArtists] = useState<any[]>([]);
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [selGenres, setSelGenres] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [totalTracks, setTotalTracks] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [formError, setFormError] = useState("");
  const uploadClickGuard = useRef(false);

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
        });
    });
  }, []);

  // ── Pick multiple audio files ─────────────────────────────
  const pickAudioFiles = async () => {
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
        multiple: true,
      });

      if (result.canceled) return;

      const newFiles: AudioFile[] = result.assets.map((asset, i) => ({
        id: Math.random().toString(36).slice(2),
        uri: asset.uri,
        name: asset.name,
        size: asset.size || 0,
        mimeType: asset.mimeType || "audio/mpeg",
        title: asset.name.replace(/\.[^/.]+$/, ""),
        artistNames: "",
        trackNum: tracks.length + i + 1,
        file: asset.file,
        uploadStatus: "pending",
      }));

      setTracks((prev) => [...prev, ...newFiles]);
    } catch (err) {
      Alert.alert("Error", "Could not pick files");
    }
  };

  // ── Pick artwork ──────────────────────────────────────────
  const pickArtwork = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    if (!result.canceled) setArtwork(result.assets[0]);
  };

  // ── Remove a track ────────────────────────────────────────
  const removeTrack = (id: string) => {
    setTracks((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      return filtered.map((t, i) => ({ ...t, trackNum: i + 1 }));
    });
  };

  // ── Update track title ────────────────────────────────────
  const updateTitle = (id: string, title: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  };

  const updateTrackArtists = (id: string, trackArtistNames: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, artistNames: trackArtistNames } : t,
      ),
    );
  };

  const updateTrackUploadState = (
    id: string,
    changes: Partial<
      Pick<AudioFile, "uploadStatus" | "uploadError" | "uploadedTrackId">
    >,
  ) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === id ? { ...track, ...changes } : track)),
    );
  };

  // ── Move track up/down ────────────────────────────────────
  const moveTrack = (id: string, direction: "up" | "down") => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;

      const newArr = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
      return newArr.map((t, i) => ({ ...t, trackNum: i + 1 }));
    });
  };

  // ── Upload artwork to backend API ────────────────────────────
  const uploadArtwork = async (artistId: string, albumId: string) => {
    if (!artwork) return null;
    try {
      // Create FormData for upload
      const formData = new FormData();
      await appendPickedFile(
        formData,
        "artwork",
        artwork,
        `album_artwork_${albumId}.jpg`,
        "image/jpeg",
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

  const getPrimaryArtistName = (artistText: string) =>
    String(artistText || "")
      .split(/,|&|feat\.|ft\.|featuring| x | × /i)
      .map((name) => name.trim())
      .filter(Boolean)[0] || "";

  const resolveAlbumArtist = async (
    session: any,
    tracksForAttempt: AudioFile[],
  ) => {
    const primaryArtistName = tracksForAttempt
      .map((track) => getPrimaryArtistName(track.artistNames))
      .find(Boolean);

    if (!primaryArtistName) {
      throw new Error("Enter artists for each track before uploading.");
    }

    const localArtist = artists.find(
      (artist) =>
        String(artist.name || "")
          .trim()
          .toLowerCase() === primaryArtistName.toLowerCase(),
    );

    if (localArtist) return localArtist;

    const { data: ownedArtists, error: ownedArtistErr } = await supabase
      .from("artists")
      .select("id, name")
      .eq("user_id", session.user.id)
      .ilike("name", primaryArtistName)
      .limit(1);

    if (ownedArtistErr) throw ownedArtistErr;
    if (ownedArtists?.[0]) {
      setArtists((prev) => {
        if (prev.some((artist) => artist.id === ownedArtists[0].id)) {
          return prev;
        }
        return [ownedArtists[0], ...prev];
      });
      return ownedArtists[0];
    }

    const res = await fetch(`${API_BASE}/artists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name: primaryArtistName }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || "Could not create artist profile");
    }

    if (json.data) {
      setArtists((prev) => [json.data, ...prev]);
    }

    return json.data;
  };

  // ── Main upload function ──────────────────────────────────
  const handleUpload = async (retryFailedOnly: boolean = false) => {
    const retryOnly = retryFailedOnly === true;
    setFormError("");

    if (!albumName.trim()) {
      setFormError("Album name is required.");
      Alert.alert("Error", "Album name is required");
      return;
    }

    const tracksForAttempt = retryOnly
      ? tracks.filter((track) => track.uploadStatus === "failed")
      : tracks.filter((track) => track.uploadStatus !== "success");

    if (tracksForAttempt.length === 0) {
      setFormError(
        retryOnly
          ? "There are no failed tracks to retry."
          : tracks.length === 0
            ? "Add at least one track."
            : "All tracks are already uploaded.",
      );
      Alert.alert(
        "Nothing to upload",
        retryOnly
          ? "There are no failed tracks to retry."
          : tracks.length === 0
            ? "Add at least one track"
            : "All tracks are already uploaded.",
      );
      return;
    }
    const tracksMissingArtists = tracksForAttempt.filter(
      (track) => !track.artistNames.trim(),
    );

    if (tracksMissingArtists.length > 0) {
      const message = "Enter artists for every track before uploading.";
      setFormError(message);
      Alert.alert("Error", message);
      return;
    }

    setUploading(true);
    setTotalTracks(tracksForAttempt.length);
    setCurrentTrack(0);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const artist = await resolveAlbumArtist(session, tracksForAttempt);

      if (!artist?.id) throw new Error("Artist profile could not be prepared");

      const cleanAlbumName = albumName.trim();
      setProgressLabel("Finding album...");

      const { data: existingAlbums, error: existingAlbumErr } = await supabase
        .from("albums")
        .select("*")
        .ilike("title", cleanAlbumName)
        .limit(1);

      if (existingAlbumErr) throw existingAlbumErr;

      let album = existingAlbums?.[0] || null;
      let albumId = album?.id || uuidv4();
      let artworkUrl = album?.cover_art_url || null;

      setProgressLabel("Checking tracks...");
      tracksForAttempt.forEach((track) =>
        updateTrackUploadState(track.id, {
          uploadStatus: "checking",
          uploadError: undefined,
        }),
      );

      const preflightRes = await fetch(`${API_BASE}/upload/preflight-album`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          album_id: album?.id || null,
          album_name: cleanAlbumName,
          artist_id: artist.id,
          tracks: tracksForAttempt.map((track) => ({
            client_id: track.id,
            title: track.title,
            artist_names: track.artistNames.trim(),
          })),
        }),
      });

      if (!preflightRes.ok) {
        const json = await preflightRes.json().catch(() => ({}));
        throw new Error(json.error || "Could not check tracks before upload");
      }

      const preflightJson = await preflightRes.json();
      const duplicateResults = preflightJson?.data?.duplicates || [];
      const duplicateIds = new Set(
        duplicateResults
          .map((item: any) => item.client_id)
          .filter((id: string | null) => !!id),
      );

      duplicateResults.forEach((item: any) => {
        if (!item.client_id) return;
        updateTrackUploadState(item.client_id, {
          uploadStatus: "failed",
          uploadError: item.error || "This song already exists.",
        });
      });

      const uploadCandidates = tracksForAttempt.filter(
        (track) => !duplicateIds.has(track.id),
      );

      setTotalTracks(uploadCandidates.length || tracksForAttempt.length);

      if (uploadCandidates.length === 0) {
        const failedSummary = duplicateResults
          .map((item: any) => `${item.title}: ${item.error}`)
          .slice(0, 6)
          .join("\n");

        Alert.alert(
          "Upload summary",
          `Uploaded: 0\nFailed: ${duplicateResults.length}${
            failedSummary ? `\n\n${failedSummary}` : ""
          }`,
        );
        return;
      }

      if (artwork && (!album || !album.cover_art_url)) {
        setProgressLabel("Uploading album cover...");
        artworkUrl = await uploadArtwork(artist.id, albumId);
      }

      if (album) {
        const albumUpdates: any = {};
        if (artworkUrl && !album.cover_art_url) {
          albumUpdates.cover_art_url = artworkUrl;
        }
        if (album.type !== albumType) {
          albumUpdates.type = albumType;
        }

        if (Object.keys(albumUpdates).length > 0) {
          const { data: updatedAlbum, error: updateAlbumErr } = await supabase
            .from("albums")
            .update(albumUpdates)
            .eq("id", album.id)
            .select()
            .single();

          if (updateAlbumErr) throw updateAlbumErr;
          album = updatedAlbum;
          artworkUrl = album?.cover_art_url || artworkUrl;
        }
      } else {
        setProgressLabel("Creating album...");

        const slug =
          cleanAlbumName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") +
          "-" +
          albumId.slice(0, 6);

        const { data: newAlbum, error: albumErr } = await supabase
          .from("albums")
          .insert({
            id: albumId,
            artist_id: artist.id,
            title: cleanAlbumName,
            slug,
            type: albumType,
            cover_art_url: artworkUrl,
            is_published: true,
            release_date: new Date().toISOString().split("T")[0],
            total_tracks: 0,
          })
          .select()
          .single();

        if (albumErr) throw albumErr;
        album = newAlbum;
      }

      const failedTracks: string[] = duplicateResults.map(
        (item: any) => `${item.title}: ${item.error || "Duplicate song"}`,
      );
      let successfulTracks = 0;
      for (let i = 0; i < uploadCandidates.length; i++) {
        const track = uploadCandidates[i];
        setCurrentTrack(i + 1);
        setProgressLabel(
          `Uploading "${track.title}" (${i + 1}/${uploadCandidates.length})`,
        );
        updateTrackUploadState(track.id, {
          uploadStatus: "uploading",
          uploadError: undefined,
        });

        try {
          const formData = new FormData();
          await appendPickedFile(
            formData,
            "file",
            track,
            track.name,
            track.mimeType,
          );
          formData.append("title", track.title);
          formData.append("artist_id", artist.id);
          formData.append("artist_names", track.artistNames.trim());
          formData.append("album_id", albumId);
          formData.append("track_number", track.trackNum.toString());
          formData.append("artwork_url", artworkUrl || "");
          if (selGenres.length > 0) {
            formData.append("genre_ids", JSON.stringify(selGenres));
          }

          const res = await fetch(`${API_BASE}/upload/track`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          });

          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            const errorMessage = json.error || "Upload failed";
            failedTracks.push(`${track.title}: ${errorMessage}`);
            updateTrackUploadState(track.id, {
              uploadStatus: "failed",
              uploadError: errorMessage,
            });
            console.error(`Track ${i + 1} failed:`, errorMessage);
          } else {
            const json = await res.json().catch(() => ({}));
            successfulTracks += 1;
            updateTrackUploadState(track.id, {
              uploadStatus: "success",
              uploadError: undefined,
              uploadedTrackId: json?.data?.track_id,
            });
          }
        } catch (trackErr: any) {
          const errorMessage = trackErr?.message || "Upload failed";
          failedTracks.push(`${track.title}: ${errorMessage}`);
          updateTrackUploadState(track.id, {
            uploadStatus: "failed",
            uploadError: errorMessage,
          });
          console.error(`Track ${i + 1} failed:`, errorMessage);
        }
      }

      const { count: albumTrackCount } = await supabase
        .from("tracks")
        .select("id", { count: "exact", head: true })
        .eq("album_id", albumId);

      await supabase
        .from("albums")
        .update({ total_tracks: albumTrackCount || successfulTracks })
        .eq("id", albumId);

      setProgressLabel("Done!");

      Alert.alert(
        failedTracks.length > 0 ? "Upload summary" : "Album uploaded!",
        `Uploaded: ${successfulTracks}\nFailed: ${failedTracks.length}${
          failedTracks.length > 0
            ? `\n\nFailed tracks:\n${failedTracks.slice(0, 6).join("\n")}${
                failedTracks.length > 6 ? "\n..." : ""
              }`
            : ""
        }`,
        successfulTracks > 0
          ? [
              { text: "OK" },
              {
                text: "View Album",
                onPress: () =>
                  navigation.replace("AlbumDetail", {
                    albumId: album?.id || albumId,
                  }),
              },
            ]
          : [{ text: "OK" }],
      );
    } catch (err: any) {
      setFormError(err?.message || "Upload failed");
      Alert.alert("Upload failed", err.message);
    } finally {
      setUploading(false);
      setProgressLabel("");
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    return bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getStatusLabel = (status?: TrackUploadStatus) => {
    switch (status) {
      case "checking":
        return "Checking";
      case "uploading":
        return "Uploading";
      case "success":
        return "Uploaded";
      case "failed":
        return "Failed";
      case "skipped":
        return "Skipped";
      default:
        return "";
    }
  };

  const getStatusStyle = (status?: TrackUploadStatus) => {
    if (status === "success") return styles.trackStatusSuccess;
    if (status === "failed" || status === "skipped") {
      return styles.trackStatusFailed;
    }
    if (status === "checking" || status === "uploading") {
      return styles.trackStatusActive;
    }
    return undefined;
  };

  const hasFailedTracks = tracks.some(
    (track) => track.uploadStatus === "failed",
  );

  const handleUploadButtonPress = (retryFailedOnly: boolean = false) => {
    if (uploadClickGuard.current) return;
    uploadClickGuard.current = true;

    Promise.resolve(handleUpload(retryFailedOnly)).finally(() => {
      uploadClickGuard.current = false;
    });
  };

  const totalProgress = totalTracks > 0 ? currentTrack / totalTracks : 0;

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Upload Album</Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Album type selector */}
          <View style={styles.typeRow}>
            {(["album", "ep", "single"] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeBtn,
                  albumType === type && styles.typeBtnActive,
                ]}
                onPress={() => setAlbumType(type)}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    albumType === type && styles.typeBtnTextActive,
                  ]}
                >
                  {type === "album"
                    ? "💿 Album"
                    : type === "ep"
                      ? "🎵 EP"
                      : "🎤 Single"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Artwork */}
          <TouchableOpacity
            style={styles.artworkPicker}
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
                  <Text style={styles.artworkOverlayIcon}>📷</Text>
                  <Text style={styles.artworkOverlayText}>Change Cover</Text>
                </View>
              </>
            ) : (
              <View style={styles.artworkEmpty}>
                <Text style={styles.artworkIcon}>🖼</Text>
                <Text style={styles.artworkTitle}>Add Album Cover</Text>
                <Text style={styles.artworkSub}>
                  Used automatically for all songs in this album
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Album name */}
          <View style={styles.section}>
            <Text style={styles.label}>ALBUM NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Dil Chahta Hai, My First EP"
              placeholderTextColor={colors.textDisabled}
              value={albumName}
              onChangeText={setAlbumName}
              editable={!uploading}
            />
            <Text style={styles.artistHint}>
              Existing albums with the same name are reused automatically.
            </Text>
          </View>

          {/* Tracks section */}
          <View style={styles.section}>
            <View style={styles.tracksSectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Tracks</Text>
                <Text style={styles.sectionSub}>
                  {tracks.length} track{tracks.length !== 1 ? "s" : ""} added
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addTracksBtn}
                onPress={pickAudioFiles}
                disabled={uploading}
              >
                <Text style={styles.addTracksBtnText}>+ Add Files</Text>
              </TouchableOpacity>
            </View>

            {tracks.length === 0 ? (
              <TouchableOpacity
                style={styles.emptyTracksArea}
                onPress={pickAudioFiles}
                disabled={uploading}
              >
                <Text style={styles.emptyTracksIcon}>🎵</Text>
                <Text style={styles.emptyTracksTitle}>Add your tracks</Text>
                <Text style={styles.emptyTracksSub}>
                  Select multiple audio files at once{"\n"}MP3, WAV, FLAC
                  supported
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.tracksList}>
                {tracks.map((track, index) => (
                  <View key={track.id} style={styles.trackItem}>
                    {/* Track number */}
                    <View style={styles.trackNumBadge}>
                      <Text style={styles.trackNumText}>{track.trackNum}</Text>
                    </View>

                    {/* Track info */}
                    <View style={styles.trackItemInfo}>
                      <TextInput
                        style={styles.trackTitleInput}
                        value={track.title}
                        onChangeText={(title) => updateTitle(track.id, title)}
                        editable={!uploading}
                        placeholderTextColor={colors.textDisabled}
                      />
                      <TextInput
                        style={styles.trackArtistInput}
                        value={track.artistNames}
                        onChangeText={(value) =>
                          updateTrackArtists(track.id, value)
                        }
                        editable={!uploading}
                        placeholder="Artists for this song"
                        placeholderTextColor={colors.textDisabled}
                      />
                      <Text style={styles.trackFileName} numberOfLines={1}>
                        {track.name} · {formatSize(track.size)}
                      </Text>
                      {!!getStatusLabel(track.uploadStatus) && (
                        <Text
                          style={[
                            styles.trackStatusText,
                            getStatusStyle(track.uploadStatus),
                          ]}
                        >
                          {getStatusLabel(track.uploadStatus)}
                        </Text>
                      )}
                      {!!track.uploadError && (
                        <Text style={styles.trackErrorText} numberOfLines={2}>
                          {track.uploadError}
                        </Text>
                      )}
                    </View>

                    {/* Reorder + remove */}
                    <View style={styles.trackActions}>
                      <TouchableOpacity
                        style={styles.trackActionBtn}
                        onPress={() => moveTrack(track.id, "up")}
                        disabled={uploading || index === 0}
                      >
                        <Text
                          style={[
                            styles.trackActionText,
                            index === 0 && { opacity: 0.3 },
                          ]}
                        >
                          ↑
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.trackActionBtn}
                        onPress={() => moveTrack(track.id, "down")}
                        disabled={uploading || index === tracks.length - 1}
                      >
                        <Text
                          style={[
                            styles.trackActionText,
                            index === tracks.length - 1 && { opacity: 0.3 },
                          ]}
                        >
                          ↓
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.trackRemoveBtn}
                        onPress={() => removeTrack(track.id)}
                        disabled={uploading}
                      >
                        <Text style={styles.trackRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Genres */}
          {genres.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>GENRES</Text>
              <View style={styles.genreGrid}>
                {genres.map((genre) => (
                  <TouchableOpacity
                    key={genre.id}
                    style={[
                      styles.genreChip,
                      selGenres.includes(genre.id) && styles.genreChipSelected,
                    ]}
                    onPress={() =>
                      setSelGenres((prev) =>
                        prev.includes(genre.id)
                          ? prev.filter((g) => g !== genre.id)
                          : [...prev, genre.id],
                      )
                    }
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

          {/* Upload progress */}
          {uploading && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>{progressLabel}</Text>
                <Text style={styles.progressCount}>
                  {currentTrack}/{totalTracks}
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${totalProgress * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPct}>
                {Math.round(totalProgress * 100)}% complete
              </Text>
            </View>
          )}

          {hasFailedTracks && !uploading && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => handleUploadButtonPress(true)}
              {...(isWeb
                ? ({ onClick: () => handleUploadButtonPress(true) } as any)
                : {})}
              activeOpacity={0.85}
            >
              <Text style={styles.retryBtnText}>Retry Failed Tracks</Text>
            </TouchableOpacity>
          )}

          {!!formError && (
            <View style={styles.formErrorBox}>
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          )}

          {/* Upload button */}
          <TouchableOpacity
            style={[
              styles.uploadBtn,
              (uploading || tracks.length === 0 || !albumName) &&
                styles.uploadBtnDisabled,
            ]}
            onPress={() => handleUploadButtonPress(false)}
            {...(isWeb
              ? ({ onClick: () => handleUploadButtonPress(false) } as any)
              : {})}
            disabled={uploading || tracks.length === 0 || !albumName.trim()}
            activeOpacity={0.85}
          >
            {uploading ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.uploadBtnText}>Uploading album...</Text>
              </View>
            ) : (
              <Text style={styles.uploadBtnText}>
                🚀 Upload{" "}
                {tracks.length > 0
                  ? `${tracks.length} Track${tracks.length > 1 ? "s" : ""}`
                  : "Album"}
              </Text>
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

  // Type selector
  typeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  typeBtnActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  typeBtnText: { ...typography.sm, color: colors.textSecondary },
  typeBtnTextActive: { color: colors.primary, fontWeight: "600" },

  // Artwork
  artworkPicker: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 300,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  artworkImage: { width: "100%", height: "100%" },
  artworkOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  artworkOverlayIcon: { fontSize: 32 },
  artworkOverlayText: { ...typography.md, ...typography.bold, color: "#fff" },
  artworkEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  artworkIcon: { fontSize: 48 },
  artworkTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  artworkSub: {
    ...typography.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Form
  section: { marginBottom: spacing.xl },
  label: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  artistHint: {
    ...typography.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
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
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  sectionSub: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },

  // Tracks
  tracksSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  addTracksBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...shadows.green,
  },
  addTracksBtnText: { ...typography.sm, ...typography.bold, color: "#000" },

  emptyTracksArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: spacing.xxxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTracksIcon: { fontSize: 40 },
  emptyTracksTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  emptyTracksSub: {
    ...typography.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },

  tracksList: { gap: spacing.sm },
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trackNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  trackNumText: {
    ...typography.sm,
    ...typography.bold,
    color: colors.textSecondary,
  },
  trackItemInfo: { flex: 1 },
  trackTitleInput: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 2,
    marginBottom: 4,
  },
  trackArtistInput: {
    ...typography.xs,
    color: colors.textSecondary,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 2,
    marginBottom: 4,
  },
  trackFileName: { ...typography.xs, color: colors.textTertiary },
  trackStatusText: {
    ...typography.xs,
    ...typography.semibold,
    marginTop: 4,
  },
  trackStatusActive: { color: colors.primary },
  trackStatusSuccess: { color: colors.primary },
  trackStatusFailed: { color: colors.red },
  trackErrorText: {
    ...typography.xs,
    color: colors.red,
    marginTop: 2,
  },
  trackActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trackActionBtn: { padding: spacing.xs },
  trackActionText: { fontSize: 18, color: colors.textSecondary },
  trackRemoveBtn: { padding: spacing.xs, marginLeft: 4 },
  trackRemoveText: { fontSize: 16, color: colors.red },

  // Genres
  genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
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

  // Progress
  progressCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  progressCount: { ...typography.sm, color: colors.primary, fontWeight: "700" },
  progressBg: {
    height: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressPct: {
    ...typography.xs,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Upload button
  retryBtn: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
    backgroundColor: "rgba(255, 70, 70, 0.08)",
  },
  retryBtnText: {
    ...typography.sm,
    ...typography.bold,
    color: colors.red,
  },
  formErrorBox: {
    backgroundColor: "rgba(255, 70, 70, 0.1)",
    borderColor: colors.red,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  formErrorText: {
    ...typography.sm,
    color: colors.red,
  },
  uploadBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.green,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { ...typography.md, ...typography.bold, color: "#000" },
  uploadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
