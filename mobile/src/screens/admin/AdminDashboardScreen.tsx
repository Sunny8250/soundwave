import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSelector } from "../../hooks/useAppDispatch";
import { adminService } from "../../services/adminService";
import { SkeletonBox } from "../../components/common/SkeletonLoader";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

interface Props {
  navigation: any;
}

export default function AdminDashboardScreen({ navigation }: Props) {
  const user = useAppSelector((s) => s.auth.user);
  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const isWeb = Platform.OS === "web";

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const role = await adminService.checkAdmin(user.id);
      if (!role) {
        Alert.alert("Access Denied", "You do not have admin access");
        navigation.goBack();
        return;
      }
      setAdminRole(role);
      const [statsData, pendingData] = await Promise.all([
        adminService.getStats(),
        adminService.getPendingTracks(),
      ]);
      setStats(statsData);
      setPending(pendingData);
    } catch (err) {
      console.error("Admin load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const handleApprove = async (trackId: string) => {
    await adminService.approveTrack(trackId);
    setPending((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleReject = async (trackId: string) => {
    await adminService.rejectTrack(trackId);
    setPending((prev) => prev.filter((t) => t.id !== trackId));
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.skeletonHeader}>
          <SkeletonBox width={140} height={24} radius={12} />
          <SkeletonBox width={40} height={40} radius={20} />
        </View>
        <View style={styles.skeletonStats}>
          {[...Array(4)].map((_, index) => (
            <SkeletonBox
              key={index}
              width="48%"
              height={110}
              radius={18}
              style={styles.skeletonCard}
            />
          ))}
        </View>
      </View>
    );

  const statCards = [
    {
      label: "Total Users",
      value: formatCount(stats?.totalUsers || 0),
      icon: "👥",
      color: colors.primary,
    },
    {
      label: "Total Artists",
      value: formatCount(stats?.totalArtists || 0),
      icon: "🎤",
      color: colors.blue,
    },
    {
      label: "Pending Uploads",
      value: formatCount(stats?.pendingUploads || 0),
      icon: "⏳",
      color: colors.orange,
      alert: true,
    },
    {
      label: "Total Tracks",
      value: formatCount(stats?.totalTracks || 0),
      icon: "🎵",
      color: colors.primary,
    },
    {
      label: "Total Albums",
      value: formatCount(stats?.totalAlbums || 0),
      icon: "💿",
      color: colors.purple,
    },
    {
      label: "Active Reports",
      value: formatCount(stats?.pendingReports || 0),
      icon: "🚨",
      color: colors.red,
      alert: true,
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, isWeb && styles.webContainer]}
      edges={["top"]}
    >
      <ScrollView
        style={[styles.scrollView, isWeb && styles.webScrollView]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.headerLabel}>Admin Dashboard</Text>
              <Text style={styles.headerRole}>
                {adminRole?.toUpperCase().replace("_", " ")}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(user?.display_name || "A")[0].toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {statCards.map((card, i) => (
            <View
              key={i}
              style={[
                styles.statCard,
                card.alert && card.value !== "0" && styles.statCardAlert,
              ]}
            >
              <Text style={styles.statIcon}>{card.icon}</Text>
              <Text
                style={[
                  styles.statValue,
                  card.alert && card.value !== "0" && { color: colors.red },
                ]}
              >
                {card.value}
              </Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* Pending Review */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Pending Review</Text>
                <Text style={styles.sectionSub}>
                  {pending.length} tracks require approval
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("AdminContent")}
              >
                <Text style={styles.viewAll}>VIEW ALL</Text>
              </TouchableOpacity>
            </View>

            {pending.slice(0, 3).map((track) => (
              <View key={track.id} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <View style={styles.pendingArt}>
                    <Text style={styles.pendingArtText}>🎵</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.pendingArtist} numberOfLines={1}>
                      {track.artists?.name} · {track.albums?.title || "Single"}
                    </Text>
                  </View>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(track.id)}
                  >
                    <Text style={styles.approveBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(track.id)}
                  >
                    <Text style={styles.rejectBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick navigation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {[
              { label: "User Management", icon: "👥", screen: "AdminUsers" },
              { label: "Content", icon: "🎵", screen: "AdminContent" },
              { label: "Moderation", icon: "🛡", screen: "AdminModeration" },
              { label: "Artists", icon: "🎤", screen: "AdminContent" },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickCard}
                onPress={() => navigation.navigate(item.screen)}
                activeOpacity={0.8}
              >
                <Text style={styles.quickIcon}>{item.icon}</Text>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {[
          { label: "Home", icon: "⌂", screen: "AdminDashboard" },
          { label: "Users", icon: "👥", screen: "AdminUsers" },
          { label: "Content", icon: "🎵", screen: "AdminContent" },
          { label: "Moderation", icon: "🛡", screen: "AdminModeration" },
        ].map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={styles.navTab}
            onPress={() => navigation.navigate(tab.screen)}
          >
            <Text style={[styles.navIcon, i === 0 && styles.navIconActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.navLabel, i === 0 && styles.navLabelActive]}>
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
  scrollView: { flex: 1 },
  webScrollView: {
    height: "100%" as any,
    overflowY: "auto",
    overflowX: "hidden",
  } as any,
  scrollContent: {
    paddingBottom: 128,
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
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLabel: { ...typography.xxl, ...typography.bold, color: colors.primary },
  headerRole: { ...typography.xs, color: colors.textTertiary, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  adminBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.primaryMid,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: { padding: spacing.sm },
  backBtnText: { fontSize: 22, color: colors.primary, fontWeight: "700" },
  adminBadgeText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.primary,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { ...typography.md, ...typography.bold, color: "#000" },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    width: "48%",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  statCardAlert: {
    borderColor: colors.red + "44",
    backgroundColor: colors.red + "11",
  },
  statIcon: { fontSize: 24 },
  statValue: {
    ...typography.xxl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  statLabel: { ...typography.xs, color: colors.textSecondary },

  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  sectionSub: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  viewAll: {
    ...typography.xs,
    ...typography.bold,
    color: colors.primary,
    letterSpacing: 0.8,
  },

  pendingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  pendingInfo: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pendingArt: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingArtText: { fontSize: 22 },
  pendingTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  pendingArtist: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pendingActions: { flexDirection: "row", gap: spacing.sm },
  approveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    ...shadows.green,
  },
  approveBtnText: { fontSize: 18, color: "#000", fontWeight: "700" },
  rejectBtn: {
    flex: 1,
    backgroundColor: colors.red + "22",
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.red + "44",
  },
  rejectBtnText: { fontSize: 18, color: colors.red, fontWeight: "700" },

  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickCard: {
    width: "48%",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: { fontSize: 32 },
  quickLabel: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
    textAlign: "center",
  },

  skeletonHeader: {
    width: "100%",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skeletonStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  skeletonCard: {
    height: 110,
  },
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
