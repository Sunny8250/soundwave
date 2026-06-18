import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSelector, useAppDispatch } from "../../hooks/useAppDispatch";
import {
  selectCurrentTrack,
  selectQueue,
} from "../../store/selectors/playerSelectors";
import { colors, typography, spacing, radius } from "../../utils/theme";

interface Props {
  onClose: () => void;
  onTrackPress?: (track: any) => void;
}

const formatTime = (ms: number) => {
  if (!ms) return "";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function QueueScreen({ onClose, onTrackPress }: Props) {
  const currentTrack = useAppSelector(selectCurrentTrack);
  const queue = useAppSelector(selectQueue);
  const dispatch = useAppDispatch();

  const currentIdx = queue.findIndex((t: any) => t.id === currentTrack?.id);
  const upcoming = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Queue</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Now Playing */}
      {currentTrack && (
        <View style={styles.nowPlayingSection}>
          <Text style={styles.sectionLabel}>NOW PLAYING</Text>
          <View style={styles.nowPlayingRow}>
            <Image
              source={{
                uri:
                  currentTrack.albums?.cover_art_url ||
                  "https://via.placeholder.com/48/141414/444?text=♪",
              }}
              style={styles.trackArt}
            />
            <View style={styles.trackInfo}>
              <Text
                style={[styles.trackTitle, { color: colors.primary }]}
                numberOfLines={1}
              >
                {currentTrack.title}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {currentTrack.artists?.name || "Unknown"}
              </Text>
            </View>
            <View style={styles.playingIndicator}>
              <Text style={styles.playingDot}>♪</Text>
            </View>
          </View>
        </View>
      )}

      {/* Upcoming */}
      <View style={styles.upcomingSection}>
        <Text style={styles.sectionLabel}>
          NEXT UP · {upcoming.length} SONGS
        </Text>
      </View>

      {upcoming.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptySub}>
            Add songs to your queue to see them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={upcoming}
          keyExtractor={(item, i) => item.id + i}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.queueRow}
              onPress={() => {
                if (onTrackPress) onTrackPress(item);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.queueIndex}>{index + 1}</Text>
              <Image
                source={{
                  uri:
                    item.albums?.cover_art_url ||
                    "https://via.placeholder.com/44/141414/444?text=♪",
                }}
                style={styles.queueArt}
              />
              <View style={styles.queueInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {item.artists?.name || "Unknown"}
                </Text>
              </View>
              <Text style={styles.queueDuration}>
                {formatTime(item.duration_ms)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  closeBtn: { padding: spacing.sm },
  closeBtnText: { fontSize: 18, color: colors.textSecondary },
  nowPlayingSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primaryDim,
  },
  upcomingSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  sectionLabel: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  nowPlayingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  trackArt: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  trackArtist: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  playingIndicator: { padding: spacing.sm },
  playingDot: { fontSize: 20, color: colors.primary },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  emptySub: {
    ...typography.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  queueIndex: {
    width: 24,
    ...typography.sm,
    color: colors.textTertiary,
    textAlign: "center",
  },
  queueArt: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  queueInfo: { flex: 1 },
  queueDuration: { ...typography.xs, color: colors.textTertiary },
});
