import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../services/supabase";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { setSession } from "../../store/slices/authSlice";
import { signInWithGoogle } from "../../services/oauth";
import { normalizeAuthUser } from "../../utils/roles";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

const { height } = Dimensions.get("window");

export default function LoginScreen({ navigation }: any) {
  const dispatch = useAppDispatch();
  const isWeb = Platform.OS === "web";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const showProviderSetup = (provider: string) => {
    Alert.alert(
      `${provider} sign-in`,
      `${provider} sign-in will be enabled after the provider setup is complete.`,
    );
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    const { data: profile } = await supabase
      .from("users")
      .select("*, admin_roles(role)")
      .eq("id", data.user.id)
      .single();
    dispatch(
      setSession({
        user: normalizeAuthUser(profile || data.user),
        session: data.session,
      }),
    );
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError("Enter your email address first");
      return;
    }

    setError("");
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
    );
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    Alert.alert(
      "Check your email",
      "We sent a secure password reset link to your email address.",
    );
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const { user, session } = await signInWithGoogle();
      dispatch(setSession({ user, session }));
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
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
          <View style={[styles.authPanel, isWeb && styles.webAuthPanel]}>
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                <Text style={styles.logoEmoji}>🎵</Text>
              </View>
            </View>
            <Text style={styles.appName}>Soundwave</Text>
            <Text style={styles.tagline}>
              Experience sound in high definition.
            </Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="yourname@domain.com"
              placeholderTextColor={colors.textDisabled}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity style={styles.forgotBtn} onPress={handlePasswordReset}>
              <Text style={styles.forgotText}>FORGOT PASSWORD?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.signInBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.signInText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR CONTINUE WITH</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.socialIcon}>G</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => navigation.navigate("PhoneLogin")}
              >
                <Text style={styles.socialIcon}>#</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => showProviderSetup("Apple")}
              >
                <Text style={styles.socialIcon}>🎵</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>New to Soundwave? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
              <Text style={styles.signupLink}>Create account</Text>
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
    padding: spacing.xl,
    justifyContent: "center",
    minHeight: height,
  },
  webScroll: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
  },
  authPanel: {
    width: "100%",
  },
  webAuthPanel: {
    maxWidth: 560,
  },
  logoArea: { alignItems: "center", marginBottom: spacing.xxxl },
  logoRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: colors.primaryMid,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  logoInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.green,
  },
  logoEmoji: { fontSize: 32 },
  appName: {
    ...typography.xxxl,
    ...typography.bold,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  tagline: {
    ...typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorText: { ...typography.sm, color: colors.red },
  fieldLabel: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  forgotText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  signInBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.green,
  },
  signInText: { ...typography.md, ...typography.bold, color: "#000" },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
    gap: spacing.md,
  },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: {
    ...typography.xs,
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  socialBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  socialIcon: {
    ...typography.md,
    ...typography.bold,
    color: colors.textPrimary,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: { ...typography.sm, color: colors.textSecondary },
  signupLink: { ...typography.sm, ...typography.bold, color: colors.primary },
});
