import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import { colors, radius, spacing } from "../../utils/theme";

const { width } = Dimensions.get("window");

interface Props {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: any;
}

export function SkeletonBox({
  width: w = "100%",
  height: h = 16,
  radius: r = 8,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: w as any,
          height: h,
          borderRadius: r,
          backgroundColor: colors.bgElevated,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Track card skeleton
export function TrackSkeleton() {
  return (
    <View style={skStyles.trackRow}>
      <SkeletonBox width={48} height={48} radius={8} />
      <View style={skStyles.trackInfo}>
        <SkeletonBox width="70%" height={14} radius={6} />
        <SkeletonBox
          width="45%"
          height={11}
          radius={6}
          style={{ marginTop: 6 }}
        />
      </View>
      <SkeletonBox width={32} height={11} radius={6} />
    </View>
  );
}

// Album card skeleton
export function AlbumSkeleton({ size = 140 }: { size?: number }) {
  return (
    <View style={[skStyles.albumCard, { marginRight: spacing.md }]}>
      <SkeletonBox width={size} height={size} radius={10} />
      <SkeletonBox
        width={size * 0.8}
        height={12}
        radius={6}
        style={{ marginTop: 8 }}
      />
      <SkeletonBox
        width={size * 0.55}
        height={10}
        radius={6}
        style={{ marginTop: 5 }}
      />
    </View>
  );
}

// Home screen skeleton
export function HomeSkeleton() {
  return (
    <View style={skStyles.container}>
      {/* Header */}
      <View style={skStyles.header}>
        <View>
          <SkeletonBox width={100} height={13} radius={6} />
          <SkeletonBox
            width={160}
            height={22}
            radius={8}
            style={{ marginTop: 6 }}
          />
        </View>
        <SkeletonBox width={40} height={40} radius={20} />
      </View>

      {/* Genre chips */}
      <View style={skStyles.chipRow}>
        {[80, 70, 90, 65, 75].map((w, i) => (
          <SkeletonBox
            key={i}
            width={w}
            height={34}
            radius={20}
            style={{ marginRight: 8 }}
          />
        ))}
      </View>

      {/* Section */}
      <View style={skStyles.sectionHeader}>
        <SkeletonBox width={140} height={18} radius={8} />
        <SkeletonBox width={50} height={13} radius={6} />
      </View>
      <View style={skStyles.albumRow}>
        {[0, 1, 2, 3].map((i) => (
          <AlbumSkeleton key={i} />
        ))}
      </View>

      {/* Section 2 */}
      <View style={[skStyles.sectionHeader, { marginTop: 24 }]}>
        <SkeletonBox width={180} height={18} radius={8} />
        <SkeletonBox width={50} height={13} radius={6} />
      </View>
      <View style={skStyles.albumRow}>
        {[0, 1, 2, 3].map((i) => (
          <AlbumSkeleton key={i} />
        ))}
      </View>

      {/* Track list */}
      <View style={[skStyles.sectionHeader, { marginTop: 24 }]}>
        <SkeletonBox width={160} height={18} radius={8} />
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <TrackSkeleton key={i} />
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  chipRow: { flexDirection: "row", marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  albumRow: { flexDirection: "row" },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  trackInfo: { flex: 1, gap: 0 },
  albumCard: {},
});
