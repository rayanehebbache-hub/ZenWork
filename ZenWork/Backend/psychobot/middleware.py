import jwt
import requests
from django.http import JsonResponse
 
 
SUPABASE_URL    = "https://jefgjiihtfkwbizbdmvq.supabase.co"
SUPABASE_JWKS   = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
 
_jwks_cache = None
 
def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        _jwks_cache = requests.get(SUPABASE_JWKS).json()
    return _jwks_cache
 
 
class SupabaseAuthMiddleware:
    """
    Lit le header Authorization: Bearer <token>,
    vérifie le JWT Supabase et injecte request.supabase_user_id.
    """
    def __init__(self, get_response):
        self.get_response = get_response
 
    def __call__(self, request):
        request.supabase_user_id = None
 
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "").strip()
            try:
                # Décode sans vérification pour lire le kid
                header     = jwt.get_unverified_header(token)
                kid        = header.get("kid")
                jwks       = get_jwks()
 
                # Trouve la clé correspondante
                public_key = None
                for key in jwks.get("keys", []):
                    if key.get("kid") == kid:
                        public_key = jwt.algorithms.ECAlgorithm.from_jwk(key)
                        break
 
                if public_key:
                    payload = jwt.decode(
                        token,
                        public_key,
                        algorithms=["ES256"],
                        audience="authenticated",
                    )
                    request.supabase_user_id = payload.get("sub")
 
            except Exception as e:
                print(f"[SupabaseAuthMiddleware] Erreur JWT : {e}")
                request.supabase_user_id = None
 
        return self.get_response(request)