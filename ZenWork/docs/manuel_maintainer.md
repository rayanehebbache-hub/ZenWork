ZenWork

1. Partie Login

La partie Login du projet est regroupée dans un dossier Login contenant des composants React permettant aux utilisateurs de se connecter soit en tant qu’employé, soit en tant que RH.

i. Login

Le composant Login est la page principale du site, elle est la première à apparaître lorsqu’on rentre sur l’application web.

Elle permet à l’utilisateur de choisir son espace de connexion parmi employé ou RH, la connexion est gérée dans EmployeeLogin ou RhLogin en fonction de l’espace que l’on a sélectionné.

Si l’on n’a pas de compte, on peut cliquer sur un lien en dessous de la zone d’authentification pour en créer un.

ii. RhLogin

Ce composant permet aux utilisateurs ayant le rôle RH uniquement de se connecter à l’application. Il fait partie de la page Login et s’affiche uniquement lorsque l’espace RH est sélectionné.

La connexion se fait via un email et un mot de passe, une fois ses infos rentrées, on fait un fetch avec la base de données pour vérifier que les infos correspondent bien avec ceux présente dans la base.

iii. EmployeeLogin

Composant identique à RhLogin à la différence près qu’il s’applique aux employés et non au RH.

2. Partie Register

Cette partie de projet est dédié à la création de compte que ce soit employé ou RH.

i. Register

Ce composant permet à l’utilisateur de remplir le formulaire suivant:

- une adresse mail
- un mot de passe qui respecte les conditions suivantes:
  - au moins une majuscule
  - au moins une minuscule
  - au moins un chiffre
  - au moins un caractère spécial parmi !, @, #, $, %, ^, &, 
  - au moins dix caractères
- un nom
- un prénom
- si l’on souhaite créer un compte en tant qu’employé ou RH

Une fois, ce formulaire remplit, on envoie ses informations vers la base de données via un fetch afin de créer un nouvel utilisateur (c’est avec ces informations que l’on décide s’il on peut se connecter ou non dans Login).

Lors de la création du compte, un id unique est automatiquement généré pour l’utilisateur pour l’identifier dans les autres pages du site (ex. dans Questionnaire voir qui a répondu au questionnaire).

3. Partie Dashboard
  Ce composant affiche une vue differente selon le role :

- version RH
- version employe

Le role vient de profile?.role.

Si le role est RH, le dashboard affiche plutot des infos globales :

- nombre d'employes
- questionnaires actifs
- reponses totales
- alertes ouvertes
- demandes en attente
- moyenne de risque IA

Si le role n'est pas RH, on est cote employe et le dashboard affiche plutot des infos personnelles :

- questionnaires completes
- questionnaire actif
- alertes ouvertes de l'utilisateur
- demandes en attente
- dernier score IA
- moyenne des scores IA

Les tables utilisees sont surtout :

- profiles
- questionnaire
- reponse_questionnaire
- alerte_burnout
- session_ia
- demande_changement

4. Partie Forum :


La partie Forum du projet est regroupée dans un dossier Forum contenant plusieurs composants React et un service Supabase dédié. Elle permet aux utilisateurs authentifiés de publier des messages internes, commenter, liker, signaler du contenu, joindre des médias, utiliser des GIF GIPHY et échanger par messagerie privée. Le point d’entrée principal est ForumHome, qui organise l’interface en onglets et adapte certaines actions selon le rôle de l’utilisateur. 

i. ForumHome
Le composant ForumHome est la page principale du forum. Lors du chargement, il récupère le rôle de l’utilisateur connecté via fetchCurrentUserRole(user.id) afin d’adapter l’interface. Il affiche un onglet Fil d’actualité, un onglet Messagerie privée, et un onglet Modération uniquement si le rôle permet la modération du forum (canModerateForum). Le fil d’actualité repose sur le composant EmployeeDiscussion utilisé ici comme moteur du feed général avec mode="feed", tandis que la modération affiche les signalements ouverts et permet de les marquer comme traités. 


