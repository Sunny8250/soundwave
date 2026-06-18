import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, radius } from "../../utils/theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "elevated" | "bordered";
}

export default function GradientCard({
  children,
  style,
  variant = "default",
}: Props) {
  return (
    <View
      style={[
        styles.card,
        variant === "elevated" && styles.elevated,
        variant === "bordered" && styles.bordered,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  elevated: {
    backgroundColor: colors.bgElevated,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bordered: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
