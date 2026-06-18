import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  PanResponder,
  Animated,
  Modal,
  FlatList,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "../../hooks/usePlayer";
import { useAppSelector, useAppDispatch } from "../../hooks/useAppDispatch";
import {
  selectShuffleOn,
  selectRepeatMode,
  selectQueue,
} from "../../store/selectors/playerSelectors";
import {
  setPosition,
  setIsPlaying,
  toggleRepeat,
  toggleShuffle,
} from "../../store/slices/playerSlice";
import { audioPlayer } from "../../services/audioPlayer";
import { playlistService } from "../../services/playlistService";
import AddToPlaylistModal from "../../components/common/AddToPlaylistModal";
import { colors, typography, spacing, radius } from "../../utils/theme";
import Toast from "../../components/common/Toast";
import { useToast } from "../../hooks/useToast";
import { Vibration } from "react-native";
import {
  getTrackArtistAvatar,
  getTrackArtistNames,
} from "../../utils/trackArtists";
import QueueScreen from "./QueueScreen";

const { width, height } = Dimensions.get("window");
const ARTWORK_SIZE = width - 48;
const WEB_ARTWORK_SIZE = Math.min(width - 64, 320);
const SWIPE_THRESHOLD = 150;
const VELOCITY_THRESHOLD = 0.5;