ii. EmployeeDiscussion (moteur du fil d’actualité)
Même si son nom historique est EmployeeDiscussion, ce composant sert de moteur principal du fil d’actualité général. Il charge les publications via fetchPostsByMode(mode), les profils auteurs via fetchProfilesByIds(...), les pièces jointes via fetchAttachmentsByTargets("post", ...), ainsi que les éventuelles sanctions actives de l’utilisateur via fetchActiveForumSanction(user.id). Les modérateurs voient tous les posts, alors que les autres utilisateurs ne voient que les publications dont le statut est published. 
Le composant permet de créer une publication contenant :

du texte,
jusqu’à 4 fichiers,
ou un GIF GIPHY sélectionné via le composant GiphyGifPicker. 

Les fichiers autorisés sont validés par forumUtils et peuvent être de type :

image (jpeg, png, webp),
GIF,
vidéo (mp4, webm),
PDF.
La taille maximale autorisée dépend du type de fichier et la validation est faite côté interface par isAllowedPostAttachment(...) et isAttachmentSizeAllowed(...). 

Lorsqu’un post est publié, le composant appelle createPost(...), qui insère la publication dans forum_posts puis, si besoin, envoie les fichiers dans le bucket Supabase forum-media et crée les enregistrements correspondants dans forum_attachments. Un GIF externe GIPHY est enregistré comme pièce jointe de type gif via createExternalGifAttachment(...). L’édition et la suppression des publications sont également gérées depuis ce composant via updatePost(...) et deletePost(...). 

iii. Post (affichage détaillé d’une publication)
Le composant Post est responsable de l’affichage détaillé d’une publication et de toutes les interactions associées. Il affiche :

l’auteur,
la date,
le statut éventuel (published, hidden, etc.),
le contenu texte,
les pièces jointes (images, GIF, vidéos, PDF),
le nombre de likes,
le nombre de commentaires visibles. 

Les likes sont chargés via fetchLikes(post.id) et mis à jour avec toggleLike(...). Les commentaires sont chargés via fetchComments(post.id), puis réorganisés en arborescence grâce à groupCommentsByParent(...) afin de gérer les réponses imbriquées. Les commentaires peuvent être créés, modifiés et supprimés via createComment(...), updateComment(...) et deleteComment(...). Le composant gère aussi un état submitting pour éviter les doubles envois. 

La zone des commentaires n’est affichée que lorsque l’utilisateur clique sur le bouton Commentaires. Le formulaire d’ajout d’un commentaire peut accepter du texte et/ou un GIF GIPHY. Chaque commentaire peut également recevoir des réponses. Les commentaires de l’utilisateur peuvent être modifiés ou supprimés ; les commentaires des autres peuvent être signalés via le système de signalement. 

Les commentaires restent soumis aux éventuelles sanctions actives (canCommentInForum). 
Le composant Post intègre également la logique de modération :

masquer / restaurer une publication,
bannir l’auteur d’une publication du forum,
traiter les signalements via createForumReport(...).
Ces actions sont réservées aux rôles autorisés (canModerateForum, canBanForumUsers, isAdminLike). 

iv. ReportModal (signalement)
Le composant ReportModal affiche une fenêtre modale de signalement lorsqu’un utilisateur souhaite signaler une publication ou un commentaire. Il propose une liste de motifs prédéfinis (spam, insultes, discours de haine, violence, contenu NSFW, autre), ainsi qu’une zone de détail libre. Le signalement n’est envoyé que si un motif a été sélectionné, puis il est transmis au composant parent via onSubmit(reason, details). 
v. GiphyGifPicker (sélection de GIF GIPHY)
Le composant GiphyGifPicker permet de rechercher des GIF GIPHY ou d’afficher les tendances via les fonctions searchGiphyGifs(...) et getGiphyTrendingGifs(...). Il s’ouvre au-dessus des formulaires de publication ou de commentaire, permet de choisir un GIF, puis renvoie l’objet sélectionné au composant parent. Il s’appuie sur une clé d’API GIPHY lue via VITE_GIPHY_API_KEY. 

