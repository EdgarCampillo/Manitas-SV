from django.contrib.auth.models import User

def mark_new_user(strategy, details, backend, user=None, is_new=False, *args, **kwargs):
    """
    Pipeline que marca usuarios nuevos para redirigirlos a completar datos.
    """
    # Si es un usuario nuevo, guardar flag en sesión
    if is_new and user:
        strategy.session_set('new_google_user', True)
        strategy.session_set('pending_email', user.email)
        strategy.session_set('pending_nombre', f"{user.first_name} {user.last_name}".strip() or user.username)
    return {}