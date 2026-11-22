import { useEffect, useMemo, useRef, useState } from "react";
import {
  createComment,
  createForumReport,
  createForumSanction,
  fetchActiveForumSanction,
  fetchAttachmentsByTargets,
  fetchComments,
  fetchLikes,
  fetchProfilesByIds,
  moderateForumPost,
  syncCommentAttachments,
  toggleLike as toggleLikeAction,
  updateComment as updateCommentAction,
  deleteComment as deleteCommentAction,
} from "./forumService";
import {
  canBanForumUsers,
  canCommentInForum,
  canModerateForum,
  formatDate,
  formatFileSize,
  getUserDisplayName,
  groupCommentsByParent,
} from "./forumUtils";
import ReportModal from "./ReportModal";
import GiphyGifPicker from "./GiphyGifPicker";

const textareaStyle = {
  width: "100%",
  minHeight: 112,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#ffffff",
  padding: "16px 18px",
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
  fontSize: 15,
  lineHeight: 1.5,
  boxSizing: "border-box",
};

const pickerToolbarStyle = {
  position: "relative",
  overflow: "visible",
  alignItems: "center",
  zIndex: 5,
};

function GifPreview({ item, onRemove }) {
  if (!item?.publicUrl && !item?.gifUrl && !item?.previewUrl) return null;

  const src = item.publicUrl || item.gifUrl || item.previewUrl;

  return (
    <div className="forum-comment-gif">
      <img
        src={src}
        alt={item.file_name || item.title || "GIF"}
      />
      {onRemove && (
        <button
          type="button"
          className="forum-tool-btn"
          onClick={onRemove}
          style={{ marginTop: 8 }}
        >
          Retirer le GIF
        </button>
      )}
    </div>
  );
}

const EMPTY_REPLY_STATE = {
  mode: null,
  targetId: null,
  text: "",
  externalGif: null,
  existingGif: null,
  existingGifRemoved: false,
};