vi. Messagerie privée
Le composant PrivateMessages gère la messagerie privée entre deux utilisateurs. Il charge d’abord les autres membres disponibles via une requête sur profiles, puis l’utilisateur peut sélectionner un contact pour ouvrir une conversation. Les messages sont récupérés dans la table forum_private_messages en filtrant sur les couples sender_id / receiver_id, puis triés par date croissante. L’envoi d’un message se fait par insertion d’une nouvelle ligne dans forum_private_messages. 


vii. Service Supabase et utilitaires
Toute la logique d’accès aux données du forum est centralisée dans forumService.js. Ce fichier regroupe notamment les fonctions de lecture / écriture vers :

forum_posts,
forum_comments,
forum_likes,
forum_attachments,
forum_reports,
forum_user_sanctions,
forum_private_messages,
ainsi que le bucket de stockage forum-media.

Le fichier forumUtils.js contient les fonctions utilitaires liées au forum, notamment :

la normalisation des rôles,
les permissions de modération et de bannissement,
les restrictions de publication / commentaire selon les sanctions,
la validation du type et de la taille des fichiers,
le regroupement arborescent des commentaires,
le formatage des dates et tailles de fichiers,
la sécurisation des URLs externes.

viii. Tables et stockage utilisés
Le forum repose principalement sur les tables suivantes :

forum_posts pour les publications,
forum_comments pour les commentaires et réponses,
forum_likes pour les likes,
forum_attachments pour les pièces jointes (images, GIF, vidéos, PDF),
forum_reports pour les signalements,
forum_user_sanctions pour les restrictions d’accès au forum,
forum_private_messages pour la messagerie privée.
Les fichiers envoyés par les utilisateurs sont stockés dans le bucket Supabase forum-media. 



5. Partie Ressource

La partie Ressource du projet regroupe les composants React permettant de consulter et de gérer la médiathèque de bien-être (vidéos de relaxation, articles sur le sommeil, la concentration, etc.). Elle se base principalement sur la table ressources de Supabase et adapte son interface selon le rôle de l'utilisateur.

i. Ressources (Page principale et logique de tri)

Le composant Ressources est la vue principale. Lors du chargement de la page (via un useEffect), deux actions asynchrones sont effectuées :

Vérification du rôle : On récupère l'utilisateur connecté via supabase.auth.getUser(), puis on interroge la table profiles pour vérifier si son rôle est RH. Ce booléen (isRH) déterminera l'affichage des options de gestion.

Récupération des données : On effectue un fetch global sur la table ressources (SELECT *).

Une fois les données récupérées, le composant extrait dynamiquement toutes les catégories existantes dans la base de données (ex: Sommeil, Mental). Ainsi, les boutons de filtres ("chips") s'adaptent automatiquement au contenu réel de la base de données sans avoir besoin de les coder en dur. L'utilisateur peut cliquer sur ces filtres pour mettre à jour la grille de ressources affichée.

ii. Gestion CRUD (Système réservé aux RH)

Si l'utilisateur est identifié comme RH (isRH === true), l'interface se modifie pour afficher un bouton global "+ Ajouter une ressource", ainsi que des boutons "Modifier" et "Supprimer" sur chaque carte.

Ajout et Modification (Modal) : L'action d'ajout ou de modification ouvre une fenêtre modale superposée. Le formulaire (formData) est dynamique :

Il propose de choisir entre un type video ou article. Si "vidéo" est sélectionné, un champ pour l'URL YouTube Embed apparaît. Si "article" est sélectionné, c'est une zone de texte (textarea) qui s'affiche.

Le champ "Catégorie" utilise la balise HTML <datalist>, ce qui permet au RH de sélectionner une catégorie existante dans un menu déroulant, ou d'en taper une nouvelle (qui s'ajoutera automatiquement aux filtres généraux après sauvegarde).

