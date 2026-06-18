import React, { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { setSession } from "../../store/slices/authSlice";
import { signInWithGoogle } from "../../services/oauth";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

export default function WelcomeScreen({ navigation }: any) {
  const dispatch = useAppDispatch();
  const isWeb = Platform.OS === "web";
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const showProviderSetup = (provider: string) => {
    Alert.alert(
      `${provider} sign-in`,
      `${provider} sign-in will be enabled after the Supabase provider setup is complete.`,
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
      <ScrollView
        contentContainerStyle={[styles.content, isWeb && styles.webContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.panel, isWeb && styles.webPanel]}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.appName}>Soundwave</Text>
            <Text style={styles.tagline}>
              Listen, discover, and publish music from one secure account.
            </Text>
          </View>

          <View style={styles.actions}>
            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate("Register")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>Create account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => navigation.navigate("Login")}
              activeOpacity={0.85}
            >
              <Text style={styles.outlineText}>Continue with email</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={[styles.providerBtn, googleLoading && styles.disabledBtn]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.providerIcon}>G</Text>
              <Text style={styles.providerText}>Continue with Google</Text>
              {googleLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.providerStatus}>OAuth</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.providerBtn}
              onPress={() => navigation.navigate("PhoneLogin")}
              activeOpacity={0.85}
            >
              <Text style={styles.providerIcon}>#</Text>
              <Text style={styles.providerText}>Continue with phone</Text>
              <Text style={styles.providerStatus}>OTP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.providerBtn}
              onPress={() => showProviderSetup("Apple")}
              activeOpacity={0.85}
            >
              <Text style={styles.providerIcon}>A</Text>
              <Text style={styles.providerText}>Continue with Apple</Text>
              <Text style={styles.providerStatus}>Later</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.securityNote}>
            Phone verification will be requested before artist uploads, payouts,
            and account recovery changes.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  webContent: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
  },
  panel: {
    width: "100%",
  },
  webPanel: {
    maxWidth: 520,
  },
  brand: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
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
  appName: {
    ...typography.xxxl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  tagline: {
    ...typography.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 360,
  },
  actions: { gap: spacing.md },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    padding: spacing.md,
  },
  errorText: { ...typography.sm, color: colors.red },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.green,
  },
  primaryText: {
    ...typography.md,
    ...typography.bold,
    color: "#000",
  },
  outlineBtn: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.bgCard,
  },
  outlineText: {
    ...typography.md,
    ...typography.bold,
    color: colors.textPrimary,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  providerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  providerIcon: {
    width: 28,
    ...typography.md,
    ...typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  providerText: {
    flex: 1,
    ...typography.md,
    ...typography.semibold,
    color: colors.textPrimary,
  },
  providerStatus: {
    ...typography.xs,
    color: colors.textTertiary,
  },
  disabledBtn: { opacity: 0.65 },
  securityNote: {
    ...typography.sm,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
});
