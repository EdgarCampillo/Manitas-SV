from django.db import models
from django.contrib.auth.models import User

# Create your models here.

def default_perfil_image():
    return 'img/perfil.png'  

class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to='perfil_images/', default=default_perfil_image)

    def __str__(self):
        return f'Perfil de {self.user.username}'