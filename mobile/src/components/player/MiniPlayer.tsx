import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";
import {
  getTrackArtistAvatar,
  getTrackArtistNames,
  TrackArtistCredit,
} from "../../utils/trackArtists";

const { width } = Dimensions.get("window");

interface Track {
  id: string;
  title: string;
  artists?: { name: string; avatar_url?: string | null };
  track_artists?: TrackArtistCredit[];
  albums?: { cover_art_url?: string };
  cover_art_url?: string;
}

interface Props {
  track: Track;
  isPlaying: boolean;
  position: number;
  duration: number;
  onPress: () => void;
  onPlayPause: () => void;
}

export default function MiniPlayer({
  track,
  isPlaying,
  position,
  duration,
  onPress,
  onPlayPause,
}: Props) {
  const progress = duration > 0 ? position / duration : 0;
  const artworkUrl =
    track.cover_art_url ||
    track.albums?.cover_art_url ||
    getTrackArtistAvatar(track) ||
    "https://via.placeholder.com/48/141414/444444?text=â™ª";
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation when playing
  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isPlaying]);

  // Smooth progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Progress bar at very top */}
      <View style={styles.progressBg}>
        <Animated.View
          style={[styles.progressFill, { width: progressWidth }]}
        />
      </View>

      <View style={styles.content}>
        {/* Artwork with pulse */}
        <Animated.View
          style={[styles.artworkWrapper, { transform: [{ scale: pulseAnim }] }]}
        >
          <Image
            source={{
              uri:
                artworkUrl ||
                "https://via.placeholder.com/48/141414/444444?text=♪",
            }}
            style={styles.artwork}
          />
          {/* Playing indicator overlay */}
          {isPlaying && (
            <View style={styles.playingOverlay}>
              <View style={styles.playingDot} />
            </View>
          )}
        </Animated.View>

        {/* Track info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {getTrackArtistNames(track)}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={(e) => {
              e.stopPropagation();
              onPlayPause();
            }}
            activeOpacity={0.7}
          >
            {isPlaying ? (
              <View style={styles.pauseWrapper}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            ) : (
              <Text style={styles.playIcon}>▶</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 66,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: "#1C1C1C",
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    ...shadows.lg,
    shadowColor: "#000",
    shadowOpacity: 0.6,
  },
  progressBg: {
    height: 2,
    backgroundColor: "#2a2a2a",
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.primary,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    gap: spacing.md,
  },
  artworkWrapper: {
    position: "relative",
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
  },
  playingOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#1C1C1C",
  },
  playingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#000",
  },
  info: { flex: 1 },
  title: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  artist: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  playIcon: { fontSize: 14, color: "#000", marginLeft: 2 },
  pauseWrapper: { flexDirection: "row", gap: 3, alignItems: "center" },
  pauseBar: { width: 3, height: 14, borderRadius: 2, backgroundColor: "#000" },
});
