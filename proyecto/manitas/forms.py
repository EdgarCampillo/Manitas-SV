from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

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