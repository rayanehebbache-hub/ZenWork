import React, { useState, useEffect, useCallback, cloneElement } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Profile from "../Profile/Profile.jsx";
import EmployeesList from "../Employees/EmployeesList.jsx";
import RhSecuredRoute from "../RhSecuredRoute.jsx";
import Loading from "../Loading/Loading.jsx";
import ForumHome from "../Forum/ForumHome.jsx";
import DashboardOverview from "../Dashboard/DashboardOverview.jsx";
import FeedbackPanel from "../Dashboard/FeedbackPanel.jsx";
import "./Layout.css";
import PsychoBot from "../Psychobot/Psychobot.jsx";
import Questionnaire from "../Questionnaire/Questionnaire.jsx";
import NoQuestionnaire from "../Questionnaire/NoQuestionnaire.jsx";
import StartQuestionnaire from "../Questionnaire/StartQuestionnaire.jsx";

const TAB_PSYCHOBOT = "psychobot";
const TAB_DASHBOARD = "dashboard";
const TAB_RESSOURCE = "ressource";
const TAB_EMPLOYEES = "employees";
const TAB_PARAMETRES = "parametres";
const TAB_FORUM = "forum";
const TAB_FEEDBACK = "feedback";
const TAB_QUESTIONNAIRE = "questionnaire";

