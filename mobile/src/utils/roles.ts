export type UserRole = "admin" | "creator" | "listener";
export type AdminRole = "super_admin" | "admin" | "moderator";

const ADMIN_ROLES = new Set(["super_admin", "admin", "moderator"]);

export const getAdminRole = (user: any): AdminRole | null => {
  const relatedRole = Array.isArray(user?.admin_roles)
    ? user.admin_roles[0]?.role
    : user?.admin_roles?.role;
  const adminRole = user?.admin_role || relatedRole;
  return ADMIN_ROLES.has(adminRole) ? adminRole : null;
};

export const normalizeAuthUser = (user: any) => {
  if (!user) return user;
  const adminRole = getAdminRole(user);
  const { admin_roles, ...cleanUser } = user;
  return {
    ...cleanUser,
    admin_role: adminRole,
    app_role: user.app_role || user.role || "listener",
    role: adminRole ? "admin" : user.role || "listener",
  };
};

export const getUserRole = (user: any): UserRole => {
  if (getAdminRole(user)) return "admin";
  if (user?.role === "admin") return "admin";
  if (user?.role === "creator" || user?.is_artist) return "creator";
  return "listener";
};

export const isAdmin = (user: any) => getUserRole(user) === "admin";

export const isCreator = (user: any) => {
  const role = getUserRole(user);
  return role === "creator" || role === "admin";
};

export const canUploadCatalog = isCreator;
