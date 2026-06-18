export const isPhonePlaceholderEmail = (email?: string | null) =>
  !!email && email.endsWith("@phone.soundwave.local");

export const isGeneratedPhoneName = (value?: string | null) =>
  !!value &&
  (/^user_\d{4,}$/i.test(value.trim()) || /^\+?\d{8,15}$/.test(value.trim()));

export const getProfileDisplayName = (user: any, fallback = "Listener") => {
  const displayName = user?.display_name?.trim();
  const username = user?.username?.trim();

  if (displayName && !isGeneratedPhoneName(displayName)) return displayName;
  if (username && !isGeneratedPhoneName(username)) return username;

  return fallback;
};

export const getProfileContactLabel = (user: any) => {
  if (user?.phone) return user.phone;
  if (user?.email && !isPhonePlaceholderEmail(user.email)) return user.email;
  return "";
};

export const getProfileInitial = (user: any) =>
  getProfileDisplayName(user, "U").charAt(0).toUpperCase();

export const needsProfileCompletion = (user: any) => {
  if (!user) return false;

  const displayName = user?.display_name?.trim();
  const hasRealDisplayName =
    !!displayName && !isGeneratedPhoneName(displayName);

  return !hasRealDisplayName && !!user?.phone;
};
