from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Perfil

@receiver(post_save, sender=User)
def crear_perfil_usuario(sender, instance, created, **kwargs):
    if created:
        perfil = Perfil.objects.create(user=instance)
        # Establecer imagen por defecto si no se proporciona
        if not perfil.image:
            perfil.image = 'img/perfil.png'
            perfil.save()

@receiver(post_save, sender=User)
def guardar_perfil_usuario(sender, instance, **kwargs):
    try:
        instance.perfil.save()
        # Asegurar que siempre haya una imagen (por defecto si no hay)
        if not instance.perfil.image:
            instance.perfil.image = 'img/perfil.png'
            instance.perfil.save()
    except Perfil.DoesNotExist:
        perfil = Perfil.objects.create(user=instance)
        if not perfil.image:
            perfil.image = 'img/perfil.png'
            perfil.save()
