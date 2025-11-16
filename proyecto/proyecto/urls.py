from django.contrib import admin
from django.urls import path
from manitas import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('',views.home, name='home'),
    path('home/', views.home, name="home"),
    path('diccionario/', views.diccionario_visual, name="diccionario_visual"),
    path('lecciones/', views.lecciones, name="lecciones"),
    path('registrate/', views.registrate, name="registrate"),
    path('login/', views.login, name="login"),
]
