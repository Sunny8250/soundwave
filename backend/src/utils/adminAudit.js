const { supabaseAdmin } = require("./supabase");

const logAdminAction = async ({
  actorId,
  targetUserId = null,
  action,
  oldValues = null,
  newValues = null,
}) => {
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: actorId,
    target_user_id: targetUserId,
    action,
    old_values: oldValues || null,
    new_values: newValues || null,
  });

  if (error) {
    console.warn("Admin audit log skipped:", error.message);
    return;
  }

  await fireWebhook({
    event: "admin_audit_log",
    data: {
      actorId,
      targetUserId,
      action,
      oldValues,
      newValues,
    },
  });
};

const notifyAdmins = async ({ type, title, body, payload = null }) => {
  const [{ data: adminRows }, { data: legacyAdminRows }] = await Promise.all([
    supabaseAdmin.from("admin_roles").select("user_id"),
    supabaseAdmin.from("users").select("id").eq("role", "admin"),
  ]);

  const adminUserIds = Array.from(
    new Set(
      [
        ...(adminRows || []).map((row) => row.user_id),
        ...(legacyAdminRows || []).map((row) => row.id),
      ].filter(Boolean),
    ),
  );

  if (adminUserIds.length === 0) return;

  const notifications = adminUserIds.map((userId) => ({
    user_id: userId,
    type,
    title,
    body,
    payload,
  }));

  const { error } = await supabaseAdmin
    .from("notifications")
    .insert(notifications);
  if (error) {
    console.warn("Admin notification insert failed:", error.message);
  }
};

const fireWebhook = async ({ event, data }) => {
  const webhookUrl = process.env.ADMIN_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn("Admin webhook delivery failed:", err);
  }
};

module.exports = { logAdminAction, notifyAdmins, fireWebhook };
