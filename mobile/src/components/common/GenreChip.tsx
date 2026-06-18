import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, radius } from "../../utils/theme";

const GENRE_COLORS: Record<string, string> = {
  "Hip-Hop": "#8B5CF6",
  Pop: "#EC4899",
  Rock: "#EF4444",
  Electronic: "#3B82F6",
  "R&B": "#F59E0B",
  Jazz: "#10B981",
  Classical: "#6366F1",
  Bollywood: "#F97316",
  Bengali: "#14B8A6",
  "Lo-fi": "#84CC16",
  Indie: "#A78BFA",
  Ambient: "#67E8F9",
  Folk: "#FB923C",
  Metal: "#94A3B8",
  Reggae: "#34D399",
  Latin: "#FBBF24",
  Tamil: "#F472B6",
  Telugu: "#60A5FA",
  Devotional: "#FCD34D",
  Punjabi: "#C084FC",
};

interface Props {
  genre: { id: string; name: string; slug: string };
  onPress: () => void;
}

export default function GenreChip({ genre, onPress }: Props) {
  const color = GENRE_COLORS[genre.name] || colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { borderColor: color + "44", backgroundColor: color + "18" },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, { color }]}>{genre.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  text: {
    ...typography.sm,
    ...typography.semibold,
  },
});
