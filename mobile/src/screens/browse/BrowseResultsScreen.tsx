import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Dimensions,
  ScrollView,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { api } from "../../services/api";
import TrackCard from "../../components/cards/TrackCard";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { selectCurrentTrack } from "../../store/selectors/playerSelectors";
import { setQueue } from "../../store/slices/playerSlice";
import {
  colors,
  radius,
  spacing,
  typography,
  shadows,
} from "../../utils/theme";

const isWeb = Platform.OS === "web";
const PAGE_SIZE = isWeb ? 20 : 30;

// Returns how many columns based on container width
const getColumns = (
  containerWidth: number,
  type: "track" | "album" | "artist",
) => {
  if (!isWeb) {
    if (type === "artist") return 4;
    if (type === "album") return 2;
    return 1;
  }
  // Web — target card sizes:
  // tracks: ~160-200px wide
  // albums: ~140-180px wide
  // artists: ~100-130px wide
  if (type === "track") {
    if (containerWidth >= 1400) return 8;
    if (containerWidth >= 1200) return 7;
    if (containerWidth >= 1000) return 6;
    if (containerWidth >= 800) return 5;
    if (containerWidth >= 600) return 4;
    if (containerWidth >= 400) return 3;
    return 2;
  }
  if (type === "album") {
    if (containerWidth >= 1400) return 9;
    if (containerWidth >= 1200) return 8;
    if (containerWidth >= 1000) return 7;
    if (containerWidth >= 800) return 6;
    if (containerWidth >= 600) return 5;
    if (containerWidth >= 400) return 4;
    return 3;
  }
  // artist — smallest, most per row
  if (containerWidth >= 1400) return 12;
  if (containerWidth >= 1200) return 11;
  if (containerWidth >= 1000) return 10;
  if (containerWidth >= 800) return 9;
  if (containerWidth >= 600) return 8;
  if (containerWidth >= 400) return 6;
  return 5;
};

interface Props {
  navigation: any;
  route: any;
  onTrackPress?: (track: any) => void;
}

const TRACK_SELECT = `
  id, title, duration_ms, explicit, play_count, like_count, published_at,
  artists!tracks_artist_id_fkey ( id, name, slug, avatar_url ),
  albums!tracks_album_id_fkey   ( id, title, cover_art_url, type )
`;