function CommentNode({
  comment,
  user,
  commentProfiles,
  commentAttachmentsMap,
  replyState,
  setReplyState,
  onReplySubmit,
  onEditSubmit,
  onDelete,
  onOpenReport,
  activeSanction,
  submitting,
  highlightedCommentId,
}) {
  const [showGifPicker, setShowGifPicker] = useState(false);
  const prevTargetId = useRef(replyState.targetId);

  useEffect(() => {
    if (prevTargetId.current !== replyState.targetId) {
      setShowGifPicker(false);
      prevTargetId.current = replyState.targetId;
    }
  }, [replyState.targetId]);

  const profile = commentProfiles[comment.user_id];
  const label =
    [profile?.prenom, profile?.nom].filter(Boolean).join(" ") ||
    comment.author_name ||
    "Utilisateur";

  const isOwnComment = comment.user_id === user.id;
  const gifAttachment = (commentAttachmentsMap[String(comment.id)] ?? []).find(
    (item) => item.kind === "gif"
  );

  const isEditing =
    replyState.mode === "edit" &&
    String(replyState.targetId) === String(comment.id);

  const isReplying =
    replyState.mode === "reply" &&
    String(replyState.targetId) === String(comment.id);

  const isHighlighted =
    String(highlightedCommentId ?? "") === String(comment.id ?? "");

  function closeAllModes() {
    setShowGifPicker(false);
    setReplyState(EMPTY_REPLY_STATE);
  }

  return (
    <div
      id={`forum-comment-${comment.id}`}
      className={comment.depth > 0 ? "forum-reply-card" : "forum-comment-card"}
      style={
        isHighlighted
          ? { outline: "2px solid #6C5DD3", scrollMarginTop: 100 }
          : undefined
      }
    >
      <div className="forum-comment-header">
        <div>
          <div className="forum-comment-author">{label}</div>
          <div className="forum-comment-date">
            {formatDate(comment.created_at)}
            {comment.edited_at ? " • modifié" : ""}
          </div>
        </div>

        {comment.status !== "published" && (
          <span
            className={`forum-status-pill ${
              comment.status === "hidden" ? "hidden" : "reported"
            }`}
          >
            {comment.status === "hidden" ? "Masqué" : comment.status}
          </span>
        )}
      </div>

      {isEditing ? (
        <>
          <textarea
            value={replyState.text}
            onChange={(e) =>
              setReplyState((prev) => ({
                ...prev,
                text: e.target.value,
              }))
            }
            rows={3}
            style={{ ...textareaStyle, minHeight: 110, marginTop: 12 }}
          />

          <div className="forum-comment-toolbar" style={pickerToolbarStyle}>
            <button
              type="button"
              className="forum-tool-btn"
              onClick={() => setShowGifPicker((prev) => !prev)}
            >
              GIF GIPHY
            </button>

            <button
              type="button"
              className="start-btn forum-admin-btn"
              onClick={() => onEditSubmit(comment.id)}
              disabled={submitting}
            >
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </button>

            <button
              type="button"
              className="start-btn forum-admin-btn"
              onClick={closeAllModes}
              disabled={submitting}
            >
              Annuler
            </button>

            <GiphyGifPicker
              open={showGifPicker}
              onClose={() => setShowGifPicker(false)}
              onSelect={(gif) => {
                setReplyState((prev) => ({
                  ...prev,
                  externalGif: gif,
                  existingGifRemoved: prev.existingGif ? true : false,
                }));
                setShowGifPicker(false);
              }}
              anchorLabel="GIF GIPHY"
            />
          </div>

          {!replyState.existingGifRemoved && replyState.existingGif && (
            <div style={{ marginTop: 10 }}>
              <GifPreview
                item={replyState.existingGif}
                onRemove={() =>
                  setReplyState((prev) => ({
                    ...prev,
                    existingGifRemoved: true,
                  }))
                }
              />
            </div>
          )}

          {replyState.externalGif && (
            <div style={{ marginTop: 10 }}>
              <GifPreview
                item={replyState.externalGif}
                onRemove={() =>
                  setReplyState((prev) => ({
                    ...prev,
                    externalGif: null,
                    existingGifRemoved: prev.existingGif ? false : false,
                  }))
                }
              />
            </div>
          )}

          {replyState.existingGif &&
            replyState.existingGifRemoved &&
            !replyState.externalGif && (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="forum-tool-btn"
                  onClick={() =>
                    setReplyState((prev) => ({
                      ...prev,
                      existingGifRemoved: false,
                    }))
                  }
                >
                  Rétablir le GIF actuel
                </button>
              </div>
            )}
        </>
      ) : (
        <>
          {comment.content && (
            <div className="forum-comment-content">{comment.content}</div>
          )}

          {gifAttachment && (gifAttachment.publicUrl || gifAttachment.external_url) && (
            <div className="forum-comment-gif">
              <img
                src={gifAttachment.publicUrl || gifAttachment.external_url}
                alt={gifAttachment.file_name || "GIF"}
              />
            </div>
          )}

          <div className="forum-comment-actions">
            <button
              type="button"
              className="start-btn forum-action-btn"
              onClick={() => {
                if (isReplying) {
                  closeAllModes();
                } else {
                  setReplyState({
                    ...EMPTY_REPLY_STATE,
                    mode: "reply",
                    targetId: comment.id,
                  });
                }
              }}
              disabled={!canCommentInForum(activeSanction)}
            >
              {isReplying ? "Annuler la réponse" : "Répondre"}
            </button>

            {isOwnComment && (
              <button
                type="button"
                className="start-btn forum-admin-btn"
                onClick={() => {
                  const currentGif =
                    (commentAttachmentsMap[String(comment.id)] ?? []).find(
                      (item) => item.kind === "gif"
                    ) ?? null;

                  setReplyState({
                    mode: "edit",
                    targetId: comment.id,
                    text: comment.content ?? "",
                    externalGif: null,
                    existingGif: currentGif,
                    existingGifRemoved: false,
                  });
                }}
              >
                Modifier
              </button>
            )}

            {isOwnComment && (
              <button
                type="button"
                className="start-btn forum-admin-btn forum-admin-danger"
                onClick={() => onDelete(comment)}
              >
                Supprimer
              </button>
            )}

            {!isOwnComment && (
              <button
                type="button"
                className="start-btn forum-action-btn forum-report-btn"
                onClick={() => onOpenReport("comment", comment.id)}
              >
                🚩 Signaler
              </button>
            )}
          </div>
        </>
      )}

      {isReplying && (
        <div className="forum-comment-composer">
          <textarea
            value={replyState.text}
            onChange={(e) =>
              setReplyState((prev) => ({
                ...prev,
                text: e.target.value,
              }))
            }
            placeholder="Écrire une réponse..."
            rows={3}
            style={{ ...textareaStyle, minHeight: 110 }}
          />

          <div className="forum-comment-toolbar" style={pickerToolbarStyle}>
            <button
              type="button"
              className="forum-tool-btn"
              onClick={() => setShowGifPicker((prev) => !prev)}
            >
              GIF GIPHY
            </button>

            <button
              type="button"
              className="start-btn forum-action-btn"
              onClick={() => onReplySubmit(comment.id)}
              disabled={
                submitting ||
                (!replyState.text.trim() && !replyState.externalGif) ||
                !canCommentInForum(activeSanction)
              }
            >
              {submitting ? "Envoi..." : "Envoyer la réponse"}
            </button>

            <GiphyGifPicker
              open={showGifPicker}
              onClose={() => setShowGifPicker(false)}
              onSelect={(gif) => {
                setReplyState((prev) => ({
                  ...prev,
                  externalGif: gif,
                }));
                setShowGifPicker(false);
              }}
              anchorLabel="GIF GIPHY"
            />
          </div>

          {replyState.externalGif && (
            <GifPreview
              item={replyState.externalGif}
              onRemove={() =>
                setReplyState((prev) => ({
                  ...prev,
                  externalGif: null,
                }))
              }
            />
          )}
        </div>
      )}

      {comment.replies?.length > 0 && (
        <div className="forum-replies-list">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              user={user}
              commentProfiles={commentProfiles}
              commentAttachmentsMap={commentAttachmentsMap}
              replyState={replyState}
              setReplyState={setReplyState}
              onReplySubmit={onReplySubmit}
              onEditSubmit={onEditSubmit}
              onDelete={onDelete}
              onOpenReport={onOpenReport}
              activeSanction={activeSanction}
              submitting={submitting}
              highlightedCommentId={highlightedCommentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Post({
  post,
  user,
  role,
  authorProfile,
  authorSanction = null,
  attachments = [],
  refreshPosts,
  onEditPost,
  onDeletePost,
  canManagePost,
  focusTarget = null,
  onFocusHandled,
}) {
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentProfiles, setCommentProfiles] = useState({});
  const [commentAttachmentsMap, setCommentAttachmentsMap] = useState({});
  const [commentText, setCommentText] = useState("");
  const [commentExternalGif, setCommentExternalGif] = useState(null);
  const [showRootGifPicker, setShowRootGifPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [replyState, setReplyState] = useState(EMPTY_REPLY_STATE);
  const [activeSanction, setActiveSanction] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const postRef = useRef(null);
  const lastHandledFocusRef = useRef("");

  useEffect(() => {
    loadLikes();
    loadComments();
  }, [post.id, role]);

  useEffect(() => {
    if (!user?.id) return;
    loadSanction();
  }, [user?.id]);

  useEffect(() => {
    if (!showComments) {
      setShowRootGifPicker(false);
    }
  }, [showComments]);

  useEffect(() => {
    if (!focusTarget?.id) return;

    const key = `${focusTarget.type}:${focusTarget.id}:${focusTarget.postId ?? ""}`;
    if (lastHandledFocusRef.current === key) return;

    if (focusTarget.type === "post" && String(focusTarget.id) === String(post.id)) {
      requestAnimationFrame(() => {
        postRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        lastHandledFocusRef.current = key;
        onFocusHandled?.();
      });
      return;
    }

    if (
      focusTarget.type === "comment" &&
      String(focusTarget.postId) === String(post.id)
    ) {
      setShowComments(true);
    }
  }, [focusTarget, post.id, onFocusHandled]);

  useEffect(() => {
    if (
      !focusTarget?.id ||
      focusTarget.type !== "comment" ||
      String(focusTarget.postId) !== String(post.id) ||
      !showComments
    ) {
      return;
    }

    const key = `${focusTarget.type}:${focusTarget.id}:${focusTarget.postId ?? ""}`;
    if (lastHandledFocusRef.current === key) return;

    const element = document.getElementById(`forum-comment-${focusTarget.id}`);
    if (!element) return;

    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      lastHandledFocusRef.current = key;
      onFocusHandled?.();
    });
  }, [focusTarget, showComments, comments, post.id, onFocusHandled]);

  async function loadSanction() {
    try {
      const sanction = await fetchActiveForumSanction(user.id);
      setActiveSanction(sanction);
    } catch (error) {
      console.error("Erreur chargement sanction forum :", error.message);
      setActiveSanction(null);
    }
  }

  async function loadLikes() {
    try {
      const data = await fetchLikes(post.id);
      setLikes(data.length);
      setHasLiked(data.some((like) => like.user_id === user.id));
    } catch (error) {
      console.error("Erreur chargement likes :", error.message);
    }
  }

  async function loadComments() {
    try {
      const data = await fetchComments(post.id);
      const visibleComments = canModerateForum(role)
        ? data
        : data.filter((comment) => comment.status === "published");

      setComments(visibleComments);

      const ids = [
        ...new Set(visibleComments.map((comment) => comment.user_id).filter(Boolean)),
      ];

      const profiles = await fetchProfilesByIds(ids);
      const map = {};
      profiles.forEach((profile) => {
        map[profile.id] = profile;
      });
      setCommentProfiles(map);

      let commentAttachmentMap = {};
      try {
        commentAttachmentMap = await fetchAttachmentsByTargets(
          "comment",
          visibleComments.map((comment) => comment.id)
        );
      } catch (error) {
        console.warn("Erreur chargement attachments commentaires :", error.message);
      }

      setCommentAttachmentsMap(commentAttachmentMap);
    } catch (error) {
      console.error("Erreur chargement commentaires :", error.message);
      setComments([]);
      setCommentProfiles({});
      setCommentAttachmentsMap({});
    }
  }

  async function handleToggleLike() {
    try {
      const result = await toggleLikeAction({
        postId: post.id,
        userId: user.id,
        hasLiked,
      });

      setHasLiked(result.liked);
      setLikes((prev) => (result.liked ? prev + 1 : Math.max(prev - 1, 0)));
    } catch (error) {
      console.error("Erreur like :", error.message);
    }
  }

  async function addComment(parentCommentId = null) {
    const text = parentCommentId !== null ? replyState.text : commentText;
    const externalGif =
      parentCommentId !== null ? replyState.externalGif : commentExternalGif;

    if (!text.trim() && !externalGif) return;

    if (!canCommentInForum(activeSanction)) {
      setErrorMessage(
        "Tu ne peux pas commenter sur le forum actuellement à cause d'une restriction."
      );
      return;
    }

    if (submitting) return;

    const currentScrollY = window.scrollY;
    const authorName = getUserDisplayName(user, commentProfiles[user.id]);

    setSubmitting(true);
    setErrorMessage("");

    try {
      await createComment({
        postId: post.id,
        userId: user.id,
        authorName,
        content: text.trim(),
        parentCommentId,
        externalGif,
      });

      if (parentCommentId !== null) {
        setReplyState(EMPTY_REPLY_STATE);
      } else {
        setCommentText("");
        setCommentExternalGif(null);
        setShowRootGifPicker(false);
      }

      await loadComments();

      requestAnimationFrame(() => {
        window.scrollTo({ top: currentScrollY });
      });
    } catch (error) {
      console.error("Erreur ajout commentaire :", error.message);
      setErrorMessage("Impossible d'ajouter le commentaire.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveCommentEdit(commentId) {
    const keepAttachmentIds =
      replyState.existingGif &&
      !replyState.existingGifRemoved &&
      !replyState.externalGif
        ? [replyState.existingGif.id]
        : [];

    const hasGif = keepAttachmentIds.length > 0 || Boolean(replyState.externalGif);

    if (!replyState.text.trim() && !hasGif) {
      setErrorMessage("Le commentaire ne peut pas être vide.");
      return;
    }

    if (submitting) return;

    const currentScrollY = window.scrollY;
    setSubmitting(true);
    setErrorMessage("");

    try {
      await updateCommentAction({
        commentId,
        userId: user.id,
        content: replyState.text.trim(),
      });

      await syncCommentAttachments({
        commentId,
        userId: user.id,
        previousAttachments: replyState.existingGif ? [replyState.existingGif] : [],
        keepAttachmentIds,
        externalGif: replyState.externalGif,
      });

      setReplyState(EMPTY_REPLY_STATE);
      await loadComments();

      requestAnimationFrame(() => {
        window.scrollTo({ top: currentScrollY });
      });
    } catch (error) {
      console.error("Erreur modification commentaire :", error.message);
      setErrorMessage("Impossible de modifier le commentaire.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeComment(comment) {
    const canDelete = comment.user_id === user.id;
    if (!canDelete) return;

    const currentScrollY = window.scrollY;

    try {
      await deleteCommentAction(comment.id);

      if (
        String(replyState.targetId) === String(comment.id) ||
        comment.replies?.some((r) => String(r.id) === String(replyState.targetId))
      ) {
        setReplyState(EMPTY_REPLY_STATE);
      }

      await loadComments();

      requestAnimationFrame(() => {
        window.scrollTo({ top: currentScrollY });
      });
    } catch (error) {
      console.error("Erreur suppression commentaire :", error.message);
      setErrorMessage("Impossible de supprimer le commentaire.");
    }
  }

  function handleOpenReport(targetType, targetId) {
    setReportTarget({ type: targetType, id: targetId });
  }

  async function handleSubmitReport(reason, details) {
    if (!reportTarget) return;

    try {
      await createForumReport({
        reporterId: user.id,
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason,
        details,
      });

      setReportTarget(null);
      setErrorMessage("");
    } catch (error) {
      console.error("Erreur signalement :", error.message);
      setErrorMessage("Impossible d'envoyer le signalement.");
    }
  }

  async function handleModeratePost(status) {
    const moderationReason = window.prompt("Motif de modération :") || "Modération forum";

    try {
      await moderateForumPost({
        postId: post.id,
        status,
        moderationReason,
      });

      await refreshPosts?.();
    } catch (error) {
      console.error("Erreur modération post :", error.message);
      setErrorMessage("Impossible de modérer cette publication.");
    }
  }

  async function handleBanAuthor(authorId) {
    if (isAuthorForumBlocked) return;

    const reason = window.prompt("Motif du bannissement forum :");
    if (!reason) return;

    const confirmBan = window.confirm(
      "Confirmer le bannissement forum de cet utilisateur ?"
    );
    if (!confirmBan) return;

    try {
      await createForumSanction({
        userId: authorId,
        type: "forum_banned",
        reason,
        issuedBy: user.id,
      });

      await refreshPosts?.();
      setErrorMessage("");
      window.alert("Utilisateur banni du forum.");
    } catch (error) {
      console.error("Erreur bannissement forum :", error.message);
      setErrorMessage("Impossible de bannir cet utilisateur du forum.");
    }
  }

  const authorName =
    [authorProfile?.prenom, authorProfile?.nom].filter(Boolean).join(" ") ||
    post.author_name ||
    "Utilisateur";

  const commentsTree = useMemo(() => groupCommentsByParent(comments), [comments]);
  const totalCommentsCount = comments.length;
  const isOwnPost = post.user_id === user.id;

  const isAuthorForumBlocked = ["forum_banned", "forum_suspended"].includes(
    authorSanction?.type
  );

  const authorBlockLabel =
    authorSanction?.type === "forum_banned"
      ? "Banni"
      : authorSanction?.type === "forum_suspended"
      ? "Suspendu"
      : null;

  const highlightedCommentId =
    focusTarget?.type === "comment" && String(focusTarget.postId) === String(post.id)
      ? focusTarget.id
      : null;

  return (
    <>
      <div ref={postRef} className="video-card forum-post-card">
        <div className="forum-post-header">
          <div>
            <div className="forum-post-author-name">{authorName}</div>
            <div className="forum-post-author-meta">
              {authorProfile?.role ? `${authorProfile.role} • ` : ""}
              {formatDate(post.created_at)}
              {post.edited_at ? " • modifié" : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {post.status !== "published" && (
              <span
                className={`forum-status-pill ${
                  post.status === "hidden" ? "hidden" : "reported"
                }`}
              >
                {post.status === "hidden" ? "Masqué" : post.status}
              </span>
            )}

            {authorBlockLabel && (
              <span className="forum-status-pill reported">{authorBlockLabel}</span>
            )}
          </div>
        </div>

        {post.content && <div className="forum-post-content">{post.content}</div>}

        {attachments.length > 0 && (
          <div className="forum-post-media">
            {attachments.map((attachment) => {
              const src =
                attachment.publicUrl ||
                attachment.external_url ||
                attachment.storage_path ||
                null;

              if (!src) return null;

              if (attachment.kind === "image" || attachment.kind === "gif") {
                return (
                  <div
                    key={attachment.id}
                    className="forum-media-item forum-media-item-visual"
                  >
                    <img
                      src={src}
                      alt={attachment.file_name || attachment.kind || "media"}
                      className={
                        attachment.kind === "gif"
                          ? "forum-media-gif"
                          : "forum-media-image"
                      }
                    />
                  </div>
                );
              }

              if (attachment.kind === "video") {
                return (
                  <div
                    key={attachment.id}
                    className="forum-media-item forum-media-item-video"
                  >
                    <video
                      src={src}
                      controls
                      className="forum-media-video"
                      preload="metadata"
                    />
                  </div>
                );
              }

              if (attachment.kind === "pdf") {
                return (
                  <a
                    key={attachment.id}
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="forum-media-item forum-media-item-file forum-media-pdf"
                  >
                    <span className="forum-media-pdf-title">
                      📄 {attachment.file_name || "Document PDF"}
                    </span>
                    <span className="forum-media-pdf-meta">
                      PDF
                      {attachment.size_bytes
                        ? ` • ${formatFileSize(attachment.size_bytes)}`
                        : ""}
                    </span>
                  </a>
                );
              }

              return null;
            })}
          </div>
        )}

        <div className="forum-post-actions">
          <button
            type="button"
            className="start-btn forum-action-btn"
            onClick={handleToggleLike}
          >
            {hasLiked ? "❤️ Like" : "🤍 Like"} ({likes})
          </button>

          <button
            type="button"
            className="start-btn forum-action-btn"
            onClick={() => setShowComments((prev) => !prev)}
          >
            {showComments
              ? `Masquer les commentaires (${totalCommentsCount})`
              : `💬 Commentaires (${totalCommentsCount})`}
          </button>

          {!isOwnPost && (
            <button
              type="button"
              className="start-btn forum-action-btn forum-report-btn"
              onClick={() => handleOpenReport("post", post.id)}
            >
              🚩 Signaler
            </button>
          )}

          {canManagePost && isOwnPost && (
            <button
              type="button"
              className="start-btn forum-admin-btn"
              onClick={onEditPost}
            >
              Modifier
            </button>
          )}

          {canManagePost && isOwnPost && (
            <button
              type="button"
              className="start-btn forum-admin-btn forum-admin-danger"
              onClick={onDeletePost}
            >
              Supprimer
            </button>
          )}

          {canModerateForum(role) && post.status === "published" && (
            <button
              type="button"
              className="start-btn forum-admin-btn"
              onClick={() => handleModeratePost("hidden")}
            >
              Masquer
            </button>
          )}

          {canModerateForum(role) && post.status === "hidden" && (
            <button
              type="button"
              className="start-btn forum-admin-btn"
              onClick={() => handleModeratePost("published")}
            >
              Restaurer
            </button>
          )}

          {canBanForumUsers(role) &&
            post.user_id !== user.id &&
            !isAuthorForumBlocked && (
              <button
                type="button"
                className="start-btn forum-admin-btn forum-admin-danger"
                onClick={() => handleBanAuthor(post.user_id)}
              >
                Bannir auteur
              </button>
            )}
        </div>

        {errorMessage && (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: "#E53E3E", margin: 0 }}>{errorMessage}</p>
          </div>
        )}

        {showComments && (
          <div className="forum-comments-section">
            <h6 className="forum-comments-title">Commentaires</h6>

            {commentsTree.length === 0 ? (
              <p style={{ margin: "0 0 12px 0" }}>Aucun commentaire pour le moment.</p>
            ) : (
              <div className="forum-comments-list">
                {commentsTree.map((comment) => (
                  <CommentNode
                    key={comment.id}
                    comment={comment}
                    user={user}
                    commentProfiles={commentProfiles}
                    commentAttachmentsMap={commentAttachmentsMap}
                    replyState={replyState}
                    setReplyState={setReplyState}
                    onReplySubmit={addComment}
                    onEditSubmit={saveCommentEdit}
                    onDelete={removeComment}
                    onOpenReport={handleOpenReport}
                    activeSanction={activeSanction}
                    submitting={submitting}
                    highlightedCommentId={highlightedCommentId}
                  />
                ))}
              </div>
            )}

            <div className="forum-comment-composer">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ajouter un commentaire..."
                rows={3}
                style={{ ...textareaStyle, minHeight: 110 }}
              />

              <div className="forum-comment-toolbar" style={pickerToolbarStyle}>
                <button
                  type="button"
                  className="forum-tool-btn"
                  onClick={() => setShowRootGifPicker((prev) => !prev)}
                >
                  GIF GIPHY
                </button>

                <button
                  type="button"
                  className="start-btn forum-action-btn"
                  onClick={() => addComment(null)}
                  disabled={
                    submitting ||
                    (!commentText.trim() && !commentExternalGif) ||
                    !canCommentInForum(activeSanction)
                  }
                >
                  {submitting ? "Envoi..." : "Envoyer"}
                </button>

                {(commentText.trim() || commentExternalGif) && (
                  <button
                    type="button"
                    className="start-btn forum-admin-btn"
                    onClick={() => {
                      setCommentText("");
                      setCommentExternalGif(null);
                      setShowRootGifPicker(false);
                    }}
                  >
                    Annuler
                  </button>
                )}

                <GiphyGifPicker
                  open={showRootGifPicker}
                  onClose={() => setShowRootGifPicker(false)}
                  onSelect={(gif) => {
                    setCommentExternalGif(gif);
                    setShowRootGifPicker(false);
                  }}
                  anchorLabel="GIF GIPHY"
                />
              </div>

              {commentExternalGif && (
                <GifPreview
                  item={commentExternalGif}
                  onRemove={() => setCommentExternalGif(null)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <ReportModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        onSubmit={handleSubmitReport}
      />
    </>
  );
}