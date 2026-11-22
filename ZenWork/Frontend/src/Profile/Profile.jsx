import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Loading from "../Loading/Loading.jsx";
import styles from "./profile.module.css";

function Profile({ user, embedded }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Account form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState({ type: "", text: "" });

  // Profile form state (nom, prenom, service, date_embauche)
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [service, setService] = useState("");
  const [dateEmbauche, setDateEmbauche] = useState("");
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    async function fetchProfile() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, nom, prenom, service, date_embauche")
        .eq("id", user.id)
        .single();
      if (!error && data) {
        setProfile(data);
        setNom(data.nom ?? "");
        setPrenom(data.prenom ?? "");
        setService(data.service ?? "");
        setDateEmbauche(data.date_embauche ? data.date_embauche.slice(0, 10) : "");
      }
      setLoading(false);
    }
    fetchProfile();
  }, [user?.id]);

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setAccountMessage({ type: "", text: "" });
    if (!newEmail.trim()) {
      setAccountMessage({ type: "error", text: "Indiquez un email." });
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      setAccountMessage({ type: "error", text: error.message });
      return;
    }
    setAccountMessage({ type: "success", text: "Email mis à jour. Vérifiez votre boîte mail si demandé." });
    setNewEmail("");
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setAccountMessage({ type: "", text: "" });
    if (newPassword.length < 10) {
      setAccountMessage({ type: "error", text: "Le mot de passe doit faire au moins 10 caractères." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountMessage({ type: "error", text: "Les mots de passe ne correspondent pas." });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setAccountMessage({ type: "error", text: error.message });
      return;
    }
    setAccountMessage({ type: "success", text: "Mot de passe mis à jour." });
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMessage({ type: "", text: "" });
    const champs = {
      nom: nom.trim() || null,
      prenom: prenom.trim() || null,
    };
    if (profile.role === "RH") {
      champs.service = service.trim() || null;
      champs.date_embauche = dateEmbauche || null;
    }
    const { error } = await supabase.from("profiles").update(champs).eq("id", user.id);
    if (error) {
      setProfileMessage({ type: "error", text: error.message });
      return;
    }
    setProfileMessage({ type: "success", text: "Profil mis à jour." });
  };

  const handleDeleteProfile = async () => {
    const confirmation = window.confirm(
      "⚠️ Etes-vous sûr de vouloir supprimer votre compte ?"
    );
    if (!confirmation) return;
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id);
    if (error) {
      alert("Erreur : " + error.message);
      return;
    }
    alert("Compte supprimé avec succès");
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || !profile) {
    return <Loading />;
  }

  const estRh = profile.role === "RH";
  const classeChampBloque = [styles.input, styles.inputBlocked].join(" ");

  return (
    <div className={styles.page}>
      <div className={styles.section}>
        <h2 className={styles.title}>Mon compte</h2>
        <p className={styles.label}>Email actuel : <strong>{user.email}</strong></p>

        <form className={styles.form} onSubmit={handleUpdatePassword}>
          <label className={styles.label}>
            Nouveau mot de passe
            <input
              className={styles.input}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 10 caractères"
              minLength={10}
            />
          </label>
          <label className={styles.label}>
            Confirmer le mot de passe
            <input
              className={styles.input}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmer"
            />
          </label>
          <button type="submit" className={styles.button}>Changer le mot de passe</button>
        </form>
        {accountMessage.text && (
          <p className={accountMessage.type === "error" ? styles.error : styles.success}>
            {accountMessage.text}
          </p>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.title}>Informations personnelles</h2>
        <form className={styles.form} onSubmit={handleUpdateProfile}>
          <label className={styles.label}>
            Nom
            <input
              className={styles.input}
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom"
            />
          </label>
          <label className={styles.label}>
            Prénom
            <input
              className={styles.input}
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Prénom"
            />
          </label>
          <label className={styles.label}>
            Service
            <input
              className={estRh ? styles.input : classeChampBloque}
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Service"
              readOnly={!estRh}
              aria-readonly={!estRh}
            />
          </label>
          <label className={styles.label}>
            Date d&apos;embauche
            <input
              className={estRh ? styles.input : classeChampBloque}
              type="date"
              value={dateEmbauche}
              onChange={(e) => setDateEmbauche(e.target.value)}
              readOnly={!estRh}
              aria-readonly={!estRh}
            />
          </label>
          {!estRh && (
            <p className={styles.muted}>
              Service et date d&apos;embauche : lecture seule (définis par le RH).
            </p>
          )}
          <p className={styles.muted}>Rôle : {profile.role}</p>
          <button type="submit" className={styles.button}>Enregistrer les modifications</button>
        </form>
        {profileMessage.text && (
          <p className={profileMessage.type === "error" ? styles.error : styles.success}>
            {profileMessage.text}
          </p>
        )}
      </div>

      {!embedded && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate(-1)}
          >
            Retour
          </button>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.div}>
          <button className={styles.deleteButton}
            onClick={handleDeleteProfile}
          >
            Supprimer mon compte
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
