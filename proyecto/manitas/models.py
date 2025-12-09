from django.db import models
from django.contrib.auth.models import User

# Create your models here.

def default_perfil_image():
    return 'img/perfil.png'  

class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to='perfil_images/', blank=True, null=True)

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
    # Mantener media_file para compatibilidad hacia atrás
    media_file = models.FileField(
        upload_to='sign_standards/',
        blank=True,
        null=True,
        help_text="Archivo principal (deprecated, usar media_files)"
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
    
    def get_media_files(self):
        """Obtiene todos los archivos multimedia asociados a este estándar"""
        return self.media_files.all().order_by('order', 'id')


class SignStandardMedia(models.Model):
    """Modelo para almacenar múltiples archivos multimedia por estándar"""
    
    HAND_CHOICES = [
        ('ambas', 'Ambas manos'),
        ('izquierda', 'Mano izquierda'),
        ('derecha', 'Mano derecha'),
    ]
    
    standard = models.ForeignKey(SignStandard, on_delete=models.CASCADE, related_name='media_files')
    media_file = models.FileField(
        upload_to='sign_standards/',
        help_text="Archivo multimedia (imagen o video)"
    )
    hand_preference = models.CharField(
        max_length=10,
        choices=HAND_CHOICES,
        default='ambas',
        help_text="Preferencia de mano para esta variante"
    )
    variant_description = models.CharField(
        max_length=200,
        blank=True,
        help_text="Descripción de la variante (ej: 'Vista frontal', 'Vista lateral')"
    )
    order = models.PositiveIntegerField(default=0, help_text="Orden de visualización")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Archivo Multimedia del Estándar"
        verbose_name_plural = "Archivos Multimedia de Estándares"
        ordering = ['standard', 'order', 'id']
    
    def __str__(self):
        return f"{self.standard.exercise_id} - {self.get_hand_preference_display()} ({self.variant_description or 'Sin descripción'})"