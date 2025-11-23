from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import authenticate, login, logout
from .forms import RegistroForm
from django.contrib import messages


# Create your views here.

def home(request):
    return render(request, "home.html")

def diccionario_visual(request):
    letras = [chr(i) for i in range(65, 91)]  # A-Z
    return render(request, 'diccionario_visual.html', {'letras': letras})

def lecciones(request):
    return render(request, 'lecciones.html')

def nosotros(request):
    return render(request, 'nosotros.html')

def contacto(request):
    return render(request, 'contacto.html')

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