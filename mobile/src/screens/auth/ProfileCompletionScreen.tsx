import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { setUser } from "../../store/slices/authSlice";
import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "../../utils/theme";
import { getProfileContactLabel } from "../../utils/profile";

export default function ProfileCompletionScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isWeb = Platform.OS === "web";
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const cleanName = displayName.trim().replace(/\s+/g, " ");

    if (cleanName.length < 2) {
      setError("Enter your real name.");
      return;
    }

    if (!user?.id) {
      setError("Your session is not ready. Please log in again.");
      return;
    }

    setError("");
    setSaving(true);

    const { error: profileError } = await supabase
      .from("users")
      .update({ display_name: cleanName })
      .eq("id", user.id);

    if (!profileError) {
      await supabase.auth.updateUser({
        data: { full_name: cleanName, name: cleanName },
      });
    }

    setSaving(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    dispatch(setUser({ ...user, display_name: cleanName }));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, isWeb && styles.webScroll]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.panel, isWeb && styles.webPanel]}>
            <View style={styles.header}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>S</Text>
              </View>
              <Text style={styles.title}>Complete your profile</Text>
              <Text style={styles.subtitle}>
                Add your name so your account looks clean across Soundwave.
              </Text>
            </View>

            <View style={styles.card}>
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>YOUR NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rahul Das"
                placeholderTextColor={colors.textDisabled}
                value={displayName}
                onChangeText={setDisplayName}
                editable={!saving}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              {!!getProfileContactLabel(user) && (
                <Text style={styles.contactText}>
                  Signed in with {getProfileContactLabel(user)}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, saving && styles.disabledBtn]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  webScroll: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
  },
  panel: { width: "100%" },
  webPanel: { maxWidth: 520 },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    ...shadows.green,
  },
  logoText: {
    ...typography.xxxl,
    ...typography.bold,
    color: "#000",
  },
  title: {
    ...typography.xxxl,
    ...typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 360,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { ...typography.sm, color: colors.red },
  label: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    padding: spacing.md,
    ...typography.md,
  },
  contactText: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginTop: spacing.xxl,
    ...shadows.green,
  },
  disabledBtn: { opacity: 0.65 },
  primaryText: {
    ...typography.md,
    ...typography.bold,
    color: "#000",
  },
});
