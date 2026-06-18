import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../../utils/theme";

interface Props {
  title: string;
  onSeeAll?: () => void;
}

export default function SectionHeader({ title, onSeeAll }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn}>
          <Text style={styles.seeAll}>See all →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.xxl,
  },
  title: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  seeAllBtn: { padding: spacing.xs },
  seeAll: {
    ...typography.sm,
    color: colors.primary,
  },
});
