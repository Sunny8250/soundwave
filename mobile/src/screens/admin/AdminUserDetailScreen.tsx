import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
} from "react-native";
import { SkeletonBox } from "../../components/common/SkeletonLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { adminService } from "../../services/adminService";
import { useAppSelector } from "../../hooks/useAppDispatch";
import { getAdminRole } from "../../utils/roles";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

export default function AdminUserDetailScreen({ navigation, route }: any) {
  const { userId } = route.params;
  const currentUser = useAppSelector((state) => state.auth.user);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isWeb = Platform.OS === "web";
  const webContainerStyle = isWeb
    ? ({ height: "100vh", maxHeight: "100vh", overflow: "hidden" } as any)
    : null;
  const webScrollStyle = isWeb
    ? ({
        height: "100vh",
        maxHeight: "100vh",
        overflowY: "auto",
      } as any)
    : null;

  const loadUser = useCallback(() => {
    setLoading(true);
    adminService.getUserDetail(userId).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser]),
  );

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <SkeletonBox
          width={140}
          height={24}
          radius={12}
          style={{ marginBottom: spacing.lg }}
        />
        <SkeletonBox
          width={120}
          height={120}
          radius={64}
          style={{ marginBottom: spacing.lg }}
        />
        <SkeletonBox
          width="60%"
          height={18}
          radius={10}
          style={{ marginBottom: spacing.md }}
        />
        <SkeletonBox
          width="80%"
          height={14}
          radius={8}
          style={{ marginBottom: spacing.xs }}
        />
        <SkeletonBox width="90%" height={14} radius={8} />
      </View>
    );

  const { user, artist, adminRole, trackCount } = data || {};
  const currentAdminRole = getAdminRole(currentUser);
  const targetAdminRole = adminRole?.role || null;
  const canManageTarget =
    targetAdminRole !== "super_admin" || currentAdminRole === "super_admin";

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const runUpdate = async (
    action: () => Promise<any>,
    errorTitle = "Update failed",
  ) => {
    try {
      setSaving(true);
      const result = await action();
      if (result?.error) {
        Alert.alert(errorTitle, result.error);
        return;
      }
      loadUser();
    } catch (error: any) {
      Alert.alert(errorTitle, error?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updatePermission = (key: string, value: boolean) => {
    if (!canManageTarget || saving) return;

    if (key === "creator") {
      if (adminRole && !value) {
        Alert.alert(
          "Creator access",
          "Admins keep creator upload access. Demote the user to listener first if you want to remove upload access.",
        );
        return;
      }
      runUpdate(() =>
        adminService.setUserRole(userId, value ? "creator" : "listener"),
      );
      return;
    }

    if (key === "mod") {
      runUpdate(() =>
        value
          ? adminService.setUserRole(userId, "admin")
          : adminService.setUserRole(
              userId,
              user?.is_artist ? "creator" : "listener",
            ),
      );
      return;
    }

    if (key === "premium") {
      runUpdate(() =>
        adminService.updateUserProfile(userId, {
          subscription_tier: value ? "premium" : "free",
        }),
      );
    }
  };

  const handleDestructiveAction = (action: string) => {
    const isBlocked = user?.account_status === "blocked";
    const messages: Record<string, string> = {
      warn: "Send a warning to this user?",
      reset: "Send password reset email?",
      block: isBlocked
        ? "Unblock this account? The user will be able to log in again."
        : "Block this account? The user will not be able to log in.",
    };
    Alert.alert(
      action.charAt(0).toUpperCase() + action.slice(1) + " User",
      messages[action],
      [
        { text: "Cancel", style: "cancel" },
        {
          text:
            action === "block" ? (isBlocked ? "Unblock" : "Block") : "Confirm",
          style: action === "block" && !isBlocked ? "destructive" : "default",
          onPress: async () => {
            if (action === "block") {
              await runUpdate(() =>
                adminService.setAccountStatus(
                  userId,
                  isBlocked ? "active" : "blocked",
                ),
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, webContainerStyle]} edges={["top"]}>
      <ScrollView
        style={[styles.scrollView, webScrollStyle]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Profile Details</Text>
          </TouchableOpacity>
          {canManageTarget ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() =>
                navigation.navigate("AdminEditUserProfile", { userId })
              }
            >
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editBtnPlaceholder} />
          )}
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(user?.display_name || user?.username || "U")[0].toUpperCase()}
            </Text>
            {user?.is_artist && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>
            {user?.display_name || user?.username}
          </Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {user?.is_artist ? "🎤 CREATOR" : "🎧 LISTENER"}
              </Text>
            </View>
            <View style={[styles.badge, styles.badgeActive]}>
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      user?.account_status === "blocked"
                        ? colors.red
                        : colors.primary,
                  },
                ]}
              >
                {user?.account_status === "blocked" ? "BLOCKED" : "ACTIVE"}
              </Text>
            </View>
            {adminRole && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: "#F59E0B22", borderColor: "#F59E0B44" },
                ]}
              >
                <Text style={[styles.badgeText, { color: "#F59E0B" }]}>
                  {adminRole.role.replace("_", " ").toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        {artist && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {(artist.follower_count || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>FOLLOWERS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {(artist.monthly_listeners || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>MONTHLY LISTENERS</Text>
            </View>
          </View>
        )}

        {/* Info cards */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>JOIN DATE</Text>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoValue}>{formatDate(user?.created_at)}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>TOTAL TRACKS</Text>
            <Text style={styles.infoIcon}>🎵</Text>
            <Text style={styles.infoValue}>{trackCount || 0}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>PLAN</Text>
            <Text style={styles.infoIcon}>⭐</Text>
            <Text style={styles.infoValue}>
              {user?.subscription_tier?.toUpperCase() || "FREE"}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>USER ID</Text>
            <Text style={styles.infoIcon}>🔑</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {userId.slice(0, 8)}...
            </Text>
          </View>
        </View>

        {/* Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <View style={styles.permCard}>
            {[
              {
                label: "Creator Status",
                value: user?.is_artist,
                key: "creator",
              },
              { label: "Moderator Access", value: !!adminRole, key: "mod" },
              {
                label: "Premium Subscriber",
                value: user?.subscription_tier === "premium",
                key: "premium",
              },
            ].map((perm) => (
              <View key={perm.key} style={styles.permRow}>
                <Text style={styles.permLabel}>{perm.label}</Text>
                <Switch
                  value={perm.value || false}
                  disabled={!canManageTarget || saving}
                  onValueChange={(value) => updatePermission(perm.key, value)}
                  trackColor={{
                    false: colors.bgElevated,
                    true: colors.primaryMid,
                  }}
                  thumbColor={perm.value ? colors.primary : colors.textTertiary}
                />
              </View>
            ))}

            <View style={styles.permDivider}>
              <Text style={styles.permDividerText}>DESTRUCTIVE ACTIONS</Text>
            </View>

            {[
              {
                label: "Warn User",
                action: "warn",
                color: colors.yellow,
                icon: "⚠",
              },
              {
                label: "Reset Password",
                action: "reset",
                color: colors.blue,
                icon: "🔑",
              },
              {
                label:
                  user?.account_status === "blocked"
                    ? "Unblock Account"
                    : "Block Account",
                action: "block",
                color:
                  user?.account_status === "blocked"
                    ? colors.primary
                    : colors.red,
                icon: "🚫",
              },
            ]
              .filter((action) => canManageTarget || action.action !== "block")
              .map((action) => (
                <TouchableOpacity
                  key={action.action}
                  style={[
                    styles.destructiveBtn,
                    action.action === "block" && styles.destructiveBtnRed,
                  ]}
                  onPress={() => handleDestructiveAction(action.action)}
                >
                  <Text
                    style={[styles.destructiveBtnText, { color: action.color }]}
                  >
                    {action.icon} {action.label}
                  </Text>
                  <Text style={{ color: action.color }}>›</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backText: { ...typography.md, color: colors.primary },
  editBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  editBtnPlaceholder: {
    width: 96,
  },
  editBtnText: { ...typography.sm, ...typography.bold, color: "#000" },
  profileCard: {
    alignItems: "center",
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    position: "relative",
    ...shadows.green,
  },
  profileAvatarText: { ...typography.xxxl, ...typography.bold, color: "#000" },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.bgCard,
  },
  verifiedText: { fontSize: 12, color: "#000", fontWeight: "700" },
  profileName: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  profileEmail: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primaryMid,
  },
  badgeText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { ...typography.xl, ...typography.bold, color: colors.primary },
  statLabel: {
    ...typography.xs,
    color: colors.textTertiary,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  statDivider: { width: 1, backgroundColor: colors.border },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoCard: {
    width: "48%",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  infoLabel: {
    ...typography.xs,
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  infoIcon: { fontSize: 22 },
  infoValue: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  permCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  permRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  permLabel: { ...typography.md, color: colors.textPrimary },
  permDivider: {
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
  },
  permDividerText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.red,
    letterSpacing: 1,
  },
  destructiveBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  destructiveBtnRed: { backgroundColor: colors.red + "11" },
  destructiveBtnText: { ...typography.md, ...typography.medium },
});
