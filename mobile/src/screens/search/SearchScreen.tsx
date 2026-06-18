import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Keyboard,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";
import {
  getTrackArtistAvatar,
  getTrackArtistNames,
} from "../../utils/trackArtists";

const { width } = Dimensions.get("window");

const GENRE_CARDS = [
  { name: "Bollywood", slug: "bollywood", color: "#F97316", emoji: "🎬" },
  { name: "Indie", slug: "indie", color: "#8B5CF6", emoji: "🎸" },
  { name: "Synthwave", slug: "electronic", color: "#3B82F6", emoji: "🎹" },
  { name: "Hip-Hop", slug: "hip-hop", color: "#EC4899", emoji: "🎤" },
  { name: "Classical", slug: "classical", color: "#6366F1", emoji: "🎻" },
  { name: "Dance", slug: "electronic", color: "#14B8A6", emoji: "🎧" },
];

interface Props {
  navigation?: any;
  onTrackPress?: (track: any) => void;
  onArtistPress?: (artistId: string) => void;
}

export default function SearchScreen({
  onTrackPress,
  onArtistPress,
  navigation,
}: Props) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<any>(null);

  const search = useCallback(async (text: string) => {
    if (!text.trim()) {
      setTracks([]);
      setArtists([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const [tRes, aRes] = await Promise.all([
        supabase
          .from("tracks")
          .select(
            `
            id, title, duration_ms, explicit, play_count, cover_art_url,
            artists!tracks_artist_id_fkey(id,name,avatar_url),
            albums!tracks_album_id_fkey(cover_art_url),
            track_artists (
              role,
              artists ( id, name, avatar_url )
            )
            `,
          )
          .eq("status", "published")
          .ilike("title", `%${text}%`)
          .limit(10),
        supabase
          .from("artists")
          .select("id,name,avatar_url,is_verified,follower_count")
          .ilike("name", `%${text}%`)
          .limit(5),
      ]);
      setTracks(tRes.data || []);
      setArtists(aRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 400);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "";
    return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  };

  const hasResults = tracks.length > 0 || artists.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoIcon}>🎵</Text>
          <Text style={styles.logoText}>Soundwave</Text>
        </View>
        <TouchableOpacity style={styles.moreBtn}>
          <Text style={styles.moreBtnText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Search title */}
      <Text style={styles.pageTitle}>Search</Text>

      {/* Search bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Text style={styles.searchBarIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Artists, songs, or podcasts"
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={handleChangeText}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => search(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery("");
                setTracks([]);
                setArtists([]);
                setSearched(false);
              }}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Empty — show genre grid */}
      {!searched && !loading && (
        <FlatList
          data={[]}
          renderItem={null}
          keyExtractor={() => "x"}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <View>
              {/* Recent searches chips */}
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={styles.subTitle}>RECENT SEARCHES</Text>
                  <TouchableOpacity>
                    <Text style={styles.clearAllText}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.recentChips}>
                  {["Indie", "Synthwave 84", "Bengali"].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={styles.recentChip}
                      onPress={() => {
                        setQuery(r);
                        search(r);
                      }}
                    >
                      <Text style={styles.recentChipText}>{r}</Text>
                      <Text style={styles.recentChipX}>✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Browse genres grid */}
              <Text style={styles.subTitle2}>BROWSE GENRES</Text>
              <View style={styles.genreGrid}>
                {GENRE_CARDS.map((g) => (
                  <TouchableOpacity
                    key={g.slug + g.name}
                    style={[
                      styles.genreCard,
                      {
                        backgroundColor: g.color + "22",
                        borderColor: g.color + "44",
                      },
                    ]}
                    onPress={() => {
                      setQuery(g.name);
                      search(g.name);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.genreEmoji}>{g.emoji}</Text>
                    <Text style={[styles.genreName, { color: g.color }]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Suggested for you */}
              <Text style={[styles.subTitle2, { marginTop: spacing.xl }]}>
                SUGGESTED FOR YOU
              </Text>
            </View>
          )}
        />
      )}

      {/* No results */}
      {searched && !loading && !hasResults && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsIcon}>😕</Text>
          <Text style={styles.noResultsTitle}>No results for "{query}"</Text>
          <Text style={styles.noResultsSub}>
            Try a different search term or browse genres above
          </Text>
        </View>
      )}

      {/* Results */}
      {hasResults && !loading && (
        <FlatList
          data={[]}
          renderItem={null}
          keyExtractor={() => "results"}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          ListHeaderComponent={() => (
            <View>
              {/* Artists */}
              {artists.length > 0 && (
                <View style={styles.resultsSection}>
                  <Text style={styles.resultsSectionTitle}>Artists</Text>
                  {artists.map((artist) => (
                    <TouchableOpacity
                      key={artist.id}
                      style={styles.artistRow}
                      onPress={() => {
                        Keyboard.dismiss();
                        if (onArtistPress) onArtistPress(artist.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.artistAvatar}>
                        <Text style={styles.artistAvatarText}>
                          {artist.name[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.artistInfo}>
                        <View style={styles.artistNameRow}>
                          <Text style={styles.artistName}>{artist.name}</Text>
                          {artist.is_verified && (
                            <View style={styles.verifiedBadge}>
                              <Text style={styles.verifiedText}>✓</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.artistMeta}>
                          {(artist.follower_count || 0).toLocaleString()}{" "}
                          followers
                        </Text>
                      </View>
                      <Text style={styles.rowArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Tracks */}
              {tracks.length > 0 && (
                <View style={styles.resultsSection}>
                  <Text style={styles.resultsSectionTitle}>Tracks</Text>
                  {tracks.map((track) => (
                    <TouchableOpacity
                      key={track.id}
                      style={styles.trackRow}
                      onPress={() => {
                        Keyboard.dismiss();
                        if (onTrackPress) onTrackPress(track);
                      }}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{
                          uri:
                            track.cover_art_url ||
                            track.albums?.cover_art_url ||
                            getTrackArtistAvatar(track) ||
                            "https://via.placeholder.com/48/141414/444?text=♪",
                        }}
                        style={styles.trackCover}
                      />
                      <View style={styles.trackInfo}>
                        <Text style={styles.trackTitle} numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>
                          {getTrackArtistNames(track, "Unknown")}
                        </Text>
                      </View>
                      <Text style={styles.trackDuration}>
                        {formatDuration(track.duration_ms)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ height: 100 }} />
            </View>
          )}
        />
      )}
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
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoIcon: { fontSize: 18 },
  logoText: { ...typography.md, ...typography.bold, color: colors.primary },
  moreBtn: { padding: spacing.sm },
  moreBtnText: { fontSize: 20, color: colors.textSecondary },
  pageTitle: {
    ...typography.xxxl,
    ...typography.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  searchBarWrapper: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchBarIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.md,
    color: colors.textPrimary,
  },
  clearText: {
    ...typography.sm,
    color: colors.textTertiary,
    padding: spacing.xs,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  loadingText: { ...typography.sm, color: colors.textSecondary },
  recentSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  subTitle: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  subTitle2: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  clearAllText: { ...typography.sm, color: colors.primary },
  recentChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  recentChipText: { ...typography.sm, color: colors.textPrimary },
  recentChipX: { ...typography.xs, color: colors.textTertiary },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  genreCard: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2,
    height: 100,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  genreEmoji: { fontSize: 32 },
  genreName: { ...typography.md, ...typography.bold },
  noResults: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  noResultsIcon: { fontSize: 48, marginBottom: spacing.md },
  noResultsTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
  },
  noResultsSub: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "center",
    paddingHorizontal: spacing.xxxl,
  },
  resultsSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  resultsSectionTitle: {
    ...typography.lg,
    ...typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  artistAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  artistAvatarText: { ...typography.lg, ...typography.bold, color: "#000" },
  artistInfo: { flex: 1 },
  artistNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  artistName: {
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedText: { fontSize: 10, color: "#000", fontWeight: "700" },
  artistMeta: { ...typography.xs, color: colors.textSecondary, marginTop: 2 },
  rowArrow: { fontSize: 20, color: colors.textTertiary },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  trackCover: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    ...typography.md,
    ...typography.medium,
    color: colors.textPrimary,
  },
  trackArtist: { ...typography.sm, color: colors.textSecondary, marginTop: 2 },
  trackDuration: { ...typography.xs, color: colors.textTertiary },
});
