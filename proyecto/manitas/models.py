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


class SignStandard(models.Model):
    """Modelo para almacenar estándares de señas (imágenes y videos) para entrenamiento"""
    
    MEDIA_TYPE_CHOICES = [
        ('image', 'Imagen'),
        ('video', 'Video'),
    ]
    
    CATEGORY_CHOICES = [
        ('alfabeto', 'Alfabeto'),
        ('numeros', 'Números'),
        ('departamentos', 'Departamentos'),
        ('saludos', 'Saludos Básicos'),
    ]
    
    exercise_id = models.CharField(max_length=100, help_text="ID del ejercicio (ej: A, NUM_3, DEPT_SAN_MIGUEL, HOLA)")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    media_file = models.FileField(
        upload_to='sign_standards/',
        help_text="Subí una imagen para letras/números o un video para departamentos/saludos"
    )
    description = models.TextField(blank=True, help_text="Descripción opcional del estándar")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, help_text="Indica si este estándar está activo")
    
    class Meta:
        verbose_name = "Estándar de Seña"
        verbose_name_plural = "Estándares de Señas"
        ordering = ['category', 'exercise_id']
        unique_together = [['exercise_id', 'category', 'media_type']]
    
    def __str__(self):
        return f"{self.get_category_display()} - {self.exercise_id} ({self.get_media_type_display()})"