const formatTime = (ms: number) => {
  if (!ms) return "0:00";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface Props {
  onClose?: () => void;
  onTrackPress?: (track: any) => void;
}

export default function PlayerScreen({ onClose, onTrackPress }: Props) {
  const { currentTrack, isPlaying, position, duration, playNext, playPrev } =
    usePlayer();
  const { toast, showToast, hideToast } = useToast();
  const shuffleOn = useAppSelector(selectShuffleOn);
  const repeatMode = useAppSelector(selectRepeatMode);
  const queue = useAppSelector(selectQueue);
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [isLiked, setIsLiked] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState(width - 48);
  const [progressBarX, setProgressBarX] = useState(0);

  // Swipe to close
  const translateY = useRef(new Animated.Value(0)).current;
  const progressTrackRef = useRef<View>(null);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: any) => {
    startY.current = e.nativeEvent.pageY;
    startTime.current = Date.now();
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback(
    (e: any) => {
      if (!isDragging.current) return;
      const dy = e.nativeEvent.pageY - startY.current;
      if (dy > 0) {
        translateY.setValue(dy);
      }
    },
    [translateY],
  );

  const handleTouchEnd = useCallback(
    (e: any) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      const dy = e.nativeEvent.pageY - startY.current;
      const dt = (Date.now() - startTime.current) / 1000;
      const velocity = dy / dt / 1000;

      if (dy > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        // Close
        Animated.timing(translateY, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          translateY.setValue(0);
          if (onClose) onClose();
        });
      } else {
        // Snap back
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      }
    },
    [translateY, onClose],
  );

  const progress = duration > 0 ? position / duration : 0;

  useEffect(() => {
    if (!currentTrack?.id || !user?.id) return;
    playlistService
      .isTrackLiked(user.id, currentTrack.id)
      .then((liked) => setIsLiked(liked));
  }, [currentTrack?.id, user?.id]);

  const handleLike = async () => {
    if (!currentTrack?.id || !user?.id) return;
    Vibration.vibrate(10);
    if (isLiked) {
      await playlistService.unlikeTrack(user.id, currentTrack.id);
      setIsLiked(false);
      showToast("Removed from Liked Songs", "info");
    } else {
      await playlistService.likeTrack(user.id, currentTrack.id);
      setIsLiked(true);
      showToast("Added to Liked Songs ♥", "success");
    }
  };

  const handleSeek = useCallback(
    async (evt: any) => {
      const { pageX, locationX } = evt.nativeEvent;
      const localX =
        typeof pageX === "number" ? pageX - progressBarX : locationX || 0;
      const ratio = Math.max(0, Math.min(1, localX / progressBarWidth));
      const newPos = ratio * duration;
      await audioPlayer.seekTo(newPos);
      dispatch(setPosition(newPos));
    },
    [duration, dispatch, progressBarWidth, progressBarX],
  );

  const handlePlayPause = async () => {
    Vibration.vibrate(8);
    if (isPlaying) {
      await audioPlayer.pause();
      dispatch(setIsPlaying(false));
    } else {
      await audioPlayer.resume();
      dispatch(setIsPlaying(true));
    }
  };

  const handleToggleShuffle = () => {
    Vibration.vibrate(8);
    dispatch(toggleShuffle());
    showToast(shuffleOn ? "Shuffle off" : "Shuffle on", "info");
  };

  const handleToggleRepeat = () => {
    Vibration.vibrate(8);
    dispatch(toggleRepeat());
    const nextMode =
      repeatMode === "off"
        ? "Repeat song"
        : repeatMode === "track"
          ? "Repeat queue"
          : "Repeat off";
    showToast(nextMode, "info");
  };

  // Feature 7 — Share handler
  const handleShare = async () => {
    if (!currentTrack) return;
    try {
      await Share.share({
        message: `🎵 Listen to "${currentTrack.title}" by ${currentTrack.artists?.name} on Soundwave!\nsoundwave://track/${currentTrack.id}`,
        title: `${currentTrack.title} - Soundwave`,
      });
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const handleNext = async () => {
    Vibration.vibrate(8);
    await playNext();
  };

  const handlePrev = async () => {
    Vibration.vibrate(8);
    await playPrev();
  };

  if (!currentTrack) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <Text style={{ fontSize: 48 }}>🎵</Text>
        </View>
        <Text style={styles.emptyTitle}>Nothing playing</Text>
        <Text style={styles.emptySub}>Pick a song to start listening</Text>
      </View>
    );
  }

  const artworkUrl =
    currentTrack.cover_art_url ||
    currentTrack.albums?.cover_art_url ||
    getTrackArtistAvatar(currentTrack) ||
    "https://via.placeholder.com/320/111111/444444?text=â™ª";

  const artistNames = getTrackArtistNames(currentTrack);
  const isWeb = Platform.OS === "web";
  const containerStyle = isWeb
    ? [styles.container, styles.containerWeb]
    : styles.container;
  const headerStyle = isWeb ? [styles.header, styles.headerWeb] : styles.header;
  const artworkSectionStyle = isWeb
    ? styles.artworkSectionWeb
    : styles.artworkSection;
  const artworkGlowStyle = isWeb ? styles.artworkGlowWeb : styles.artworkGlow;
  const infoSectionStyle = isWeb
    ? [styles.infoSection, styles.playerSectionWeb, styles.infoSectionWeb]
    : styles.infoSection;
  const progressSectionStyle = isWeb
    ? [
        styles.progressSection,
        styles.playerSectionWeb,
        styles.progressSectionWeb,
      ]
    : styles.progressSection;
  const controlsSectionStyle = isWeb
    ? [
        styles.controlsSection,
        styles.playerSectionWeb,
        styles.controlsSectionWeb,
      ]
    : styles.controlsSection;
  const footerStyle = isWeb ? [styles.footer, styles.footerWeb] : styles.footer;

  return (
    <Animated.View
      style={[styles.animatedContainer, { transform: [{ translateY }] }]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <SafeAreaView style={containerStyle} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

        {/* Drag handle */}
        <View style={styles.dragHandle}>
          <View style={styles.dragHandleBar} />
        </View>

        {/* Header */}
        <View style={headerStyle}>
          <TouchableOpacity onPress={onClose} style={styles.headerSideBtn}>
            <Text style={styles.chevronDown}>⌄</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>PLAYING FROM PLAYLIST</Text>
            <Text style={styles.headerSource} numberOfLines={1}>
              {artistNames}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerSideBtn}
            onPress={() => setShowPlaylist(true)}
          >
            <Text style={styles.headerMoreBtn}>⋮</Text>
          </TouchableOpacity>
        </View>

        {/* Artwork */}
        <View style={artworkSectionStyle}>
          <View style={artworkGlowStyle}>
            <Image
              source={{
                uri:
                  artworkUrl ||
                  "https://via.placeholder.com/320/111111/444444?text=♪",
              }}
              style={styles.artwork}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Track info */}
        <View style={infoSectionStyle}>
          <View style={styles.infoLeft}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {artistNames}
            </Text>
          </View>
          <TouchableOpacity style={styles.likeBtn} onPress={handleLike}>
            <Text style={[styles.likeBtnText, isLiked && styles.likedText]}>
              {isLiked ? "♥" : "♡"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={progressSectionStyle}>
          <TouchableOpacity
            style={styles.progressTouchArea}
            onPress={handleSeek}
            activeOpacity={1}
            onLayout={() => {
              progressTrackRef.current?.measureInWindow((x, _y, barWidth) => {
                setProgressBarX(x);
                setProgressBarWidth(barWidth);
              });
            }}
          >
            <View ref={progressTrackRef} style={styles.progressTrack}>
              <View
                style={[styles.progressFilled, { width: `${progress * 100}%` }]}
              />
              <View
                style={[
                  styles.progressThumb,
                  { left: `${Math.min(progress * 100, 97)}%` },
                ]}
              />
            </View>
          </TouchableOpacity>
          <View style={styles.timestampRow}>
            <Text style={styles.timestamp}>{formatTime(position)}</Text>
            <Text style={styles.timestamp}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={controlsSectionStyle}>
          <TouchableOpacity
            style={styles.sideControl}
            onPress={handleToggleShuffle}
          >
            <Text
              style={[
                styles.sideControlText,
                shuffleOn && styles.controlActive,
              ]}
            >
              ⇄
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipControl} onPress={handlePrev}>
            <Text style={styles.skipControlText}>⏮</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playPauseBtn}
            onPress={handlePlayPause}
            activeOpacity={0.85}
          >
            {isPlaying ? (
              <View style={styles.pauseIconWrapper}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            ) : (
              <Text style={styles.playIcon}>▶</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipControl} onPress={handleNext}>
            <Text style={styles.skipControlText}>⏭</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sideControl}
            onPress={handleToggleRepeat}
          >
            <Text
              style={[
                styles.sideControlText,
                repeatMode !== "off" && styles.controlActive,
              ]}
            >
              {repeatMode === "track" ? "🔂" : "↺"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.deviceRow}>
            {/* Device/artist name — truncated */}
            <View style={styles.deviceLeft}>
              <Text style={styles.deviceIcon}>🎧</Text>
              <Text
                style={styles.deviceName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {currentTrack.artists?.name || "Phone Speaker"}
              </Text>
            </View>

            {/* Action buttons — always visible */}
            <View style={styles.deviceRight}>
              <TouchableOpacity
                style={styles.footerActionBtn}
                onPress={handleShare}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.footerActionIcon}>⤴</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerActionBtn}
                onPress={() => setShowQueue(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.footerActionIcon}>☰</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Toast
            message={toast.message}
            visible={toast.visible}
            type={toast.type}
            onHide={hideToast}
            actionLabel={toast.actionLabel}
            onAction={toast.action ?? undefined}
            duration={toast.duration}
          />
        </View>
      </SafeAreaView>

      <AddToPlaylistModal
        visible={showPlaylist}
        track={currentTrack}
        onClose={() => setShowPlaylist(false)}
        onAdded={() => showToast("Added to playlist ✓", "success")}
      />

      <Modal
        visible={showQueue}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowQueue(false)}
      >
        <QueueScreen
          onClose={() => setShowQueue(false)}
          onTrackPress={onTrackPress}
        />
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  containerWeb: {
    width: "100%",
    height,
    maxHeight: height,
    overflow: "hidden",
    paddingTop: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  emptySub: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  dragHandle: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dragHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#333333",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerWeb: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerSideBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  chevronDown: {
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 32,
  },
  headerMoreBtn: { fontSize: 22, color: colors.textPrimary },
  headerCenter: { flex: 1, alignItems: "center" },
  headerLabel: {
    ...typography.xs,
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerSource: {
    ...typography.sm,
    ...typography.bold,
    color: colors.textPrimary,
  },

  artworkSection: {
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    flex: 1,
  },
  artworkSectionWeb: {
    width: "100%",
    height: WEB_ARTWORK_SIZE + spacing.xl,
    minHeight: WEB_ARTWORK_SIZE + spacing.xl,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: spacing.xl,
  },
  artworkGlow: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: radius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 20,
  },
  artworkGlowWeb: {
    width: WEB_ARTWORK_SIZE,
    height: WEB_ARTWORK_SIZE,
    alignSelf: "center",
    borderRadius: radius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 20,
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: radius.xl,
    backgroundColor: colors.bgElevated,
  },

  infoSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  playerSectionWeb: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
  },
  infoSectionWeb: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  infoLeft: { flex: 1 },
  trackTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  artistName: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  likeBtn: { padding: spacing.sm },
  likeBtnText: { fontSize: 26, color: colors.textSecondary },
  likedText: { color: colors.primary },

  progressSection: { paddingHorizontal: spacing.xxl, marginBottom: spacing.md },
  progressSectionWeb: {
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  progressTouchArea: { paddingVertical: spacing.md },
  progressTrack: {
    height: 3,
    backgroundColor: colors.bgElevated,
    borderRadius: 2,
    position: "relative",
  },
  progressFilled: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    top: -6,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.textPrimary,
    marginLeft: -7,
  },
  timestampRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  timestamp: { ...typography.xs, color: colors.textTertiary },

  controlsSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  controlsSectionWeb: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  sideControl: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sideControlText: { fontSize: 22, color: colors.textSecondary },
  controlActive: { color: colors.primary },
  skipControl: {
    width: 54,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
  },
  skipControlText: { fontSize: 30, color: colors.textPrimary },
  playPauseBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  playIcon: { fontSize: 26, color: "#000000", marginLeft: 4 },
  pauseIconWrapper: { flexDirection: "row", gap: 6, alignItems: "center" },
  pauseBar: {
    width: 4,
    height: 22,
    borderRadius: 3,
    backgroundColor: "#000000",
  },

  footer: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  footerWeb: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  deviceLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  deviceIcon: { fontSize: 16, flexShrink: 0 },
  deviceName: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  deviceRight: {
    flexDirection: "row",
    gap: spacing.sm,
    flexShrink: 0,
  },
  footerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  footerActionIcon: { fontSize: 18, color: colors.textSecondary },
  footerIconBtn: { padding: spacing.sm },
  footerIconText: { fontSize: 20, color: colors.textSecondary },
  queueOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  queueSheet: {
    maxHeight: height * 0.65,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  queueTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  queueClose: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.primary,
  },
  queueEmpty: {
    ...typography.sm,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.xxl,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  queueItemActive: { backgroundColor: colors.primaryDim },
  queueIndex: {
    width: 24,
    ...typography.sm,
    color: colors.textTertiary,
    textAlign: "center",
  },
  queueItemInfo: { flex: 1 },
  queueItemTitle: {
    ...typography.md,
    ...typography.medium,
    color: colors.textPrimary,
  },
  queueItemTitleActive: { color: colors.primary },
  queueItemArtist: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
