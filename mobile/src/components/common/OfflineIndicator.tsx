import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { colors, typography, spacing } from "../../utils/theme";

export default function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOnline ? -60 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [isOnline, slideAnim]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}
    >
      <Text style={styles.icon}>⚠</Text>
      <Text style={styles.text}>You're offline — playback may be affected</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 9999,
  },
  icon: { fontSize: 14, color: colors.yellow },
  text: { ...typography.sm, color: colors.textSecondary, flex: 1 },
});
