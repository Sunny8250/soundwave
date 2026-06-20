import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
  TextInput,
  Dimensions,
  Platform,
  FlatList,
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

const TABS = ["Tracks", "Albums", "Artists", "Review"];
const PAGINATION_SIZE = 20;

export default function AdminContentScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState("Review");
  const [pending, setPending] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { toast, showToast, hideToast } = useToast();

  // Pagination state per tab
  const [tracksPage, setTracksPage] = useState(0);
  const [albumsPage, setAlbumsPage] = useState(0);
  const [artistsPage, setArtistsPage] = useState(0);
  const [hasMoreTracks, setHasMoreTracks] = useState(true);
  const [hasMoreAlbums, setHasMoreAlbums] = useState(true);
  const [hasMoreArtists, setHasMoreArtists] = useState(true);

  // Track which tabs have been loaded
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(
    new Set(["Review"]),
  );
  const [loadingMore, setLoadingMore] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  // Loading / refreshing
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search input
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current as any);
    };
  }, [search]);

  // Filter data using debounced search
  const filteredTracks = useMemo(
    () =>
      tracks.filter(
        (t) =>
          t.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          t.artists?.name
            ?.toLowerCase()
            .includes(debouncedSearch.toLowerCase()),
      ),
    [tracks, debouncedSearch],
  );

  const filteredAlbums = useMemo(
    () =>
      albums.filter(
        (a) =>
          a.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          a.artists?.name
            ?.toLowerCase()
            .includes(debouncedSearch.toLowerCase()),
      ),
    [albums, debouncedSearch],
  );

  const filteredArtists = useMemo(
    () =>
      artists.filter((a) =>
        a.name?.toLowerCase().includes(debouncedSearch.toLowerCase()),
      ),
    [artists, debouncedSearch],
  );

  const filteredPending = useMemo(
    () =>
      pending.filter(
        (t) =>
          t.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          t.artists?.name
            ?.toLowerCase()
            .includes(debouncedSearch.toLowerCase()),
      ),
    [pending, debouncedSearch],
  );

  // Load data only for the active tab (lazy loading)
  const loadTabData = useCallback(
    async (tab: string, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!loadedTabs.has(tab)) {
        setLoading(true);
      }

      try {
        switch (tab) {
          case "Review":
            const pendingData = await adminService.getPendingTracks();
            setPending(pendingData);
            setLoadedTabs((prev) => new Set([...prev, tab]));
            break;
          case "Tracks":
            const tracksData = await adminService.getAllTracks();
            setTracks(tracksData.data || []);
            setTracksPage(0);
            setHasMoreTracks((tracksData.data?.length || 0) >= PAGINATION_SIZE);
            setLoadedTabs((prev) => new Set([...prev, tab]));
            break;
          case "Albums":
            const albumsData = await adminService.getAllAlbums();
            setAlbums(albumsData.data || []);
            setAlbumsPage(0);
            setHasMoreAlbums((albumsData.data?.length || 0) >= PAGINATION_SIZE);
            setLoadedTabs((prev) => new Set([...prev, tab]));
            break;
          case "Artists":
            const artistsData = await adminService.getAllArtists();
            setArtists(artistsData.data || []);
            setArtistsPage(0);
            setHasMoreArtists(
              (artistsData.data?.length || 0) >= PAGINATION_SIZE,
            );
            setLoadedTabs((prev) => new Set([...prev, tab]));
            break;
        }
      } catch (err) {
        console.error(`Failed to load ${tab}:`, err);
        Alert.alert("Error", `Failed to load ${tab}`);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadedTabs],
  );

  // Load more for pagination (infinite scroll)
  const loadMore = useCallback(
    async (tab: string) => {
      if (loadingMore) return;
      setLoadingMore(true);

      try {
        switch (tab) {
          case "Tracks":
            if (!hasMoreTracks) return;
            const moreTracksData = await adminService.getAllTracks();
            setTracks((prev) => [...prev, ...(moreTracksData.data || [])]);
            setTracksPage((prev) => prev + 1);
            setHasMoreTracks(
              (moreTracksData.data?.length || 0) >= PAGINATION_SIZE,
            );
            break;
          case "Albums":
            if (!hasMoreAlbums) return;
            const moreAlbumsData = await adminService.getAllAlbums();
            setAlbums((prev) => [...prev, ...(moreAlbumsData.data || [])]);
            setAlbumsPage((prev) => prev + 1);
            setHasMoreAlbums(
              (moreAlbumsData.data?.length || 0) >= PAGINATION_SIZE,
            );
            break;
          case "Artists":
            if (!hasMoreArtists) return;
            const moreArtistsData = await adminService.getAllArtists();
            setArtists((prev) => [...prev, ...(moreArtistsData.data || [])]);
            setArtistsPage((prev) => prev + 1);
            setHasMoreArtists(
              (moreArtistsData.data?.length || 0) >= PAGINATION_SIZE,
            );
            break;
        }
      } catch (err) {
        console.error(`Failed to load more ${tab}:`, err);
      } finally {
        setLoadingMore(false);
      }
    },
    [hasMoreTracks, hasMoreAlbums, hasMoreArtists, loadingMore],
  );

  // Load initial data only for Review tab
  useEffect(() => {
    if (!loadedTabs.has(activeTab)) {
      loadTabData(activeTab);
    }
  }, [activeTab, loadedTabs, loadTabData]);

  const onRefresh = () => {
    loadTabData(activeTab, true);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (activeTab === "Review") {
      if (selectedIds.size === filteredPending.length && selectedIds.size > 0) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(filteredPending.map((t) => t.id)));
      }
    } else if (activeTab === "Tracks") {
      if (selectedIds.size === filteredTracks.length && selectedIds.size > 0) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(filteredTracks.map((t) => t.id)));
      }
    } else if (activeTab === "Albums") {
      if (selectedIds.size === filteredAlbums.length && selectedIds.size > 0) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(filteredAlbums.map((a) => a.id)));
      }
    } else if (activeTab === "Artists") {
      if (selectedIds.size === filteredArtists.length && selectedIds.size > 0) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(filteredArtists.map((a) => a.id)));
      }
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionInProgress(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => adminService.approveTrack(id)));
      setPending((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      Alert.alert("Success", `Approved ${ids.length} tracks`);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to approve tracks");
    } finally {
      setBulkActionInProgress(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    confirmAction(
      "Reject Tracks",
      `Reject ${selectedIds.size} track(s)?`,
      async () => {
        setBulkActionInProgress(true);
        try {
          const ids = Array.from(selectedIds);
          await Promise.all(ids.map((id) => adminService.rejectTrack(id)));
          setPending((prev) => prev.filter((t) => !selectedIds.has(t.id)));
          setSelectedIds(new Set());
          Alert.alert("Success", `Rejected ${ids.length} tracks`);
        } catch (err: any) {
          Alert.alert("Error", err?.message || "Failed to reject tracks");
        } finally {
          setBulkActionInProgress(false);
        }
      },
    );
  };

  const handleBulkTakedown = async () => {
    if (selectedIds.size === 0) return;
    confirmAction(
      "Takedown Tracks",
      `Remove ${selectedIds.size} track(s) from platform?`,
      async () => {
        setBulkActionInProgress(true);
        try {
          const ids = Array.from(selectedIds);
          await Promise.all(ids.map((id) => adminService.takedownTrack(id)));
          setTracks((prev) =>
            prev.map((t) =>
              selectedIds.has(t.id) ? { ...t, status: "takedown" } : t,
            ),
          );
          setSelectedIds(new Set());
          Alert.alert("Success", `Took down ${ids.length} tracks`);
        } catch (err: any) {
          Alert.alert("Error", err?.message || "Failed to take down tracks");
        } finally {
          setBulkActionInProgress(false);
        }
      },
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    confirmAction(
      "Delete Tracks",
      `Permanently delete ${selectedIds.size} track(s)?`,
      async () => {
        setBulkActionInProgress(true);
        try {
          const ids = Array.from(selectedIds);
          await Promise.all(ids.map((id) => adminService.deleteTrack(id)));
          setTracks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
          setSelectedIds(new Set());
          Alert.alert("Success", `Deleted ${ids.length} tracks`);
        } catch (err: any) {
          Alert.alert("Error", err?.message || "Failed to delete tracks");
        } finally {
          setBulkActionInProgress(false);
        }
      },
    );
  };

  const handleBulkVerifyArtists = async (verify: boolean) => {
    if (selectedIds.size === 0) return;
    confirmAction(
      verify ? "Verify Artists" : "Unverify Artists",
      `${verify ? "Verify" : "Remove verification from"} ${selectedIds.size} artist(s)?`,
      async () => {
        setBulkActionInProgress(true);
        try {
          const ids = Array.from(selectedIds);
          await Promise.all(
            ids.map((id) => adminService.verifyArtist(id, verify)),
          );
          setArtists((prev) =>
            prev.map((a) =>
              selectedIds.has(a.id) ? { ...a, is_verified: verify } : a,
            ),
          );
          setSelectedIds(new Set());
          Alert.alert(
            "Success",
            `${verify ? "Verified" : "Unverified"} ${ids.length} artists`,
          );
        } catch (err: any) {
          Alert.alert("Error", err?.message || "Failed to update artists");
        } finally {
          setBulkActionInProgress(false);
        }
      },
    );
  };

  const handleApprove = async (trackId: string) => {
    await adminService.approveTrack(trackId);
    setPending((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleRejectConfirm = (trackId: string, title: string) => {
    Alert.alert("Reject Track", `Reject "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          await adminService.rejectTrack(trackId);
          setPending((prev) => prev.filter((t) => t.id !== trackId));
        },
      },
    ]);
  };

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onConfirm },
    ]);
  };

  const handleTakedownTrack = async (trackId: string) => {
    confirmAction(
      "Takedown Track",
      "Remove this track from the platform?",
      async () => {
        setOpenMenuId(null);
        const prevTracks = tracks;
        try {
          // optimistic update
          setTracks((prev) =>
            prev.map((t) =>
              t.id === trackId ? { ...t, status: "takedown" } : t,
            ),
          );
          await adminService.takedownTrack(trackId);

          showToast("Track taken down", "info", {
            actionLabel: "Undo",
            duration: 5000,
            action: async () => {
              try {
                await adminService.approveTrack(trackId);
                // refresh list
                await loadTabData("Tracks");
                showToast("Undo successful", "success");
              } catch (err) {
                showToast("Undo failed", "error");
              }
            },
          });
        } catch (err: any) {
          // revert optimistic
          setTracks(prevTracks);
          Alert.alert("Error", err?.message || "Failed to take down track");
        }
      },
    );
  };

  const handleDeleteTrack = async (trackId: string) => {
    console.log("handleDeleteTrack invoked", trackId);
    confirmAction(
      "Delete Track",
      "Permanently delete this track?",
      async () => {
        console.log("handleDeleteTrack confirm Delete", trackId);
        try {
          await adminService.deleteTrack(trackId);
          console.log("handleDeleteTrack success", trackId);
          setOpenMenuId(null);
          setTracks((prev) => prev.filter((t) => t.id !== trackId));
          // deletions are irreversible; show info toast
          showToast("Track deleted", "info");
        } catch (err: any) {
          console.error("AdminContentScreen deleteTrack error", err);
          Alert.alert(
            "Delete failed",
            err?.message || "Failed to delete track",
          );
        }
      },
    );
  };

  const handleToggleAlbum = async (albumId: string, currentStatus: boolean) => {
    try {
      await (adminService as any).toggleAlbumPublished?.(
        albumId,
        !currentStatus,
      );
      setOpenMenuId(null);
      setAlbums((prev) =>
        prev.map((a) =>
          a.id === albumId ? { ...a, is_published: !a.is_published } : a,
        ),
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update album");
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    confirmAction(
      "Delete Album",
      "Permanently delete this album?",
      async () => {
        setOpenMenuId(null);
        try {
          await (adminService as any).deleteAlbum?.(albumId);
          setAlbums((prev) => prev.filter((a) => a.id !== albumId));
          showToast("Album deleted", "info");
        } catch (err: any) {
          Alert.alert("Error", err?.message || "Failed to delete album");
        }
      },
    );
  };

  // Rendered toast

  const formatCount = (n: number) => {
    if (!n) return "0";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  // Loading indicator for pagination
  const PaginationLoader = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: spacing.md, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  };

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case "Tracks":
        return "Search tracks by name or artist...";
      case "Albums":
        return "Search albums by name or artist...";
      case "Artists":
        return "Search artists by name...";
      case "Review":
        return "Search pending tracks...";
      default:
        return "Search...";
    }
  };

  const ArtworkBox = ({ uri, fallback, size = 48 }: any) => {
    // Prefetch image for caching
    if (uri && Platform.OS !== "web") {
      Image.prefetch(uri);
    }

    return (
      <View
        style={[
          styles.artwork,
          {
            width: size,
            height: size,
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: radius.md }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ fontSize: size * 0.38 }}>{fallback}</Text>
        )}
      </View>
    );
  };

  const CheckBox = ({ checked, onPress }: any) => (
    <TouchableOpacity
      style={[styles.checkbox, checked && styles.checkboxChecked]}
      onPress={onPress}
    >
      {checked && <Text style={styles.checkboxIcon}>✓</Text>}
    </TouchableOpacity>
  );

  // Inline dropdown menu component
  const DropdownMenu = ({
    id,
    items,
  }: {
    id: string;
    items: { label: string; color?: string; onPress: () => void }[];
  }) => {
    const isOpen = openMenuId === id;

    console.log(`DropdownMenu render — id: ${id}, isOpen: ${isOpen}`);

    return (
      <View style={styles.dropdownWrapper}>
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            console.log(
              `⋮ pressed for id: ${id}, current openMenuId: ${openMenuId}`,
            );
            setOpenMenuId(isOpen ? null : id);
          }}
        >
          <Text style={styles.moreBtnText}>⋮</Text>
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.dropdown}>
            {items.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dropdownItem,
                  i < items.length - 1 && styles.dropdownItemBorder,
                ]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  console.log(`Dropdown item pressed: ${item.label}`);
                  item.onPress();
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    item.color ? { color: item.color } : {},
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Content</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshText}>↺ Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab);
              setSearch("");
              setOpenMenuId(null);
              setSelectedIds(new Set()); // Clear selection on tab change
            }}
          >
            {tab === "Review" && pending.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pending.length}</Text>
              </View>
            )}
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={getSearchPlaceholder()}
          placeholderTextColor={colors.textDisabled}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch("")}
            style={styles.clearBtn}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          {[...Array(4)].map((_, index) => (
            <View key={index} style={styles.skeletonReportRow}>
              <SkeletonBox width={48} height={48} radius={16} />
              <View style={styles.skeletonReportMeta}>
                <SkeletonBox width="45%" height={14} radius={8} />
                <SkeletonBox
                  width="65%"
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
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
          onScrollBeginDrag={() => setOpenMenuId(null)}
          onMomentumScrollEnd={(event) => {
            const contentHeight = event.nativeEvent.contentSize.height;
            const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;
            const offset = event.nativeEvent.contentOffset.y;

            // Trigger load more when within 500pts of bottom
            if (contentHeight - scrollViewHeight - offset < 500) {
              loadMore(activeTab);
            }
          }}
        >
          {/* ── REVIEW TAB ── */}
          {activeTab === "Review" && (
            <View>
              <View style={styles.sectionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Pending Review</Text>
                  <Text style={styles.sectionSub}>
                    {filteredPending.length > 0
                      ? `${filteredPending.length} tracks need approval`
                      : "No pending tracks — all clear ✓"}
                  </Text>
                </View>
                {filteredPending.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {filteredPending.length}
                    </Text>
                  </View>
                )}
              </View>

              {filteredPending.length > 0 && (
                <View style={styles.selectAllRow}>
                  <CheckBox
                    checked={
                      selectedIds.size === filteredPending.length &&
                      selectedIds.size > 0
                    }
                    onPress={toggleSelectAll}
                  />
                  <Text style={styles.selectAllText}>
                    {selectedIds.size > 0
                      ? `${selectedIds.size} selected`
                      : "Select all"}
                  </Text>
                </View>
              )}

              {filteredPending.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>✅</Text>
                  <Text style={styles.emptyTitle}>All caught up!</Text>
                  <Text style={styles.emptySub}>
                    No tracks waiting for review
                  </Text>
                </View>
              ) : (
                filteredPending.map((track) => (
                  <View
                    key={track.id}
                    style={[
                      styles.reviewCard,
                      selectedIds.has(track.id) && styles.reviewCardSelected,
                    ]}
                  >
                    <CheckBox
                      checked={selectedIds.has(track.id)}
                      onPress={() => toggleSelection(track.id)}
                    />
                    <ArtworkBox
                      uri={track.albums?.cover_art_url}
                      fallback="🎵"
                      size={60}
                    />
                    <View style={styles.reviewInfo}>
                      <Text style={styles.reviewTitle} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={styles.reviewArtist}>
                        {track.artists?.name || "Unknown"}
                      </Text>
                      <Text style={styles.reviewMeta}>
                        {track.albums?.title || "Single"}
                        {track.explicit ? " · 🔞 Explicit" : ""}
                      </Text>
                    </View>
                    {selectedIds.size === 0 && (
                      <View style={styles.reviewBtns}>
                        <TouchableOpacity
                          style={styles.approveBtn}
                          onPress={() => handleApprove(track.id)}
                        >
                          <Text style={styles.approveBtnText}>✓ Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.rejectBtn}
                          onPress={() =>
                            handleRejectConfirm(track.id, track.title)
                          }
                        >
                          <Text style={styles.rejectBtnText}>✕ Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* ── TRACKS TAB ── */}
          {activeTab === "Tracks" && (
            <View>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>All Tracks</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {filteredTracks.length}
                  </Text>
                </View>
              </View>

              {filteredTracks.length > 0 && selectedIds.size > 0 && (
                <View style={styles.selectAllRow}>
                  <CheckBox
                    checked={
                      selectedIds.size === filteredTracks.length &&
                      selectedIds.size > 0
                    }
                    onPress={toggleSelectAll}
                  />
                  <Text style={styles.selectAllText}>
                    {selectedIds.size} selected
                  </Text>
                </View>
              )}

              <View style={styles.tableHeader}>
                {filteredTracks.length > 0 && selectedIds.size > 0 && (
                  <View style={{ width: 32 }} />
                )}
                <Text style={[styles.thText, { flex: 1 }]}>TRACK</Text>
                <Text
                  style={[styles.thText, { width: 56, textAlign: "right" }]}
                >
                  PLAYS
                </Text>
                <Text
                  style={[styles.thText, { width: 68, textAlign: "center" }]}
                >
                  STATUS
                </Text>
                {selectedIds.size === 0 && (
                  <Text style={[styles.thText, { width: 40 }]}> </Text>
                )}
              </View>

              {filteredTracks.length === 0 ? (
                <View style={styles.emptyInline}>
                  <Text style={styles.emptyInlineText}>No tracks found</Text>
                </View>
              ) : (
                filteredTracks.map((track, idx) => (
                  <View
                    key={track.id}
                    style={[
                      styles.tableRow,
                      { zIndex: filteredTracks.length - idx },
                      selectedIds.has(track.id) && styles.tableRowSelected,
                    ]}
                  >
                    {selectedIds.size > 0 && (
                      <CheckBox
                        checked={selectedIds.has(track.id)}
                        onPress={() => toggleSelection(track.id)}
                      />
                    )}
                    <ArtworkBox
                      uri={track.albums?.cover_art_url}
                      fallback="🎵"
                      size={44}
                    />
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackTitle} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>
                        {track.artists?.name || "Unknown"}
                        {track.explicit ? " · E" : ""}
                      </Text>
                    </View>
                    <Text style={styles.trackPlays}>
                      {formatCount(track.play_count || 0)}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor:
                            track.status === "published"
                              ? "#1DB95422"
                              : track.status === "takedown"
                                ? "#EF444422"
                                : "#F59E0B22",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color:
                              track.status === "published"
                                ? colors.primary
                                : track.status === "takedown"
                                  ? colors.red
                                  : colors.yellow,
                          },
                        ]}
                      >
                        {track.status === "published"
                          ? "● Live"
                          : track.status === "takedown"
                            ? "● Down"
                            : "● " + track.status}
                      </Text>
                    </View>
                    {selectedIds.size === 0 && (
                      <DropdownMenu
                        id={track.id}
                        items={[
                          {
                            label: "⬇ Takedown",
                            color: colors.yellow,
                            onPress: () => handleTakedownTrack(track.id),
                          },
                          {
                            label: "🗑 Delete",
                            color: colors.red,
                            onPress: () => handleDeleteTrack(track.id),
                          },
                        ]}
                      />
                    )}
                  </View>
                ))
              )}
              {activeTab === "Tracks" && hasMoreTracks && <PaginationLoader />}
            </View>
          )}

          {/* ── ALBUMS TAB ── */}
          {activeTab === "Albums" && (
            <View>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>All Albums</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {filteredAlbums.length}
                  </Text>
                </View>
              </View>

              {filteredAlbums.length === 0 ? (
                <View style={styles.emptyInline}>
                  <Text style={styles.emptyInlineText}>No albums found</Text>
                </View>
              ) : (
                filteredAlbums.map((album, idx) => (
                  <View
                    key={album.id}
                    style={[
                      styles.albumCard,
                      { zIndex: filteredAlbums.length - idx },
                    ]}
                  >
                    <ArtworkBox
                      uri={album.cover_art_url}
                      fallback="💿"
                      size={56}
                    />
                    <View style={styles.albumInfo}>
                      <Text style={styles.albumTitle} numberOfLines={1}>
                        {album.title}
                      </Text>
                      <Text style={styles.albumArtist}>
                        {album.artists?.name || "Unknown"}
                      </Text>
                      <View style={styles.albumTagRow}>
                        <View style={styles.typeTag}>
                          <Text style={styles.typeTagText}>
                            {album.type?.toUpperCase() || "ALBUM"}
                          </Text>
                        </View>
                        <Text style={styles.albumTracks}>
                          {album.total_tracks || 0} tracks
                        </Text>
                        <Text
                          style={[
                            styles.albumStatus,
                            {
                              color: album.is_published
                                ? colors.primary
                                : colors.red,
                            },
                          ]}
                        >
                          {album.is_published ? "● Published" : "● Hidden"}
                        </Text>
                      </View>
                    </View>
                    <DropdownMenu
                      id={album.id}
                      items={[
                        {
                          label: album.is_published
                            ? "👁 Hide Album"
                            : "✓ Publish Album",
                          color: album.is_published
                            ? colors.yellow
                            : colors.primary,
                          onPress: () =>
                            handleToggleAlbum(album.id, album.is_published),
                        },
                        {
                          label: "🗑 Delete Album",
                          color: colors.red,
                          onPress: () => handleDeleteAlbum(album.id),
                        },
                      ]}
                    />
                  </View>
                ))
              )}
              {activeTab === "Albums" && hasMoreAlbums && <PaginationLoader />}
            </View>
          )}

          {/* ── ARTISTS TAB ── */}
          {activeTab === "Artists" && (
            <View>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>All Artists</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {filteredArtists.length}
                  </Text>
                </View>
              </View>

              {filteredArtists.length === 0 ? (
                <View style={styles.emptyInline}>
                  <Text style={styles.emptyInlineText}>No artists found</Text>
                </View>
              ) : (
                filteredArtists.map((artist) => {
                  const initials = artist.name
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <View key={artist.id} style={styles.artistCard}>
                      {artist.avatar_url ? (
                        <Image
                          source={{ uri: artist.avatar_url }}
                          style={styles.artistAvatar}
                        />
                      ) : (
                        <View style={styles.artistAvatarFallback}>
                          <Text style={styles.artistAvatarText}>
                            {initials}
                          </Text>
                        </View>
                      )}
                      <View style={styles.artistInfo}>
                        <View style={styles.artistNameRow}>
                          <Text style={styles.artistName} numberOfLines={1}>
                            {artist.name}
                          </Text>
                          {artist.is_verified && (
                            <View style={styles.verifiedBadge}>
                              <Text style={styles.verifiedText}>✓</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.artistStats}>
                          {formatCount(artist.follower_count || 0)} followers
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.verifyBtn,
                          artist.is_verified && styles.verifyBtnOn,
                        ]}
                        onPress={() => {
                          const action = artist.is_verified
                            ? "remove verification from"
                            : "verify";
                          confirmAction(
                            artist.is_verified
                              ? "Remove Verification"
                              : "Verify Artist",
                            `${action} "${artist.name}"?`,
                            async () => {
                              try {
                                await adminService.verifyArtist(
                                  artist.id,
                                  !artist.is_verified,
                                );
                                setArtists((prev) =>
                                  prev.map((a) =>
                                    a.id === artist.id
                                      ? { ...a, is_verified: !a.is_verified }
                                      : a,
                                  ),
                                );
                              } catch (err: any) {
                                Alert.alert(
                                  "Error",
                                  err?.message ||
                                    "Failed to update verification status",
                                );
                              }
                            },
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.verifyBtnText,
                            artist.is_verified && styles.verifyBtnTextOn,
                          ]}
                        >
                          {artist.is_verified ? "✓ Verified" : "Verify"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
              {activeTab === "Artists" && hasMoreArtists && (
                <PaginationLoader />
              )}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ── Multi-select toolbar ── */}
      {selectedIds.size > 0 && (
        <View style={styles.bulkActionBar}>
          <View style={styles.bulkActionLeft}>
            <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
              <Text style={styles.bulkActionCancel}>✕ Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.bulkActionCount}>
              {selectedIds.size} selected
            </Text>
          </View>
          <View style={styles.bulkActionRight}>
            {activeTab === "Review" && (
              <>
                <TouchableOpacity
                  style={styles.bulkBtn}
                  onPress={handleBulkApprove}
                  disabled={bulkActionInProgress}
                >
                  <Text style={styles.bulkBtnText}>✓ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkBtn, styles.bulkBtnRed]}
                  onPress={handleBulkReject}
                  disabled={bulkActionInProgress}
                >
                  <Text style={styles.bulkBtnText}>✕ Reject</Text>
                </TouchableOpacity>
              </>
            )}
            {activeTab === "Tracks" && (
              <>
                <TouchableOpacity
                  style={[styles.bulkBtn, styles.bulkBtnYellow]}
                  onPress={handleBulkTakedown}
                  disabled={bulkActionInProgress}
                >
                  <Text style={styles.bulkBtnText}>⬇ Down</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkBtn, styles.bulkBtnRed]}
                  onPress={handleBulkDelete}
                  disabled={bulkActionInProgress}
                >
                  <Text style={styles.bulkBtnText}>🗑 Delete</Text>
                </TouchableOpacity>
              </>
            )}
            {activeTab === "Artists" && (
              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => handleBulkVerifyArtists(true)}
                disabled={bulkActionInProgress}
              >
                <Text style={styles.bulkBtnText}>✓ Verify</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Bottom nav ── */}
      <View style={styles.bottomNav}>
        {[
          { label: "Home", icon: "⌂", screen: "AdminDashboard" },
          { label: "Users", icon: "👥", screen: "AdminUsers" },
          {
            label: "Content",
            icon: "🎵",
            screen: "AdminContent",
            active: true,
          },
          { label: "Moderation", icon: "🛡", screen: "AdminModeration" },
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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    maxHeight: Platform.OS === "web" ? ("100vh" as any) : undefined,
    overflow: Platform.OS === "web" ? ("hidden" as any) : undefined,
  },
  scrollView: {
    flex: 1,
    height: Platform.OS === "web" ? 0 : undefined,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.sm, marginRight: spacing.sm },
  backText: { fontSize: 22, color: colors.primary, fontWeight: "700" },
  headerTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "center",
  },
  refreshBtn: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshText: { ...typography.sm, color: colors.primary, fontWeight: "600" },

  // Tabs — horizontal row, not pills
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  tab: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: { color: colors.primary },
  tabBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: colors.red,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadgeText: { fontSize: 9, color: "#fff", fontWeight: "700" },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
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
  clearBtn: { padding: spacing.xs },
  clearText: { ...typography.sm, color: colors.textTertiary },

  // Loading
  loadingBox: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center",
    alignItems: "stretch",
    gap: spacing.md,
    paddingTop: 80,
  },
  skeletonReportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  skeletonReportMeta: {
    flex: 1,
    gap: spacing.sm,
  },
  loadingText: { ...typography.sm, color: colors.textSecondary },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  // Section header
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  sectionSub: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  countBadge: {
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  countBadgeText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.primary,
  },

  // Checkbox
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxIcon: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },

  // Select all row
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectAllText: {
    ...typography.sm,
    color: colors.textPrimary,
    fontWeight: "600",
  },

  // Review card selected state
  reviewCardSelected: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },

  // Table row selected state
  tableRowSelected: {
    backgroundColor: colors.primaryDim,
  },

  // Bulk action bar
  bulkActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bulkActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  bulkActionCancel: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.red,
  },
  bulkActionCount: {
    ...typography.sm,
    color: colors.textSecondary,
  },
  bulkActionRight: {
    flexDirection: "row",
    gap: spacing.sm,
    flex: 1,
    justifyContent: "flex-end",
  },
  bulkBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  bulkBtnText: {
    ...typography.xs,
    ...typography.bold,
    color: "#000",
  },
  bulkBtnRed: {
    backgroundColor: colors.red,
  },
  bulkBtnYellow: {
    backgroundColor: colors.yellow,
  },

  // Review card
  reviewCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  reviewInfo: { marginVertical: spacing.sm },
  reviewTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  reviewArtist: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  reviewMeta: { ...typography.xs, color: colors.textTertiary, marginTop: 2 },
  reviewBtns: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.green,
  },
  approveBtnText: { ...typography.sm, ...typography.bold, color: "#000" },
  rejectBtn: {
    flex: 1,
    backgroundColor: colors.red + "22",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.red + "44",
  },
  rejectBtnText: { ...typography.sm, ...typography.bold, color: colors.red },

  // Empty states
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
  emptyInline: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyInlineText: { ...typography.sm, color: colors.textSecondary },

  // Table header
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  thText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },

  // Track row
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: spacing.md,
    position: "relative",
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  trackArtist: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  trackPlays: {
    ...typography.sm,
    ...typography.bold,
    color: colors.textSecondary,
    width: 40,
    textAlign: "right",
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    width: 68,
    alignItems: "center",
  },
  statusPillText: { fontSize: 11, fontWeight: "700" },

  // Inline dropdown
  dropdownWrapper: { position: "relative", zIndex: 9999 },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#3a3a3a",
    justifyContent: "center",
    alignItems: "center",
  },
  moreBtnText: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "700",
  },
  dropdown: {
    position: "absolute",
    right: 0,
    top: 40,
    backgroundColor: "#1E1E1E",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    zIndex: 9999,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 999,
    overflow: "visible",
  },
  artwork: {
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  dropdownItemText: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },

  // Album card
  albumCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  albumInfo: { flex: 1 },
  albumTitle: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  albumArtist: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  albumTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  typeTag: {
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  typeTagText: { fontSize: 9, fontWeight: "700", color: colors.textTertiary },
  albumTracks: { ...typography.xs, color: colors.textTertiary },
  albumStatus: { fontSize: 11, fontWeight: "600" },

  // Artist card
  artistCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.sm,
  },
  artistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgElevated,
  },
  artistAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    justifyContent: "center",
    alignItems: "center",
  },
  artistAvatarText: {
    ...typography.md,
    ...typography.bold,
    color: colors.primary,
  },
  artistInfo: { flex: 1 },
  artistNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  artistName: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  artistStats: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedText: { fontSize: 9, color: "#000", fontWeight: "700" },
  verifyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  verifyBtnOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  verifyBtnText: {
    ...typography.xs,
    ...typography.semibold,
    color: colors.textSecondary,
  },
  verifyBtnTextOn: { color: colors.primary },

  // Bottom nav
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
