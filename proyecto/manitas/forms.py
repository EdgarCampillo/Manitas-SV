from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import Perfil

class RegistroForm(UserCreationForm):
    nombre_completo = forms.CharField(
        max_length=150,
        required=True,
        label="Nombre completo",
        widget=forms.TextInput(attrs={'placeholder': 'Ejemplo: María López'})
    )
    email = forms.EmailField(
        required=True,
        label="Correo electrónico",
        widget=forms.EmailInput(attrs={'placeholder': 'ejemplo@correo.com'})
    )

    class Meta:
        model = User
        fields = ("nombre_completo", "username", "email", "password1", "password2")

    def clean_email(self):
        """Valida que el correo electrónico no esté ya en uso"""
        email = self.cleaned_data.get('email')
        if email:
            # Verificar si ya existe un usuario con este correo
            if User.objects.filter(email=email).exists():
                raise forms.ValidationError(
                    "Este correo electrónico ya está siendo usado. Por favor, usá otro correo o iniciá sesión."
                )
        return email

    def save(self, commit=True):
        user = super().save(commit=False)
        nombre = self.cleaned_data.get("nombre_completo")
        if nombre:
            partes = nombre.split(" ", 1)
            user.first_name = partes[0]
            user.last_name = partes[1] if len(partes) > 1 else ""
        user.email = self.cleaned_data.get("email")
       
        if commit:
            user.save()
        return user
    
class PerfilForm(forms.ModelForm):
    
    first_name = forms.CharField(label="Nombre", max_length=30, required=False)
    last_name = forms.CharField(label="Apellido", max_length=30, required=False)
    username = forms.CharField(label="Usuario", max_length=30)
    email = forms.EmailField(label="Correo electrónico", required=False)

    class Meta:
        model = Perfil
        fields = ['image']

    def __init__(self, *args, **kwargs):
        user = kwargs.pop('instance', None)
        perfil = None
        if user and hasattr(user, 'perfil'):
            perfil = user.perfil
        super().__init__(*args, **kwargs)
        if user:
            self.fields['first_name'].initial = user.first_name
            self.fields['last_name'].initial = user.last_name
            self.fields['username'].initial = user.username
            self.fields['email'].initial = user.email
        if perfil:
            self.instance = perfil

    def save(self, commit=True):
        perfil = super().save(commit=False)
        user = perfil.user
        user.first_name = self.cleaned_data['first_name']   
        user.last_name = self.cleaned_data['last_name']
        user.username = self.cleaned_data['username']
        user.email = self.cleaned_data['email']
        if commit:
            user.save()
            perfil.save()
        return perfil