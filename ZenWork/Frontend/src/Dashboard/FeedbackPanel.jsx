import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import Loading from "../Loading/Loading.jsx";
import styles from "./feedbackPanel.module.css";

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

export default function FeedbackPanel({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);
  const refreshTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function fetchFeedback({ silent } = {}) {
      if (!silent) setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("session_ia")
        .select("id, resume_anonymise, score_risque, created_at")
        .eq("utilisateur_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!active) return;
      if (fetchError) {
        setError("Impossible de charger les retours IA.");
        setSessions([]);
      } else {
        setSessions(data ?? []);
      }
      setLoading(false);
    }

    fetchFeedback();

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) return;
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        fetchFeedback({ silent: true });
      }, 300);
    };

    const channel = supabase
      .channel(`feedback-sync-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_ia", filter: `utilisateur_id=eq.${user.id}` },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      active = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const tips = [
      "Note 3 choses positives de ta journee.",
      "Planifie une pause courte toutes les 90 minutes.",
      "Clarifie ta priorite numero 1 pour demain.",
      "Evalue ton energie sur 10 et adapte ton rythme.",
      "Demande un feedback concret sur une tache cle.",
    ];
    const tipOfTheDay = tips[new Date().getDate() % tips.length];
    return {
      total: sessions.length,
      latestDate: sessions[0]?.created_at ? formatDate(sessions[0].created_at) : "-",
      tip: tipOfTheDay,
    };
  }, [sessions]);

  if (loading) return <Loading />;

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Feedback IA</h1>
          <p className={styles.subtitle}>
            Vos retours ecrits issus des sessions PsychoBot, visibles uniquement par vous.
          </p>
        </div>
        <div className={styles.badge}>Confidentiel</div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.statsGrid}>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Sessions enregistrees</span>
          <strong className={styles.statValue}>{stats.total}</strong>
          <span className={styles.statHint}>Toutes sessions</span>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Derniere date</span>
          <strong className={styles.statValue}>{stats.latestDate}</strong>
          <span className={styles.statHint}>Mise a jour auto</span>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Astuce du jour</span>
          <strong className={styles.statValue}>Focus</strong>
          <span className={styles.statHint}>{stats.tip}</span>
        </article>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Retours ecrits</h2>
        {sessions.length === 0 ? (
          <p className={styles.empty}>Aucun retour IA pour le moment.</p>
        ) : (
          <div className={styles.feedbackList}>
            {sessions.map((item) => (
              <article key={item.id} className={styles.feedbackCard}>
                <div className={styles.feedbackHeader}>
                  <span className={styles.feedbackDate}>{formatDate(item.created_at)}</span>
                </div>
                <p className={styles.feedbackText}>
                  {item.resume_anonymise?.trim()
                    ? item.resume_anonymise
                    : "Aucun retour ecrit pour cette session. Continuez a utiliser PsychoBot pour enrichir vos analyses."}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
