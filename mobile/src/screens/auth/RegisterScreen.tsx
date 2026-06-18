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

export default function RegisterScreen({ navigation }: any) {
  const isWeb = Platform.OS === "web";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordChecks = [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "Contains a letter", passed: /[A-Za-z]/.test(password) },
    { label: "Contains a number", passed: /\d/.test(password) },
  ];

  const passwordIsStrong = passwordChecks.every((check) => check.passed);

  const handleRegister = async () => {
    if (!displayName || !email || !password || !confirm) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!passwordIsStrong) {
      setError("Password must be at least 8 characters and include a letter and a number");
      return;
    }

    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    Alert.alert(
      "Check your email",
      "We sent a verification link. After confirming your email, you can sign in.",
      [{ text: "OK", onPress: () => navigation.navigate("Login") }],
    );
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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join Soundwave for free</Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            ) : null}

            {[
              {
                label: "Your Name",
                value: displayName,
                setter: setDisplayName,
                placeholder: "e.g. Rahul Das",
                icon: "👤",
                secure: false,
                keyboard: "default",
              },
              {
                label: "Email",
                value: email,
                setter: setEmail,
                placeholder: "you@example.com",
                icon: "✉",
                secure: false,
                keyboard: "email-address",
              },
              {
                label: "Password",
                value: password,
                setter: setPassword,
                placeholder: "At least 8 characters",
                icon: "🔒",
                secure: true,
                keyboard: "default",
              },
              {
                label: "Confirm Password",
                value: confirm,
                setter: setConfirm,
                placeholder: "Repeat your password",
                icon: "🔒",
                secure: true,
                keyboard: "default",
              },
            ].map((field) => (
              <View key={field.label} style={styles.inputGroup}>
                <Text style={styles.label}>{field.label}</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>{field.icon}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textTertiary}
                    value={field.value}
                    onChangeText={field.setter}
                    secureTextEntry={field.secure}
                    autoCapitalize="none"
                    keyboardType={field.keyboard as any}
                  />
                </View>
                {field.label === "Password" && (
                  <View style={styles.passwordChecklist}>
                    {passwordChecks.map((check) => (
                      <Text
                        key={check.label}
                        style={[
                          styles.passwordCheck,
                          check.passed && styles.passwordCheckPassed,
                        ]}
                      >
                        {check.passed ? "OK" : "--"} {check.label}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.registerBtn,
                loading && styles.registerBtnDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.registerBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.loginLinkText}>
              Already have an account?{" "}
              <Text style={styles.loginLinkHighlight}>Log In</Text>
            </Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.xxl },
  webScroll: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
  },
  authPanel: {
    width: "100%",
  },
  webAuthPanel: {
    maxWidth: 680,
  },
  backBtn: { marginBottom: spacing.xl },
  backText: { ...typography.md, color: colors.primary },
  header: { marginBottom: spacing.xxl },
  title: {
    ...typography.xxxl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  errorBox: {
    backgroundColor: "#EF444422",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "#EF444444",
  },
  errorText: { ...typography.sm, color: colors.red },
  inputGroup: { marginBottom: spacing.lg },
  label: {
    ...typography.sm,
    ...typography.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  inputIcon: { fontSize: 16 },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.md,
    color: colors.textPrimary,
  },
  passwordChecklist: {
    marginTop: spacing.sm,
    gap: 2,
  },
  passwordCheck: {
    ...typography.xs,
    color: colors.textTertiary,
  },
  passwordCheckPassed: {
    color: colors.primary,
  },
  registerBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadows.green,
  },
  registerBtnDisabled: { opacity: 0.6 },
  registerBtnText: {
    ...typography.md,
    ...typography.bold,
    color: "#000",
  },
  loginLink: { alignItems: "center", marginBottom: spacing.xl },
  loginLinkText: { ...typography.sm, color: colors.textSecondary },
  loginLinkHighlight: { color: colors.primary, fontWeight: "600" },
});
