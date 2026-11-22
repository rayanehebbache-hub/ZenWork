import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Loading from "../Loading/Loading.jsx";

function Home({ user }) {
  const navigate = useNavigate();
  const [latestQuestionnaireId, setLatestQuestionnaireId] = useState(null);
  const [role, setRole] = useState(null);
  const prenom = user?.user_metadata?.prenom || "Utilisateur";

  useEffect(() => {
    async function fetchRole() {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setRole(data.role);
      }
    }

    fetchRole();
  }, [user.id]);

  useEffect(() => {
    if (role !== "RH") {
      async function fetchLatestQuestionnaireId() {
        const { data, error } = await supabase
          .from("questionnaire")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error(
            "Echec dans la récupération du questionnaire :",
            error.message
          );
        } else {
          setLatestQuestionnaireId(data?.id ?? null);
        }
      }

      fetchLatestQuestionnaireId();
    }
  }, [role]);

  if (!role) {
    return <Loading />;
  }

  return (
    <div>
      <h1>Hi {prenom} ! 👋</h1>
      <button onClick={() => navigate("/profile")}>
        Mon profil
      </button>
      {role === "RH" && (
        <>
          <button onClick={() => navigate(`/employees`)}>
            Liste des employés
          </button>
          <button onClick={() => navigate("/start_questionnaire")}>
            Lancer un questionnaire
          </button>
        </>
      )}

      {role !== "RH" && latestQuestionnaireId && (
        <button
          onClick={() =>
            navigate(`/questionnaire/${latestQuestionnaireId}`)
          }
        >
          Questionnaire
        </button>
      )}

      {role !== "RH" && !latestQuestionnaireId && <Loading />}

      <br />
      <br />

      <button onClick={() => navigate("/forum")}>
        Accéder au forum
      </button>

      <br />
      <br />

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate("/");
        }}
      >
        Déconnexion
      </button>
    </div>
  );
}

export default Home;