
Projet Informatique – Lancement du projet
Récapitulatif de la réunion de 09/02/2026 :
1)	Répartition des rôles et les tâches :
Equipe frontend: Lead frontend (Product Owner) =Oualid: 
			Développeur frontend = Rayane
 
Equipe backend: Lead Backend (Scrum manager) = Abderrahim
			Développeur backend RH= Mohamed
			Développeur backend IA = Lylia


2)	Liste des besoins pour la structure de base de données :
-gestion de utilisateurs
-création de table pour stocker :
•	les données des utilisateurs :
CREATE TABLE Utilisateurs (
    id_user SERIAL PRIMARY KEY,
    nom VARCHAR(100),
    prenom VARCHAR(100),
    email VARCHAR(150) UNIQUE,
    mot_de_passe VARCHAR(255),
    role VARCHAR(20) CHECK (role IN ('Employe', 'RH', 'Direction', 'Admin')), -- 
    id_equipe INTEGER,
    date_arrivee DATE DEFAULT CURRENT_DATE
);



•	Des questionnaire/réponses :
CREATE TABLE Questionnaires (
    id_questionnaire SERIAL PRIMARY KEY,
    titre VARCHAR(200),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

•	Les congés : 
CREATE TABLE Conges (
    id_conge SERIAL PRIMARY KEY,
    id_user INTEGER REFERENCES Utilisateurs(id_user),
    date_debut DATE,
    date_fin DATE,
    type_conge VARCHAR(50), -- CP, RTT, Maladie
    statut VARCHAR(20) DEFAULT 'En attente', -- Validé, Refusé
    justificatif_url VARCHAR(255) -- Lien vers le fichier stocké [cite: 19]
);
•	Pour échanger les horaires :
CREATE TABLE Echanges_Horaires (
    id_echange SERIAL PRIMARY KEY,
    id_demandeur INTEGER REFERENCES Utilisateurs(id_user),
    id_receveur INTEGER REFERENCES Utilisateurs(id_user),
    id_planning_source INTEGER REFERENCES Plannings(id_planning),
    statut VARCHAR(20) DEFAULT 'Propose' -- Propose, Accepte, Refuse
);



•	Pouvoir faire des messages : 
CREATE TABLE Reponses (
    id_reponse SERIAL PRIMARY KEY,
    id_user INTEGER REFERENCES Utilisateurs(id_user),
    id_questionnaire INTEGER REFERENCES Questionnaires(id_questionnaire),
    score_bien_etre INTEGER, -- Score calculé pour l'IA
    commentaire TEXT,
    date_soumission TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
•	Détecter les burn out : 
CREATE TABLE Alertes_Burnout (
    id_alerte SERIAL PRIMARY KEY,
    id_user INTEGER REFERENCES Utilisateurs(id_user),
    niveau_risque VARCHAR(20) CHECK (niveau_risque IN ('Faible', 'Modere', 'Critique')),
    date_detection TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    statut_traitement VARCHAR(20) DEFAULT 'En attente' -- Pour le suivi RH
);
•	Gestion des planning : 
CREATE TABLE Plannings (
    id_planning SERIAL PRIMARY KEY,
    id_user INTEGER REFERENCES Utilisateurs(id_user),
    date_debut TIMESTAMP,
    date_fin TIMESTAMP,
    type_activite VARCHAR(50) -- ex: Présentiel, Télétravail
);	
•	Gestion des forum :
CREATE TABLE Forums (
    id_forum SERIAL PRIMARY KEY,
    nom_espace VARCHAR(100),
    acces_requis VARCHAR(20) -- Niveau de permission
);
•	Gestion de l’aide assistance :
CREATE TABLE Ressources_BienEtre (
    id_ressource SERIAL PRIMARY KEY,
    titre VARCHAR(200),
    type_contenu VARCHAR(50), -- Vidéo, Article, Audio
    url_contenu VARCHAR(255)
);


À faire pour la semaine prochaine :
•	Création du backlog produit (table ou fichier)
•	Planification des sprints de la première semaine
•	Préparation des slides de présentation du projet
•	Mise en place de la structure initiale du projet :
o	fichiers de base (HTML, CSS, XML, etc.)
o	initialisation du dépôt GitLab