function PopupProfil({ user, profile, onFermer, onOuvrirParametres }) {
  const navigate = useNavigate();

  const deconnecter = async () => {
    await supabase.auth.signOut();
    onFermer();
    navigate("/");
  };

  const ouvrirParametres = () => {
    onFermer();
    onOuvrirParametres();
    navigate("/profile");
  };

  return (
    <div className="profile-popup-overlay" onClick={onFermer}>
      <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
        <div className="profile-popup-header">
          <div className="profile-popup-avatar" />
          <div className="profile-popup-info">
            <span className="profile-popup-name">
              {profile?.prenom || profile?.nom
                ? [profile.prenom, profile.nom].filter(Boolean).join(" ")
                : "Utilisateur"}
            </span>
            <span className="profile-popup-email">{user?.email ?? ""}</span>
            {profile?.role && (
              <span className="profile-popup-role">{profile.role}</span>
            )}
          </div>
        </div>
        <div className="profile-popup-actions">
          <button
            type="button"
            className="profile-popup-btn"
            onClick={ouvrirParametres}
          >
            <img
              src="/parametre.png"
              alt=""
              className="profile-popup-btn-icon"
            />
            Paramètres
          </button>
          <button
            type="button"
            className="profile-popup-btn profile-popup-btn-logout"
            onClick={deconnecter}
          >
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}

function formaterDateNotification(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function resolveEmployeeName(profiles) {
  if (!profiles) return null;
  return [profiles.prenom, profiles.nom].filter(Boolean).join(" ") || "Employé";
}

function PopupNotifications({ user, onFermer, onMarkedRead }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [alerteByMinute, setAlerteByMinute] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      if (!user?.id) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) {
        setFetchError(error.message);
        setItems([]);
        setLoading(false);
        return;
      }

      const notifications = data ?? [];
      setItems(notifications);

      const hasBurnoutAlerts = notifications.some(
        (n) => n.type?.toLowerCase() === "alerte_burnout"
      );
      if (hasBurnoutAlerts) {
        const { data: alertes, error: alerteError } = await supabase
          .from("alerte_burnout")
          .select("id, created_at, profiles!utilisateur_id(nom, prenom)")
          .order("created_at", { ascending: false })
          .limit(200);
        if (alerteError) {
          console.warn("[Notifications] alerte_burnout join failed:", alerteError.message);
        }
        if (!cancelled && alertes) {
          const map = {};
          alertes.forEach((a) => {
            const key = String(a.created_at ?? "").slice(0, 16);
            if (!map[key]) map[key] = resolveEmployeeName(a.profiles);
          });
          setAlerteByMinute(map);
        }
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-popup-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new;
          if (!newNotif) return;
          setItems((prev) => {
            if (!prev) return [newNotif];
            if (prev.some((x) => x.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new;
          if (!updated) return;
          setItems((prev) =>
            prev
              ? prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
              : prev,
          );
          onMarkedRead?.();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, onMarkedRead]);

  const marquerUneLue = async (n) => {
    if (!user?.id || n.is_read || markingAll) return;
    if (markingId === n.id) return;
    setMarkingId(n.id);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", n.id)
      .eq("user_id", user.id);
    setMarkingId(null);

    if (error) return;
    setItems((prev) =>
      prev
        ? prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
        : prev,
    );
    onMarkedRead?.();
  };

  const marquerToutLu = async () => {
    if (!user?.id || markingAll || markingId) return;
    const hasUnread = items?.some((x) => !x.is_read);
    if (!hasUnread) return;
    setMarkingAll(true);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setMarkingAll(false);
    if (error) return;
    setItems((prev) =>
      prev ? prev.map((x) => ({ ...x, is_read: true })) : prev,
    );
    onMarkedRead?.();
  };

  const aDesNonLues = items?.some((x) => !x.is_read);

  return (
    <div className="notification-popup-overlay" onClick={onFermer}>
      <div
        className="notification-popup"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Notifications"
      >
        <div className="notification-popup-header">
          <h2 className="notification-popup-title">Notifications</h2>
          <div className="notification-popup-header-actions">
            {!loading && !fetchError && aDesNonLues ? (
              <button
                type="button"
                className="notification-mark-all-read-btn"
                onClick={() => void marquerToutLu()}
                disabled={markingAll || markingId !== null}
              >
                {markingAll ? "…" : "Tout marquer comme lu"}
              </button>
            ) : null}
            <button
              type="button"
              className="notification-popup-close"
              onClick={onFermer}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </div>
        <div className="notification-popup-body">
          {loading && <p className="notification-popup-status">Chargement…</p>}
          {!loading && fetchError && (
            <p className="notification-popup-status notification-popup-error">
              {fetchError}
            </p>
          )}
          {!loading && !fetchError && items?.length === 0 && (
            <p className="notification-popup-status">Aucune notification.</p>
          )}
          {!loading && !fetchError && items && items.length > 0 && (
            <ul className="notification-list">
              {items.map((n) => {
                const minuteKey = String(n.created_at ?? "").slice(0, 16);
                const triggeredBy =
                  n.type?.toLowerCase() === "alerte_burnout"
                    ? alerteByMinute[minuteKey]
                    : null;
                return (
                  <li key={n.id} className="notification-item-wrap">
                    <button
                      type="button"
                      className={`notification-item${n.is_read ? "" : " notification-item-unread notification-item-clickable"}`}
                      onClick={() => void marquerUneLue(n)}
                      disabled={markingAll || markingId === n.id}
                      aria-label={
                        n.is_read
                          ? "Notification lue"
                          : "Marquer cette notification comme lue"
                      }
                    >
                      <div className="notification-item-top">
                        <span className="notification-type">{n.type}</span>
                        <span className="notification-date">
                          {formaterDateNotification(n.created_at)}
                        </span>
                      </div>
                      {triggeredBy && (
                        <div className="notification-triggered-by">
                          👤 Déclenché par : <strong>{triggeredBy}</strong>
                        </div>
                      )}
                      {n.title && (
                        <div className="notification-title">{n.title}</div>
                      )}
                      {n.body && (
                        <div className="notification-body">{n.body}</div>
                      )}
                      <div className="notification-seen">
                        {markingId === n.id ? "…" : n.is_read ? "Lu" : "Non lu"}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ user, children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(TAB_DASHBOARD);
  const [popupOpen, setPopupOpen] = useState(false);
  const [questionnaireId, setQuestionnaireId] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [newForumCount, setNewForumCount] = useState(0);

  const resetForumCount = useCallback(() => {
    setNewForumCount(0);
    if (user?.id) {
      localStorage.setItem(`forum_last_visit_${user.id}`, new Date().toISOString());
    }
  }, [user?.id]);

  const rafraichirCompteurNonLues = useCallback(async () => {
    if (!user?.id) {
      setUnreadNotifCount(0);
      return;
    }
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) setUnreadNotifCount(0);
    else setUnreadNotifCount(count ?? 0);
  }, [user?.id]);

  useEffect(() => {
    rafraichirCompteurNonLues();
  }, [notificationsOpen, rafraichirCompteurNonLues]);

  useEffect(() => {
  if (pathname.includes("/employees")) {
    setTab(TAB_EMPLOYEES);
  } else if (pathname.includes("/profile")) {
    setTab(TAB_PARAMETRES);
  } else if (pathname.includes("/forum")) {
    setTab(TAB_FORUM);
    resetForumCount();
  } else if (pathname.includes("/feedback")) {
    setTab(TAB_FEEDBACK);
  } else if (pathname.includes("/ressource")) {
    setTab(TAB_RESSOURCE);
  } else if (pathname.includes("/psychobot")) {
    setTab(TAB_PSYCHOBOT);
  } else if (pathname.includes("/dashboard")) {
    setTab(TAB_DASHBOARD);
  } else if (pathname.includes("/questionnaire")) {
    setTab(TAB_QUESTIONNAIRE);
  } else if (pathname.includes("/start_questionnaire")) {
    setTab(TAB_QUESTIONNAIRE);
  } else {
    setTab(TAB_DASHBOARD);
  }
}, [pathname, resetForumCount]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let active = true;

    const fetchProfile = async ({ silent } = {}) => {
      const { data } = await supabase
        .from("profiles")
        .select("nom, prenom, role")
        .eq("id", user.id)
        .single();
      if (!active) return;
      setProfile(data || null);
      if (!silent) setLoading(false);
    };

    fetchProfile();

    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => fetchProfile({ silent: true }),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-badge-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!payload.new?.is_read) {
            setUnreadNotifCount((prev) => prev + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          rafraichirCompteurNonLues();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, rafraichirCompteurNonLues]);

  useEffect(() => {
    if (!user?.id) return;

    const lastVisitRaw = localStorage.getItem(`forum_last_visit_${user.id}`);
    if (!lastVisitRaw) {
      localStorage.setItem(`forum_last_visit_${user.id}`, new Date().toISOString());
      return;
    }

    let cancelled = false;
    (async () => {
      const [postsResult, msgsResult] = await Promise.all([
        supabase
          .from("forum_posts")
          .select("*", { count: "exact", head: true })
          .neq("user_id", user.id)
          .gt("created_at", lastVisitRaw),
        supabase
          .from("forum_private_messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .gt("created_at", lastVisitRaw),
      ]);
      if (!cancelled) {
        setNewForumCount((postsResult.count ?? 0) + (msgsResult.count ?? 0));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`forum-badge-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "forum_posts",
        },
        (payload) => {
          if (payload.new?.user_id === user.id) return;
          setNewForumCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "forum_private_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          setNewForumCount((prev) => prev + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    async function fetchLastQuestionnaire() {
      setFetchLoading(true);
      const { data, error } = await supabase
        .from("questionnaire")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) {
        console.error(
          "Erreur récupération dernier questionnaire :",
          error.message,
        );
      }
      if (data) {
        setQuestionnaireId(data.id);
      }
      setFetchLoading(false);
    }
    fetchLastQuestionnaire();
  }, []);

  const greetingName = profile?.prenom || profile?.nom || "Utilisateur";
  const isRH = profile?.role === "RH";
  const isEmployee = !isRH;

  const avatarInitials =
    [profile?.prenom?.[0], profile?.nom?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "U";

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img
            src="/zenwork-dessin.png"
            alt="Logo"
            className="sidebar-logo-img"
          />
          <span className="sidebar-logo-text">ZenWork</span>
        </div>

        <nav className="menu">
          <button
            type="button"
            className={`menu-item ${tab === TAB_DASHBOARD ? "active" : ""}`}
            onClick={() => {
              setTab(TAB_DASHBOARD);
              navigate("/dashboard");
            }}
          >
            <img
              src="/tableau-de-bord.png"
              alt="Dashboard"
              className="sidebar-icon-img"
            />
            <span className="label">Dashboard</span>
          </button>

          <button
            type="button"
            className={`menu-item ${tab === TAB_FORUM ? "active" : ""}`}
            style={{ position: "relative" }}
            onClick={() => {
              setTab(TAB_FORUM);
              navigate("/forum");
              resetForumCount();
            }}
            aria-label={
              newForumCount > 0
                ? `Forum, ${newForumCount} nouveau${newForumCount > 1 ? "x" : ""}`
                : "Forum"
            }
          >
            <img
              src="/forum.png"
              alt="Forum"
              className="sidebar-icon-img"
            />
            {newForumCount > 0 && (
              <span className="menu-item-badge" aria-hidden>
                {newForumCount > 99 ? "99+" : newForumCount}
              </span>
            )}
            <span className="label">Forum</span>
          </button>

          <button
            type="button"
            className={`menu-item ${tab === TAB_RESSOURCE ? "active" : ""}`}
            onClick={() => {
              setTab(TAB_RESSOURCE);
              navigate("/ressource");
            }}
          >
            <img
              src="/ressource.png"
              alt="Ressources"
              className="sidebar-icon-img"
            />
            <span className="label">Ressources</span>
          </button>

          {isEmployee && (
            <button
              type="button"
              className={`menu-item ${tab === TAB_FEEDBACK ? "active" : ""}`}
              onClick={() => {
                setTab(TAB_FEEDBACK);
                navigate("/feedback");
              }}
            >
              <img
                src="/tableau-de-bord.png"
                alt="Feedback IA"
                className="sidebar-icon-img"
              />
              <span className="label">Feedback IA</span>
            </button>
          )}

          {isRH && (
            <button
              type="button"
              className={`menu-item ${tab === TAB_EMPLOYEES ? "active" : ""}`}
              onClick={() => {
                setTab(TAB_EMPLOYEES);
                navigate("/employees");
              }}
            >
              <img
                src="/employee.png"
                alt="Employés"
                className="sidebar-icon-img"
              />
              <span className="label">Employés</span>
            </button>
          )}
          <button
            type="button"
            className={`menu-item ${tab === TAB_QUESTIONNAIRE ? "active" : ""}`}
            onClick={() => {
              setTab(TAB_QUESTIONNAIRE);

              if (isRH) {
                navigate('/start_questionnaire');
              } else {
                navigate(
                  '/questionnaire',
                );
              }
            }}
          >
            <img
              src="/questionnaire.png"
              alt="Questionnaire"
              className="sidebar-icon-img"
            />
            <span className="label">
              {isRH ? "Questionnaire" : "Questionnaire"}
            </span>
          </button>
          <button
            type="button"
            className={`menu-item ${tab === TAB_PSYCHOBOT ? "active" : ""}`}
            onClick={() => {
              
              setTab(TAB_PSYCHOBOT)
              navigate("/psychobot");

            }}
          >
            <img src="/bot.png" alt="Psychobot" className="sidebar-icon-img" />
            <span className="label">Psychobot</span>
          </button>

          <button
            type="button"
            className={`menu-item ${tab === TAB_PARAMETRES ? "active" : ""}`}
            onClick={() => {
              setTab(TAB_PARAMETRES);
              navigate("/profile");
            }}
          >
            <img
              src="/parametre.png"
              alt="Paramètres"
              className="sidebar-icon-img"
            />
            <span className="label">Paramètres</span>
          </button>
        </nav>
      </aside>

      <main className="main-content">
        <header className="floating-topbar">
          <div className="topbar-left">
            <div className="welcome-text">
              <span className="user-greeting">
                Bonjour, {greetingName} ! 👋
              </span>
              <span className="company-name">RH Bien-être IA</span>
            </div>
          </div>

          <div className="topbar-center">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Rechercher une ressource..." />
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="notification-icon-btn"
              onClick={() => {
                setPopupOpen(false);
                setNotificationsOpen(true);
              }}
              aria-label={
                unreadNotifCount > 0
                  ? `Ouvrir les notifications, ${unreadNotifCount} non lues`
                  : "Ouvrir les notifications"
              }
            >
              <img
                src="/notification.png"
                alt=""
                className="sidebar-icon-img"
              />
              {unreadNotifCount > 0 ? (
                <span className="notification-unread-badge" aria-hidden>
                  {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="user-avatar-btn"
              onClick={() => {
                setNotificationsOpen(false);
                setPopupOpen(true);
              }}
              aria-label="Profil"
            >
              <div className="user-avatar">{avatarInitials}</div>
            </button>
          </div>
        </header>

        <div className="ressources-content">
          {tab === TAB_DASHBOARD && (
            <DashboardOverview user={user} profile={profile} />
          )}

          {tab === TAB_RESSOURCE &&
            (children ? children : <div className="ressources-placeholder" />)}

          {tab === TAB_FEEDBACK && isEmployee && <FeedbackPanel user={user} />}

          {tab === TAB_EMPLOYEES &&
            isRH &&
            (children ? (
              <RhSecuredRoute user={user}>
                {cloneElement(children, { user, embedded: true })}
              </RhSecuredRoute>
            ) : (
              <RhSecuredRoute user={user}>
                <EmployeesList user={user} embedded />
              </RhSecuredRoute>
            ))}

          {tab === TAB_PARAMETRES &&
            (children ? (
              cloneElement(children, { user, embedded: true })
            ) : (
              <Profile user={user} embedded />
            ))}

          {tab === TAB_QUESTIONNAIRE &&
            (isRH ? (
              <StartQuestionnaire user={user} />
            ) : (
              <Questionnaire user={user} questionnaireId={questionnaireId} />
            ))}
          {tab === TAB_FORUM &&
            (children ? (
              cloneElement(children, { user, embedded: true })
            ) : (
              <ForumHome user={user} embedded />
            ))}

          {tab === TAB_PSYCHOBOT && <PsychoBot />}
        </div>
      </main>

      {popupOpen && (
        <PopupProfil
          user={user}
          profile={profile}
          onFermer={() => setPopupOpen(false)}
          onOuvrirParametres={() => {
            setTab(TAB_PARAMETRES);
            navigate("/profile");
          }}
        />
      )}

      {notificationsOpen && (
        <PopupNotifications
          user={user}
          onFermer={() => setNotificationsOpen(false)}
          onMarkedRead={rafraichirCompteurNonLues}
        />
      )}
    </div>
  );
}
