import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from "react-native";
import { colors, typography, spacing, radius } from "../../utils/theme";
import NowPlayingIndicator from "../common/NowPlayingIndicator";
import {
  getTrackArtistAvatar,
  getTrackArtistNames,
  TrackArtistCredit,
} from "../../utils/trackArtists";

interface Track {
  id: string;
  title: string;
  duration_ms?: number;
  play_count?: number;
  explicit?: boolean;
  artists?: { name: string; avatar_url?: string | null };
  track_artists?: TrackArtistCredit[];
  albums?: { cover_art_url?: string };
  cover_art_url?: string;
}

interface Props {
  track: Track;
  onPress: (track: Track) => void;
  showIndex?: number;
  isPlaying?: boolean;
}

const formatDuration = (ms?: number) => {
  if (!ms) return "";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function TrackCard({
  track,
  onPress,
  showIndex,
  isPlaying,
}: Props) {
  const artworkUrl =
    track.cover_art_url ||
    track.albums?.cover_art_url ||
    getTrackArtistAvatar(track) ||
    "https://via.placeholder.com/48/111111/666666?text=â™ª";

  const handlePress = () => {
    Vibration.vibrate(10);
    onPress(track);
  };

  return (
    <TouchableOpacity
      style={[styles.container, isPlaying && styles.containerActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Index or now playing indicator */}
      <View style={styles.indexWrapper}>
        {isPlaying ? (
          <NowPlayingIndicator isPlaying={true} size={16} />
        ) : showIndex !== undefined ? (
          <Text style={styles.index}>{showIndex + 1}</Text>
        ) : null}
      </View>

      {/* Cover */}
      <View style={styles.coverWrapper}>
        <Image
          source={{
            uri:
              artworkUrl ||
              "https://via.placeholder.com/48/111111/666666?text=♪",
          }}
          style={styles.cover}
        />
        {isPlaying && (
          <View style={styles.playingOverlay}>
            <NowPlayingIndicator isPlaying={true} size={14} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          {track.explicit && (
            <View style={styles.explicitBadge}>
              <Text style={styles.explicitText}>E</Text>
            </View>
          )}
          <Text
            style={[styles.title, isPlaying && styles.titleActive]}
            numberOfLines={1}
          >
            {track.title}
          </Text>
        </View>
        <Text style={styles.artist} numberOfLines={1}>
          {getTrackArtistNames(track)}
        </Text>
      </View>

      {/* Duration */}
      <View style={styles.right}>
        <Text style={styles.duration}>{formatDuration(track.duration_ms)}</Text>
        {(track.play_count || 0) > 0 && (
          <Text style={styles.plays}>
            ▶ {track.play_count?.toLocaleString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.md,
  },
  containerActive: {
    backgroundColor: colors.primaryDim,
  },
  indexWrapper: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  index: {
    ...typography.sm,
    color: colors.textTertiary,
    textAlign: "center",
  },
  coverWrapper: { position: "relative" },
  cover: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  playingOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  explicitBadge: {
    backgroundColor: colors.bgElevated,
    borderRadius: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  explicitText: { fontSize: 9, color: colors.textTertiary },
  title: {
    ...typography.md,
    ...typography.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  titleActive: { color: colors.primary },
  artist: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  right: { alignItems: "flex-end", gap: 3 },
  duration: { ...typography.xs, color: colors.textTertiary },
  plays: { ...typography.xs, color: colors.textDisabled },
});
