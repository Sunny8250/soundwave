import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { setUser } from "../../store/slices/authSlice";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const API_PREFIX = process.env.EXPO_PUBLIC_API_PREFIX || "/api/v2";
const API_BASE = API_URL ? `${API_URL}${API_PREFIX}` : "";

export default function BecomeArtistScreen({ navigation }: any) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [name, setName] = useState(user?.display_name || "");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("India");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Artist name is required");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${API_BASE}/auth/become-artist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name: name.trim(), bio: bio.trim(), country }),
      });

      const json = await res.json();

      if (!res.ok) {
        Alert.alert("Error", json.error || "Failed to create artist profile");
        return;
      }

      // Update user in Redux store
      dispatch(setUser({ ...user!, is_artist: true }));
      Alert.alert(
        "🎉 Artist profile created!",
        "You can now upload your music.",
        [
          {
            text: "Start Uploading",
            onPress: () => navigation.replace("CreatorDashboard"),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.heroArea}>
            <Text style={styles.heroIcon}>🎤</Text>
            <Text style={styles.heroTitle}>Become an Artist</Text>
            <Text style={styles.heroSub}>
              Create your artist profile and start uploading your music to
              Soundwave.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Artist Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Your artist or band name"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell listeners about yourself..."
              placeholderTextColor="#666"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              placeholder="India"
              placeholderTextColor="#666"
              value={country}
              onChangeText={setCountry}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ✅ Upload unlimited tracks{"\n"}✅ Earn 85% of streaming revenue
                {"\n"}✅ See your play stats and analytics{"\n"}✅ Build your
                fanbase on Soundwave
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Create Artist Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  scroll: { flexGrow: 1, padding: 20 },
  backBtn: { marginBottom: 20 },
  backText: { color: "#1DB954", fontSize: 15 },
  heroArea: { alignItems: "center", marginBottom: 32 },
  heroIcon: { fontSize: 56, marginBottom: 12 },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  heroSub: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  form: { width: "100%" },
  label: {
    fontSize: 13,
    color: "#aaa",
    marginBottom: 6,
    marginTop: 16,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  infoBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#1DB95433",
  },
  infoText: { color: "#aaa", fontSize: 14, lineHeight: 26 },
  btn: {
    backgroundColor: "#1DB954",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
