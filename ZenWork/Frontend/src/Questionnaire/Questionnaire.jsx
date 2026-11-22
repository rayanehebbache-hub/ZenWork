import { useState, useEffect } from "react";
import styles from "./questionnaire.module.css";
import { supabase } from "../supabaseClient.js";
import { useParams, useNavigate } from "react-router-dom";
import AnswerInput from "./AnswerInput.jsx";
import NoQuestionnaire from "./NoQuestionnaire.jsx";
import Loading from "../Loading/Loading.jsx";

const API = "http://localhost:8000";

function Questionnaire({ user, questionnaireId }) {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [started, setStarted]                   = useState(false);
  const [currentQuestion, setCurrentQuestion]   = useState(0);
  const [finish, setFinish]                     = useState(false);
  const [currentUser, setCurrentUser]           = useState(null);
  const [questions, setQuestions]               = useState([]);
  const [answers, setAnswers]                   = useState({});
  const [questionnaireClosed, setQuestionnaireClosed] = useState(false);
  const [loadingQuestionnaire, setLoadingQuestionnaire] = useState(true);
  const [loadingFinish, setLoadingFinish]       = useState(true);
  const [analyseEnCours, setAnalyseEnCours]     = useState(false);

  const ratings    = ["😟", "🙁", "😐", "🙂", "😃"];
  const progression = Math.floor((currentQuestion / questions.length) * 100);

  // ── Récupère l'utilisateur connecté ──────────────────────
  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) { console.error("Erreur getUser:", error.message); return; }
      if (data?.user) setCurrentUser(data.user);
    }
    fetchUser();
  }, []);

  // ── Vérifie si le questionnaire est encore actif ──────────
  useEffect(() => {
    let interval;
    const checkQuestionnaire = async () => {
      const { data: q, error } = await supabase
        .from("questionnaire")
        .select("active")
        .eq("id", questionnaireId)
        .single();
      if (error || !q || !q.active) {
        setQuestionnaireClosed(true);
        clearInterval(interval);
      }
      setLoadingQuestionnaire(false);
    };
    checkQuestionnaire();
    interval = setInterval(checkQuestionnaire, 5000);
    return () => clearInterval(interval);
  }, [questionnaireId]);

  // ── Vérifie si l'employé a déjà répondu ──────────────────
  useEffect(() => {
    if (!currentUser) return;
    async function checkFinish() {
      setLoadingFinish(true);
      const { data } = await supabase
        .from("reponse_questionnaire")
        .select("id")
        .eq("questionnaire_id", questionnaireId)
        .eq("utilisateur_id", currentUser.id)
        .maybeSingle();
      if (data) setFinish(true);
      setLoadingFinish(false);
    }
    checkFinish();
  }, [currentUser, questionnaireId]);

  // ── Charge les questions du questionnaire ─────────────────
  useEffect(() => {
    async function fetchQuestionnaire() {
      if (!questionnaireId) return;
      const { data, error } = await supabase
        .from("questionnaire")
        .select("structure_json")
        .eq("id", questionnaireId)
        .single();
      if (error) { console.error("Erreur questionnaire:", error.message); return; }
      if (data?.structure_json) {
        try {
          setQuestions(JSON.parse(data.structure_json));
          setCurrentQuestion(0);
          setAnswers({});
        } catch (e) { console.error("Erreur parsing JSON:", e); }
      }
    }
    fetchQuestionnaire();
  }, [questionnaireId]);

  // ── Envoi des réponses + analyse IA ──────────────────────
  async function sendAnswers() {
    if (finish) return;

    // 1. Insère les réponses dans Supabase et récupère l'id
    const { data: inserted, error } = await supabase
      .from("reponse_questionnaire")
      .insert([{
        utilisateur_id:   currentUser.id,
        questionnaire_id: questionnaireId,
        reponse_json:     JSON.stringify(answers),
      }])
      .select("id")
      .single();

    if (error) {
      console.error("Echec envoi réponses :", error.message);
      return;
    }

    console.log(">>> Réponses insérées, id :", inserted.id);
    setFinish(true);

    // 2. Appelle Django pour analyser et stocker le score
    setAnalyseEnCours(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API}/psychobot/questionnaire/`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ questionnaire_id: inserted.id }),
      });

      const result = await res.json();
      console.log(">>> Analyse IA :", result);

    } catch (e) {
      console.error("Erreur analyse IA :", e);
    } finally {
      setAnalyseEnCours(false);
    }
  }

  // ── Déclenche sendAnswers quand toutes les questions sont répondues ──
  useEffect(() => {
    if (currentQuestion === questions.length && questions.length > 0 && !finish) {
      sendAnswers();
    }
  }, [currentQuestion, finish, questions.length]);

  // ── Écrans de chargement et états ────────────────────────
  if (!currentUser || loadingQuestionnaire || loadingFinish) {
    return <Loading />;
  }

  if (questionnaireClosed || !questionnaireId) {
    return <NoQuestionnaire />;
  }

  if (finish) {
    return (
      <div className={styles.questionnaireWrapper}>
        <div className={styles.finish}>
          <h1 className={styles.h1}>C'est terminé !</h1>
          {analyseEnCours && (
            <p className={styles.p} style={{ fontSize: "13px", opacity: 0.7 }}>
              Analyse en cours...
            </p>
          )}
          <button
            className={styles.goHome}
            onClick={() => navigate("/dashboard")}
            disabled={analyseEnCours}
          >
            Retour à l'accueil
          </button>
          <p className={styles.p}>
            Merci d'avoir pris le temps de répondre au questionnaire.
          </p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className={styles.questionnaireWrapper}>
        <div className={styles.welcome}>
          <h1 className={styles.h1}>
            Voulez vous procédé au <br />questionnaire ?
          </h1>
          <button className={styles.button} onClick={() => setStarted(true)}>
            Commencer l'évaluation
          </button>
          <p className={styles.p}>
            <br /><br />
            Il s'agit d'un questionnaire anonyme de {questions.length} questions ayant pour but
            <br />d'évaluer votre santé mentale afin de pouvoir vous aider si besoin.<br />
            Il vous sera demandé de répondre avec honnêteté afin de ne pas fausser
            <br />le questionnaire qui pourrait vous aider.
          </p>
          <p className={styles.p}>
            Il s'agit d'un questionnaire complet et détaillé basé sur de nombreux
            <br />questionnaires fiables.
          </p>
        </div>
      </div>
    );
  }

  if (currentQuestion < questions.length) {
    return (
      <div className={styles.questionnaireWrapper}>
        <div className={styles.container}>
          <div className={styles.middle}>
            <div className={styles.title}>
              <h2 className={styles.h2}>
                {questions[currentQuestion].question}
                {questions[currentQuestion].optional ? " (facultatif)" : ""}
                {questions[currentQuestion].type === "1_to_10" ? " (de 1 à 10)" : ""}
              </h2>
            </div>
            <div className={styles.answer}>
              <div className={styles.progression_container}>
                <div className={styles.bar} style={{ width: `${progression}%` }} />
              </div>
              <div className={styles.div}>
                <AnswerInput
                  question={questions[currentQuestion]}
                  answers={answers}
                  setAnswers={setAnswers}
                  currentQuestion={currentQuestion}
                  setCurrentQuestion={setCurrentQuestion}
                  ratings={ratings}
                />
              </div>
              <button
                className={styles.retour}
                onClick={() => {
                  if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
                }}
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Questionnaire;