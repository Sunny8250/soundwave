import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, Dimensions } from "react-native";
import { colors, typography, spacing, radius } from "../../utils/theme";

const { width } = Dimensions.get("window");

interface Props {
  message: string;
  visible: boolean;
  type?: "success" | "error" | "info";
  onHide: () => void;
  actionLabel?: string | null;
  onAction?: (() => void) | null;
  duration?: number;
}

export default function Toast({
  message,
  visible,
  type = "success",
  onHide,
  actionLabel = null,
  onAction = null,
  duration = 2500,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 20,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => onHide());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const bgColor = {
    success: "#1DB954",
    error: "#EF4444",
    info: "#3B82F6",
  }[type];

  const icon = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  }[type];

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }], backgroundColor: bgColor },
      ]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <Text style={styles.action} onPress={onAction}>
          {actionLabel}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 140,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    gap: spacing.sm,
    maxWidth: width - 64,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  icon: { fontSize: 14, color: "#000", fontWeight: "700" },
  message: { ...typography.sm, ...typography.semibold, color: "#000" },
  action: {
    ...typography.sm,
    ...typography.semibold,
    color: "#000",
    marginLeft: spacing.md,
  },
});
