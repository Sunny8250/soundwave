const darkColors = {
  bg: "#0A0A0A",
  bgCard: "#141414",
  bgElevated: "#1C1C1C",
  bgInput: "#181818",
  bgHighlight: "#242424",

  primary: "#1DB954",
  primaryDim: "rgba(29,185,84,0.15)",
  primaryMid: "rgba(29,185,84,0.35)",

  textPrimary: "#FFFFFF",
  textSecondary: "#B3B3B3",
  textTertiary: "#727272",
  textDisabled: "#404040",

  purple: "#8B5CF6",
  blue: "#3B82F6",
  orange: "#F97316",
  pink: "#EC4899",
  yellow: "#F59E0B",
  red: "#EF4444",
  teal: "#14B8A6",

  border: "#282828",
  borderLight: "#333333",

  gradientGreen: ["#1DB954", "#158a3e"],
  gradientDark: ["#282828", "#141414"],
  gradientCard: ["#1e1e1e", "#111111"],
};

export const colors = { ...darkColors };

export const lightColors = {
  bg: "#F8F8F8",
  bgCard: "#FFFFFF",
  bgElevated: "#EEEEEE",
  bgInput: "#F0F0F0",
  bgHighlight: "#E8E8E8",
  primary: "#1DB954",
  primaryDim: "rgba(29,185,84,0.12)",
  primaryMid: "rgba(29,185,84,0.3)",
  textPrimary: "#111111",
  textSecondary: "#555555",
  textTertiary: "#888888",
  textDisabled: "#BBBBBB",
  border: "#DDDDDD",
  borderLight: "#E8E8E8",
  purple: "#8B5CF6",
  blue: "#3B82F6",
  orange: "#F97316",
  pink: "#EC4899",
  yellow: "#F59E0B",
  red: "#EF4444",
  teal: "#14B8A6",
  gradientGreen: ["#1DB954", "#158a3e"],
  gradientDark: ["#eeeeee", "#f8f8f8"],
  gradientCard: ["#ffffff", "#f5f5f5"],
};

export const typography = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 13, lineHeight: 18 },
  md: { fontSize: 15, lineHeight: 22 },
  lg: { fontSize: 17, lineHeight: 24 },
  xl: { fontSize: 20, lineHeight: 28 },
  xxl: { fontSize: 24, lineHeight: 32 },
  xxxl: { fontSize: 28, lineHeight: 36 },
  bold: { fontWeight: "700" as const },
  semibold: { fontWeight: "600" as const },
  medium: { fontWeight: "500" as const },
  regular: { fontWeight: "400" as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  green: {
    shadowColor: "#1DB954",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
};
