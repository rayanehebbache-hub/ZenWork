import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import connection
 
from .services import (
    compute_burnout_score,
    chat_with_gemini,
    update_score_from_chat,
    determine_level,
    build_context_prefix,
    generate_commentaire_rh,
    detect_besoins_ressources,
)
 
# ─────────────────────────────────────────────
# REQUÊTES SQL SUPABASE
# ─────────────────────────────────────────────
 
def _get_reponses_et_utilisateur(questionnaire_id):
    """
    Retourne (reponses_dict, utilisateur_id) depuis reponse_questionnaire.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT reponse_json, utilisateur_id FROM reponse_questionnaire WHERE id = %s",
            [questionnaire_id]
        )
        row = cursor.fetchone()
        if not row:
            return None, None
        reponse, utilisateur_id = row[0], row[1]
        while isinstance(reponse, str):
            try:
                reponse = json.loads(reponse)
            except (json.JSONDecodeError, ValueError):
                break
        return (reponse if isinstance(reponse, dict) else None), utilisateur_id


def _niveau_urgence_from_level(level):
    """Aligné avec determine_level : low/medium/high → 1/2/3 pour alerte_burnout."""
    if level == "high":
        return 3
    if level == "medium":
        return 2
    if level == "low":
        return 1
    return None


def _upsert_alerte_burnout(utilisateur_id, niveau, score, raisons):
    """
    Écrit dans alerte_burnout (liée à profiles.id via utilisateur_id).
    On n'utilise plus psychobot_alerteburnout dont la FK pointe vers
    psychobot_questionnairereponse — table incompatible avec reponse_questionnaire.
    """
    commentaire = generate_commentaire_rh(score, raisons)
    niveau_urgence = _niveau_urgence_from_level(niveau)
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO alerte_burnout (
                utilisateur_id, statut, commentaire_rh, niveau_urgence, created_at
            )
            VALUES (%s, 'NOUVEAU', %s, %s, NOW())
            RETURNING id
            """,
            [utilisateur_id, commentaire, niveau_urgence],
        )
        return cursor.fetchone()[0]


def _insert_session_ia(utilisateur_id, score_risque, resume_anonymise=None):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO session_ia (utilisateur_id, score_risque, resume_anonymise)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            [utilisateur_id, score_risque, resume_anonymise]
        )
        return cursor.fetchone()[0]
 
 
# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────
 
@csrf_exempt
@require_POST
def analyze_questionnaire(request):
    print(">>> analyze_questionnaire appelé")

    try:
        utilisateur_id = request.supabase_user_id
    except AttributeError:
        return JsonResponse({"error": "Non authentifié"}, status=401)
 
    if not utilisateur_id:
        return JsonResponse({"error": "Non authentifié"}, status=401)
 
    data             = json.loads(request.body)
    questionnaire_id = data.get("questionnaire_id")
 
    if not questionnaire_id:
        return JsonResponse({"error": "questionnaire_id manquant"}, status=400)
 
    reponses, uid_from_db = _get_reponses_et_utilisateur(questionnaire_id)
    if not reponses:
        return JsonResponse({"error": "Questionnaire introuvable en BDD"}, status=404)

    # Sécurité : l'utilisateur connecté doit être le propriétaire de la réponse
    if uid_from_db and str(uid_from_db) != str(utilisateur_id):
        return JsonResponse({"error": "Accès non autorisé"}, status=403)
 
    result            = compute_burnout_score(reponses)
    score_initial     = result["score"]
    niveau_initial    = determine_level(score_initial)
    raisons_initiales = result["raisons"]
 
    alerte_id = _upsert_alerte_burnout(utilisateur_id, niveau_initial, score_initial, raisons_initiales)
 
    return JsonResponse({
        "alerte_id":     alerte_id,
        "score_initial": score_initial,
        "niveau":        niveau_initial,
        "raisons":       raisons_initiales
    })
 
 
