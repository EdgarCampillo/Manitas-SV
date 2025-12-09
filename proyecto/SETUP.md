# Configuración del Proyecto Manitas

> **Nota para GitHub:** Este proyecto está configurado para ser seguro en repositorios públicos. El archivo `.env` con credenciales reales NO se sube al repositorio.

## Configuración de Base de Datos PostgreSQL

Este proyecto usa PostgreSQL como base de datos. Para configurarlo:

### Paso 1: Crear el archivo .env

Copia el archivo `database_config.env.example` a `.env` en el mismo directorio:

```bash
copy database_config.env.example .env
```


### Paso 2: Configurar las credenciales

**Opción A - Usar credenciales compartidas (Recomendado para el equipo):**

Si todos van a usar la misma base de datos compartida, simplemente copia las credenciales que el administrador del proyecto te proporcione. Estas credenciales deben ir en tu archivo `.env`:

```
DB_NAME=manitas_db
DB_USER=postgres
DB_PASSWORD=la_contraseña_compartida
DB_HOST=localhost
DB_PORT=5432
```

**Opción B - Usar tu propia base de datos:**

Si prefieres usar tu propia base de datos local, edita el archivo `.env` con tus propias credenciales de PostgreSQL.

**📋 Variables necesarias en el archivo `.env`:**

Además de las credenciales de la base de datos, asegúrate de incluir estas variables si las necesitas:

```
# Base de datos (OBLIGATORIO)
DB_NAME=manitas_db
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432

# Django Secret Key (OBLIGATORIO)
SECRET_KEY=tu_secret_key

# Email (si usas recuperación de contraseña)
EMAIL_HOST_USER=tu_email@gmail.com
EMAIL_HOST_PASSWORD=tu_app_password

# Google OAuth2 (si usas login con Google)
GOOGLE_OAUTH2_KEY=tu_key
GOOGLE_OAUTH2_SECRET=tu_secret

# Admin compartido (opcional)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### Paso 3: Aplicar las migraciones

Una vez configurada la base de datos, ejecuta las migraciones:

```bash
python manage.py migrate
```

### Paso 4: Crear el superusuario compartido

Para acceder al panel de administración con las credenciales compartidas, ejecuta:

```bash
python manage.py setup_admin
```

Esto creará un superusuario con las credenciales configuradas en el archivo `.env`:
- Usuario: `admin` (o el valor de `ADMIN_USERNAME` en .env)
- Contraseña: `admin123` (o el valor de `ADMIN_PASSWORD` en .env)

**Nota:** Si prefieres crear tu propio superusuario, puedes usar el comando tradicional:
```bash
python manage.py createsuperuser
```

## Configuración de Google OAuth2

Si necesitas configurar el login con Google, edita el archivo `.env` y agrega:

```
GOOGLE_OAUTH2_KEY=tu_google_oauth2_key
GOOGLE_OAUTH2_SECRET=tu_google_oauth2_secret
```

## Requisitos

Asegúrate de tener instaladas las dependencias:

```bash
pip install -r requirements.txt
```

