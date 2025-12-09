"""
Comando de gestión para crear el superusuario compartido del proyecto.
Ejecuta: python manage.py setup_admin
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decouple import config

User = get_user_model()


class Command(BaseCommand):
    help = 'Crea el superusuario compartido para el proyecto'

    def handle(self, *args, **options):
        # Credenciales del admin compartido (puedes cambiarlas aquí o usar variables de entorno)
        admin_username = config('ADMIN_USERNAME', default='admin')
        admin_email = config('ADMIN_EMAIL', default='admin@manitas.com')
        admin_password = config('ADMIN_PASSWORD', default='admin123')

        # Verificar si el usuario ya existe
        if User.objects.filter(username=admin_username).exists():
            self.stdout.write(
                self.style.WARNING(f'El usuario "{admin_username}" ya existe.')
            )
            # Actualizar la contraseña por si acaso
            user = User.objects.get(username=admin_username)
            user.set_password(admin_password)
            user.is_superuser = True
            user.is_staff = True
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f'Contraseña del usuario "{admin_username}" actualizada.')
            )
        else:
            # Crear el superusuario
            User.objects.create_superuser(
                username=admin_username,
                email=admin_email,
                password=admin_password
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Superusuario "{admin_username}" creado exitosamente.\n'
                    f'Usuario: {admin_username}\n'
                    f'Contraseña: {admin_password}'
                )
            )