export default function BrowseResultsScreen({
  navigation,
  route,
  onTrackPress,
}: Props) {
  const { title, source, genreSlug } = route.params;
  const currentTrack = useAppSelector(selectCurrentTrack);
  const dispatch = useAppDispatch();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const screenW = Dimensions.get("window").width;
  // Container width measured via onLayout — reliable on web and mobile
  const [containerW, setContainerW] = useState(
    isWeb ? screenW - spacing.lg * 4 : screenW - spacing.lg * 2,
  );

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerW(w);
  }, []);

  const isAlbumList = source === "albums";
  const isArtistList = source === "artists";

  // ── Data loading — ALWAYS replaces, never appends ────────
  const loadPage = useCallback(
    async (pageNum: number) => {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        let data: any[] = [];
        let count = 0;

        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        if (source === "albums") {
          const res = await supabase
            .from("albums")
            .select(
              `id, title, type, cover_art_url, release_date, total_tracks,
             artists!albums_artist_id_fkey ( name )`,
              { count: "exact" },
            )
            .eq("is_published", true)
            .order("release_date", { ascending: false })
            .range(from, to);
          data = res.data || [];
          count = res.count || 0;
        } else if (source === "artists") {
          const res = await supabase
            .from("artists")
            .select("id, name, avatar_url, is_verified, follower_count", {
              count: "exact",
            })
            .order("name", { ascending: true })
            .range(from, to);
          data = res.data || [];
          count = res.count || 0;
        } else {
          // Track sources — no server-side pagination for API calls
          if (pageNum === 0) {
            let res: any;
            if (source === "genre" && genreSlug)
              res = await api.getByGenre(genreSlug, 200);
            else if (source === "trending") res = await api.getTrending();
            else if (source === "indie") res = await api.getIndieIndian();
            else if (source === "bengali") res = await api.getBengali();
            else if (source === "bollywood")
              res = await api.getByGenre("bollywood", 200);
            else {
              const dbRes = await supabase
                .from("tracks")
                .select(TRACK_SELECT, { count: "exact" })
                .eq("status", "published")
                .order("published_at", { ascending: false })
                .range(from, to);
              data = dbRes.data || [];
              count = dbRes.count || 0;
            }
            if (res) {
              data = res.data || [];
              count = data.length;
            }
          } else {
            // Track page > 0 — slice from cached full data
            // handled by fullTrackData ref below
          }
        }

        setTotalCount(count);
        setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
        // ALWAYS replace — never append
        setItems(data);
      } catch (err) {
        console.error("BrowseResults load error:", err);
        setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [genreSlug, source],
  );

  // For track sources, hold all data in a ref and slice per page
  const allTracksRef = useRef<any[]>([]);

  const loadAllTracks = useCallback(async () => {
    setLoading(true);
    try {
      let res: any;
      if (source === "genre" && genreSlug)
        res = await api.getByGenre(genreSlug, 200);
      else if (source === "trending") res = await api.getTrending();
      else if (source === "indie") res = await api.getIndieIndian();
      else if (source === "bengali") res = await api.getBengali();
      else if (source === "bollywood")
        res = await api.getByGenre("bollywood", 200);
      else {
        const dbRes = await supabase
          .from("tracks")
          .select(TRACK_SELECT)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(200);
        res = dbRes;
      }
      const all = res.data || [];
      allTracksRef.current = all;
      setTotalCount(all.length);
      setTotalPages(Math.max(1, Math.ceil(all.length / PAGE_SIZE)));
      setItems(all.slice(0, PAGE_SIZE));
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [source, genreSlug]);

  useEffect(() => {
    setPage(0);
    setItems([]);
    if (!isAlbumList && !isArtistList) {
      loadAllTracks();
    } else {
      loadPage(0);
    }
  }, []);

  const goToPage = useCallback(
    (newPage: number) => {
      if (newPage < 0 || newPage >= totalPages) return;
      setPage(newPage);
      if (isAlbumList || isArtistList) {
        loadPage(newPage);
      } else {
        // Slice from cached all tracks
        const from = newPage * PAGE_SIZE;
        const slice = allTracksRef.current.slice(from, from + PAGE_SIZE);
        setItems(slice);
        // Scroll to top
        if (isWeb) window.scrollTo?.({ top: 0, behavior: "smooth" });
      }
    },
    [totalPages, isAlbumList, isArtistList, loadPage],
  );

  // ── Grid card computations ────────────────────────────────
  const GAP = 12; // fixed 12px gap — consistent

  const trackCols = getColumns(containerW, "track");
  const albumCols = getColumns(containerW, "album");
  const artistCols = getColumns(containerW, "artist");

  // Exact math: fill 100% with no remainder
  const trackCardW = Math.floor(
    (containerW - GAP * (trackCols - 1)) / trackCols,
  );
  const albumCardW = Math.floor(
    (containerW - GAP * (albumCols - 1)) / albumCols,
  );
  const artistCardW = Math.floor(
    (containerW - GAP * (artistCols - 1)) / artistCols,
  );

  // ── Track Grid Card ───────────────────────────────────────
  const TrackGridCard = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      style={{ width: trackCardW }}
      onPress={() => {
        const globalIdx = page * PAGE_SIZE + index;
        const allTracks =
          allTracksRef.current.length > 0 ? allTracksRef.current : items;
        dispatch(setQueue(allTracks.slice(globalIdx)));
        if (onTrackPress) onTrackPress(item);
      }}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.cardArtWrapper,
          { width: trackCardW, height: trackCardW },
        ]}
      >
        <Image
          source={{
            uri:
              item.albums?.cover_art_url ||
              "https://via.placeholder.com/200/141414/444?text=♪",
          }}
          style={styles.cardArt}
          resizeMode="cover"
        />
        <View style={styles.cardPlayBtn}>
          <Text style={styles.cardPlayIcon}>▶</Text>
        </View>
        {item.explicit && (
          <View style={styles.explicitBadge}>
            <Text style={styles.explicitText}>E</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {item.artists?.name || "Unknown"}
      </Text>
    </TouchableOpacity>
  );

  // ── Album Card ────────────────────────────────────────────
  const AlbumCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={{ width: albumCardW }}
      onPress={() => navigation.navigate("AlbumDetail", { albumId: item.id })}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.cardArtWrapper,
          { width: albumCardW, height: albumCardW },
        ]}
      >
        <Image
          source={{
            uri:
              item.cover_art_url ||
              "https://via.placeholder.com/200/141414/444?text=♪",
          }}
          style={styles.cardArt}
          resizeMode="cover"
        />
        <View style={styles.cardPlayBtn}>
          <Text style={styles.cardPlayIcon}>▶</Text>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {item.artists?.name} · {item.total_tracks || 0} songs
      </Text>
    </TouchableOpacity>
  );

  // ── Artist Card ───────────────────────────────────────────
  const ArtistCard = ({ item }: { item: any }) => {
    const size = artistCardW;
    const avatarSize = Math.max(Math.floor(artistCardW * 0.85), 40);
    const initials =
      item.name
        ?.split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "A";
    return (
      <TouchableOpacity
        style={{ width: size, alignItems: "center" }}
        onPress={() =>
          navigation.navigate("ArtistProfile", { artistId: item.id })
        }
        activeOpacity={0.8}
      >
        <View style={{ position: "relative", marginBottom: spacing.sm }}>
          {item.avatar_url ? (
            <Image
              source={{ uri: item.avatar_url }}
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              }}
            />
          ) : (
            <View
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: colors.primary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: Math.max(Math.floor(size * 0.28), 11),
                  fontWeight: "700",
                  color: "#000",
                }}
              >
                {initials}
              </Text>
            </View>
          )}
          {item.is_verified && (
            <View style={styles.verifiedDot}>
              <Text style={{ fontSize: 9, color: "#000", fontWeight: "700" }}>
                ✓
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.cardTitle, { textAlign: "center" }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={[styles.cardSub, { textAlign: "center" }]}
          numberOfLines={1}
        >
          {(item.follower_count || 0).toLocaleString()} followers
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Pagination ────────────────────────────────────────────
  const Pagination = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageBtn, page === 0 && styles.pageBtnOff]}
          onPress={() => goToPage(page - 1)}
          disabled={page === 0}
        >
          <Text style={[styles.pageBtnTxt, page === 0 && styles.pageBtnTxtOff]}>
            ‹ Prev
          </Text>
        </TouchableOpacity>

        {/* Page numbers */}
        <View style={styles.pageNumbers}>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p = i;
            // If past 4th page, shift the window
            if (totalPages > 7 && page > 3) {
              p = Math.min(page - 3 + i, totalPages - 1);
            }
            const isActive = p === page;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.pageNum, isActive && styles.pageNumActive]}
                onPress={() => goToPage(p)}
              >
                <Text
                  style={[
                    styles.pageNumTxt,
                    isActive && styles.pageNumTxtActive,
                  ]}
                >
                  {p + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnOff]}
          onPress={() => goToPage(page + 1)}
          disabled={page >= totalPages - 1}
        >
          {loadingMore ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text
              style={[
                styles.pageBtnTxt,
                page >= totalPages - 1 && styles.pageBtnTxtOff,
              ]}
            >
              Next ›
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Web grid renderer ─────────────────────────────────────
  const WebGrid = ({ children }: { children: React.ReactNode }) => (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: GAP,
        alignItems: "flex-start",
        alignContent: "flex-start",
        width: "100%",
      }}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.countLabel}>
          {totalCount > 0 ? `${totalCount.toLocaleString()} items` : ""}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
        </View>
      ) : isWeb ? (
        <ScrollView
          style={styles.webScroll}
          contentContainerStyle={styles.webScrollContent}
          showsVerticalScrollIndicator
        >
          {/* Measure actual content width */}
          <View onLayout={onContainerLayout} style={styles.gridContainer}>
            {isArtistList ? (
              <WebGrid>
                {items.map((item) => (
                  <ArtistCard key={item.id} item={item} />
                ))}
              </WebGrid>
            ) : isAlbumList ? (
              <WebGrid>
                {items.map((item) => (
                  <AlbumCard key={item.id} item={item} />
                ))}
              </WebGrid>
            ) : (
              <WebGrid>
                {items.map((item, i) => (
                  <TrackGridCard key={item.id} item={item} index={i} />
                ))}
              </WebGrid>
            )}
          </View>

          <Pagination />
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : // Mobile — FlatList
      isArtistList || isAlbumList ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={isArtistList ? 4 : 2}
          key={isArtistList ? "artists" : "albums"}
          contentContainerStyle={styles.mobileGrid}
          columnWrapperStyle={{ gap: spacing.sm }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) =>
            isArtistList ? (
              <ArtistCard item={item} />
            ) : (
              <AlbumCard item={item} />
            )
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.mobileTrackList}
          onEndReached={() => {
            const next = page + 1;
            if (next < totalPages) goToPage(next);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={() =>
            loadingMore ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ padding: 20 }}
              />
            ) : null
          }
          renderItem={({ item, index }) => (
            <TrackCard
              track={item}
              showIndex={index}
              onPress={(track) => {
                dispatch(setQueue(items.slice(index)));
                if (onTrackPress) onTrackPress(track);
              }}
              isPlaying={currentTrack?.id === item.id}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    ...(isWeb ? { height: "100vh" as any } : {}),
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: { fontSize: 22, color: colors.textPrimary, fontWeight: "600" },
  pageTitle: {
    flex: 1,
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  countLabel: { ...typography.sm, color: colors.textTertiary },

  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: { ...typography.sm, color: colors.textSecondary },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },

  // Web scroll
  webScroll: {
    flex: 1,
    height: isWeb ? (0 as any) : undefined,
  },
  webScrollContent: {
    paddingVertical: spacing.lg,
  },
  gridContainer: {
    width: "100%",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    alignContent: "flex-start",
  },

  // Mobile
  mobileGrid: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: 120,
  },
  mobileTrackList: { paddingBottom: 120 },

  // Shared card parts
  cardArtWrapper: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.bgElevated,
    marginBottom: spacing.sm,
    position: "relative",
  },
  cardArt: { width: "100%", height: "100%" },
  cardPlayBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  cardPlayIcon: { fontSize: 13, color: "#000", marginLeft: 2 },
  explicitBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  explicitText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  cardTitle: {
    ...typography.sm,
    ...typography.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardSub: { ...typography.xs, color: colors.textSecondary },

  // Artist verified dot
  verifiedDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },

  // Pagination
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  pageBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 80,
    alignItems: "center",
  },
  pageBtnOff: { borderColor: colors.border, opacity: 0.4 },
  pageBtnTxt: { ...typography.sm, ...typography.bold, color: colors.primary },
  pageBtnTxtOff: { color: colors.textTertiary },
  pageNumbers: { flexDirection: "row", gap: spacing.xs },
  pageNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageNumActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pageNumTxt: { ...typography.sm, color: colors.textSecondary },
  pageNumTxtActive: { color: "#000", fontWeight: "700" },
});
