import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Loading from "../Loading/Loading.jsx";
import styles from "./dashboardOverview.module.css";

function formatDate(dateValue) {
  if (!dateValue) return "-";
  try {
    return new Date(dateValue).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateValue;
  }
}

function buildDaySeries(items, days = 7) {
  const now = new Date();
  const buckets = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: d.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3),
      value: 0,
    });
  }

  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  (items || []).forEach((item) => {
    const key = String(item.created_at || "").slice(0, 10);
    if (byKey[key]) byKey[key].value += 1;
  });

  return buckets;
}

function countByStatus(items, expectedStatuses) {
  const initial = Object.fromEntries(expectedStatuses.map((status) => [status, 0]));
  (items || []).forEach((item) => {
    const status = item?.statut;
    if (status in initial) initial[status] += 1;
  });
  return initial;
}

async function safeQuery(label, query) {
  const result = await query;
  if (result.error) {
    console.error(`[DashboardOverview] ${label}`, result.error);
  }
  return result;
}

function StatCard({ label, value, hint }) {
  return (
    <article className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
      <span className={styles.statHint}>{hint}</span>
    </article>
  );
}

function BarsChart({ title, series, emptyLabel }) {
  const max = Math.max(1, ...series.map((item) => item.value));

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {series.every((item) => item.value === 0) ? (
        <p className={styles.empty}>{emptyLabel}</p>
      ) : (
        <div className={styles.barsWrap}>
          {series.map((item) => (
            <div key={item.key || item.label} className={styles.barItem}>
              <span className={styles.barValue}>{item.value}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ height: `${(item.value / max) * 100}%` }}
                />
              </div>
              <span className={styles.barLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RingChart({ title, value, subtitle }) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <div className={styles.ringWrap}>
        <div
          className={styles.ring}
          style={{
            background: `conic-gradient(#6C5DD3 ${normalized}%, #E2E8F0 ${normalized}% 100%)`,
          }}
        >
          <div className={styles.ringInner}>{Math.round(normalized)}%</div>
        </div>
        <p className={styles.ringSubtitle}>{subtitle}</p>
      </div>
    </section>
  );
}

export default function DashboardOverview({ user, profile }) {
  const navigate = useNavigate();
  const role = profile?.role || "EMPLOYE";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshTimeoutRef = useRef(null);

  const [stats, setStats] = useState({
    employeesCount: 0,
    activeQuestionnaires: 0,
    responseCount: 0,
    openAlerts: 0,
    pendingRequests: 0,
    weeklyResponses: 0,
    activityDays: 0,
    completionRate: 0,
  });

  const [activeQuestionnaireId, setActiveQuestionnaireId] = useState(null);
  const [trendSeries, setTrendSeries] = useState([]);
  const [primaryBreakdown, setPrimaryBreakdown] = useState([]);
  const [secondaryBreakdown, setSecondaryBreakdown] = useState([]);
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function fetchDashboard({ silent } = {}) {
      if (!silent) {
        setLoading(true);
      }
      setError("");

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      try {
        const questionnaireRes = await safeQuery(
          "questionnaire",
          supabase
            .from("questionnaire")
            .select("id, created_at")
            .order("created_at", { ascending: false })
        );

        const questionnaireRows = questionnaireRes.data || [];
        const latestQuestionnaireId = questionnaireRows[0]?.id || null;

        if (role === "RH") {
          const [
            employeesRes,
            allResponsesRes,
            weeklyResponsesRes,
            alertsRes,
            demandesRes,
          ] = await Promise.all([
            safeQuery(
              "profiles count RH",
              supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "EMPLOYE")
            ),
            safeQuery(
              "reponse_questionnaire count RH",
              supabase.from("reponse_questionnaire").select("id", { count: "exact", head: true })
            ),
            safeQuery(
              "reponse_questionnaire weekly RH",
              supabase
                .from("reponse_questionnaire")
                .select("id, created_at, utilisateur_id")
                .gte("created_at", sevenDaysAgo.toISOString())
            ),
            safeQuery(
              "alerte_burnout RH",
              supabase
                .from("alerte_burnout")
                .select("id, utilisateur_id, niveau_urgence, statut, created_at")
                .order("created_at", { ascending: false })
                .limit(8)
            ),
            safeQuery(
              "demande_changement RH",
              supabase
                .from("demande_changement")
                .select("id, utilisateur_id, statut, type_demande, created_at")
                .order("created_at", { ascending: false })
                .limit(12)
            ),
          ]);

          const employeesCount = employeesRes.count || 0;
          const responseCount = allResponsesRes.count || 0;
          const activeQuestionnaires = questionnaireRows.length;

          const alerts = alertsRes.data || [];
          const openAlerts = alerts.filter((item) => item.statut !== "TRAITE").length;

          const demandes = demandesRes.data || [];
          const pendingRequests = demandes.filter((item) => item.statut === "EN_ATTENTE").length;
          const weeklyResponses = weeklyResponsesRes.data || [];
          const weeklyParticipants = new Set(
            weeklyResponses.map((item) => item.utilisateur_id).filter(Boolean)
          ).size;

          const urgency1 = alerts.filter((item) => item.niveau_urgence === 1).length;
          const urgency2 = alerts.filter((item) => item.niveau_urgence === 2).length;
          const urgency3 = alerts.filter((item) => item.niveau_urgence === 3).length;
          const demandesByStatus = countByStatus(demandes, ["EN_ATTENTE", "ACCEPTEE", "REFUSEE"]);

          const completionRate = employeesCount > 0
            ? Math.min(100, (weeklyParticipants / employeesCount) * 100)
            : 0;

          const userIds = [
            ...new Set(
              [...alerts, ...demandes].map((item) => item.utilisateur_id).filter(Boolean)
            ),
          ];
          let employeesById = {};
          if (userIds.length) {
            const { data: employeeRows } = await safeQuery(
              "profiles names RH",
              supabase
                .from("profiles")
                .select("id, nom, prenom")
                .in("id", userIds)
            );
            employeesById = Object.fromEntries(
              (employeeRows || []).map((row) => [row.id, [row.prenom, row.nom].filter(Boolean).join(" ") || "Employe"])
            );
          }

          if (!active) return;
          setStats({
            employeesCount,
            activeQuestionnaires,
            responseCount,
            openAlerts,
            pendingRequests,
            weeklyResponses: weeklyParticipants,
            activityDays: 0,
            completionRate,
          });

          setTrendSeries(buildDaySeries(weeklyResponses));
          setPrimaryBreakdown([
            { key: "low", label: "Urgence 1", value: urgency1 },
            { key: "med", label: "Urgence 2", value: urgency2 },
            { key: "high", label: "Urgence 3", value: urgency3 },
          ]);
          setSecondaryBreakdown([
            { key: "pending", label: "En attente", value: demandesByStatus.EN_ATTENTE },
            { key: "accepted", label: "Acceptees", value: demandesByStatus.ACCEPTEE },
            { key: "refused", label: "Refusees", value: demandesByStatus.REFUSEE },
          ]);

          setFeed(
            [...alerts, ...demandes]
              .map((item) => {
                const isAlert = item.niveau_urgence != null;
                return {
                  id: `${isAlert ? "a" : "d"}-${item.id}`,
                  title: employeesById[item.utilisateur_id] || "Employe",
                  subtitle: isAlert
                    ? `Alerte niveau ${item.niveau_urgence} - ${item.statut}`
                    : `Demande ${item.type_demande || "RH"} - ${item.statut}`,
                  date: item.created_at,
                };
              })
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 8)
          );
        } else {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
          thirtyDaysAgo.setHours(0, 0, 0, 0);

          const [
            responsesRes,
            weeklyResponsesRes,
            activityResponsesRes,
            alertsRes,
            demandesRes,
          ] = await Promise.all([
            safeQuery(
              "reponse_questionnaire user count",
              supabase
                .from("reponse_questionnaire")
                .select("id, questionnaire_id, created_at", { count: "exact" })
                .eq("utilisateur_id", user.id)
                .order("created_at", { ascending: false })
                .limit(8)
            ),
            safeQuery(
              "reponse_questionnaire user weekly",
              supabase
                .from("reponse_questionnaire")
                .select("id, created_at")
                .eq("utilisateur_id", user.id)
                .gte("created_at", sevenDaysAgo.toISOString())
            ),
            safeQuery(
              "reponse_questionnaire user activity",
              supabase
                .from("reponse_questionnaire")
                .select("created_at")
                .eq("utilisateur_id", user.id)
                .gte("created_at", thirtyDaysAgo.toISOString())
            ),
            safeQuery(
              "alerte_burnout user",
              supabase
                .from("alerte_burnout")
                .select("id, statut, created_at")
                .eq("utilisateur_id", user.id)
                .order("created_at", { ascending: false })
            ),
            safeQuery(
              "demande_changement user",
              supabase
                .from("demande_changement")
                .select("id, statut, type_demande, created_at")
                .eq("utilisateur_id", user.id)
                .order("created_at", { ascending: false })
            ),
          ]);

          const demandes = demandesRes.data || [];
          const pending = demandes.filter((item) => item.statut === "EN_ATTENTE").length;
          const accepted = demandes.filter((item) => item.statut === "ACCEPTEE").length;
          const refused = demandes.filter((item) => item.statut === "REFUSEE").length;
          const alerts = alertsRes.data || [];
          const alertStatuses = countByStatus(alerts, ["NOUVEAU", "EN_COURS", "TRAITE"]);

          const activeQuestionnaireIdFound = latestQuestionnaireId;
          const activeDays = new Set(
            (activityResponsesRes.data || [])
              .map((row) => String(row.created_at || "").slice(0, 10))
              .filter(Boolean)
          );
          const completionRate = Math.min(100, (activeDays.size / 30) * 100);

          if (!active) return;
          setActiveQuestionnaireId(activeQuestionnaireIdFound);
          setStats({
            employeesCount: 0,
            activeQuestionnaires: activeQuestionnaireIdFound ? 1 : 0,
            responseCount: responsesRes.count || 0,
            openAlerts: alerts.filter((item) => item.statut !== "TRAITE").length,
            pendingRequests: pending,
            weeklyResponses: weeklyResponsesRes.data?.length || 0,
            activityDays: activeDays.size,
            completionRate,
          });

          setTrendSeries(buildDaySeries(weeklyResponsesRes.data || []));
          setPrimaryBreakdown([
            { key: "new", label: "Nouvelles", value: alertStatuses.NOUVEAU },
            { key: "progress", label: "En cours", value: alertStatuses.EN_COURS },
            { key: "done", label: "Traitees", value: alertStatuses.TRAITE },
          ]);
          setSecondaryBreakdown([
            { key: "p", label: "En attente", value: pending },
            { key: "a", label: "Acceptees", value: accepted },
            { key: "r", label: "Refusees", value: refused },
          ]);

          const responseEvents = (responsesRes.data || []).map((item) => ({
            id: `r-${item.id}`,
            title: "Questionnaire complete",
            subtitle: `Questionnaire #${item.questionnaire_id}`,
            date: item.created_at,
          }));

          const alertEvents = alerts.slice(0, 6).map((item) => ({
            id: `a-${item.id}`,
            title: "Alerte burnout",
            subtitle: `Statut: ${item.statut}`,
            date: item.created_at,
          }));

          const demandeEvents = demandes.slice(0, 6).map((item) => ({
            id: `d-${item.id}`,
            title: `Demande ${item.type_demande || "RH"}`,
            subtitle: `Statut: ${item.statut}`,
            date: item.created_at,
          }));

          setFeed(
            [...responseEvents, ...alertEvents, ...demandeEvents]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 8)
          );
        }
      } catch (err) {
        if (!active) return;
        console.error("[DashboardOverview] fetchDashboard fatal", err);
        setError(err.message || "Erreur lors du chargement du dashboard.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    }

    fetchDashboard();

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) return;
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        fetchDashboard({ silent: true });
      }, 300);
    };

    const changeOptions = (tableName) =>
      role === "RH"
        ? { event: "*", schema: "public", table: tableName }
        : { event: "*", schema: "public", table: tableName, filter: `utilisateur_id=eq.${user.id}` };

    let channel = supabase
      .channel(`dashboard-sync-${user.id}-${role}`)
      .on("postgres_changes", changeOptions("reponse_questionnaire"), scheduleRefresh)
      .on("postgres_changes", changeOptions("alerte_burnout"), scheduleRefresh)
      .on("postgres_changes", changeOptions("demande_changement"), scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "questionnaire" }, scheduleRefresh);

    if (role === "RH") {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleRefresh);
    }

    channel = channel.subscribe();

    return () => {
      active = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [role, user?.id]);

  if (loading) return <Loading />;

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard {role === "RH" ? "RH" : "Employe"}</h1>
          <p className={styles.subtitle}>Vue operationnelle en temps reel de la plateforme bien-etre.</p>
        </div>
        <div className={styles.headerActions}>
          {role === "RH" ? (
            <>
              <button type="button" className={styles.primaryBtn} onClick={() => navigate("/employees")}>Voir les employes</button>
              <button type="button" className={styles.secondaryBtn} onClick={() => navigate(`/profile/${user.id}`)}>Parametres</button>
            </>
          ) : (
            <>
              {activeQuestionnaireId ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => navigate(`/questionnaire/${user.id}/${activeQuestionnaireId}`)}
                >
                  Repondre au questionnaire
                </button>
              ) : (
                <button type="button" className={styles.secondaryBtn} disabled>Aucun questionnaire actif</button>
              )}
              <button type="button" className={styles.secondaryBtn} onClick={() => navigate(`/profile/${user.id}`)}>Mon profil</button>
            </>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.statsGrid}>
        {role === "RH" ? (
          <>
            <StatCard label="Employes actifs" value={stats.employeesCount} hint="Comptes employes" />
            <StatCard label="Questionnaires" value={stats.activeQuestionnaires} hint="Disponibles en base" />
            <StatCard label="Reponses totales" value={stats.responseCount} hint="Depuis le debut" />
            <StatCard label="Alertes ouvertes" value={stats.openAlerts} hint="Nouveau + en cours" />
            <StatCard label="Demandes en attente" value={stats.pendingRequests} hint="A traiter" />
            <StatCard label="Repondants cette semaine" value={stats.weeklyResponses} hint="Employes ayant repondu" />
          </>
        ) : (
          <>
            <StatCard label="Questionnaires completes" value={stats.responseCount} hint="Historique personnel" />
            <StatCard label="Questionnaire disponible" value={stats.activeQuestionnaires} hint="0 ou 1" />
            <StatCard label="Alertes ouvertes" value={stats.openAlerts} hint="Suivi RH en cours" />
            <StatCard label="Demandes en attente" value={stats.pendingRequests} hint="Conge, horaire, echange" />
            <StatCard label="Reponses cette semaine" value={stats.weeklyResponses} hint="Sur 7 jours" />
            <StatCard label="Jours actifs" value={stats.activityDays} hint="Sur 30 jours" />
          </>
        )}
      </div>

      <div className={styles.twoCols}>
        <BarsChart
          title={role === "RH" ? "Reponses sur 7 jours" : "Mes reponses sur 7 jours"}
          series={trendSeries}
          emptyLabel="Pas de reponse sur les 7 derniers jours."
        />

        <RingChart
          title={role === "RH" ? "Taux de participation hebdo" : "Progression personnelle"}
          value={stats.completionRate}
          subtitle={
            role === "RH"
              ? "Ratio reponses / nombre d'employes"
              : "Jours actifs sur les 30 derniers jours"
          }
        />
      </div>

      <div className={styles.twoCols}>
        <BarsChart
          title={role === "RH" ? "Alertes par urgence" : "Mes alertes"}
          series={primaryBreakdown}
          emptyLabel={role === "RH" ? "Aucune alerte recensee." : "Aucune alerte enregistree."}
        />

        <BarsChart
          title={role === "RH" ? "Demandes RH" : "Mes demandes RH"}
          series={secondaryBreakdown}
          emptyLabel="Aucune demande enregistree."
        />
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Activite recente</h2>
        {feed.length === 0 ? (
          <p className={styles.empty}>Aucune activite a afficher pour le moment.</p>
        ) : (
          <ul className={styles.feedList}>
            {feed.slice(0, 6).map((item) => (
              <li key={item.id} className={styles.feedItem}>
                <div>
                  <p className={styles.feedTitle}>{item.title}</p>
                  <p className={styles.feedSubtitle}>{item.subtitle}</p>
                </div>
                <span className={styles.feedDate}>{formatDate(item.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
