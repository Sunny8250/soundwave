import React from "react";
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { clearAuth } from "../../store/slices/authSlice";
import { toggleTheme } from "../../store/slices/themeSlice";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";
import {
  getProfileContactLabel,
  getProfileDisplayName,
  getProfileInitial,
} from "../../utils/profile";
import { getUserRole, isAdmin, isCreator } from "../../utils/roles";

export default function ProfileScreen({ navigation }: any) {
  const dispatch = useAppDispatch();
  const isDark = useAppSelector((s) => (s as any).theme?.isDark ?? true);
  const user = useAppSelector((s) => s.auth.user);
  const isWeb = Platform.OS === "web";
  const [loggingOut, setLoggingOut] = React.useState(false);
  const profileName = getProfileDisplayName(user);
  const profileContact = getProfileContactLabel(user);
  const profileInitial = getProfileInitial(user);
  const role = getUserRole(user);
  const canCreate = isCreator(user);

  const handleBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("Home");
  };

  const performLogout = async () => {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    setLoggingOut(false);

    if (error) {
      Alert.alert("Log Out Failed", error.message);
      return;
    }

    dispatch(clearAuth());
  };

  const handleLogout = () => {
    if (loggingOut) return;

    if (isWeb) {
      const confirmed =
        typeof window !== "undefined"
          ? window.confirm("Are you sure you want to log out?")
          : true;

      if (confirmed) {
        performLogout();
      }

      return;
    }

    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: performLogout,
      },
    ]);
  };

  const menuItems = [
    {
      icon: "🎤",
      title: user?.is_artist ? "Creator Dashboard" : "Become an Artist",
      subtitle: user?.is_artist
        ? "Manage your music and stats"
        : "Upload your music to Soundwave",
      color: colors.primary,
      onPress: () =>
        navigation.navigate(
          user?.is_artist ? "CreatorDashboard" : "BecomeArtist",
        ),
      highlight: !user?.is_artist,
    },
    {
      icon: "⭐",
      title: "Create Artist Profile",
      subtitle: "Add artist details, image, and bio",
      color: colors.blue,
      onPress: () => navigation.navigate("UploadArtistPlaylist"),
    },
    {
      icon: "⭐",
      title: "Upgrade to Premium",
      subtitle: "High quality audio, no limits",
      color: colors.yellow,
      onPress: () => {},
    },
    {
      icon: "🔔",
      title: "Notifications",
      subtitle: "Manage your alerts",
      color: colors.blue,
      onPress: () => {},
    },
    {
      icon: "⚙️",
      title: "Settings",
      subtitle: "Account and preferences",
      color: colors.textSecondary,
      onPress: () => {},
    },
    {
      icon: isDark ? "☀️" : "🌙",
      title: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
      subtitle: "Change app appearance",
      color: colors.yellow,
      onPress: () => dispatch(toggleTheme()),
    },
    {
      icon: "❓",
      title: "Help & Support",
      subtitle: "FAQs and contact",
      color: colors.teal,
      onPress: () => {},
    },
  ];

  const roleMenuItems = [
    ...(isAdmin(user)
      ? [
          {
            icon: "A",
            title: "Admin Dashboard",
            subtitle: "Manage users, roles, and platform access",
            color: colors.red,
            onPress: () => navigation.navigate("AdminDashboard"),
            highlight: true,
          },
        ]
      : []),
    ...(canCreate
      ? [
          {
            icon: "C",
            title: "Creator Dashboard",
            subtitle: "Upload and manage your music",
            color: colors.primary,
            onPress: () => navigation.navigate("CreatorDashboard"),
            highlight: false,
          },
          {
            icon: "+",
            title: "Create Artist Profile",
            subtitle: "Add artist details, image, and bio",
            color: colors.blue,
            onPress: () => navigation.navigate("UploadArtistPlaylist"),
            highlight: false,
          },
        ]
      : [
          {
            icon: "L",
            title: "Listener Account",
            subtitle: "Ask an admin to enable creator uploads",
            color: colors.primary,
            onPress: () =>
              Alert.alert(
                "Creator access required",
                "Only admins can make a listener account a creator.",
              ),
            highlight: true,
          },
        ]),
    {
      icon: "*",
      title: "Upgrade to Premium",
      subtitle: "High quality audio, no limits",
      color: colors.yellow,
      onPress: () => {},
    },
    {
      icon: "!",
      title: "Notifications",
      subtitle: "Manage your alerts",
      color: colors.blue,
      onPress: () => {},
    },
    {
      icon: "S",
      title: "Settings",
      subtitle: "Account and preferences",
      color: colors.textSecondary,
      onPress: () => {},
    },
    {
      icon: "?",
      title: "Help & Support",
      subtitle: "FAQs and contact",
      color: colors.teal,
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {isWeb && (
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => {}}>
            <Text style={styles.settingsBtnText}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profileInitial}</Text>
            </View>
            <View style={styles.avatarRing} />
          </View>
          <Text style={styles.displayName}>{profileName}</Text>
          {!!profileContact && (
            <Text style={styles.email}>{profileContact}</Text>
          )}

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role.toUpperCase()}</Text>
          </View>

          <View style={styles.tierRow}>
            <View
              style={[
                styles.tierBadge,
                user?.subscription_tier === "premium" &&
                  styles.tierBadgePremium,
              ]}
            >
              <Text style={styles.tierText}>
                {user?.subscription_tier === "premium"
                  ? "⭐ Premium"
                  : "🎵 Free Plan"}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Playlists</Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          {roleMenuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.menuItem,
                item.highlight && styles.menuItemHighlight,
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.menuIconBox,
                  { backgroundColor: item.color + "22" },
                ]}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
              </View>
              <View style={styles.menuText}>
                <Text
                  style={[
                    styles.menuTitle,
                    item.highlight && { color: colors.primary },
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut && (
            <ActivityIndicator
              color={colors.red}
              size="small"
              style={styles.logoutSpinner}
            />
          )}
          <Text style={styles.logoutText}>🚪 Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Soundwave v1.0.0</Text>
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  backBtn: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  backText: {
    ...typography.md,
    color: colors.primary,
  },
  headerTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  settingsBtn: { padding: spacing.sm },
  settingsBtnText: { fontSize: 20, color: colors.textSecondary },
  profileCard: {
    alignItems: "center",
    padding: spacing.xxl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
    ...shadows.md,
  },
  avatarWrapper: { position: "relative", marginBottom: spacing.lg },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.green,
  },
  avatarText: { ...typography.xxxl, ...typography.bold, color: "#000" },
  avatarRing: {
    position: "absolute",
    inset: -4,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.primaryMid,
  },
  displayName: {
    ...typography.xxl,
    ...typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  roleBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  roleText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.primary,
  },
  tierRow: { marginBottom: spacing.xl },
  tierBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierBadgePremium: {
    backgroundColor: colors.yellow + "22",
    borderColor: colors.yellow + "44",
  },
  tierText: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  statLabel: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  menuSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItemHighlight: {
    borderColor: colors.primaryMid,
    backgroundColor: colors.primaryDim,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIcon: { fontSize: 22 },
  menuText: { flex: 1 },
  menuTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  menuSubtitle: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  menuArrow: { fontSize: 20, color: colors.textTertiary },
  logoutBtn: {
    marginHorizontal: spacing.lg,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    marginBottom: spacing.lg,
  },
  logoutBtnDisabled: {
    opacity: 0.65,
  },
  logoutSpinner: {
    marginBottom: spacing.xs,
  },
  logoutText: { ...typography.md, ...typography.semibold, color: colors.red },
  version: {
    textAlign: "center",
    ...typography.xs,
    color: colors.textDisabled,
  },
});
