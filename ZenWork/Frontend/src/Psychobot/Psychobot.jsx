import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Psychobot.css";
import { supabase } from "../supabaseClient";

const API = "http://localhost:8000";

export default function PsychoBot() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Bonjour ! Je suis PsychoBot. Comment vous sentez-vous aujourd'hui ?" }
  ]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [sessionData, setSessionData]     = useState(null);
  const [token, setToken]                 = useState(null);
  const [redirection, setRedirection]     = useState(null);
  const bottomRef                         = useRef(null);
  const navigate                          = useNavigate();

  // Récupère le token au chargement
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || sessionClosed) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/psychobot/chat/message/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          history:      newMessages.slice(0, -1),
          message:      text,
          score_actuel: sessionData?.score_initial || 0,
        }),
      });
      const data = await res.json();
      console.log(">>> data reçue :", data);

      if (data.response) {
        setMessages([...newMessages, { role: "assistant", content: data.response }]);

        if (data.score_initial !== undefined) {
          setSessionData({
            score_initial:     data.score_initial,
            raisons_initiales: data.raisons || [],
          });
        }

        // Détection en temps réel
        if (data.urgence && !redirection) {
          setRedirection({ type: "urgence", message: data.message_redirection });
        } else if (data.categorie_ressource && !redirection) {
          setRedirection({ type: "ressource", message: data.message_redirection, categorie: data.categorie_ressource });
        }
      } else {
        setError(data.error || "Erreur inattendue.");
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function closeSession() {
    if (sessionClosed) return;
    setLoading(true);
    setError(null);
 
    try {
      const res = await fetch(`${API}/psychobot/chat/fermer/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          history:           messages,
          score_initial:     sessionData?.score_initial     || 0,
          raisons_initiales: sessionData?.raisons_initiales || [],
          questionnaire_id:  sessionData?.questionnaire_id  || null,
        }),
      });
      const data = await res.json();
      console.log("Session fermée :", data);
      setSessionClosed(true);

      // Redirection après fermeture si pas encore affichée
      if (data.urgence && !redirection) {
        setRedirection({ type: "urgence", message: data.message_redirection });
      } else if (data.categorie_ressource && !redirection) {
        setRedirection({ type: "ressource", message: data.message_redirection, categorie: data.categorie_ressource });
      }

      if (data.resume_session) {
        setMessages(m => [...m, { role: "assistant", content: data.resume_session }]);
      }

    } catch (e) {
      console.error("Erreur closeSession :", e);
      setError("Erreur lors de la clôture de la session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="psycho-page">

      {/* Header */}
      <div className="psycho-header">
        <div className="psycho-avatar">🤖</div>
        <div>
          <h2>PsychoBot</h2>
          <p>Assistant bien-être — confidentiel</p>
        </div>
        <div className="psycho-status" />
        {!sessionClosed && (
          <button className="close-session-btn" onClick={closeSession} disabled={loading}>
            Terminer la session
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="psycho-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`msg-row ${msg.role}`}>
            <div className="msg-icon">
              {msg.role === "assistant" ? "🤖" : "👤"}
            </div>
            <div className="bubble">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="msg-row assistant">
            <div className="msg-icon">🤖</div>
            <div className="typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {error && <p className="psycho-error">⚠ {error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="psycho-input-zone">
        {sessionClosed ? (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", padding: "8px 0" }}>
            Session terminée. Merci pour cet échange.
          </p>
        ) : (
          <>
            {/* Bannière de redirection */}
            {redirection && (
              <div className={`redirection-banner ${redirection.type}`}>
                <p>{redirection.message}</p>
                {redirection.type === "urgence" ? (
                  <div className="redirection-buttons">
                    <a href="tel:3114" className="btn-urgence-red">Appeler le 3114</a>
                    <a
                      href="https://www.doctolib.fr/psychologue"
                      target="_blank"
                      rel="noreferrer"
                      className="btn-urgence-blue"
                    >
                      Consulter un psy
                    </a>
                  </div>
                ) : (
                  <div className="redirection-buttons">
                    <button
                      className="btn-ressource"
                      onClick={() => navigate(`/ressource?categorie=${redirection.categorie}`)}
                    >
                      Voir les ressources
                    </button>
                    <button className="btn-non-merci" onClick={() => setRedirection(null)}>
                      Non merci
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="input-row">
              <textarea
                className="psycho-textarea"
                value={input}
                placeholder="Écrivez votre message..."
                rows={1}
                disabled={loading}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
              >
                ➤
              </button>
            </div>
            <p className="psycho-hint">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</p>
          </>
        )}
      </div>

    </div>
  );
}