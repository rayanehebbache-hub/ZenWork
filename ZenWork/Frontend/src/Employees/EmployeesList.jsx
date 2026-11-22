import { useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Loading from "../Loading/Loading.jsx";
import styles from "./employees.module.css";

function EmployeesList({ user, embedded }) {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    nom: "",
    prenom: "",
    service: "",
    date_embauche: "",
    role: "EMPLOYE",
  });

  useEffect(() => {
    async function fetchProfiles() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, nom, prenom, service, date_embauche, created_at")
        .order("nom", { ascending: true });
      if (!error) {
        setProfiles(data ?? []);
      } else {
        setMessage({ type: "error", text: "Impossible de charger les employés." });
      }
      setLoading(false);
    }
    fetchProfiles();
  }, []);

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      nom: p.nom ?? "",
      prenom: p.prenom ?? "",
      service: p.service ?? "",
      date_embauche: p.date_embauche ? p.date_embauche.slice(0, 10) : "",
      role: p.role ?? "EMPLOYE",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    const { error } = await supabase
      .from("profiles")
      .update({
        nom: editForm.nom.trim() || null,
        prenom: editForm.prenom.trim() || null,
        service: editForm.service.trim() || null,
        date_embauche: editForm.date_embauche || null,
        role: editForm.role,
      })
      .eq("id", editingId);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === editingId
          ? {
              ...p,
              nom: editForm.nom.trim() || null,
              prenom: editForm.prenom.trim() || null,
              service: editForm.service.trim() || null,
              date_embauche: editForm.date_embauche || null,
              role: editForm.role,
            }
          : p
      )
    );
    setMessage({ type: "success", text: "Profil mis à jour." });
    setEditingId(null);
  };

  const formatDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Liste des employés</h1>
      {message.text && (
        <p className={message.type === "error" ? styles.error : styles.success}>
          {message.text}
        </p>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Service</th>
              <th>Date d&apos;embauche</th>
              <th>Rôle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <React.Fragment key={p.id}>
                <tr className={editingId === p.id ? styles.rowHighlight : ""}>
                  <td>{p.nom ?? "—"}</td>
                  <td>{p.prenom ?? "—"}</td>
                  <td>{p.service ?? "—"}</td>
                  <td>{formatDate(p.date_embauche)}</td>
                  <td><span className={styles.badge}>{p.role}</span></td>
                  <td>
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => startEdit(p)}
                      disabled={editingId !== null && editingId !== p.id}
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
                {editingId === p.id && (
                  <tr key={`${p.id}-form`}>
                    <td colSpan={6} className={styles.editCell}>
                      <form className={styles.editForm} onSubmit={handleSaveEdit}>
                        <label className={styles.label}>
                          Nom
                          <input
                            className={styles.input}
                            value={editForm.nom}
                            onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                          />
                        </label>
                        <label className={styles.label}>
                          Prénom
                          <input
                            className={styles.input}
                            value={editForm.prenom}
                            onChange={(e) => setEditForm((f) => ({ ...f, prenom: e.target.value }))}
                          />
                        </label>
                        <label className={styles.label}>
                          Service
                          <input
                            className={styles.input}
                            value={editForm.service}
                            onChange={(e) => setEditForm((f) => ({ ...f, service: e.target.value }))}
                          />
                        </label>
                        <label className={styles.label}>
                          Date d&apos;embauche
                          <input
                            className={styles.input}
                            type="date"
                            value={editForm.date_embauche}
                            onChange={(e) => setEditForm((f) => ({ ...f, date_embauche: e.target.value }))}
                          />
                        </label>
                        <label className={styles.label}>
                          Rôle
                          <select
                            className={styles.select}
                            value={editForm.role}
                            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                          >
                            <option value="EMPLOYE">Employé</option>
                            <option value="RH">RH</option>
                          </select>
                        </label>
                        <div className={styles.formActions}>
                          <button type="submit" className={styles.saveBtn}>Enregistrer</button>
                          <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>
                            Annuler
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
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
    </div>
  );
}

export default EmployeesList;
