import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearForumSanction,
  fetchActiveForumSanction,
  fetchAllActiveForumSanctions,
  fetchCommentById,
  fetchCurrentUserRole,
  fetchOpenForumReports,
  fetchProfilesByIds,
  reviewForumReport,
} from "./forumService";
import EmployeeDiscussion from "./EmployeeDiscussion";
import PrivateMessages from "./PrivateMessages";
import { canModerateForum, formatDate } from "./forumUtils";

function BlockedForumView({ sanction, onBackHome }) {
  const label =
    sanction?.type === "forum_banned"
      ? "Tu es banni du forum."
      : sanction?.type === "forum_suspended"
      ? "Ton accès au forum est temporairement suspendu."
      : "Tu n’as pas accès au forum pour le moment.";

  return (
    <div className="forum-page">
      <div className="video-card">
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Accès au forum restreint</h3>
        <p style={{ marginTop: 0, marginBottom: 10 }}>{label}</p>

        {sanction?.reason && (
          <p style={{ marginTop: 0, marginBottom: 10 }}>
            <strong>Motif :</strong> {sanction.reason}
          </p>
        )}

        {sanction?.end_at && (
          <p style={{ marginTop: 0, marginBottom: 14 }}>
            <strong>Fin prévue :</strong> {formatDate(sanction.end_at)}
          </p>
        )}

        <button
          type="button"
          className="forum-tool-btn"
          onClick={onBackHome}
        >
          Retour à l’accueil
        </button>
      </div>
    </div>
  );
}

