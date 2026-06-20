import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Dimensions,
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
import Toast from "../../components/common/Toast";
import { useToast } from "../../hooks/useToast";

const TABS = ["Reports", "Blocked", "Logs"];
const FILTERS = ["all", "track", "user", "album"];

const PRIORITY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  high: { color: colors.red, bg: colors.red + "22", label: "🔴 HIGH" },
  normal: {
    color: colors.yellow,
    bg: colors.yellow + "22",
    label: "🟡 NORMAL",
  },
  low: { color: colors.blue, bg: colors.blue + "22", label: "🔵 LOW" },
};

const TYPE_ICONS: Record<string, string> = {
  track: "🎵",
  user: "👤",
  album: "💿",
  playlist: "📋",
};

export default function AdminModerationScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState("Reports");
  const [filter, setFilter] = useState("all");
  const [reports, setReports] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const loadData = useCallback(async () => {
    try {
      const reportsData = await adminService.getReports(filter);
      setReports(reportsData);
    } catch (err) {
      console.error("Moderation load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const logsData = await adminService.getAuditLogs({ limit: 100 });
      setLogs(logsData);
    } catch (err) {
      console.error("Audit logs load error:", err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadBlockedUsers = useCallback(async () => {
    setBlockedLoading(true);
    try {
      const blockedData = await adminService.getUsers("", "all", 0, 1000);
      const filtered = (blockedData.data || []).filter(
        (u: any) => u.account_status === "blocked",
      );
      setBlockedUsers(filtered);
    } catch (err) {
      console.error("Blocked users load error:", err);
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "Logs") {
      loadLogs();
    } else if (activeTab === "Blocked") {
      loadBlockedUsers();
    } else {
      loadData();
    }
  }, [activeTab, loadData, loadLogs, loadBlockedUsers]);
  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const { toast, showToast, hideToast } = useToast();

  const filteredReports = reports
    .filter((r) => filter === "all" || r.content_type === filter)
    .filter(
      (r) =>
        search === "" ||
        r.reason?.toLowerCase().includes(search.toLowerCase()) ||
        r.reporter?.display_name?.toLowerCase().includes(search.toLowerCase()),
    );

  const handleDismiss = async (reportId: string) => {
    await adminService.resolveReport(reportId, "dismissed");
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  const handleTakedown = async (report: any) => {
    Alert.alert("Take Down Content", "Remove this content from the platform?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Take Down",
        style: "destructive",
        onPress: async () => {
          try {
            if (report.content_type === "track") {
              await adminService.takedownTrack(report.content_id);
            }
            await adminService.resolveReport(report.id, "resolved");
            setReports((prev) => prev.filter((r) => r.id !== report.id));

            showToast("Content taken down", "info", {
              actionLabel: "Undo",
              duration: 5000,
              action: async () => {
                try {
                  if (report.content_type === "track") {
                    await adminService.approveTrack(report.content_id);
                  }
                  await loadData();
                  showToast("Undo successful", "success");
                } catch (err) {
                  showToast("Undo failed", "error");
                }
              },
            });
          } catch (err: any) {
            console.error("Moderation takedown error", err);
            Alert.alert("Error", err?.message || "Failed to take down content");
          }
        },
      },
    ]);
  };

  const handleBlockUser = async (report: any) => {
    Alert.alert("Block User", "Block this user from the platform?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await adminService.blockUser(report.content_id);
            await adminService.resolveReport(report.id, "resolved");
            setReports((prev) => prev.filter((r) => r.id !== report.id));

            showToast("User blocked", "info", {
              actionLabel: "Undo",
              duration: 5000,
              action: async () => {
                try {
                  await adminService.setAccountStatus(
                    report.content_id,
                    "active",
                  );
                  await loadData();
                  showToast("Undo successful", "success");
                } catch (err) {
                  showToast("Undo failed", "error");
                }
              },
            });
          } catch (err: any) {
            console.error("Block user error", err);
            Alert.alert("Error", err?.message || "Failed to block user");
          }
        },
      },
    ]);
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${mins}m ago`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Moderation</Text>
          {reports.length > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{reports.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshText}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
            {tab === "Reports" && reports.length > 0 && (
              <View style={styles.tabDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "Reports" && (
        <>
          {/* Search bar */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search reports by reason or reporter..."
              placeholderTextColor={colors.textDisabled}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  filter === f && styles.filterChipActive,
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={styles.filterIcon}>{TYPE_ICONS[f] || "📋"}</Text>
                <Text
                  style={[
                    styles.filterText,
                    filter === f && styles.filterTextActive,
                  ]}
                >
                  {f.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Toast
            message={toast.message}
            visible={toast.visible}
            type={toast.type}
            onHide={hideToast}
            actionLabel={toast.actionLabel}
            onAction={toast.action ?? undefined}
            duration={toast.duration}
          />

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipNum}>{reports.length}</Text>
              <Text style={styles.statChipLabel}>Total</Text>
            </View>
            <View
              style={[styles.statChip, { backgroundColor: colors.red + "15" }]}
            >
              <Text style={[styles.statChipNum, { color: colors.red }]}>
                {reports.filter((r) => r.priority === "high").length}
              </Text>
              <Text style={styles.statChipLabel}>High Priority</Text>
            </View>
            <View
              style={[
                styles.statChip,
                { backgroundColor: colors.yellow + "15" },
              ]}
            >
              <Text style={[styles.statChipNum, { color: colors.yellow }]}>
                {reports.filter((r) => r.content_type === "track").length}
              </Text>
              <Text style={styles.statChipLabel}>Track Reports</Text>
            </View>
            <View
              style={[styles.statChip, { backgroundColor: colors.blue + "15" }]}
            >
              <Text style={[styles.statChipNum, { color: colors.blue }]}>
                {reports.filter((r) => r.content_type === "user").length}
              </Text>
              <Text style={styles.statChipLabel}>User Reports</Text>
            </View>
          </View>
        </>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          {[...Array(4)].map((index) => (
            <View key={index} style={styles.skeletonReportRow}>
              <SkeletonBox width={48} height={48} radius={16} />
              <View style={styles.skeletonReportMeta}>
                <SkeletonBox width="50%" height={14} radius={8} />
                <SkeletonBox
                  width="70%"
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── REPORTS TAB ── */}
          {activeTab === "Reports" && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Active Reports</Text>
                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>
                    {filteredReports.length} items
                  </Text>
                </View>
              </View>

              {filteredReports.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>✅</Text>
                  <Text style={styles.emptyTitle}>No active reports</Text>
                  <Text style={styles.emptySub}>
                    All reports have been resolved
                  </Text>
                </View>
              ) : (
                filteredReports.map((report) => {
                  const priority =
                    PRIORITY_CONFIG[report.priority] || PRIORITY_CONFIG.normal;
                  const isExpanded = expandedId === report.id;

                  return (
                    <View key={report.id} style={styles.reportCard}>
                      {/* Card header */}
                      <TouchableOpacity
                        style={styles.reportCardHeader}
                        onPress={() =>
                          setExpandedId(isExpanded ? null : report.id)
                        }
                        activeOpacity={0.8}
                      >
                        {/* Type icon */}
                        <View style={styles.reportTypeIcon}>
                          <Text style={styles.reportTypeEmoji}>
                            {TYPE_ICONS[report.content_type] || "📋"}
                          </Text>
                        </View>

                        {/* Info */}
                        <View style={styles.reportHeaderInfo}>
                          <View style={styles.reportTitleRow}>
                            <Text style={styles.reportReason}>
                              {report.reason}
                            </Text>
                            <View
                              style={[
                                styles.priorityTag,
                                { backgroundColor: priority.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.priorityTagText,
                                  { color: priority.color },
                                ]}
                              >
                                {priority.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.reportMeta}>
                            {report.content_type.toUpperCase()}
                            {"  ·  "}
                            {report.reporter?.display_name || "Anonymous"}
                            {"  ·  "}
                            {getTimeSince(report.created_at)}
                          </Text>
                        </View>

                        <Text style={styles.expandIcon}>
                          {isExpanded ? "▲" : "▼"}
                        </Text>
                      </TouchableOpacity>

                      {/* Expanded details */}
                      {isExpanded && (
                        <View style={styles.reportDetails}>
                          {/* Content ID */}
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>CONTENT ID</Text>
                            <Text style={styles.detailValue}>
                              #{report.content_id?.slice(0, 12).toUpperCase()}
                            </Text>
                          </View>

                          {/* Reporter */}
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>REPORTED BY</Text>
                            <Text style={styles.detailValue}>
                              {report.reporter?.display_name ||
                                report.reporter?.username ||
                                "Anonymous"}
                            </Text>
                          </View>

                          {/* Description */}
                          {report.description && (
                            <View style={styles.descBox}>
                              <Text style={styles.descLabel}>DESCRIPTION</Text>
                              <Text style={styles.descText}>
                                {report.description}
                              </Text>
                            </View>
                          )}

                          {/* Action buttons */}
                          <View style={styles.actionRow}>
                            <TouchableOpacity
                              style={styles.dismissBtn}
                              onPress={() => handleDismiss(report.id)}
                            >
                              <Text style={styles.dismissBtnText}>
                                ✓ Dismiss
                              </Text>
                            </TouchableOpacity>

                            {report.content_type === "track" && (
                              <TouchableOpacity
                                style={styles.takedownBtn}
                                onPress={() => handleTakedown(report)}
                              >
                                <Text style={styles.takedownBtnText}>
                                  ⬇ Take Down
                                </Text>
                              </TouchableOpacity>
                            )}

                            {report.content_type === "user" && (
                              <>
                                <TouchableOpacity style={styles.warnBtn}>
                                  <Text style={styles.warnBtnText}>⚠ Warn</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.blockBtn}
                                  onPress={() => handleBlockUser(report)}
                                >
                                  <Text style={styles.blockBtnText}>
                                    🚫 Block
                                  </Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}

          {/* ── BLOCKED TAB ── */}
          {activeTab === "Blocked" && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Blocked Users</Text>
                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>
                    {blockedUsers.length} users
                  </Text>
                </View>
              </View>

              {blockedLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={colors.primary} size="small" />
                </View>
              ) : blockedUsers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>✅</Text>
                  <Text style={styles.emptyTitle}>No blocked users</Text>
                  <Text style={styles.emptySub}>
                    All users are in good standing
                  </Text>
                </View>
              ) : (
                blockedUsers.map((user: any) => (
                  <View key={user.id} style={styles.blockedUserCard}>
                    <View style={styles.blockedUserHeader}>
                      <View style={styles.blockedUserAvatar}>
                        <Text style={styles.blockedUserAvatarText}>
                          {user.display_name?.[0]?.toUpperCase() || "U"}
                        </Text>
                      </View>
                      <View style={styles.blockedUserInfo}>
                        <Text style={styles.blockedUserName}>
                          {user.display_name || user.username || "Unknown"}
                        </Text>
                        <Text style={styles.blockedUserMeta}>
                          {user.email || user.phone || "No email"}
                          {" · "}
                          {user.is_artist ? "Creator" : "Listener"}
                        </Text>
                        <Text style={styles.blockedDate}>
                          Blocked{" "}
                          {getTimeSince(user.updated_at || user.created_at)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => {
                        Alert.alert(
                          "Unblock User",
                          `Allow @${user.username} to use the platform again?`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Unblock",
                              style: "default",
                              onPress: async () => {
                                try {
                                  await adminService.setAccountStatus(
                                    user.id,
                                    "active",
                                  );
                                  setBlockedUsers((prev: any[]) =>
                                    prev.filter((u: any) => u.id !== user.id),
                                  );
                                  Alert.alert("Success", "User unblocked");
                                } catch (err: any) {
                                  Alert.alert(
                                    "Error",
                                    err?.message || "Failed to unblock user",
                                  );
                                }
                              },
                            },
                          ],
                        );
                      }}
                    >
                      <Text style={styles.unblockBtnText}>✓ Unblock</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}

          {/* ── LOGS TAB ── */}
          {activeTab === "Logs" && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Admin Audit Logs</Text>
                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>
                    {logs.length} entries
                  </Text>
                </View>
              </View>

              {logsLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={colors.primary} size="small" />
                </View>
              ) : logs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>No audit logs</Text>
                  <Text style={styles.emptySub}>
                    Admin actions will appear here
                  </Text>
                </View>
              ) : (
                logs.map((log: any) => {
                  const actionEmojis: Record<string, string> = {
                    delete_track: "🗑",
                    takedown_track: "⬇",
                    update_track_status: "📝",
                    approve_track: "✓",
                    reject_track: "✕",
                    block_user: "🚫",
                    unblock_user: "✓",
                    verify_artist: "✓",
                    unverify_artist: "✕",
                    create_report: "📢",
                    resolve_report: "✓",
                  };

                  return (
                    <View key={log.id} style={styles.logEntry}>
                      <View style={styles.logEntryHeader}>
                        <View style={styles.logActionIcon}>
                          <Text style={{ fontSize: 18 }}>
                            {actionEmojis[log.action] || "📝"}
                          </Text>
                        </View>
                        <View style={styles.logInfo}>
                          <Text style={styles.logAction}>
                            {log.action?.replace(/_/g, " ").toUpperCase()}
                          </Text>
                          <Text style={styles.logMeta}>
                            by {log.actor?.display_name || "System"}
                            {" · "}
                            {getTimeSince(log.created_at)}
                          </Text>
                        </View>
                      </View>
                      {log.new_values && (
                        <View style={styles.logDetails}>
                          <Text style={styles.logDetailsLabel}>CHANGES</Text>
                          <View style={styles.logDetailsContent}>
                            <Text style={styles.logDetailsText}>
                              {JSON.stringify(
                                log.new_values,
                                null,
                                2,
                              ).substring(0, 200)}
                              {JSON.stringify(log.new_values).length > 200
                                ? "..."
                                : ""}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {[
          { label: "Home", icon: "⌂", screen: "AdminDashboard" },
          { label: "Users", icon: "👥", screen: "AdminUsers" },
          { label: "Content", icon: "🎵", screen: "AdminContent" },
          {
            label: "Moderation",
            icon: "🛡",
            screen: "AdminModeration",
            active: true,
          },
        ].map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={styles.navTab}
            onPress={() => navigation.navigate(tab.screen)}
          >
            <Text
              style={[styles.navIcon, (tab as any).active && styles.navActive]}
            >
              {tab.icon}
            </Text>
            <Text
              style={[styles.navLabel, (tab as any).active && styles.navActive]}
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: { padding: spacing.sm },
  backText: { fontSize: 24, color: colors.primary, fontWeight: "600" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  headerBadgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  refreshBtn: { padding: spacing.sm },
  refreshText: { fontSize: 22, color: colors.primary },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  tab: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.md, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: "600" },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
    marginLeft: 2,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.sm,
    color: colors.textPrimary,
  },
  clearText: {
    ...typography.sm,
    color: colors.textTertiary,
    padding: spacing.xs,
  },

  filtersRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  filterIcon: { fontSize: 14 },
  filterText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
  },
  filterTextActive: { color: colors.primary },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  statChip: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statChipNum: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  statChipLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 2,
    textAlign: "center",
  },

  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  skeletonReportRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  skeletonReportMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  loadingText: { ...typography.sm, color: colors.textSecondary },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  countChip: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  countChipText: { ...typography.xs, color: colors.textSecondary },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  emptySub: { ...typography.sm, color: colors.textSecondary },

  reportCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.sm,
  },
  reportCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  reportTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  reportTypeEmoji: { fontSize: 22 },
  reportHeaderInfo: { flex: 1 },
  reportTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  reportReason: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  priorityTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  priorityTagText: { fontSize: 10, fontWeight: "700" },
  reportMeta: { ...typography.xs, color: colors.textSecondary },
  expandIcon: { fontSize: 12, color: colors.textTertiary, padding: spacing.sm },

  reportDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.bgElevated + "55",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  detailValue: { ...typography.sm, color: colors.textPrimary },
  descBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  descLabel: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  descText: { ...typography.sm, color: colors.textSecondary },

  actionRow: { flexDirection: "row", gap: spacing.sm },
  dismissBtn: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dismissBtnText: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  takedownBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    ...shadows.green,
  },
  takedownBtnText: { ...typography.sm, ...typography.bold, color: "#000" },
  warnBtn: {
    flex: 1,
    backgroundColor: colors.yellow + "22",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.yellow + "44",
  },
  warnBtnText: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.yellow,
  },
  blockBtn: {
    flex: 1,
    backgroundColor: colors.red,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  blockBtnText: { ...typography.sm, ...typography.bold, color: "#fff" },

  // Blocked user styles
  blockedUserCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockedUserHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  blockedUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDim,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  blockedUserAvatarText: {
    ...typography.lg,
    ...typography.bold,
    color: colors.primary,
  },
  blockedUserInfo: { flex: 1 },
  blockedUserName: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  blockedUserMeta: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  blockedDate: {
    ...typography.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  unblockBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  unblockBtnText: {
    ...typography.sm,
    ...typography.bold,
    color: "#000",
  },

  // Log entry styles
  logEntry: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logEntryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logActionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDim,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  logInfo: { flex: 1 },
  logAction: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
    textTransform: "capitalize",
  },
  logMeta: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  logDetailsLabel: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  logDetailsContent: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  logDetailsText: {
    ...typography.xs,
    color: colors.textSecondary,
    fontFamily: "monospace",
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
  navLabel: { ...typography.xs, color: colors.textTertiary },
  navActive: { color: colors.primary },
});
