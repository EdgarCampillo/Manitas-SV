from django.shortcuts import render, redirect
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import authenticate, login, logout
from .forms import RegistroForm
from django.contrib import messages
from social_django.models import UserSocialAuth
from django.contrib.auth.decorators import login_required, user_passes_test
from .forms import PerfilForm
from .models import Perfil, SignStandard
from django.http import JsonResponse, HttpResponseForbidden, HttpResponseBadRequest, FileResponse, Http404
from django.conf import settings
from django.views.decorators.http import require_http_methods
import os, datetime, json


# Create your views here.

def home(request):
    return render(request, "home.html")

def diccionario_visual(request):
    letras = [chr(i) for i in range(65, 91)]  # A-Z
    return render(request, 'diccionario_visual.html', {'letras': letras})


def nosotros(request):
    return render(request, 'nosotros.html')

def contacto(request):
    return render(request, 'contacto.html')

#Lecciones - Requieren login
@login_required
def lecciones(request):
    return render(request, 'lecciones.html')

@login_required
def leccion1(request):
    return render(request, 'leccion1.html')

@login_required
def leccion2(request):
    return render(request, 'leccion2.html')

@login_required
def leccion3(request):
    return render(request, 'leccion3.html')

@login_required
def leccion4(request):
    return render(request, 'leccion4.html')

@login_required
def ejercicios(request):
    return render(request, 'ejercicios.html')

#registro, login, logout, perfil
def registrate(request):
    if request.method == 'POST':
        form = RegistroForm(request.POST)
        if form.is_valid():
            usuario = form.save(commit=False)
            nombre = form.cleaned_data['nombre_completo']
            partes = nombre.split(' ', 1)
            usuario.first_name = partes[0]
            usuario.last_name = partes[1] if len(partes) > 1 else ''
            usuario.save()
            login(request, usuario, backend='django.contrib.auth.backends.ModelBackend')
            messages.success(request, "Cuenta creada con éxito.")
            return redirect('home')
    else:
        form = RegistroForm()
    return render(request, 'registrate.html', {'form': form})

def registrate_google(request):
    email = request.session.get('pending_email')
    nombre = request.session.get('pending_nombre')
    if not email:
        return redirect('registrate')

    if request.method == 'POST':
        form = RegistroForm(request.POST)
        if form.is_valid():
            usuario = form.save(commit=False)
            usuario.email = email 
            partes = form.cleaned_data['nombre_completo'].split(' ', 1)
            usuario.first_name = partes[0]
            usuario.last_name = partes[1] if len(partes) > 1 else ''
            usuario.save()
            login(request, usuario, backend='django.contrib.auth.backends.ModelBackend')
            messages.success(request, "Cuenta creada con Google. ¡Bienvenido a Manitas SV!")
            return redirect('home')
    else:
        form = RegistroForm(initial={'email': email, 'nombre_completo': nombre})

    return render(request, 'registrate_google.html', {'form': form})

@login_required
def perfil_view(request):
    user = request.user
    perfil, created = Perfil.objects.get_or_create(user=user)

    if request.method == 'POST':
        form = PerfilForm(request.POST, request.FILES, instance=user)
        if form.is_valid():
            form.save()
            return redirect('perfil')
    else:
        form = PerfilForm(instance=user)

    return render(request, 'perfil.html', {'form': form, 'perfil': perfil})

def login_view(request):
    # Mostrar mensaje si fue redirigido desde una página protegida
    if request.GET.get('next'):
        messages.info(request, "Por favor, iniciá sesión para acceder a esta sección.")
    
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            usuario = authenticate(username=username, password=password)
            if usuario is not None:
                login(request, usuario)
                messages.success(request, f"Bienvenido {usuario.username} 👋")
                # Redirigir a la página que intentaba acceder o a home
                next_url = request.GET.get('next', 'home')
                return redirect(next_url)
            else:
                messages.error(request, "Usuario o contraseña incorrectos.")
        else:
            messages.error(request, "Usuario o contraseña incorrectos.")
    else:
        form = AuthenticationForm()
    return render(request, 'login.html', {'form': form})


def logout_view(request):
    logout(request)
    messages.info(request, "Has cerrado sesión correctamente.")
    return redirect('home')


