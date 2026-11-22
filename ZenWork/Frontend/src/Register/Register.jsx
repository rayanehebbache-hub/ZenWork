import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import Login from "../Login/Login.jsx";
import styles from "./register.module.css";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("EMPLOYE");
  const [message, setMessage] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [consent, setConsent] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!consent) {
      setMessage("Vous devez accepter les conditions d'utilisation");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nom, prenom },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data?.user?.id) {
      setMessage("Impossible de recuperer l'utilisateur apres l'inscription.");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      role,
      nom,
      prenom,
    });

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    setMessage("Compte crée avec succes !");
  };

  return (
    <div className={styles.container}>
      <div className={styles.create}>
        <h2 className={styles.h2} >Inscription</h2>
        <form className={styles.form} onSubmit={handleRegister}>
          <input className={styles.input}
            type="email"
            placeholder="Email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />

          <input className={styles.input}
            type="password"
            placeholder="Mot de passe"
            required
            pattern="(?=.*[A-Z])(?=.*[a-z])(?=.*[!@#$%^&*])(?=.*[0-9]).{10,}"
            onChange={(e) => setPassword(e.target.value)}
          />

          <input className={styles.input}
            type="text"
            placeholder="Nom"
            required
            onChange={(e) => setNom(e.target.value)}
          />

          <input className={styles.input}
            type="text"
            placeholder="Prénom"
            required
            onChange={(e) => setPrenom(e.target.value)}
          />

          <select className={styles.select} onChange={(e) => setRole(e.target.value)}>
            <option className={styles.option} value="EMPLOYE">Employé</option>
            <option className={styles.option} value="RH">RH</option>
          </select>

          <label className={styles.label}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Si vous appuyez sur ce bouton vous consentez à ce
            <br />
            que vos données soient utilisées par une intelligence
            <br />
            artificielle et exploitables par celle-ci, ainsi que
            <br />
            consultables par les RH et vous.
          </label>

          <button className={styles.button} type="submit">Créer le compte</button>
        </form>
        <p className={styles.login} onClick={() => navigate("/")}>
          Retourner a l'espace de connexion
        </p>
        <p className={styles.p}>{message}</p>
      </div>
    </div>
  );
}

export default Register;