À la soumission, un appel à Supabase est fait via .insert() (si création) ou .update() (si modification d'un editingId existant).

Suppression :
Au clic sur le bouton "Supprimer", une fenêtre de confirmation native (window.confirm) s'affiche pour éviter les erreurs. Si validée, une requête .delete() est envoyée à Supabase en ciblant l'id de la ressource, puis la liste locale est mise à jour.

iii. RessourceDetail (Lecteur et Vue Détaillée)

Plutôt que d'utiliser React Router et de changer d'URL (ce qui pourrait causer des erreurs 404), la navigation vers une ressource se fait par un système de "Vue Unique". Lorsqu'une ressource est cliquée, elle est stockée dans la variable d'état selectedRessource.

Le composant parent efface alors la grille pour afficher le composant enfant RessourceDetail, en lui passant la ressource en prop ainsi qu'une fonction de retour (onBack).

L'affichage s'adapte au type de la ressource :

Si video : Le composant intègre une balise iframe YouTube, encapsulée dans un conteneur CSS utilisant l'astuce du padding-bottom: 56.25% pour forcer un ratio 16:9 parfait et responsive.

Si article : Le composant affiche l'image d'illustration en bannière (img) et le contenu textuel. La propriété CSS white-space: pre-line est utilisée pour que les sauts de ligne tapés par le RH dans le formulaire soient respectés à l'affichage.

iv. Design et Dark Mode

L'ensemble de l'interface (grille, cartes, modal, lecteur) est géré par Ressources.css et RessourceDetail.css.
Le système intègre nativement une requête média @media (prefers-color-scheme: dark). Si le système d'exploitation de l'utilisateur (ou son navigateur) est configuré en mode sombre, toutes les couleurs (fonds de cartes, textes, fenêtres modales) basculent automatiquement vers des teintes sombres (gris anthracite et bleu-violet) pour réduire la fatigue oculaire, ce qui est particulièrement pertinent pour les ressources liées au sommeil et à la relaxation.

6. Partie Questionnaire

La partie Questionnaire du projet est regroupée dans un dossier Questionnaire contenant des composants React, elle se compose principalement d’un module permettant de créer un questionnaire et d’un autre permettant d’y répondre.

i. StartQuestionnaire

Il s’agit d’un composant React permettant aux RH uniquement de lancer un questionnaire auquel les employés pourront répondre. Ils ont deux options: utiliser le questionnaire par défaut fourni par l’application ou créer leur propre questionnaire personnalisé.

Les questions sont stockées dans une liste d’objets, chacun contenant:

- l’intitulé de la question
- son type de réponse parmi
  - émoji du moins expressif au plus expressif
  - de 1 à 10
  - oui/non
  - texte (pour laisser l’utilisateur répondre plus librement)
- s’il s’agit d’une question optionnelle ou non
- un indicateur de validation (utiliser lors la création de questionnaire personnalisés pour vérifier que les questions sont correctement remplies)

Nous utilisons une variable pour savoir quoi envoyer vers la base de données en fonction de s’il s’agit d’un questionnaire personnalisé ou non, si c’est le cas, on permet à la RH de rentrer ses questions et de les envoyer sinon on envoie les questions par défaut qui sont codées en dur.

Pour tout cela, on fait un fetch vers la base de données pour vérifier si un questionnaire est lancé, via l’attribut de type booléen active de la table questionnaire, si oui, on peut l’arrêter (les employés ne pourront plus y répondre) en mettant cet attribut à FALSE sinon on peut en lancer un.

Une fois que le questionnaire est créé, on peut le lancer, cela revient à envoyer vers la base de données un fichier JSON du tableau contenant toutes les questions.

ii. Questionnaire

Il s’agit également d’un composant React permettant aux employés uniquement cette fois-ci de répondre aux questionnaires lancés par les RH.

Pour cela, nous vérifions d’abord si un questionnaire est lancé c’est-à-dire vérifier dans la table questionnaire si l’attribut active est à TRUE pour l’id correspondant passé en prop. Si un questionnaire est lancé, alors on propose à l’employé de répondre au questionnaire s’il n’a pas encore répondu et dans le cas contraire il ne peut plus y répondre sinon on affiche le composant React NoQuestionnaire qu’on détaillera un peu plus tard.

Lorsqu’un employé répond au questionnaire, les questions s’affichent une à une, cet affichage est géré par le composant React AnswerInput que l’on verra juste après. L’employé a la possibilité de revenir une ou plusieurs questions en arrière pour changer sa ou ses réponse s’il le souhaite. Il est à noter qu’avant de répondre au questionnaire, le nombre de questions est indiqué à l’employé et que tout au long du questionnaire une barre de progression est affichée néanmoins s’il le souhaite, l’employé peut quitter à tout moment le questionnaire et revenir le recommencer une prochaine fois du moment qu’il ne l’a pas encore terminé.

Une fois que l’on a fini de répondre au questionnaire, on effectue un fetch pour envoyer chaque question associée à sa réponse au format JSON à la base de données. C’est de ce dernier que l’on vérifie si un employé a déjà répondu à un questionnaire ou non pour lui en empêcher l’accès.

iii. AnswerInput

Ce composant React est là pour gérer l’affichage/rendu des questions et est utilisé par Questionnaire.

L’affichage des questions dépend du type de la question :

- émoji: cinq boutons avec un émoji du moins expressif au plus expressif
- de 1 à 10: une petite zone de texte dans laquelle on peut rentrer uniquement un nombre entre 1 et 10 compris
- oui/non: deux boutons, l’un pour oui, l’autre pour non
- texte: une zone de texte assez large avec une certaine limite de caractère quand même

Mais également de si elle est optionnel ou non, dans ce cas-là on laisse la possibilité de passer la question.

Elle stocke les couples (question, réponse) dans une variable qu’elle renverra au composant Questionnaire pour qu’il puisse l’envoyer à la base de données.

iv. NoQuestionnaire

Ce composant a uniquement pour vocation d’afficher « Il n'y a pas de questionnaire disponible pour le moment ». Il est utilisé par Questionnaire lorsqu’aucun questionnaire n’est lancé.

7. Partie Psychobot

La partie Psychobot du projet est regroupée dans un dossier Psychobot contenant des composants React côté frontend et une application Django côté backend. Elle se compose d'un module d'analyse de questionnaire, d'un chat thérapeutique et d'un système de détection de burn-out.

i. Architecture générale
Le Psychobot repose sur deux couches :

Frontend : composants React qui affichent le chat et communiquent avec le backend via des appels fetch.
Backend Django (dossier psychobot/) : trois endpoints REST qui font appel au modèle Llama 3 via l'API Groq pour analyser les réponses et générer des messages personnalisés.

L'authentification entre le frontend et le backend est gérée par un middleware Django (middleware.py) qui vérifie le JWT Supabase transmis dans le header Authorization: Bearer <token> et injecte l'UUID de l'utilisateur dans chaque requête.

ii. Analyse du questionnaire
Une fois qu'un employé a soumis ses réponses au questionnaire, le frontend appelle l'endpoint POST /psychobot/questionnaire/ en transmettant le questionnaire_id.
Le backend récupère alors les réponses depuis la table reponse_questionnaire et les transmet au modèle IA. Les réponses peuvent être de plusieurs formats : emojis (😟 😐 😊), valeurs numériques de 1 à 10, oui/non, ou texte libre.
Le modèle retourne un score de 0 à 100 ainsi qu'une liste de signaux détectés. À partir de ce score, un niveau de risque est déterminé :

0–34 : aucun signal préoccupant
35–54 : léger, à surveiller
55–74 : modéré, intervention recommandée
75–100 : sévère, attention immédiate

Un message court à la troisième personne est ensuite généré par l'IA et stocké dans le champ commentaire_rh de la table alerte_burnout.

iii. Chat
L'employé peut ensuite ouvrir une session de chat avec PsychoBot. Chaque message est envoyé via POST /psychobot/chat/message/ avec l'historique complet de la conversation.
Au premier message de la session, le backend injecte discrètement dans le contexte les données clés du questionnaire (niveau de stress, charge de travail, isolement, humeur) sans les mentionner directement, afin que PsychoBot puisse personnaliser ses réponses de façon naturelle. Le prénom de l'employé est également récupéré depuis la table profiles.
Le backend réinjecte aussi les 10 derniers messages des conversations précédentes (table historique_chat) pour donner à PsychoBot une mémoire entre les sessions.
Après chaque message, le backend analyse la conversation pour détecter les besoins de l'employé et recommande une catégorie de ressource parmi : stress, sommeil, mental, sport, méditation.

iv. Clôture de session
Lorsque l'employé ferme le chat, le frontend appelle POST /psychobot/chat/fermer/. Le backend relit l'intégralité de la conversation et affine le score initial grâce au modèle IA, qui peut détecter des éléments aggravants ou rassurants non visibles dans le questionnaire seul.
Le score final et un résumé anonymisé sont stockés dans la table session_ia. Si le score dépasse 60, une nouvelle entrée est créée dans alerte_burnout avec un message généré par l'IA, visible par le RH dans la section Activité récente du Dashboard.
L'historique complet de la session est sauvegardé dans historique_chat pour les sessions futures.

8. Partie Paramètre

Accessible via le menu latéral ou l'icône avatar (route `/profile/:id`), ce composant permet à tout utilisateur de gérer son compte. Il fetch la table `profiles` (`id`, `role`, `nom`, `prenom`, `service`, `date_embauche`) et expose deux sections :

i. Mon compte — modification du mot de passe (min. 10 caractères, confirmation requise) via `supabase.auth.updateUser`. Email affiché en lecture seule.

ii. Informations personnelles — mise à jour de `nom`, `prenom`, `service`, `date_embauche` via `UPDATE` sur `profiles`. Le rôle est en lecture seule (modifiable uniquement par un RH depuis la page Employés).

9. Page Employés (RH uniquement)

Protégé par `RhSecuredRoute`, accessible via `/employees` ou le bouton « Voir les employés » du Dashboard RH. Affiche tous les profils de la table `profiles` triés par nom (colonnes : Nom, Prénom, Service, Date d'embauche, Rôle).

Un bouton « Modifier » par ligne ouvre un formulaire inline pour mettre à jour `nom`, `prenom`, `service`, `date_embauche` et `role` (EMPLOYE / RH) via `UPDATE` sur `profiles`. Un seul employé est modifiable à la fois ; les autres boutons sont désactivés le temps de l'édition.

10. Partie Notifications

Intégré dans `DashboardLayout`, le système est accessible via l'icône de cloche en haut à droite. Un badge rouge indique le nombre de notifications non lues (`SELECT COUNT` sur `notifications` où `user_id` et `is_read = false`, rafraîchi à chaque ouverture du panneau).

Un clic sur la cloche ouvre un popup listant les 100 dernières notifications (`type`, `title`, `body`, date, statut lu/non lu). Les non lues sont mises en évidence ; cliquer dessus les marque comme lues (`UPDATE is_read = true`). Un bouton « Tout marquer comme lu » traite toutes les non lues en une seule requête.

Pour les alertes burnout, le champ `body` identifie l'employé concerné (nom, prénom, niveau d'urgence). Le RH retrouve ces mêmes alertes dans la section « Activité récente » du Dashboard avec le nom de l'employé et le statut (`NOUVEAU`, `EN_COURS`, `TRAITE`), puis peut accéder au profil complet via `/employees`.

Tables : `notifications` (`id`, `user_id`, `type`, `title`, `body`, `is_read`, `created_at`) et `alerte_burnout`.f

11. Partie Feedback
  Cette page sert a afficher les retours IA issus des sessions PsychoBot de l'utilisateur connecte.

On recupere dans Supabase :

- id
- resume_anonymise
- score_risque
- created_at

Depuis la table :

- session_ia

On filtre avec :

- utilisateur_id = user.id

Donc normalement chaque employe ne voit que ses propres retours.

### Ce qui s'affiche

La page affiche :

- le nombre total de sessions chargees
- la date de la derniere session
- une petite "astuce du jour"
- la liste des retours ecrits

Si resume_anonymise est vide, un texte par defaut est affiche pour ne pas laisser une carte vide.

### Rafraichissement temps reel

Comme pour le dashboard, il y a un channel Supabase qui ecoute les changements de la table session_ia pour l'utilisateur courant.

Des qu'une session est ajoutee ou modifiee, la liste peut se mettre a jour automatiquement.

Réalisé par

- Mohamed ALDYAB
- Oualid FELKAOUI
- Abderrahim HERMEZ
- Lylia AIT-MOKHTAR
- Rayane HEBBACHE
- Nassim ICHCHOU