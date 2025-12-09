from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Perfil

@receiver(post_save, sender=User)
def crear_perfil_usuario(sender, instance, created, **kwargs):
    """Crea un perfil automáticamente cuando se crea un usuario"""
    if created:
        # Crear perfil sin imagen (se mostrará la imagen por defecto en los templates)
        Perfil.objects.get_or_create(user=instance)

@receiver(post_save, sender=User)
def guardar_perfil_usuario(sender, instance, **kwargs):
    """Asegura que el perfil exista cuando se guarda un usuario"""
    try:
        instance.perfil
    except Perfil.DoesNotExist:
        # Si no existe perfil, crearlo
        Perfil.objects.create(user=instance)
