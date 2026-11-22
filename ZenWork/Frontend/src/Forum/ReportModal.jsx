import { useEffect, useState } from "react";

export default function ReportModal({ open, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    if (!reason) return;
    onSubmit(reason, details);
  }

  return (
    <div className="forum-modal-overlay" onClick={onClose}>
      <div className="forum-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Signaler le message</h3>
        <p>Sélectionne la raison du signalement.</p>

        {[
          "Spam",
          "Insultes ou harcèlement",
          "Discours de haine",
          "Violence",
          "Contenu NSFW",
          "Autre",
        ].map((item) => (
          <label key={item} className="forum-radio">
            <input
              type="radio"
              name="forum-report-reason"
              value={item}
              checked={reason === item}
              onChange={() => setReason(item)}
            />
            <span>{item}</span>
          </label>
        ))}

        <textarea
          placeholder="Détails (optionnel)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />

        <div className="forum-modal-actions">
          <button type="button" onClick={onClose}>
            Annuler
          </button>

          <button
            type="button"
            className="danger"
            disabled={!reason}
            onClick={handleSubmit}
          >
            Signaler
          </button>
        </div>
      </div>
    </div>
  );
}