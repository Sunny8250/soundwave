import { Platform, StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "../../utils/theme";

export const adminColors = {
  bg: "#071008",
  surface: "#111D13",
  surfaceAlt: "#172419",
  border: "#324638",
  borderSoft: "#243428",
  green: "#4ADE80",
  greenDeep: "#16A34A",
  muted: "#A9B8AA",
  faint: "#6F7F70",
  red: "#FB7185",
  blue: "#60A5FA",
  yellow: "#FACC15",
};

export const webScrollStyle =
  Platform.OS === "web"
    ? ({
        height: "100%",
        maxHeight: "100%",
        overflowY: "auto",
        overflowX: "hidden",
      } as any)
    : null;

export const compactNumber = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value || 0);
};

export const initials = (name?: string | null) => {
  const parts = String(name || "User")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const adminBaseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: adminColors.bg,
  },
  webContainer: {
    height: "100vh" as any,
    maxHeight: "100vh" as any,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 112,
  },
  centeredContent: {
    alignItems: "center",
  },
  shell: {
    width: "100%",
    maxWidth: 720,
  },
  wideShell: {
    width: "100%",
    maxWidth: 1120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: adminColors.borderSoft,
    paddingBottom: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    ...typography.xxxl,
    ...typography.bold,
    color: adminColors.green,
  },
  title: {
    flex: 1,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "700",
    color: adminColors.green,
  },
  refreshButton: {
    minWidth: 92,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: adminColors.border,
    backgroundColor: adminColors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  refreshText: {
    ...typography.sm,
    ...typography.bold,
    color: adminColors.green,
  },
  panel: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: adminColors.border,
    backgroundColor: adminColors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  panelTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  panelSub: {
    ...typography.sm,
    color: adminColors.muted,
    marginTop: 2,
  },
  emptyText: {
    ...typography.md,
    color: adminColors.muted,
    textAlign: "center",
  },
  chipRow: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  chip: {
    borderRadius: radius.xl,
    backgroundColor: "#263126",
    minWidth: 112,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chipActive: {
    backgroundColor: adminColors.green,
  },
  chipText: {
    ...typography.md,
    ...typography.bold,
    color: adminColors.muted,
  },
  chipTextActive: {
    color: "#061108",
  },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: adminColors.greenDeep,
  },
  badgeText: {
    ...typography.xs,
    ...typography.bold,
    color: "#061108",
  },
  dangerBadge: {
    backgroundColor: "rgba(251,113,133,0.16)",
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.42)",
  },
  dangerText: {
    color: adminColors.red,
  },
  primaryButton: {
    borderRadius: radius.md,
    backgroundColor: adminColors.green,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryButtonText: {
    ...typography.md,
    ...typography.bold,
    color: "#061108",
  },
  ghostButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: adminColors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ghostButtonText: {
    ...typography.md,
    ...typography.bold,
    color: adminColors.muted,
  },
  dangerButton: {
    borderRadius: radius.md,
    backgroundColor: adminColors.red,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  dangerButtonText: {
    ...typography.md,
    ...typography.bold,
    color: "#061108",
  },
});
