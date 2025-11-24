from django.shortcuts import redirect

def require_extra_data(strategy, details, user=None, *args, **kwargs):
    if user:
        return  

    email = details.get('email')
    nombre = details.get('fullname')

    if not email:
        return strategy.redirect('/registrate')

    
    strategy.session_set('pending_email', email)
    strategy.session_set('pending_nombre', nombre)

    return strategy.redirect('/registrate_google')