@login_required
def upload_samples(request):
    """Endpoint seguro para que administradores suban muestras de entrenamiento (JSON).
    Requiere usuario logueado y `is_staff` True.
    Guarda el archivo en MEDIA_ROOT/samples/ y devuelve la ruta pública.
    """
    if not request.user.is_staff:
        return HttpResponseForbidden('Acceso denegado')

    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        body = request.body.decode('utf-8')
        obj = json.loads(body)
    except Exception as e:
        return HttpResponseBadRequest('JSON inválido')

    samples_dir = os.path.join(settings.MEDIA_ROOT, 'samples')
    os.makedirs(samples_dir, exist_ok=True)
    filename = datetime.datetime.now().strftime('samples_%Y%m%d_%H%M%S.json')
    filepath = os.path.join(samples_dir, filename)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False)
        public_url = settings.MEDIA_URL + 'samples/' + filename
        return JsonResponse({'status': 'ok', 'file': public_url})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def is_staff_user(user):
    """Verifica si el usuario es staff/admin"""
    return user.is_authenticated and user.is_staff


@user_passes_test(is_staff_user)
@login_required
def admin_train_signs(request):
    """Vista para que el admin gestione los estándares de señas"""
    standards = SignStandard.objects.filter(is_active=True).order_by('category', 'exercise_id')
    
    # Agrupar por categoría
    standards_by_category = {}
    for standard in standards:
        if standard.category not in standards_by_category:
            standards_by_category[standard.category] = []
        standards_by_category[standard.category].append(standard)
    
    return render(request, 'admin_train_signs.html', {
        'standards': standards,
        'standards_by_category': standards_by_category
    })


@require_http_methods(["GET", "POST"])
@login_required
def api_sign_standards(request):
    """API para obtener estándares de señas. Solo imágenes para usuarios normales, videos solo para admins."""
    if request.method == 'GET':
        category = request.GET.get('category', None)
        exercise_id = request.GET.get('exercise_id', None)
        
        filters = {'is_active': True}
        if category:
            filters['category'] = category
        if exercise_id:
            filters['exercise_id'] = exercise_id
        
        # Si no es admin, solo devolver imágenes
        if not request.user.is_staff:
            filters['media_type'] = 'image'
        
        standards = SignStandard.objects.filter(**filters)
        
        data = []
        for std in standards:
            data.append({
                'id': std.id,
                'exercise_id': std.exercise_id,
                'category': std.category,
                'media_type': std.media_type,
                'media_url': std.media_file.url if std.media_file else None,
                'description': std.description
            })
        
        return JsonResponse({'standards': data})
    
    elif request.method == 'POST':
        # Solo admins pueden crear estándares
        if not request.user.is_staff:
            return HttpResponseForbidden('Acceso denegado')
        
        try:
            exercise_id = request.POST.get('exercise_id')
            category = request.POST.get('category')
            media_type = request.POST.get('media_type')
            description = request.POST.get('description', '')
            media_file = request.FILES.get('media_file')
            
            if not all([exercise_id, category, media_type, media_file]):
                return JsonResponse({'error': 'Faltan campos requeridos'}, status=400)
            
            # Validar que el tipo de media sea correcto según la categoría
            if category in ['alfabeto', 'numeros'] and media_type != 'image':
                return JsonResponse({
                    'error': 'Para alfabeto y números solo se permiten imágenes'
                }, status=400)
            
            if category in ['departamentos', 'saludos'] and media_type != 'video':
                return JsonResponse({
                    'error': 'Para departamentos y saludos solo se permiten videos'
                }, status=400)
            
            # Crear o actualizar el estándar
            standard, created = SignStandard.objects.update_or_create(
                exercise_id=exercise_id,
                category=category,
                media_type=media_type,
                defaults={
                    'media_file': media_file,
                    'description': description,
                    'is_active': True
                }
            )
            
            return JsonResponse({
                'status': 'ok',
                'message': 'Estándar creado' if created else 'Estándar actualizado',
                'standard': {
                    'id': standard.id,
                    'exercise_id': standard.exercise_id,
                    'category': standard.category,
                    'media_type': standard.media_type,
                    'media_url': standard.media_file.url
                }
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


@login_required
def serve_sign_video(request, standard_id):
    """Sirve videos de estándares solo a usuarios admin"""
    try:
        standard = SignStandard.objects.get(id=standard_id, is_active=True)
        
        # Solo admins pueden ver videos
        if standard.media_type == 'video' and not request.user.is_staff:
            return HttpResponseForbidden('Acceso denegado: Solo administradores pueden ver videos')
        
        if not standard.media_file:
            raise Http404("Archivo no encontrado")
        
        file_path = standard.media_file.path
        if not os.path.exists(file_path):
            raise Http404("Archivo no encontrado")
        
        return FileResponse(open(file_path, 'rb'), content_type='video/mp4')
    except SignStandard.DoesNotExist:
        raise Http404("Estándar no encontrado")