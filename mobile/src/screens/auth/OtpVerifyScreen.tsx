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
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { setSession } from "../../store/slices/authSlice";
import { normalizeAuthUser } from "../../utils/roles";
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

export default function OtpVerifyScreen({ navigation, route }: any) {
  const dispatch = useAppDispatch();
  const isWeb = Platform.OS === "web";
  const phone = route?.params?.phone || "";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProfileAndContinue = async (session: any, authUser: any) => {
    const { data: profile } = await supabase
      .from("users")
      .select("*, admin_roles(role)")
      .eq("id", authUser.id)
      .single();

    dispatch(
      setSession({
        user: normalizeAuthUser(
          profile || {
            id: authUser.id,
            email: authUser.email || "",
            phone: authUser.phone || phone,
            phone_verified: true,
          },
        ),
        session,
      }),
    );
  };

  const handleVerify = async () => {
    const token = otp.trim();

    if (token.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    if (!data.session || !data.user) {
      setError("OTP verified, but no session was returned.");
      return;
    }

    await loadProfileAndContinue(data.session, data.user);
  };

  const handleResend = async () => {
    setError("");
    setMessage("");
    setResending(true);

    const { error: resendError } = await supabase.auth.signInWithOtp({
      phone,
    });

    setResending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setMessage("A new OTP has been sent.");
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
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>6</Text>
              </View>
              <Text style={styles.title}>Enter verification code</Text>
              <Text style={styles.subtitle}>Sent to {phone}</Text>
            </View>

            <View style={styles.card}>
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              {!!message && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>{message}</Text>
                </View>
              )}

              <Text style={styles.label}>OTP CODE</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="123456"
                placeholderTextColor={colors.textDisabled}
                value={otp}
                onChangeText={(value) =>
                  setOtp(value.replace(/\D/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                editable={!loading}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryText}>Verify and continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResend}
                disabled={resending}
              >
                <Text style={styles.resendText}>
                  {resending ? "Sending..." : "Resend OTP"}
                </Text>
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
  },
  webScroll: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
  },
  panel: { width: "100%" },
  webPanel: { maxWidth: 520 },
  backBtn: { alignSelf: "flex-start", marginBottom: spacing.xl },
  backText: { ...typography.md, color: colors.primary },
  header: { alignItems: "center", marginBottom: spacing.xxl },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    ...shadows.green,
  },
  badgeText: {
    ...typography.xxl,
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
  messageBox: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  messageText: { ...typography.sm, color: colors.primary },
  label: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  otpInput: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.xxl,
    ...typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.green,
  },
  disabledBtn: { opacity: 0.6 },
  primaryText: {
    ...typography.md,
    ...typography.bold,
    color: "#000",
  },
  resendBtn: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  resendText: {
    ...typography.sm,
    ...typography.bold,
    color: colors.primary,
  },
});
