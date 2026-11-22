import { useEffect, useMemo, useState } from "react";
import {
  createPost,
  deletePost as deletePostAction,
  fetchActiveForumSanction,
  fetchActiveForumSanctionsByUserIds,
  fetchAttachmentsByTargets,
  fetchPostsByMode,
  fetchProfilesByIds,
  syncPostAttachments,
  updatePost as updatePostAction,
} from "./forumService";
import Post from "./Post";
import GiphyGifPicker from "./GiphyGifPicker";
import {
  canModerateForum,
  canPostInForum,
  formatFileSize,
  getAttachmentKind,
  getUserDisplayName,
  isAllowedPostAttachment,
  isAttachmentSizeAllowed,
  normalizeRole,
} from "./forumUtils";

const textareaStyle = {
  width: "100%",
  minHeight: 130,
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

function ExistingAttachmentPreview({ attachment, onRemove }) {
  const src =
    attachment?.publicUrl ||
    attachment?.external_url ||
    attachment?.storage_path ||
    "";

  if (!src) return null;

  if (attachment.kind === "image" || attachment.kind === "gif") {
    return (
      <div className="forum-media-item forum-media-item-visual">
        <img
          src={src}
          alt={attachment.file_name || attachment.kind || "media"}
          className={
            attachment.kind === "gif" ? "forum-media-gif" : "forum-media-image"
          }
        />
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="forum-tool-btn"
            onClick={onRemove}
          >
            Retirer
          </button>
        </div>
      </div>
    );
  }

  if (attachment.kind === "video") {
    return (
      <div className="forum-media-item forum-media-item-video">
        <video
          src={src}
          controls
          className="forum-media-video"
          preload="metadata"
        />
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="forum-tool-btn"
            onClick={onRemove}
          >
            Retirer
          </button>
        </div>
      </div>
    );
  }

  if (attachment.kind === "pdf") {
    return (
      <div className="forum-media-item forum-media-item-file">
        <div className="forum-media-pdf">
          <span className="forum-media-pdf-title">
            📄 {attachment.file_name || "Document PDF"}
          </span>
          <span className="forum-media-pdf-meta">
            PDF
            {attachment.size_bytes
              ? ` • ${formatFileSize(attachment.size_bytes)}`
              : ""}
          </span>
        </div>
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="forum-tool-btn"
            onClick={onRemove}
          >
            Retirer
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function EmployeeDiscussion({
  mode,
  user,
  role,
  focusTarget = null,
  onFocusHandled,
}) {
  const [posts, setPosts] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [attachmentsMap, setAttachmentsMap] = useState({});
  const [authorSanctionsMap, setAuthorSanctionsMap] = useState({});

  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [editingPostId, setEditingPostId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [editingOriginalAttachments, setEditingOriginalAttachments] = useState(
    []
  );
  const [editingCurrentAttachments, setEditingCurrentAttachments] = useState([]);
  const [editingFiles, setEditingFiles] = useState([]);
  const [editingSelectedGif, setEditingSelectedGif] = useState(null);
  const [showEditGifPicker, setShowEditGifPicker] = useState(false);

  const [activeSanction, setActiveSanction] = useState(null);

  const normalizedRole = useMemo(() => normalizeRole(role), [role]);
  const isModerator = useMemo(
    () => canModerateForum(normalizedRole),
    [normalizedRole]
  );

  useEffect(() => {
    loadPosts();
  }, [mode, isModerator]);

  useEffect(() => {
    if (!user?.id) return;
    loadSanction();
  }, [user?.id]);

  async function loadSanction() {
    try {
      const sanction = await fetchActiveForumSanction(user.id);
      setActiveSanction(sanction);
    } catch (error) {
      console.error("Erreur chargement sanction forum :", error.message);
      setActiveSanction(null);
    }
  }

  async function loadPosts() {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchPostsByMode(mode);
      const visiblePosts = isModerator
        ? data
        : data.filter((post) => post.status === "published");

      setPosts(visiblePosts);

      const userIds = [
        ...new Set(visiblePosts.map((post) => post.user_id).filter(Boolean)),
      ];

      const profiles = await fetchProfilesByIds(userIds);
      const profilesById = {};
      profiles.forEach((profile) => {
        profilesById[profile.id] = profile;
      });
      setProfilesMap(profilesById);

      let attachmentMap = {};
      try {
        attachmentMap = await fetchAttachmentsByTargets(
          "post",
          visiblePosts.map((post) => post.id)
        );
      } catch (error) {
        console.warn("Erreur chargement attachments forum :", error.message);
      }
      setAttachmentsMap(attachmentMap);

      let sanctionsMap = {};
      try {
        sanctionsMap = await fetchActiveForumSanctionsByUserIds(userIds);
      } catch (error) {
        console.warn("Erreur chargement sanctions auteurs :", error.message);
      }
      setAuthorSanctionsMap(sanctionsMap);
    } catch (error) {
      console.error("Erreur chargement posts :", error.message);
      setErrorMessage("Impossible de charger les publications.");
      setPosts([]);
      setProfilesMap({});
      setAttachmentsMap({});
      setAuthorSanctionsMap({});
    } finally {
      setLoading(false);
    }
  }

  function handleFilesChange(event) {
    const selected = Array.from(event.target.files ?? []);
    const next = [];

    if (selected.length > 4) {
      setErrorMessage("Tu peux ajouter au maximum 4 fichiers par publication.");
      event.target.value = "";
      return;
    }

    for (const file of selected) {
      if (!isAllowedPostAttachment(file.type)) {
        setErrorMessage(`Type non autorisé : ${file.name}`);
        event.target.value = "";
        return;
      }

      if (!isAttachmentSizeAllowed(file)) {
        setErrorMessage(`Fichier trop volumineux : ${file.name}`);
        event.target.value = "";
        return;
      }

      next.push(file);
    }

    setErrorMessage("");
    setFiles(next);
    event.target.value = "";
  }

  function handleEditFilesChange(event) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;

    const next = [...editingFiles];

    for (const file of selected) {
      if (!isAllowedPostAttachment(file.type)) {
        setErrorMessage(`Type non autorisé : ${file.name}`);
        event.target.value = "";
        return;
      }

      if (!isAttachmentSizeAllowed(file)) {
        setErrorMessage(`Fichier trop volumineux : ${file.name}`);
        event.target.value = "";
        return;
      }

      next.push(file);
    }

    if (next.length > 4) {
      setErrorMessage(
        "Tu peux ajouter au maximum 4 nouveaux fichiers pendant l’édition."
      );
      event.target.value = "";
      return;
    }

    setErrorMessage("");
    setEditingFiles(next);
    event.target.value = "";
  }

  async function addPost() {
    if ((!text.trim() && files.length === 0 && !selectedGif) || submitting) {
      return;
    }

    if (!canPostInForum(activeSanction)) {
      setErrorMessage(
        "Tu ne peux pas publier sur le forum actuellement à cause d’une restriction."
      );
      return;
    }

    const currentScrollY = window.scrollY;
    setSubmitting(true);
    setErrorMessage("");

    try {
      const authorProfile = profilesMap[user.id] ?? null;
      const authorName = getUserDisplayName(user, authorProfile);

      await createPost({
        userId: user.id,
        authorName,
        content: text.trim(),
        mode,
        attachments: files,
        externalGif: selectedGif,
      });

      setText("");
      setFiles([]);
      setSelectedGif(null);
      setShowGifPicker(false);

      await loadPosts();

      requestAnimationFrame(() => {
        window.scrollTo({ top: currentScrollY });
      });
    } catch (error) {
      console.error("Erreur ajout post :", error.message);
      setErrorMessage(
        "La publication a échoué. Vérifie les policies Supabase / Storage / RLS."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startEditPost(post) {
    if (post.user_id !== user.id) return;

    const currentAttachments = attachmentsMap[String(post.id)] ?? [];

    setEditingPostId(post.id);
    setEditingText(post.content ?? "");
    setEditingOriginalAttachments(currentAttachments);
    setEditingCurrentAttachments(currentAttachments);
    setEditingFiles([]);
    setEditingSelectedGif(null);
    setShowEditGifPicker(false);
    setErrorMessage("");
  }

  function cancelEditPost() {
    setEditingPostId(null);
    setEditingText("");
    setEditingOriginalAttachments([]);
    setEditingCurrentAttachments([]);
    setEditingFiles([]);
    setEditingSelectedGif(null);
    setShowEditGifPicker(false);
  }

  async function saveEditPost(postId) {
    const keepAttachmentIds = editingCurrentAttachments.map((item) => item.id);
    const hasMedia =
      keepAttachmentIds.length > 0 ||
      editingFiles.length > 0 ||
      Boolean(editingSelectedGif);

    if (!editingText.trim() && !hasMedia) {
      setErrorMessage("Le post ne peut pas être vide.");
      return;
    }

    const currentScrollY = window.scrollY;
    setSubmitting(true);
    setErrorMessage("");

    try {
      await updatePostAction({
        postId,
        userId: user.id,
        content: editingText.trim(),
      });

      await syncPostAttachments({
        postId,
        userId: user.id,
        previousAttachments: editingOriginalAttachments,
        keepAttachmentIds,
        newFiles: editingFiles,
        externalGif: editingSelectedGif,
      });

      cancelEditPost();
      await loadPosts();

      requestAnimationFrame(() => {
        window.scrollTo({ top: currentScrollY });
      });
    } catch (error) {
      console.error("Erreur modification post :", error.message);
      setErrorMessage("Impossible de modifier la publication.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removePost(post) {
    const canDelete = post.user_id === user.id;
    if (!canDelete) return;

    const currentScrollY = window.scrollY;

    try {
      await deletePostAction(post.id);
      await loadPosts();

      requestAnimationFrame(() => {
        window.scrollTo({ top: currentScrollY });
      });
    } catch (error) {
      console.error("Erreur suppression post :", error.message);
      setErrorMessage("Impossible de supprimer la publication.");
    }
  }

  const sectionTitle = "Fil d’actualité interne";

  return (
    <div className="forum-feed">
      <div className="forum-composer video-card">
        <div className="forum-composer-header">
          <h3>{sectionTitle}</h3>
          <p>
            Publie un message, un GIF, une image, une vidéo ou un PDF selon les
            règles du forum.
          </p>
        </div>

        {activeSanction && !canPostInForum(activeSanction) && (
          <div
            className="forum-status-pill reported"
            style={{ width: "fit-content" }}
          >
            Restriction active : {activeSanction.type}
          </div>
        )}

        <div style={{ width: "100%" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écris ton message..."
            rows={5}
            style={textareaStyle}
          />
        </div>

        <div
          className="forum-composer-toolbar"
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            position: "relative",
          }}
        >
          <label className="forum-tool-btn" htmlFor={`forum-post-files-${mode}`}>
            📎 Ajouter des fichiers
          </label>

          <input
            id={`forum-post-files-${mode}`}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf"
            onChange={handleFilesChange}
            style={{ display: "none" }}
          />

          <button
            type="button"
            className="forum-tool-btn"
            onClick={() => setShowGifPicker((prev) => !prev)}
          >
            GIF
          </button>

          <span className="forum-attachment-meta">
            Max 4 fichiers : image, GIF, vidéo MP4/WebM, PDF
          </span>

          <GiphyGifPicker
            open={showGifPicker}
            onClose={() => setShowGifPicker(false)}
            onSelect={(gif) => {
              setSelectedGif(gif);
              setShowGifPicker(false);
              setErrorMessage("");
            }}
            anchorLabel="GIF GIPHY"
          />
        </div>

        {selectedGif && (
          <div
            style={{
              marginTop: 12,
              background: "rgba(15,23,42,0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: 10,
              display: "inline-flex",
              flexDirection: "column",
              gap: 8,
              maxWidth: 260,
            }}
          >
            <img
              src={selectedGif.previewUrl || selectedGif.gifUrl}
              alt={selectedGif.title || "GIF"}
              style={{
                width: "100%",
                maxWidth: 240,
                maxHeight: 180,
                objectFit: "cover",
                borderRadius: 10,
              }}
            />

            <button
              type="button"
              className="forum-tool-btn"
              onClick={() => setSelectedGif(null)}
              style={{ width: "fit-content" }}
            >
              Retirer le GIF
            </button>
          </div>
        )}

        {files.length > 0 && (
          <div className="forum-attachments-preview">
            {files.map((file, index) => {
              const kind = getAttachmentKind(file.type);

              return (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="forum-attachment-chip"
                >
                  <span className="forum-attachment-name">{file.name}</span>
                  <span className="forum-attachment-meta">
                    {kind?.toUpperCase()} • {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    className="forum-tool-btn"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, i) => i !== index))
                    }
                    style={{ width: "fit-content", marginTop: 4 }}
                  >
                    Retirer
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="forum-composer-actions">
          <button
            type="button"
            className="start-btn forum-publish-btn"
            onClick={addPost}
            disabled={submitting}
          >
            {submitting ? "Publication..." : "Publier"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="video-card">
          <p style={{ color: "#E53E3E", margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="video-card">
          <p style={{ margin: 0 }}>Chargement...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="video-card">
          <p style={{ margin: 0 }}>Aucune publication pour le moment.</p>
        </div>
      ) : (
        <div className="video-grid" style={{ gridTemplateColumns: "1fr" }}>
          {posts.map((post) => {
            const authorProfile = profilesMap[post.user_id] ?? null;
            const canManage = post.user_id === user.id;

            if (editingPostId === post.id) {
              return (
                <div key={post.id} className="video-card forum-post-card">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={4}
                    style={{
                      ...textareaStyle,
                      minHeight: 120,
                      marginBottom: 16,
                    }}
                  />

                  {(editingCurrentAttachments.length > 0 ||
                    editingFiles.length > 0 ||
                    editingSelectedGif) && (
                    <div style={{ marginBottom: 16 }}>
                      {editingCurrentAttachments.length > 0 && (
                        <div
                          className="forum-post-media"
                          style={{ marginBottom: 12 }}
                        >
                          {editingCurrentAttachments.map((attachment) => (
                            <ExistingAttachmentPreview
                              key={attachment.id}
                              attachment={attachment}
                              onRemove={() =>
                                setEditingCurrentAttachments((prev) =>
                                  prev.filter((item) => item.id !== attachment.id)
                                )
                              }
                            />
                          ))}
                        </div>
                      )}

                      {editingFiles.length > 0 && (
                        <div
                          className="forum-attachments-preview"
                          style={{ marginBottom: 12 }}
                        >
                          {editingFiles.map((file, index) => {
                            const kind = getAttachmentKind(file.type);
                            return (
                              <div
                                key={`${file.name}-${file.size}-${index}`}
                                className="forum-attachment-chip"
                              >
                                <span className="forum-attachment-name">
                                  {file.name}
                                </span>
                                <span className="forum-attachment-meta">
                                  {kind?.toUpperCase()} •{" "}
                                  {formatFileSize(file.size)}
                                </span>
                                <button
                                  type="button"
                                  className="forum-tool-btn"
                                  onClick={() =>
                                    setEditingFiles((prev) =>
                                      prev.filter((_, i) => i !== index)
                                    )
                                  }
                                  style={{ width: "fit-content", marginTop: 4 }}
                                >
                                  Retirer
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {editingSelectedGif && (
                        <div
                          style={{
                            background: "rgba(15,23,42,0.5)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 14,
                            padding: 10,
                            display: "inline-flex",
                            flexDirection: "column",
                            gap: 8,
                            maxWidth: 260,
                          }}
                        >
                          <img
                            src={
                              editingSelectedGif.previewUrl ||
                              editingSelectedGif.gifUrl
                            }
                            alt={editingSelectedGif.title || "GIF"}
                            style={{
                              width: "100%",
                              maxWidth: 240,
                              maxHeight: 180,
                              objectFit: "cover",
                              borderRadius: 10,
                            }}
                          />

                          <button
                            type="button"
                            className="forum-tool-btn"
                            onClick={() => setEditingSelectedGif(null)}
                            style={{ width: "fit-content" }}
                          >
                            Retirer le GIF
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className="forum-composer-toolbar"
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                      position: "relative",
                      marginBottom: 16,
                    }}
                  >
                    <label
                      className="forum-tool-btn"
                      htmlFor={`forum-edit-post-files-${post.id}`}
                    >
                      📎 Ajouter des fichiers
                    </label>

                    <input
                      id={`forum-edit-post-files-${post.id}`}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf"
                      onChange={handleEditFilesChange}
                      style={{ display: "none" }}
                    />

                    <button
                      type="button"
                      className="forum-tool-btn"
                      onClick={() => setShowEditGifPicker((prev) => !prev)}
                    >
                      GIF
                    </button>

                    <span className="forum-attachment-meta">
                      Tu peux retirer, garder ou ajouter des médias avant
                      d’enregistrer.
                    </span>

                    <GiphyGifPicker
                      open={showEditGifPicker}
                      onClose={() => setShowEditGifPicker(false)}
                      onSelect={(gif) => {
                        setEditingSelectedGif(gif);
                        setShowEditGifPicker(false);
                        setErrorMessage("");
                      }}
                      anchorLabel="GIF GIPHY"
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="start-btn forum-admin-btn"
                      onClick={() => saveEditPost(post.id)}
                      disabled={submitting}
                    >
                      {submitting ? "Enregistrement..." : "Enregistrer"}
                    </button>

                    <button
                      type="button"
                      className="start-btn forum-admin-btn"
                      onClick={cancelEditPost}
                      disabled={submitting}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <Post
                key={post.id}
                post={post}
                user={user}
                role={normalizedRole}
                authorProfile={authorProfile}
                authorSanction={authorSanctionsMap[post.user_id] ?? null}
                attachments={attachmentsMap[String(post.id)] ?? []}
                refreshPosts={loadPosts}
                onEditPost={() => startEditPost(post)}
                onDeletePost={() => removePost(post)}
                canManagePost={canManage}
                focusTarget={focusTarget}
                onFocusHandled={onFocusHandled}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}