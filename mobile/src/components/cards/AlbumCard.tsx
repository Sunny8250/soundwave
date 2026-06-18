import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

interface Props {
  item: {
    id: string;
    title?: string;
    name?: string;
    artists?: { name: string };
    albums?: { cover_art_url?: string };
    cover_art_url?: string;
  };
  onPress: () => void;
  size?: number;
  subtitle?: string;
}

export default function AlbumCard({
  item,
  onPress,
  size = 148,
  subtitle,
}: Props) {
  const imageUrl = item.albums?.cover_art_url || item.cover_art_url;
  const title = item.title || item.name || "";
  const sub = subtitle || item.artists?.name || "";

  return (
    <TouchableOpacity
      style={[styles.container, { width: size }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.imageWrapper, { width: size, height: size }]}>
        <Image
          source={{
            uri:
              imageUrl ||
              "https://via.placeholder.com/148/111111/444444?text=♪",
          }}
          style={styles.image}
        />
        <View style={styles.playButton}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {sub ? (
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginRight: spacing.md },
  imageWrapper: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.bgElevated,
    marginBottom: spacing.sm,
    position: "relative",
    ...shadows.md,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  playButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.green,
  },
  playIcon: { fontSize: 12, color: "#000", marginLeft: 2 },
  title: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  sub: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
