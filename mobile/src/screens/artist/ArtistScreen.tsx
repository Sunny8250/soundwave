import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { setQueue } from "../../store/slices/playerSlice";
import {
  upsertArtists,
  upsertTracks,
  upsertAlbums,
} from "../../store/slices/entitiesSlice";
import {
  artistsSelectors,
  tracksSelectors,
  albumsSelectors,
} from "../../store/slices/entitiesSlice";

const { width } = Dimensions.get("window");

interface Track {
  id: string;
  title: string;
  duration_ms?: number;
  play_count?: number;
  like_count?: number;
  explicit?: boolean;
  cover_art_url?: string | null;
  album_id?: string | null;
  artist_ids?: string[];
  artists?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
  albums?: {
    id: string;
    title: string;
    cover_art_url?: string | null;
    type?: string;
    release_date?: string;
    is_published?: boolean;
  };
}

interface Album {
  id: string;
  title: string;
  cover_art_url?: string | null;
  artist_id?: string | null;
  type?: string;
  release_date?: string;
}

interface Props {
  navigation: any;
  route: any;
  onTrackPress?: (track: any) => void;
}

export default function ArtistScreen({
  navigation,
  route,
  onTrackPress,
}: Props) {
  const { artistId } = route.params;
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Prefer normalized store values when available
  const artistFromStore = useAppSelector((s) =>
    artistsSelectors.selectById(s, artistId),
  );
  const allTracks = useAppSelector((s) => tracksSelectors.selectAll(s));
  const allAlbums = useAppSelector((s) => albumsSelectors.selectAll(s));

  const [artist, setArtist] = useState<any>(artistFromStore || null);

  useEffect(() => {
    if (artistFromStore) setArtist(artistFromStore);
  }, [artistFromStore]);
  // Tracks for this artist (filter by artist_ids or artists field fallback)
  const tracks: any[] = allTracks.filter((t: any) => {
    if (Array.isArray(t.artist_ids) && t.artist_ids.length > 0)
      return t.artist_ids.includes(artistId);
    return t.artists?.id === artistId;
  });
  const albums: any[] = allAlbums.filter((a: any) => a.artist_id === artistId);
  const [isFollowing, setIsFollowing] = useState(false);
  const isOwnProfile = artist?.user_id === user?.id;

  const loadData = useCallback(async () => {
    try {
      // Load artist profile
      const { data: artistData } = await supabase
        .from("artists")
        .select("*")
        .eq("id", artistId)
        .single();

      setArtist(artistData);
      // upsert into normalized store
      try {
        dispatch(upsertArtists([artistData] as any));
      } catch (e) {}

      // Load tracks where this artist is primary, plus tracks linked through
      // track_artists for featured/collaborator credits.
      const [primaryTracksRes, linkedTracksRes] = await Promise.all([
        supabase
          .from("tracks")
          .select(
            `
            id, title, duration_ms, play_count, like_count, explicit, cover_art_url,
            artists!tracks_artist_id_fkey ( id, name, avatar_url ),
            albums!tracks_album_id_fkey ( id, title, cover_art_url, type, release_date, is_published ),
            track_artists (
              role,
              artists ( id, name, avatar_url )
            )
          `,
          )
          .eq("artist_id", artistId)
          .eq("status", "published")
          .order("play_count", { ascending: false })
          .limit(20),
        supabase
          .from("track_artists")
          .select(
            `
            role,
            tracks (
              id, title, duration_ms, play_count, like_count, explicit, cover_art_url, status,
              artists!tracks_artist_id_fkey ( id, name, avatar_url ),
              albums!tracks_album_id_fkey ( id, title, cover_art_url, type, release_date, is_published ),
              track_artists (
                role,
                artists ( id, name, avatar_url )
              )
            )
          `,
          )
          .eq("artist_id", artistId),
      ]);

      const trackMap = new Map<string, any>();
      (primaryTracksRes.data || []).forEach((track) =>
        trackMap.set(track.id, track),
      );
      (linkedTracksRes.data || []).forEach((row: any) => {
        const linkedTrack = row.tracks;
        if (linkedTrack?.status === "published") {
          trackMap.set(linkedTrack.id, linkedTrack);
        }
      });

      const builtTracks = Array.from(trackMap.values())
        .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
        .slice(0, 20);
      // upsert tracks into normalized store with artist_ids
      try {
        const normalized = builtTracks.map((t) => {
          const artistIds = [] as string[];
          if (t.artists?.id) artistIds.push(t.artists.id);
          if (Array.isArray(t.track_artists)) {
            t.track_artists.forEach((ta: any) => {
              if (ta?.artists?.id && !artistIds.includes(ta.artists.id))
                artistIds.push(ta.artists.id);
            });
          }
          return {
            ...t,
            artist_ids: artistIds,
            album_id: t.albums?.id || null,
          };
        });
        dispatch(upsertTracks(normalized as any));
      } catch (e) {}

      // Load artist albums
      const { data: albumsData } = await supabase
        .from("albums")
        .select("id, title, cover_art_url, type, release_date")
        .eq("artist_id", artistId)
        .eq("is_published", true)
        .order("release_date", { ascending: false });

      const albumMap = new Map<string, any>();
      (albumsData || []).forEach((album) => albumMap.set(album.id, album));
      (linkedTracksRes.data || []).forEach((row: any) => {
        const linkedAlbum = row.tracks?.albums;
        if (linkedAlbum?.id && linkedAlbum.is_published !== false) {
          albumMap.set(linkedAlbum.id, linkedAlbum);
        }
      });

      const builtAlbums = Array.from(albumMap.values()).sort(
        (a, b) =>
          new Date(b.release_date || 0).getTime() -
          new Date(a.release_date || 0).getTime(),
      );
      try {
        dispatch(upsertAlbums(builtAlbums as any));
      } catch (e) {}

      // local set for UI remains for backward compatibility
      // setAlbums(builtAlbums);

      // Check if following
      if (user?.id) {
        const { data: followData } = await supabase
          .from("user_follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", artistId)
          .eq("following_type", "artist")
          .single();
        setIsFollowing(!!followData);
      }
    } catch (err) {
      console.error("ArtistScreen load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [artistId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleFollow = async () => {
    if (!user?.id) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", artistId)
          .eq("following_type", "artist");
        setIsFollowing(false);
        setArtist((prev: any) => ({
          ...prev,
          follower_count: Math.max((prev.follower_count || 1) - 1, 0),
        }));
      } else {
        await supabase.from("user_follows").insert({
          follower_id: user.id,
          following_id: artistId,
          following_type: "artist",
        });
        setIsFollowing(true);
        setArtist((prev: any) => ({
          ...prev,
          follower_count: (prev.follower_count || 0) + 1,
        }));
      }
    } catch (err) {
      console.error("Follow error:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "";
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCount = (n?: number) => {
    if (!n) return "0";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const artistTracks = tracks.map((track: any) => ({
    ...track,
    artists: track.artists || {
      id: artist?.id,
      name: artist?.name,
      avatar_url: artist?.avatar_url,
    },
  }));

  const handlePlayAll = () => {
    if (artistTracks.length === 0) return;
    dispatch(setQueue(artistTracks as any));
    if (onTrackPress) onTrackPress(artistTracks[0]);
  };

  const handleTrackPress = (track: any) => {
    const index = artistTracks.findIndex((item) => item.id === track.id);
    dispatch(setQueue(artistTracks.slice(Math.max(index, 0)) as any));
    if (onTrackPress) onTrackPress(track);
  };

  const renderTrackCover = (track: any) => {
    const imageUrl =
      track.cover_art_url || track.albums?.cover_art_url || artist?.avatar_url;
    if (imageUrl) {
      return (
        <Image source={{ uri: imageUrl }} style={styles.trackCoverImage} />
      );
    }

    return (
      <View style={styles.trackCover}>
        <Text style={styles.trackCoverText}>ðŸŽµ</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    );
  }

  if (!artist) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: "#fff" }}>Artist not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Artist hero */}
        <View style={styles.hero}>
          {artist.avatar_url ? (
            <Image
              source={{ uri: artist.avatar_url }}
              style={styles.heroAvatarImage}
            />
          ) : (
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>
                {artist.name[0].toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.artistName}>{artist.name}</Text>
              {artist.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {formatCount(artist.monthly_listeners)}
                </Text>
                <Text style={styles.statLabel}>Monthly listeners</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {formatCount(artist.follower_count)}
                </Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{tracks.length}</Text>
                <Text style={styles.statLabel}>Tracks</Text>
              </View>
            </View>

            {/* Bio */}
            {artist.bio ? <Text style={styles.bio}>{artist.bio}</Text> : null}

            {/* Follow / Edit button */}
            {isOwnProfile ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navigation.navigate("CreatorDashboard")}
              >
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                onPress={handleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator
                    color={isFollowing ? "#fff" : "#000"}
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.followBtnText,
                      isFollowing && styles.followingBtnText,
                    ]}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {tracks.length > 0 && (
              <TouchableOpacity
                style={styles.playAllBtn}
                onPress={handlePlayAll}
                activeOpacity={0.85}
              >
                <Text style={styles.playAllBtnText}>▶ Play All</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Popular tracks */}
        {tracks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular</Text>
            {tracks.slice(0, 5).map((track, index) => (
              <TouchableOpacity
                key={track.id}
                style={styles.trackRow}
                onPress={() => handleTrackPress(artistTracks[index])}
                activeOpacity={0.7}
              >
                <Text style={styles.trackIndex}>{index + 1}</Text>
                {renderTrackCover(track)}
                <View style={styles.trackCoverHidden}>
                  <Text style={styles.trackCoverText}>🎵</Text>
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackPlays}>
                    {formatCount(track.play_count)} plays
                  </Text>
                </View>
                <Text style={styles.trackDuration}>
                  {formatDuration(track.duration_ms)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Albums */}
        {albums.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Albums</Text>
            {albums.map((album) => (
              <TouchableOpacity
                key={album.id}
                style={styles.albumRow}
                onPress={() =>
                  navigation.navigate("AlbumDetail", { albumId: album.id })
                }
                activeOpacity={0.8}
              >
                <View style={styles.albumCover}>
                  <Text style={styles.albumCoverText}>💿</Text>
                </View>
                <View style={styles.albumInfo}>
                  <Text style={styles.albumTitle} numberOfLines={2}>
                    {album.title}
                  </Text>
                  <Text style={styles.albumMeta}>
                    {album.type} · {new Date(album.release_date).getFullYear()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Discography */}
        {tracks.length > 5 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Tracks</Text>
            {tracks.slice(5).map((track, index) => (
              <TouchableOpacity
                key={track.id}
                style={styles.trackRow}
                onPress={() => handleTrackPress(artistTracks[index + 5])}
                activeOpacity={0.7}
              >
                <Text style={styles.trackIndex}>{index + 6}</Text>
                {renderTrackCover(track)}
                <View style={styles.trackCoverHidden}>
                  <Text style={styles.trackCoverText}>🎵</Text>
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackPlays}>
                    {formatCount(track.play_count)} plays
                  </Text>
                </View>
                <Text style={styles.trackDuration}>
                  {formatDuration(track.duration_ms)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {tracks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎵</Text>
            <Text style={styles.emptyTitle}>No tracks yet</Text>
            <Text style={styles.emptySub}>
              {isOwnProfile
                ? "Upload your first track from the Creator Dashboard"
                : "This artist has not uploaded any tracks yet"}
            </Text>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={() => navigation.navigate("UploadTrack")}
              >
                <Text style={styles.uploadBtnText}>Upload Track</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtn: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backText: { color: "#1DB954", fontSize: 15 },
  hero: {
    padding: 20,
    paddingTop: 8,
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
    marginBottom: 8,
  },
  heroAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroAvatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1a1a1a",
    marginBottom: 16,
  },
  heroAvatarText: { fontSize: 44, fontWeight: "700", color: "#fff" },
  heroInfo: { alignItems: "center", width: "100%" },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  artistName: { fontSize: 26, fontWeight: "700", color: "#fff" },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statItem: { alignItems: "center", paddingHorizontal: 20 },
  statValue: { fontSize: 18, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  statDivider: { width: 0.5, height: 30, backgroundColor: "#333" },
  bio: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  followBtn: {
    backgroundColor: "#1DB954",
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 24,
  },
  followingBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#fff",
  },
  followBtnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  followingBtnText: { color: "#fff" },
  editBtn: {
    borderWidth: 1,
    borderColor: "#fff",
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 24,
  },
  editBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  playAllBtn: {
    backgroundColor: "#1DB954",
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 12,
  },
  playAllBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 15,
  },
  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    marginTop: 8,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
  },
  trackIndex: { width: 24, fontSize: 13, color: "#666", textAlign: "center" },
  trackCover: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  trackCoverHidden: {
    display: "none",
  },
  trackCoverImage: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
  },
  trackCoverText: { fontSize: 18 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 14, fontWeight: "500", color: "#fff" },
  trackPlays: { fontSize: 12, color: "#888", marginTop: 2 },
  trackDuration: { fontSize: 12, color: "#666" },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#fff" },
  emptySub: {
    fontSize: 13,
    color: "#888",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  uploadBtn: {
    backgroundColor: "#1DB954",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  uploadBtnText: { color: "#fff", fontWeight: "700" },
  albumRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1a1a1a",
  },
  albumCover: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  albumCoverText: { fontSize: 24 },
  albumInfo: { flex: 1 },
  albumTitle: { fontSize: 14, fontWeight: "600", color: "#fff" },
  albumMeta: { fontSize: 12, color: "#888", marginTop: 4 },
});
