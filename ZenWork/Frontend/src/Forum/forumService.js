import { supabase } from "../supabaseClient";
import {
  getAttachmentKind,
  isAllowedPostAttachment,
  isAllowedCommentGif,
  isAttachmentSizeAllowed,
  normalizeRole,
} from "./forumUtils";

const FORUM_BUCKET = "forum-media";

const GIPHY_API_BASE = "https://api.giphy.com/v1";
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY ?? "";

function sanitizeFileName(name = "file") {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]/g, "_")
    .slice(0, 120);
}

function getPublicUrl(path) {
  const { data } = supabase.storage.from(FORUM_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

function resolveAttachmentUrl(item) {
  if (item?.external_url) return item.external_url;
  if (/^https?:\/\//i.test(item?.storage_path ?? "")) return item.storage_path;
  return getPublicUrl(item.storage_path);
}

function mapGiphyResult(item) {
  const preview =
    item?.images?.fixed_width?.url ||
    item?.images?.downsized?.url ||
    item?.images?.original?.url ||
    null;

  const full =
    item?.images?.original?.url ||
    item?.images?.downsized?.url ||
    item?.images?.fixed_width?.url ||
    null;

  return {
    id: item.id,
    title: item.title || item.slug || "GIF",
    previewUrl: preview,
    gifUrl: full,
    itemUrl: item.url ?? null,
  };
}

async function giphyFetch(endpoint, params = {}) {
  if (!GIPHY_API_KEY) {
    throw new Error("Clé GIPHY absente.");
  }

  const url = new URL(`${GIPHY_API_BASE}/${endpoint}`);
  url.searchParams.set("api_key", GIPHY_API_KEY);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Erreur GIPHY.");
  }

  return data;
}

export function hasGiphyConfig() {
  return Boolean(GIPHY_API_KEY);
}

export async function searchGiphyGifs(query, limit = 24) {
  const data = await giphyFetch("gifs/search", {
    q: query,
    limit,
    rating: "pg",
    lang: "fr",
    bundle: "messaging_non_clips",
  });

  return (data?.data ?? []).map(mapGiphyResult).filter((item) => item.gifUrl);
}

export async function getGiphyTrendingGifs(limit = 24) {
  const data = await giphyFetch("gifs/trending", {
    limit,
    rating: "pg",
    bundle: "messaging_non_clips",
  });

  return (data?.data ?? []).map(mapGiphyResult).filter((item) => item.gifUrl);
}

export function normalizeForumRole(role) {
  return normalizeRole(role);
}

export async function fetchCurrentUserRole(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return normalizeRole(data?.role);
}

export async function fetchProfileById(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nom, prenom, role")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMembersExcept(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nom, prenom, role")
    .neq("id", userId)
    .order("prenom", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchProfilesByIds(ids = []) {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nom, prenom, role")
    .in("id", ids);

  if (error) throw error;
  return data ?? [];
}

export async function fetchPostsByMode(mode) {
  const { data, error } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("mode", mode)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from("forum_comments")
    .select("*")
    .eq("post_id", postId)
    .neq("status", "deleted")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchAttachmentsByTargets(targetType, targetIds = []) {
  if (!targetIds.length) return {};

  const { data, error } = await supabase
    .from("forum_attachments")
    .select("*")
    .eq("target_type", targetType)
    .in("target_id", targetIds)
    .eq("is_rejected", false)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const grouped = {};
  (data ?? []).forEach((item) => {
    const key = String(item.target_id);
    if (!grouped[key]) grouped[key] = [];

    grouped[key].push({
      ...item,
      publicUrl: resolveAttachmentUrl(item),
    });
  });

  return grouped;
}

export async function uploadForumAttachment(file, { targetType, targetId, uploaderId }) {
  if (!file) throw new Error("Fichier manquant.");

  const mimeType = file.type ?? "";
  const kind = getAttachmentKind(mimeType);

  if (!kind) {
    throw new Error("Type de fichier non pris en charge.");
  }

  if (targetType === "post") {
    if (!isAllowedPostAttachment(mimeType)) {
      throw new Error("Type de fichier non autorisé pour un post.");
    }
  }

  if (targetType === "comment") {
    if (!isAllowedCommentGif(mimeType)) {
      throw new Error("Seul un GIF est autorisé dans un commentaire.");
    }
  }

  if (!isAttachmentSizeAllowed(file)) {
    throw new Error("Le fichier dépasse la taille maximale autorisée.");
  }

  const safeName = sanitizeFileName(file.name);
  const path = `${uploaderId}/${targetType}-${targetId}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(FORUM_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: mimeType,
    });

  if (uploadError) throw uploadError;

  const record = {
    target_type: targetType,
    target_id: targetId,
    uploader_id: uploaderId,
    kind,
    storage_path: path,
    file_name: safeName,
    mime_type: mimeType,
    size_bytes: file.size,
    scan_status: "pending",
    is_nsfw: false,
    is_rejected: false,
  };

  const { data, error } = await supabase
    .from("forum_attachments")
    .insert([record])
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    publicUrl: resolveAttachmentUrl(data),
  };
}

export async function createExternalGifAttachment({
  targetType,
  targetId,
  uploaderId,
  gif,
}) {
  if (!gif?.gifUrl) {
    throw new Error("GIF externe invalide.");
  }

  const record = {
    target_type: targetType,
    target_id: targetId,
    uploader_id: uploaderId,
    kind: "gif",
    storage_path: gif.gifUrl,
    file_name: sanitizeFileName(`${gif.title || "giphy-gif"}.gif`),
    mime_type: "image/gif",
    size_bytes: 0,
    scan_status: "external",
    is_nsfw: false,
    is_rejected: false,
  };

  const { data, error } = await supabase
    .from("forum_attachments")
    .insert([record])
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    publicUrl: resolveAttachmentUrl(data),
  };
}

export async function deleteAttachment(attachmentId) {
  const { data, error } = await supabase
    .from("forum_attachments")
    .select("id, storage_path")
    .eq("id", attachmentId)
    .single();

  if (error) throw error;

  if (data?.storage_path && !/^https?:\/\//i.test(data.storage_path)) {
    const { error: storageError } = await supabase.storage
      .from(FORUM_BUCKET)
      .remove([data.storage_path]);

    if (storageError) throw storageError;
  }

  const { error: deleteError } = await supabase
    .from("forum_attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteError) throw deleteError;

  return true;
}

export async function syncPostAttachments({
  postId,
  userId,
  previousAttachments = [],
  keepAttachmentIds = [],
  newFiles = [],
  externalGif = null,
}) {
  const keepIds = new Set((keepAttachmentIds ?? []).map((id) => String(id)));

  for (const attachment of previousAttachments ?? []) {
    if (!keepIds.has(String(attachment.id))) {
      await deleteAttachment(attachment.id);
    }
  }

  for (const file of newFiles ?? []) {
    await uploadForumAttachment(file, {
      targetType: "post",
      targetId: postId,
      uploaderId: userId,
    });
  }

  if (externalGif) {
    await createExternalGifAttachment({
      targetType: "post",
      targetId: postId,
      uploaderId: userId,
      gif: externalGif,
    });
  }

  const hasMedia =
    keepIds.size > 0 || (newFiles?.length ?? 0) > 0 || Boolean(externalGif);

  const { error } = await supabase
    .from("forum_posts")
    .update({
      has_media: hasMedia,
      edited_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("user_id", userId);

  if (error) throw error;

  return { hasMedia };
}

export async function syncCommentAttachments({
  commentId,
  userId,
  previousAttachments = [],
  keepAttachmentIds = [],
  gifFile = null,
  externalGif = null,
}) {
  const keepIds = new Set((keepAttachmentIds ?? []).map((id) => String(id)));

  for (const attachment of previousAttachments ?? []) {
    if (!keepIds.has(String(attachment.id))) {
      await deleteAttachment(attachment.id);
    }
  }

  if (gifFile) {
    await uploadForumAttachment(gifFile, {
      targetType: "comment",
      targetId: commentId,
      uploaderId: userId,
    });
  }

  if (externalGif) {
    await createExternalGifAttachment({
      targetType: "comment",
      targetId: commentId,
      uploaderId: userId,
      gif: externalGif,
    });
  }

  const hasGif =
    keepIds.size > 0 || Boolean(gifFile) || Boolean(externalGif);

  const { error } = await supabase
    .from("forum_comments")
    .update({
      has_gif: hasGif,
      edited_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("user_id", userId);

  if (error) throw error;

  return { hasGif };
}

export async function createPost({
  userId,
  authorName,
  content,
  mode,
  attachments = [],
  externalGif = null,
}) {
  const payload = {
    user_id: userId,
    author_name: authorName,
    content,
    mode,
    status: "published",
    has_media: attachments.length > 0 || Boolean(externalGif),
  };

  const { data, error } = await supabase
    .from("forum_posts")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  if (attachments.length) {
    for (const file of attachments) {
      await uploadForumAttachment(file, {
        targetType: "post",
        targetId: data.id,
        uploaderId: userId,
      });
    }
  }

  if (externalGif) {
    await createExternalGifAttachment({
      targetType: "post",
      targetId: data.id,
      uploaderId: userId,
      gif: externalGif,
    });
  }

  return data;
}

export async function updatePost({ postId, userId, content }) {
  const { data, error } = await supabase
    .from("forum_posts")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePost(postId) {
  const { error } = await supabase
    .from("forum_posts")
    .update({ status: "deleted" })
    .eq("id", postId);

  if (error) throw error;
  return true;
}

export async function moderateForumPost({ postId, status, moderationReason = null }) {
  const { data, error } = await supabase
    .from("forum_posts")
    .update({
      status,
      moderation_reason: moderationReason,
    })
    .eq("id", postId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function moderateForumComment({
  commentId,
  status,
  moderationReason = null,
}) {
  const { data, error } = await supabase
    .from("forum_comments")
    .update({
      status,
      moderation_reason: moderationReason,
    })
    .eq("id", commentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchLikes(postId) {
  const { data, error } = await supabase
    .from("forum_likes")
    .select("*")
    .eq("post_id", postId);

  if (error) throw error;
  return data ?? [];
}

export async function toggleLike({ postId, userId, hasLiked }) {
  if (hasLiked) {
    const { error } = await supabase
      .from("forum_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);

    if (error) throw error;
    return { liked: false };
  }

  const { error } = await supabase
    .from("forum_likes")
    .insert([{ post_id: postId, user_id: userId }]);

  if (error) throw error;
  return { liked: true };
}

export async function createComment({
  postId,
  userId,
  authorName,
  content,
  parentCommentId = null,
  gifFile = null,
  externalGif = null,
}) {
  const payload = {
    post_id: postId,
    user_id: userId,
    author_name: authorName,
    content,
    parent_comment_id: parentCommentId,
    status: "published",
    has_gif: Boolean(gifFile || externalGif),
  };

  const { data, error } = await supabase
    .from("forum_comments")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  if (gifFile) {
    await uploadForumAttachment(gifFile, {
      targetType: "comment",
      targetId: data.id,
      uploaderId: userId,
    });
  }

  if (externalGif) {
    await createExternalGifAttachment({
      targetType: "comment",
      targetId: data.id,
      uploaderId: userId,
      gif: externalGif,
    });
  }

  return data;
}

export async function updateComment({ commentId, userId, content }) {
  const { data, error } = await supabase
    .from("forum_comments")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const { error } = await supabase
    .from("forum_comments")
    .update({ status: "deleted" })
    .eq("id", commentId);

  if (error) throw error;
  return true;
}

export async function createForumReport({
  reporterId,
  targetType,
  targetId,
  reason,
  details = "",
}) {
  const { data, error } = await supabase
    .from("forum_reports")
    .insert([
      {
        reporter_id: reporterId,
        target_type: targetType,
        target_id: targetId,
        reason,
        details,
        status: "open",
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchOpenForumReports() {
  const { data, error } = await supabase
    .from("forum_reports")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function reviewForumReport({ reportId, reviewedBy, status = "reviewed" }) {
  const { data, error } = await supabase
    .from("forum_reports")
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createForumSanction({
  userId,
  type,
  reason,
  endAt = null,
  issuedBy,
}) {
  const { data, error } = await supabase
    .from("forum_user_sanctions")
    .insert([
      {
        user_id: userId,
        type,
        reason,
        end_at: endAt,
        issued_by: issuedBy,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function clearForumSanction(sanctionId) {
  const { data, error } = await supabase
    .from("forum_user_sanctions")
    .update({ is_active: false })
    .eq("id", sanctionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchActiveForumSanction(userId) {
  const { data, error } = await supabase
    .from("forum_user_sanctions")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const now = Date.now();
  const active = (data ?? []).find((item) => {
    if (!item.end_at) return true;
    return new Date(item.end_at).getTime() > now;
  });

  return active ?? null;
}

export async function fetchPrivateMessages(userId, otherUserId) {
  const { data, error } = await supabase
    .from("forum_private_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
    )
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendPrivateMessage({ senderId, receiverId, content }) {
  const { data, error } = await supabase
    .from("forum_private_messages")
    .insert([
      {
        sender_id: senderId,
        receiver_id: receiverId,
        content,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchUserGroups(userId) {
  const { data: memberships, error: membershipsError } = await supabase
    .from("forum_message_group_members")
    .select("group_id, role")
    .eq("user_id", userId);

  if (membershipsError) throw membershipsError;

  const groupIds = [...new Set((memberships ?? []).map((item) => item.group_id))];
  if (!groupIds.length) return [];

  const { data: groups, error: groupsError } = await supabase
    .from("forum_message_groups")
    .select("*")
    .in("id", groupIds)
    .order("created_at", { ascending: false });

  if (groupsError) throw groupsError;

  const roleByGroupId = new Map(
    (memberships ?? []).map((item) => [item.group_id, item.role])
  );

  return (groups ?? []).map((group) => ({
    ...group,
    membershipRole: roleByGroupId.get(group.id) ?? "member",
  }));
}

export async function fetchGroupMembers(groupId) {
  const { data: membershipRows, error: membershipError } = await supabase
    .from("forum_message_group_members")
    .select("user_id, role")
    .eq("group_id", groupId);

  if (membershipError) throw membershipError;

  const userIds = [...new Set((membershipRows ?? []).map((row) => row.user_id))];
  if (!userIds.length) return [];

  const profiles = await fetchProfilesByIds(userIds);

  const roleByUserId = new Map(
    (membershipRows ?? []).map((row) => [row.user_id, row.role])
  );

  return profiles.map((profile) => ({
    ...profile,
    membershipRole: roleByUserId.get(profile.id) ?? "member",
  }));
}

export async function fetchGroupMessages(groupId) {
  const { data, error } = await supabase
    .from("forum_group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createMessageGroup({
  creatorId,
  name = "",
  memberIds = [],
}) {
  const uniqueIds = [...new Set([creatorId, ...memberIds].filter(Boolean))];

  if (uniqueIds.length < 2) {
    throw new Error("Un groupe doit contenir au moins 2 membres.");
  }

  const cleanName = String(name ?? "").trim();
  const isDirectLikeGroup = uniqueIds.length === 2;

  const groupId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: groupError } = await supabase
    .from("forum_message_groups")
    .insert([
      {
        id: groupId,
        name: isDirectLikeGroup ? "__auto__" : cleanName,
        created_by: creatorId,
        created_at: now,
      },
    ]);

  if (groupError) throw groupError;

  const membersPayload = uniqueIds.map((userId) => ({
    group_id: groupId,
    user_id: userId,
    role: userId === creatorId ? "owner" : "member",
  }));

  const { error: membersError } = await supabase
    .from("forum_message_group_members")
    .insert(membersPayload);

  if (membersError) throw membersError;

  return {
    id: groupId,
    name: isDirectLikeGroup ? "__auto__" : cleanName,
    created_by: creatorId,
    created_at: now,
  };
}

export async function sendGroupMessage({ groupId, senderId, content }) {
  const cleanContent = String(content ?? "").trim();
  if (!cleanContent) {
    throw new Error("Le message ne peut pas être vide.");
  }

  const { data, error } = await supabase
    .from("forum_group_messages")
    .insert([
      {
        group_id: groupId,
        sender_id: senderId,
        content: cleanContent,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchDirectThreads(userId) {
  const { data, error } = await supabase
    .from("forum_private_messages")
    .select("sender_id, receiver_id, created_at")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const otherIds = [
    ...new Set(
      (data ?? [])
        .map((item) =>
          item.sender_id === userId ? item.receiver_id : item.sender_id
        )
        .filter(Boolean)
    ),
  ];

  if (!otherIds.length) return [];

  const profiles = await fetchProfilesByIds(otherIds);

  return profiles.sort((a, b) => {
    const aName = [a?.prenom, a?.nom].filter(Boolean).join(" ");
    const bName = [b?.prenom, b?.nom].filter(Boolean).join(" ");
    return aName.localeCompare(bName, "fr");
  });
}

export async function fetchAllActiveForumSanctions() {
  const { data, error } = await supabase
    .from("forum_user_sanctions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveForumSanctionsByUserIds(userIds = []) {
  if (!userIds.length) return {};

  const { data, error } = await supabase
    .from("forum_user_sanctions")
    .select("*")
    .in("user_id", userIds)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const now = Date.now();
  const map = {};

  (data ?? []).forEach((item) => {
    if (map[item.user_id]) return;

    if (!item.end_at || new Date(item.end_at).getTime() > now) {
      map[item.user_id] = item;
    }
  });

  return map;
}

export async function fetchCommentById(commentId) {
  const { data, error } = await supabase
    .from("forum_comments")
    .select("*")
    .eq("id", commentId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

