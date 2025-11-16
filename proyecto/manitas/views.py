from django.shortcuts import render

# Create your views here.

def home(request):
    return render(request, "home.html")

def diccionario_visual(request):
    letras = [chr(i) for i in range(65, 91)]  # A-Z
    return render(request, 'diccionario_visual.html', {'letras': letras})

def lecciones(request, ):
    return render(request, 'lecciones.html')

def registrate(request):
    return render(request, 'registrate.html')

def login(request):
    return render(request, 'login.html')