function ModerationPanel({ user, onOpenTarget }) {
  const [reports, setReports] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingSanctions, setLoadingSanctions] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadReports() {
    setLoadingReports(true);

    try {
      const data = await fetchOpenForumReports();
      setReports(data);
    } catch (error) {
      console.error("Erreur chargement signalements :", error.message);
      setErrorMessage("Impossible de charger les signalements.");
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadSanctions() {
    setLoadingSanctions(true);

    try {
      const data = await fetchAllActiveForumSanctions();
      setSanctions(data);

      const userIds = [
        ...new Set(data.map((item) => item.user_id).filter(Boolean)),
      ];

      if (userIds.length > 0) {
        const profiles = await fetchProfilesByIds(userIds);
        const map = {};
        profiles.forEach((profile) => {
          map[profile.id] = profile;
        });
        setProfilesMap(map);
      } else {
        setProfilesMap({});
      }
    } catch (error) {
      console.error("Erreur chargement sanctions :", error.message);
      setErrorMessage("Impossible de charger les sanctions actives.");
    } finally {
      setLoadingSanctions(false);
    }
  }

  useEffect(() => {
    loadReports();
    loadSanctions();
  }, []);

  async function handleReview(reportId) {
    try {
      await reviewForumReport({
        reportId,
        reviewedBy: user.id,
        status: "reviewed",
      });

      await loadReports();
    } catch (error) {
      console.error("Erreur traitement signalement :", error.message);
      setErrorMessage("Impossible de mettre à jour le signalement.");
    }
  }

  async function handleClearSanction(sanctionId) {
    try {
      await clearForumSanction(sanctionId);
      await loadSanctions();
    } catch (error) {
      console.error("Erreur levée sanction :", error.message);
      setErrorMessage("Impossible de lever cette sanction.");
    }
  }

  function getSanctionTargetLabel(sanction) {
    const profile = profilesMap[sanction.user_id];
    const name =
      [profile?.prenom, profile?.nom].filter(Boolean).join(" ") || "Utilisateur";

    return `${name}${profile?.role ? ` (${profile.role})` : ""}`;
  }

  return (
    <div className="forum-moderation-panel">
      <div className="forum-moderation-card">
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Modération du forum</h4>
        <p style={{ marginTop: 0, marginBottom: 14 }}>
          Traite ici les signalements ouverts du forum.
        </p>

        {errorMessage && (
          <p style={{ color: "#E53E3E", margin: "0 0 12px 0" }}>
            {errorMessage}
          </p>
        )}

        {loadingReports ? (
          <p style={{ margin: 0 }}>Chargement...</p>
        ) : reports.length === 0 ? (
          <p style={{ margin: 0 }}>Aucun signalement ouvert.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reports.map((report) => (
              <div key={report.id} className="forum-moderation-card">
                <button
                  type="button"
                  onClick={() => onOpenTarget(report)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "block",
                    width: "100%",
                  }}
                >
                  <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                    {report.target_type === "post" ? "Post" : "Commentaire"} #
                    {report.target_id}
                  </p>

                  <p style={{ margin: "0 0 6px 0" }}>
                    <strong>Motif :</strong> {report.reason}
                  </p>

                  {report.details ? (
                    <p style={{ margin: "0 0 6px 0" }}>
                      <strong>Détail :</strong> {report.details}
                    </p>
                  ) : null}

                  <p style={{ margin: "0 0 10px 0", color: "#718096" }}>
                    Signalé le {formatDate(report.created_at)}
                  </p>
                </button>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="forum-tool-btn"
                    onClick={() => onOpenTarget(report)}
                  >
                    Ouvrir le contenu
                  </button>

                  <button
                    type="button"
                    className="forum-tool-btn"
                    onClick={() => handleReview(report.id)}
                  >
                    Marquer traité
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="forum-moderation-card">
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Sanctions actives</h4>
        <p style={{ marginTop: 0, marginBottom: 14 }}>
          Tu peux lever un bannissement ou une sanction active depuis cette section.
        </p>

        {loadingSanctions ? (
          <p style={{ margin: 0 }}>Chargement...</p>
        ) : sanctions.length === 0 ? (
          <p style={{ margin: 0 }}>Aucune sanction active.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sanctions.map((sanction) => {
              const isBan =
                sanction.type === "forum_banned" ||
                sanction.type === "forum_suspended";

              return (
                <div key={sanction.id} className="forum-moderation-card">
                  <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
                    {getSanctionTargetLabel(sanction)}
                  </p>

                  <p style={{ margin: "0 0 6px 0" }}>
                    <strong>Type :</strong> {sanction.type}
                  </p>

                  <p style={{ margin: "0 0 6px 0" }}>
                    <strong>Motif :</strong> {sanction.reason}
                  </p>

                  {sanction.end_at ? (
                    <p style={{ margin: "0 0 10px 0", color: "#718096" }}>
                      Fin prévue : {formatDate(sanction.end_at)}
                    </p>
                  ) : (
                    <p style={{ margin: "0 0 10px 0", color: "#718096" }}>
                      Sans date de fin
                    </p>
                  )}

                  <button
                    type="button"
                    className="forum-tool-btn"
                    onClick={() => handleClearSanction(sanction.id)}
                  >
                    {isBan ? "Lever le bannissement" : "Lever la sanction"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ForumHome({ user, embedded = false }) {
  const [tab, setTab] = useState("feed");
  const [role, setRole] = useState(null);
  const [activeSanction, setActiveSanction] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [loadingSanction, setLoadingSanction] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) {
      setLoadingRole(false);
      setLoadingSanction(false);
      return;
    }

    async function loadRoleAndSanction() {
      setLoadingRole(true);
      setLoadingSanction(true);

      try {
        const [currentRole, sanction] = await Promise.all([
          fetchCurrentUserRole(user.id),
          fetchActiveForumSanction(user.id),
        ]);

        setRole(currentRole);
        setActiveSanction(sanction);
      } catch (error) {
        console.error("Erreur chargement forum :", error.message);
        setRole(null);
        setActiveSanction(null);
      } finally {
        setLoadingRole(false);
        setLoadingSanction(false);
      }
    }

    loadRoleAndSanction();
  }, [user?.id]);

  const isForumBlocked = useMemo(() => {
    return ["forum_banned", "forum_suspended"].includes(activeSanction?.type);
  }, [activeSanction]);

  async function handleOpenReportedTarget(report) {
    try {
      if (report.target_type === "post") {
        setFocusTarget({
          type: "post",
          id: String(report.target_id),
        });
      } else {
        const comment = await fetchCommentById(report.target_id);

        if (!comment?.post_id) {
          window.alert("Le commentaire ciblé n’existe plus.");
          return;
        }

        setFocusTarget({
          type: "comment",
          id: String(report.target_id),
          postId: String(comment.post_id),
        });
      }

      setTab("feed");
    } catch (error) {
      console.error("Erreur ouverture contenu signalé :", error.message);
      window.alert("Impossible d’ouvrir le contenu signalé.");
    }
  }

  if (loadingRole || loadingSanction) {
    return (
      <div className="forum-page">
        <div className="video-card">
          <p style={{ margin: 0 }}>Chargement du forum...</p>
        </div>
      </div>
    );
  }

  if (isForumBlocked) {
    return (
      <BlockedForumView
        sanction={activeSanction}
        onBackHome={() => navigate("/dashboard")}
      />
    );
  }

  return (
    <div className="forum-page">
      {!embedded && (
        <div className="video-card">
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Forum interne</h3>
          <p style={{ marginTop: 0, marginBottom: 14 }}>
            Publications, échanges et messagerie interne.
          </p>

          <button
            type="button"
            className="forum-tool-btn"
            onClick={() => navigate("/dashboard")}
          >
            Retour à l’accueil
          </button>
        </div>
      )}

      <div className="forum-tabs">
        <button
          type="button"
          className={`forum-tab-btn ${tab === "feed" ? "active" : ""}`}
          onClick={() => setTab("feed")}
        >
          Fil d’actualité
        </button>

        <button
          type="button"
          className={`forum-tab-btn ${tab === "messages" ? "active" : ""}`}
          onClick={() => setTab("messages")}
        >
          Messagerie privée
        </button>

        {canModerateForum(role) && (
          <button
            type="button"
            className={`forum-tab-btn ${tab === "moderation" ? "active" : ""}`}
            onClick={() => setTab("moderation")}
          >
            Modération
          </button>
        )}
      </div>

      {tab === "feed" && (
        <EmployeeDiscussion
          mode="feed"
          user={user}
          role={role}
          focusTarget={focusTarget}
          onFocusHandled={() => setFocusTarget(null)}
        />
      )}

      {tab === "messages" && <PrivateMessages user={user} />}

      {tab === "moderation" && canModerateForum(role) && (
        <ModerationPanel
          user={user}
          onOpenTarget={handleOpenReportedTarget}
        />
      )}
    </div>
  );
}