@csrf_exempt
@require_POST
def send_chat_message(request):
    try:
        utilisateur_id = request.supabase_user_id
    except AttributeError:
        return JsonResponse({"error": "Non authentifié"}, status=401)

    if not utilisateur_id:
        return JsonResponse({"error": "Non authentifié"}, status=401)

    data             = json.loads(request.body)
    history          = data.get("history", [])
    user_message     = data.get("message", "")
    questionnaire_id = data.get("questionnaire_id")
    score_actuel     = data.get("score_actuel", 0) 

    # Réinjecte l'historique passé au 1er message de la session
    if len(history) <= 1:
        historique_passe = _get_historique(utilisateur_id, limit=10)
        if historique_passe:
            history = historique_passe + history

    prefix = ""
    if len(history) == 1 and questionnaire_id:
        reponses, _ = _get_reponses_et_utilisateur(questionnaire_id)
        if reponses:
            prefix = build_context_prefix(reponses)

     # Récupère le prénom et injecte dans le contexte
    profil = _get_profil_employe(utilisateur_id)
    if profil and profil.get("prenom"):
        prefix = f"[INFO INTERNE — NE PAS MENTIONNER DIRECTEMENT] L'employé s'appelle {profil['prenom']} {profil.get('nom', '')}. Utilise son prénom naturellement dans la conversation. " + prefix
    
    bot_response = chat_with_gemini(history, user_message, prefix)

    # Détection des besoins après chaque message
    history_complet = history + [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": bot_response},
    ]
    besoins = detect_besoins_ressources(history_complet, score_actuel)

    return JsonResponse({
    "response":            bot_response,
    "categorie_ressource": besoins.get("categorie"),
    "urgence":             besoins.get("urgence", False),
    "message_redirection": besoins.get("message_redirection"),
    })
 
@csrf_exempt
@require_POST
def close_chat_session(request):
    try:
        utilisateur_id = request.supabase_user_id
    except AttributeError:
        return JsonResponse({"error": "Non authentifié"}, status=401)

    if not utilisateur_id:
        return JsonResponse({"error": "Non authentifié"}, status=401)

    try:
        data            = json.loads(request.body)
        history         = data.get("history", [])
        initial_score   = data.get("score_initial", 0)
        initial_raisons = data.get("raisons_initiales", [])

        new_data        = update_score_from_chat(history, initial_score, initial_raisons)
        score_final     = new_data["score"]
        raisons_finales = new_data["raisons"]
        niveau_final    = determine_level(score_final)
        resume          = " | ".join(raisons_finales) if raisons_finales else "Aucun signal."

        print(f">>> score_final : {score_final}")

        # Stocke dans session_ia
        _insert_session_ia(utilisateur_id, score_final, resume)

        # Si score dépasse 60 → alerte
        if score_final >= 60:
            commentaire = generate_commentaire_rh(score_final, raisons_finales)
            niveau_urgence = _niveau_urgence_from_level(niveau_final)
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO alerte_burnout (
                        utilisateur_id, statut, commentaire_rh, niveau_urgence
                    )
                    VALUES (%s, 'NOUVEAU', %s, %s)
                    """,
                    [utilisateur_id, commentaire, niveau_urgence],
                )
        # Sauvegarde l'historique
        _save_historique(utilisateur_id, history)
        return JsonResponse({
            "status":       "Session clôturée",
            "score_final":  score_final,
            "niveau_final": niveau_final,
            "raisons":      raisons_finales,
        })

    except Exception as e:
        print(f">>> Erreur : {e}")
        return JsonResponse({"error": str(e)}, status=500)
    
def _save_historique(utilisateur_id, messages):
    """Sauvegarde tous les messages de la session."""
    with connection.cursor() as cursor:
        for msg in messages:
            role    = msg.get("role", "user")
            contenu = msg.get("content", msg.get("contenu", ""))
            if contenu:
                cursor.execute(
                    """
                    INSERT INTO historique_chat (utilisateur_id, role, contenu)
                    VALUES (%s, %s, %s)
                    """,
                    [utilisateur_id, role, contenu]
                )


def _get_historique(utilisateur_id, limit=10):
    """Récupère les derniers messages pour contexte."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT role, contenu FROM historique_chat
            WHERE utilisateur_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            [utilisateur_id, limit]
        )
        rows = cursor.fetchall()
        # Inverse pour avoir l'ordre chronologique
        return [{"role": r[0], "content": r[1]} for r in reversed(rows)]

def _get_profil_employe(utilisateur_id):
    """Récupère le prénom et nom de l'employé depuis profiles."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT prenom, nom FROM profiles WHERE id = %s",
            [utilisateur_id]
        )
        row = cursor.fetchone()
        if row:
            return {"prenom": row[0], "nom": row[1]}
        return None