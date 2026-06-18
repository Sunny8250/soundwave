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
import {
  colors,
  typography,
  spacing,
  radius,
  shadows,
} from "../../utils/theme";

const normalizePhone = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return `+${digits}`;
};

export default function PhoneLoginScreen({ navigation }: any) {
  const isWeb = Platform.OS === "web";
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async () => {
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || normalizedPhone.length < 8) {
      setError("Enter a valid phone number with country code.");
      return;
    }

    setError("");
    setLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
    });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    navigation.navigate("OtpVerify", { phone: normalizedPhone });
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
                <Text style={styles.badgeText}>#</Text>
              </View>
              <Text style={styles.title}>Continue with phone</Text>
              <Text style={styles.subtitle}>
                We will send a 6-digit verification code by SMS.
              </Text>
            </View>

            <View style={styles.card}>
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.label}>PHONE NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.textDisabled}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                editable={!loading}
              />
              <Text style={styles.hint}>
                Use international format. Indian 10-digit numbers will be
                converted to +91 automatically.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryText}>Send OTP</Text>
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
  label: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.md,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.xs,
    color: colors.textTertiary,
    marginTop: spacing.sm,
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
});
