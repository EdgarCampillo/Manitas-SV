from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

class RegistroForm(UserCreationForm):
    nombre_completo = forms.CharField(max_length=150, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'nombre_completo', 'password1', 'password2']
