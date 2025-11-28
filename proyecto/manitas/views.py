from django.shortcuts import render, redirect
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import authenticate, login, logout
from .forms import RegistroForm
from django.contrib import messages
from social_django.models import UserSocialAuth
from django.contrib.auth.decorators import login_required
from .forms import PerfilForm
from .models import Perfil


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

#Lecciones
def lecciones(request):
    return render(request, 'lecciones.html')

def leccion1(request):
    return render(request, 'leccion1.html')

def leccion2(request):
    return render(request, 'leccion2.html')

def leccion3(request):
    return render(request, 'leccion3.html')

def leccion4(request):
    return render(request, 'leccion4.html')

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
            login(request, usuario)
            messages.success(request, "Cuenta creada con éxito. ¡Bienvenido a Manitas SV!")
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
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            usuario = authenticate(username=username, password=password)
            if usuario is not None:
                login(request, usuario)
                messages.success(request, f"Bienvenido {usuario.username} 👋")
                return redirect('home')
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