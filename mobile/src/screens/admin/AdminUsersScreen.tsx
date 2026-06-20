import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { adminService } from "../../services/adminService";
import { SkeletonBox } from "../../components/common/SkeletonLoader";
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
import { useAppSelector } from "../../hooks/useAppDispatch";
import Toast from "../../components/common/Toast";
import { useToast } from "../../hooks/useToast";
import { getAdminRole } from "../../utils/roles";

const FILTERS = ["all", "admins", "creators", "listeners", "premium"];
const ROLE_COLORS: Record<string, string> = {
  super_admin: "#F59E0B",
  admin: "#3B82F6",
  moderator: "#8B5CF6",
  creator: "#1DB954",
  premium: "#F59E0B",
  listener: "#666",
};
const ROLE_LABELS: Record<string, string> = {
  super_admin: "SUPER ADMIN",
  admin: "ADMIN",
  moderator: "MODERATOR",
  creator: "CREATOR",
  premium: "PREMIUM",
  listener: "LISTENER",
};

export default function AdminUsersScreen({ navigation }: any) {
  const currentUser = useAppSelector((state) => state.auth.user);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuUser, setMenuUser] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const { data } = await adminService.getUsers(search, filter);
    setUsers(data);
    setLoading(false);
    setRefreshing(false);
  }, [search, filter]);

  useEffect(() => {
    const timer = setTimeout(loadUsers, 300);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const getUserRole = (user: any) => {
    const adminRole = getTargetAdminRole(user);

    if (adminRole || user.admin_role || user.role === "admin") return "admin";
    if (user.is_artist) return "creator";
    if (user.subscription_tier === "premium") return "premium";
    return "listener";
  };

  const getTargetAdminRole = (user: any) => {
    const adminRole = Array.isArray(user.admin_roles)
      ? user.admin_roles[0]?.role
      : user.admin_roles?.role;

    return user.admin_role || adminRole || null;
  };

  const getAssignableRole = (user: any) => {
    const role = getUserRole(user);
    return role === "admin" || role === "creator" ? role : "listener";
  };

  const getDisplayRole = (user: any) =>
    getTargetAdminRole(user) || getUserRole(user);

  const getCurrentAdminRole = () => {
    const currentUserRole = getAdminRole(currentUser);
    if (currentUserRole) return currentUserRole;

    const currentUserRow = users.find((user) => user.id === currentUser?.id);
    return currentUserRow ? getTargetAdminRole(currentUserRow) : null;
  };

  const getUserLabel = (user: any) =>
    getProfileDisplayName(user, user?.username || "this user");

  const { toast, showToast, hideToast } = useToast();

  const runAction = async (
    action: () => Promise<any>,
    errorTitle = "Update failed",
  ) => {
    try {
      const result = await action();
      if (result?.error) {
        Alert.alert(errorTitle, result.error);
        return;
      }
      await loadUsers();
    } catch (error: any) {
      Alert.alert(errorTitle, error?.message || "Please try again.");
    }
  };

  const confirmAction = (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => Promise<void>,
    destructive = false,
  ) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(message)) {
        <Toast
          message={toast.message}
          visible={toast.visible}
          type={toast.type}
          onHide={hideToast}
          actionLabel={toast.actionLabel}
          onAction={toast.action ?? undefined}
          duration={toast.duration}
        />;
        onConfirm();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: async () => {
          await onConfirm();
        },
      },
    ]);
  };

  const buildMenuActions = (user: any) => {
    const role = getAssignableRole(user);
    const targetAdminRole = getTargetAdminRole(user);
    const currentAdminRole = getCurrentAdminRole();
    const canGrantSuperAdmin = currentAdminRole === "super_admin";
    const canManageTarget =
      targetAdminRole !== "super_admin" || currentAdminRole === "super_admin";

    return [
      {
        key: "profile",
        label: "👤 Profile Details",
        color: colors.textPrimary,
      },
      ...(canManageTarget && role !== "admin"
        ? [{ key: "make_admin", label: "🛡 Make Admin", color: colors.blue }]
        : []),
      ...(canManageTarget && role === "admin" && targetAdminRole !== "moderator"
        ? [
            {
              key: "set_moderator",
              label: "🛡 Set Moderator",
              color: ROLE_COLORS.moderator,
            },
          ]
        : []),
      ...(canManageTarget && role === "admin" && targetAdminRole !== "admin"
        ? [
            {
              key: "set_admin_level",
              label: "🛡 Set Admin",
              color: ROLE_COLORS.admin,
            },
          ]
        : []),
      ...(canManageTarget &&
      role === "admin" &&
      canGrantSuperAdmin &&
      targetAdminRole !== "super_admin"
        ? [
            {
              key: "set_super_admin",
              label: "🛡 Set Super Admin",
              color: ROLE_COLORS.super_admin,
            },
          ]
        : []),
      ...(canManageTarget && role !== "creator"
        ? [
            {
              key: "make_creator",
              label: "🎤 Make Creator",
              color: colors.primary,
            },
          ]
        : []),
      ...(canManageTarget && role !== "listener"
        ? [
            {
              key: "make_listener",
              label: "🎧 Make Listener",
              color: colors.textSecondary,
            },
          ]
        : []),
      {
        key: "block",
        label:
          user?.account_status === "blocked"
            ? "🚫 Unblock User"
            : "🚫 Block User",
        color: user?.account_status === "blocked" ? colors.primary : colors.red,
      },
    ].filter((action) => canManageTarget || action.key === "profile");
  };

  const handleAction = async (action: string, user: any) => {
    setMenuUser(null);
    switch (action) {
      case "profile":
        navigation.navigate("AdminUserDetail", { userId: user.id });
        break;
      case "make_admin":
        confirmAction(
          "Make Admin",
          `Make ${getUserLabel(user)} an admin?`,
          "Confirm",
          () => runAction(() => adminService.setUserRole(user.id, "admin")),
        );
        break;
      case "set_moderator":
        confirmAction(
          "Set Moderator",
          `Make ${getUserLabel(user)} a moderator?`,
          "Confirm",
          () =>
            runAction(() => adminService.setAdminLevel(user.id, "moderator")),
        );
        break;
      case "set_admin_level":
        confirmAction(
          "Set Admin",
          `Make ${getUserLabel(user)} an admin?`,
          "Confirm",
          () => runAction(() => adminService.setAdminLevel(user.id, "admin")),
        );
        break;
      case "set_super_admin":
        confirmAction(
          "Set Super Admin",
          `Give ${getUserLabel(user)} full super admin access?`,
          "Confirm",
          () =>
            runAction(() => adminService.setAdminLevel(user.id, "super_admin")),
        );
        break;
      case "make_creator":
        confirmAction(
          "Make Creator",
          `Make ${getUserLabel(user)} a creator?`,
          "Confirm",
          () => runAction(() => adminService.setUserRole(user.id, "creator")),
        );
        break;
      case "make_listener":
        confirmAction(
          "Make Listener",
          `Make ${getUserLabel(user)} a listener?`,
          "Confirm",
          () => runAction(() => adminService.setUserRole(user.id, "listener")),
        );
        break;
      case "block":
        confirmAction(
          user?.account_status === "blocked" ? "Unblock User" : "Block User",
          user?.account_status === "blocked"
            ? `Unblock ${getUserLabel(user)}?`
            : `Block ${getUserLabel(user)}?`,
          user?.account_status === "blocked" ? "Unblock" : "Block",
          async () => {
            const prevStatus = user?.account_status;
            const newStatus = prevStatus === "blocked" ? "active" : "blocked";
            try {
              // optimistic update
              setUsers((list) =>
                list.map((u) =>
                  u.id === user.id ? { ...u, account_status: newStatus } : u,
                ),
              );
            } catch (e) {}

            await runAction(() =>
              adminService.setAccountStatus(user.id, newStatus),
            );

            showToast(
              prevStatus === "blocked" ? "User unblocked" : "User blocked",
              "success",
              {
                actionLabel: "Undo",
                duration: 5000,
                action: async () => {
                  try {
                    await adminService.setAccountStatus(user.id, prevStatus);
                    await loadUsers();
                    showToast("Undo successful", "info");
                  } catch (err) {
                    showToast("Undo failed", "error");
                  }
                },
              },
            );
          },
          user?.account_status !== "blocked",
        );
        break;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, Platform.OS === "web" && styles.webContainer]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Management</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.refreshText}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or ID..."
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        style={styles.filtersScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.skeletonList}>
          {[...Array(5)].map((_, index) => (
            <View key={index} style={styles.skeletonRow}>
              <SkeletonBox width={52} height={52} radius={14} />
              <View style={styles.skeletonMeta}>
                <SkeletonBox width="55%" height={14} radius={8} />
                <SkeletonBox
                  width="40%"
                  height={12}
                  radius={6}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          style={[styles.list, Platform.OS === "web" && styles.webList]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {users.map((user) => {
            const role = getUserRole(user);
            const displayRole = getDisplayRole(user);
            const displayName = getProfileDisplayName(user, "Listener");
            const contactLabel = getProfileContactLabel(user) || "No contact";
            const initials = getProfileInitial(user);

            return (
              <TouchableOpacity
                key={user.id}
                style={[
                  styles.userCard,
                  menuUser === user.id && styles.userCardMenuOpen,
                ]}
                onPress={() =>
                  navigation.navigate("AdminUserDetail", { userId: user.id })
                }
                activeOpacity={0.8}
              >
                {/* Avatar */}
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: ROLE_COLORS[displayRole] + "33" },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: ROLE_COLORS[displayRole] },
                    ]}
                  >
                    {initials}
                  </Text>
                </View>

                {/* Info */}
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <View
                      style={[
                        styles.roleBadge,
                        {
                          backgroundColor: ROLE_COLORS[displayRole] + "22",
                          borderColor: ROLE_COLORS[displayRole] + "55",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleText,
                          { color: ROLE_COLORS[displayRole] },
                        ]}
                      >
                        {ROLE_LABELS[displayRole] || displayRole.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.userEmail} numberOfLines={1}>
                    {contactLabel}
                  </Text>
                </View>

                {/* Menu */}
                <TouchableOpacity
                  style={styles.menuBtn}
                  onPress={() =>
                    setMenuUser(menuUser === user.id ? null : user.id)
                  }
                >
                  <Text style={styles.menuBtnText}>⋮</Text>
                </TouchableOpacity>

                {/* Dropdown menu */}
                {menuUser === user.id && (
                  <View style={styles.dropdown}>
                    {buildMenuActions(user).map((action) => (
                      <TouchableOpacity
                        key={action.key}
                        style={styles.dropdownItem}
                        onPress={() => handleAction(action.key, user)}
                      >
                        <Text
                          style={[styles.dropdownText, { color: action.color }]}
                        >
                          {action.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {[
          { label: "Home", icon: "⌂", screen: "AdminDashboard" },
          { label: "Users", icon: "👥", screen: "AdminUsers", active: true },
          { label: "Content", icon: "🎵", screen: "AdminContent" },
          { label: "Moderation", icon: "🛡", screen: "AdminModeration" },
        ].map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={styles.navTab}
            onPress={() => navigation.navigate(tab.screen)}
          >
            <Text style={[styles.navIcon, tab.active && styles.navIconActive]}>
              {tab.icon}
            </Text>
            <Text
              style={[styles.navLabel, tab.active && styles.navLabelActive]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  webContainer: {
    height: "100vh" as any,
    maxHeight: "100vh" as any,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backText: { fontSize: 24, color: colors.primary },
  headerTitle: { ...typography.xl, ...typography.bold, color: colors.primary },
  refreshText: { fontSize: 22, color: colors.textSecondary },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.md,
    color: colors.textPrimary,
  },

  filtersRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
    minHeight: 48,
  },
  filtersScroll: {
    flexGrow: 0,
    maxHeight: 56,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    height: 40,
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { ...typography.sm, color: colors.textSecondary },
  filterTextActive: { color: "#000", fontWeight: "700" },

  list: { flex: 1 },
  webList: {
    height: "100%" as any,
    overflowY: "auto",
    overflowX: "hidden",
  } as any,
  listContent: {
    paddingBottom: 128,
  },
  skeletonList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  skeletonMeta: {
    flex: 1,
    gap: spacing.sm,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    position: "relative",
    overflow: "visible",
  },
  userCardMenuOpen: {
    zIndex: 1000,
    elevation: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { ...typography.lg, ...typography.bold },
  userInfo: { flex: 1 },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 3,
  },
  userName: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  roleText: { fontSize: 10, fontWeight: "700" },
  userEmail: { ...typography.xs, color: colors.textSecondary },
  menuBtn: { padding: spacing.sm },
  menuBtnText: { fontSize: 20, color: colors.textSecondary },
  dropdown: {
    position: "absolute",
    right: spacing.lg,
    top: 52,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
    minWidth: 180,
    ...shadows.lg,
  },
  dropdownItem: {
    padding: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  dropdownText: { ...typography.sm, ...typography.medium },

  bottomNav: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  navTab: { flex: 1, alignItems: "center", gap: 4 },
  navIcon: { fontSize: 20, color: colors.textTertiary },
  navIconActive: { color: colors.primary },
  navLabel: { ...typography.xs, color: colors.textTertiary },
  navLabelActive: { color: colors.primary },
});
