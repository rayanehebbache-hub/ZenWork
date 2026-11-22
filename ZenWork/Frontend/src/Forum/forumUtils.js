export function normalizeRole(role) {
  return String(role ?? "").trim().toLowerCase();
}

export function isHR(role) {
  return normalizeRole(role) === "rh";
}

export function isAdminLike(role) {
  const normalized = normalizeRole(role);
  return ["rh", "direction", "admin", "administrateur"].includes(normalized);
}

export function canModerateForum(role) {
  return isAdminLike(role);
}

export function canBanForumUsers(role) {
  return isAdminLike(role);
}

export function getUserDisplayName(user, profile = null) {
  return (
    [profile?.prenom, profile?.nom].filter(Boolean).join(" ") ||
    user?.user_metadata?.prenom ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "Utilisateur"
  );
}

export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

export function canPostInForum(activeSanction) {
  if (!activeSanction) return true;
  return !["forum_banned", "forum_suspended", "mute_posts"].includes(
    activeSanction.type
  );
}

export function canCommentInForum(activeSanction) {
  if (!activeSanction) return true;
  return !["forum_banned", "forum_suspended", "mute_comments"].includes(
    activeSanction.type
  );
}

export function isAllowedPostAttachment(mimeType) {
  return [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "application/pdf",
  ].includes(mimeType);
}

export function isAllowedCommentGif(mimeType) {
  return mimeType === "image/gif";
}

export function getAttachmentKind(mimeType) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "image/gif") return "gif";
  if (mimeType.startsWith("image/")) return "image";
  return null;
}

export function getPostAttachmentLimits(kind) {
  const MB = 1024 * 1024;

  switch (kind) {
    case "image":
      return 10 * MB;
    case "gif":
      return 50 * MB;     // ✅ max réel Supabase
    case "video":
      return 50 * MB;     // ✅ max réel Supabase
    case "pdf":
      return 20 * MB;
    default:
      return 0;
  }
}

export function isAttachmentSizeAllowed(file) {
  const kind = getAttachmentKind(file?.type || "");
  const max = getPostAttachmentLimits(kind);
  return max > 0 && file.size <= max;
}

export function groupCommentsByParent(comments = []) {
  const byParent = new Map();

  comments.forEach((comment) => {
    const key = comment.parent_comment_id ?? "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(comment);
  });

  byParent.forEach((list) => {
    list.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  function buildTree(parentKey = "root", depth = 0) {
    return (byParent.get(parentKey) || []).map((comment) => ({
      ...comment,
      depth,
      replies: buildTree(comment.id, depth + 1),
    }));
  }

  return buildTree();
}

export function sanitizeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}