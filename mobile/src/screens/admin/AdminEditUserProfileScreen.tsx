import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { adminService } from "../../services/adminService";
import { useAppSelector } from "../../hooks/useAppDispatch";
import { getAdminRole } from "../../utils/roles";
import { SkeletonBox } from "../../components/common/SkeletonLoader";
import { colors, radius, spacing, typography } from "../../utils/theme";

const SUBSCRIPTION_TIERS = ["free", "premium", "artist_pro"] as const;
type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export default function AdminEditUserProfileScreen({ navigation, route }: any) {
  const { userId } = route.params;
  const currentUser = useAppSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetAdminRole, setTargetAdminRole] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [subscriptionTier, setSubscriptionTier] =
    useState<SubscriptionTier>("free");

  const currentAdminRole = getAdminRole(currentUser);
  const canEditTarget =
    targetAdminRole !== "super_admin" || currentAdminRole === "super_admin";
  const isWeb = Platform.OS === "web";
  const webContainerStyle = isWeb
    ? ({ height: "100vh", maxHeight: "100vh", overflow: "hidden" } as any)
    : null;
  const webScrollStyle = isWeb
    ? ({
        height: "100vh",
        maxHeight: "100vh",
        overflowY: "auto",
      } as any)
    : null;

  useEffect(() => {
    adminService.getUserDetail(userId).then((result) => {
      const user = result?.user || {};
      setTargetAdminRole(result?.adminRole?.role || null);
      setDisplayName(user.display_name || "");
      setUsername(user.username || "");
      setBio(user.bio || "");
      setCountry(user.country || "");
      setAvatarUrl(user.avatar_url || "");
      setSubscriptionTier(user.subscription_tier || "free");
      setLoading(false);
    });
  }, [userId]);

  const showError = (message: string) => {
    Alert.alert("Update failed", message);
  };

  const handleSave = async () => {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      showError("Username is required.");
      return;
    }

    if (!canEditTarget) {
      showError("Only a super admin can edit a super admin profile.");
      return;
    }

    setSaving(true);
    const result = await adminService.updateUserProfile(userId, {
      display_name: displayName.trim() || null,
      username: cleanUsername,
      bio: bio.trim() || null,
      country: country.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      subscription_tier: subscriptionTier,
    });
    setSaving(false);

    if (result?.error) {
      showError(result.error);
      return;
    }

    navigation.navigate("AdminUserDetail", {
      userId,
      refreshKey: Date.now(),
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <SkeletonBox
          width={140}
          height={24}
          radius={12}
          style={{ marginBottom: spacing.lg }}
        />
        <SkeletonBox
          width={120}
          height={120}
          radius={64}
          style={{ marginBottom: spacing.lg }}
        />
        <SkeletonBox
          width="70%"
          height={18}
          radius={10}
          style={{ marginBottom: spacing.md }}
        />
        <SkeletonBox
          width="90%"
          height={14}
          radius={8}
          style={{ marginBottom: spacing.xs }}
        />
        <SkeletonBox width="90%" height={14} radius={8} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, webContainerStyle]} edges={["top"]}>
      <ScrollView
        style={[styles.scrollView, webScrollStyle]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Profile Details</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {!canEditTarget && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Only a super admin can edit another super admin profile.
            </Text>
          </View>
        )}

        <View style={styles.formCard}>
          <Field
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="User display name"
            editable={canEditTarget && !saving}
          />

          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            editable={canEditTarget && !saving}
          />

          <Field
            label="Country"
            value={country}
            onChangeText={setCountry}
            placeholder="India"
            editable={canEditTarget && !saving}
          />

          <Field
            label="Avatar URL"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://..."
            editable={canEditTarget && !saving}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Short profile bio"
            placeholderTextColor={colors.textDisabled}
            value={bio}
            onChangeText={setBio}
            editable={canEditTarget && !saving}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Subscription</Text>
          <View style={styles.tierRow}>
            {SUBSCRIPTION_TIERS.map((tier) => {
              const active = subscriptionTier === tier;
              return (
                <TouchableOpacity
                  key={tier}
                  style={[styles.tierChip, active && styles.tierChipActive]}
                  disabled={!canEditTarget || saving}
                  onPress={() => setSubscriptionTier(tier)}
                >
                  <Text
                    style={[styles.tierText, active && styles.tierTextActive]}
                  >
                    {tier.replace("_", " ").toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (!canEditTarget || saving) && styles.saveButtonDisabled,
          ]}
          disabled={!canEditTarget || saving}
          onPress={handleSave}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  editable,
  autoCapitalize = "sentences",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  editable: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) => (
  <>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={colors.textDisabled}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      autoCapitalize={autoCapitalize}
    />
  </>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  backText: { ...typography.md, color: colors.primary },
  headerTitle: {
    ...typography.xl,
    ...typography.bold,
    color: colors.textPrimary,
  },
  headerSpacer: { width: 110 },
  warningBox: {
    borderWidth: 1,
    borderColor: colors.red + "66",
    backgroundColor: colors.red + "18",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningText: { ...typography.sm, color: colors.red },
  formCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  label: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginTop: spacing.md,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.md,
  },
  textArea: {
    minHeight: 120,
  },
  tierRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tierChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgElevated,
  },
  tierChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tierText: {
    ...typography.xs,
    ...typography.bold,
    color: colors.textSecondary,
  },
  tierTextActive: {
    color: "#000",
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    ...typography.md,
    ...typography.bold,
    color: "#000",
  },
});
