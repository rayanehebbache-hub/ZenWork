import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import styles from "./login.module.css";

function EmployeeLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
      e.preventDefault();
  
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
  
      if (error) {
        setMessage(error.message);
        // message pour l'utilisateur (pour le moment pas opti
        // car ne distingue pas s'il s'agit de l'utilisateur
        // qui s'est trompé ou si l'erreur viens de la base)
        setErrorMessage("Email ou mot de passe incorrect");
        return;
      }

      const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

      if (profileError || profile.role !== "EMPLOYE") {
        setErrorMessage("Email ou mot de passe incorrect");
        return;
      }
  
      setMessage("Connexion réussie !");
      console.log("User connecté :", data.user);
      navigate("/dashboard");
    };

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.div}>
        <form className={styles.form} onSubmit={handleLogin}>
          <label className={styles.label}>Email
            <br />
            <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <br />
          <label className={styles.label}>Mot de passe
            <br />
            <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          <br />
          <button className={styles.button} >Se connecter</button>
        </form>
        {errorMessage  && <p className={styles.errorMessage}>{errorMessage}</p>}
      </div>
    </div>
  );
}

export default EmployeeLogin;
