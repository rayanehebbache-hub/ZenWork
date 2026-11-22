import React from "react";
import "./RessourceDetail.css";

// On reçoit les infos directement de Ressources.jsx
export default function RessourceDetail({ ressource, onBack }) {
  
  if (!ressource) return null;

  return (
    <div className="ressource-detail-container">
      {/* BOUTON RETOUR QUI UTILISE LA FONCTION "onBack" */}
      <button className="back-btn" onClick={onBack}>
        ← Retour aux ressources
      </button>

      {/* EN-TÊTE DE LA PAGE */}
      <div className="detail-header">
        <span className="detail-category">{ressource.category}</span>
        <h1>{ressource.title}</h1>
        <p className="detail-meta">
          {ressource.type === "video" ? "Coaché par " : "Écrit par "} 
          <strong>{ressource.author}</strong> • {ressource.duration}
        </p>
      </div>

      {/* LECTEUR VIDÉO OU CONTENU ARTICLE */}
      <div className="detail-content">
        {ressource.type === "video" ? (
          <div className="video-player-wrapper">
            <iframe
              src={ressource.embedUrl}
              title={ressource.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="youtube-iframe"
            ></iframe>
          </div>
        ) : (
          <div className="article-body">
            <img src={ressource.image} alt={ressource.title} className="article-illustration" />
            <p className="article-text">{ressource.contenuText}</p>
          </div>
        )}
      </div>
    </div>
  );
}