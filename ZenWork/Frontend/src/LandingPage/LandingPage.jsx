import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);

  const handleNavigation = (path) => {
    setIsExiting(true);
    setTimeout(() => {
      navigate(path);
    }, 400);
  };

  return (
    <div className={`relax-landing ${isExiting ? 'page-exit' : ''}`}>
      {/* --- BACKGROUND ANIMÉ --- */}
      <div className="ambient-background">
        <div className="soft-glow glow-1"></div>
        <div className="soft-glow glow-2"></div>
        
        <div className="leaves-container">
          <div className="leaf leaf-1"></div>
          <div className="leaf leaf-2"></div>
          <div className="leaf leaf-3"></div>
          <div className="leaf leaf-4"></div>
          <div className="leaf leaf-5"></div>
        </div>
      </div>

      {/* --- HEADER NAVBAR --- */}
      <nav className="glass-navbar fade-in-down">
        <div className="nav-logo">
          <img src="/zenwork-dessin.png" alt="ZenWork Logo" className="landing-logo light-logo" />
          <img src="/zenwork-dessin-dark.png" alt="ZenWork Logo" className="landing-logo dark-logo" />
          <span className="logo-text">ZenWork</span>
        </div>
        <div className="nav-actions">
          <button onClick={() => handleNavigation('/login')} className="nav-link">Connexion</button>
          <button onClick={() => handleNavigation('/register')} className="btn-relax-small">Démarrer</button>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="hero-section">
        <div className="hero-content fade-in-up">
          {/* La bulle a été supprimée, le titre remonte naturellement */}
          <h1 className="hero-title">
            Prenez soin de votre esprit avec <br />
            <span className="text-gradient">sérénité et douceur.</span>
          </h1>
          <p className="hero-subtitle">
            Une plateforme épurée qui allie suivi bien-être intelligent et ressources apaisantes pour vous accompagner au quotidien.
          </p>
          <div className="hero-cta-group">
            <button onClick={() => handleNavigation('/register')} className="btn-relax-large">
              Essayer gratuitement
            </button>
            <button onClick={() => handleNavigation('/login')} className="btn-glass-large">
              Découvrir la plateforme
            </button>
          </div>
        </div>

        <div className="hero-visual fade-in-up delay-1">
          <div className="floating-glass-card">
            <div className="card-header">
              <span className="card-title-mini">Votre Météo Intérieure</span>
            </div>
            <div className="card-body">
              <div className="skeleton-line full"></div>
              <div className="skeleton-line half"></div>
              <div className="health-ring">
                <div className="ring-score">Zen</div>
                <div className="ring-label">Niveau de stress</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section className="features-section">
        <div className="feature-card glass-panel fade-in-up delay-2">
          <div className="feat-icon">🕊️</div>
          <h3>Écoute bienveillante</h3>
          <p>Un espace confidentiel pour libérer la parole sans aucun jugement, à tout moment.</p>
        </div>
        <div className="feature-card glass-panel highlighted fade-in-up delay-3">
          <div className="feat-icon">🧘‍♀️</div>
          <h3>Ressources ciblées</h3>
          <p>Méditations, exercices de respiration et conseils pour améliorer votre sommeil.</p>
        </div>
        <div className="feature-card glass-panel fade-in-up delay-4">
          <div className="feat-icon">🌱</div>
          <h3>Communauté saine</h3>
          <p>Échangez avec vos collègues dans un environnement serein et constructif.</p>
        </div>
      </section>
      {/* --- FOOTER MINIMALISTE --- */}
      <footer className="glass-footer">
        <div className="footer-content">
          <div className="footer-left">
            <span className="footer-logo">
              <span className="logo-icon"></span> ZenWork
            </span>
            <p className="copyright">© 2026 ZenWork. Tous droits réservés.</p>
          </div>
          <div className="footer-links">
            <a href="#mentions" onClick={(e) => e.preventDefault()}>Mentions légales</a>
            <a href="#confidentialite" onClick={(e) => e.preventDefault()}>Confidentialité</a>
            <a href="#contact" onClick={(e) => e.preventDefault()}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}