# Proyecto Manitas

Aplicación web para el aprendizaje de lenguaje de señas salvadoreño.

## 🚀 Inicio Rápido

### Requisitos Previos

- Python 3.10 o superior
- PostgreSQL 12 o superior
- pip (gestor de paquetes de Python)

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd proyecto
   ```

2. **Crear y activar entorno virtual** (recomendado)
   ```bash
   python -m venv entorno
   # En Windows:
   entorno\Scripts\activate
   # En Linux/Mac:
   source entorno/bin/activate
   ```

3. **Instalar dependencias**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configurar variables de entorno**
   
   **Para usar la base de datos compartida del equipo:**
   
   Pide al administrador del proyecto las credenciales compartidas y créalas en un archivo `.env`:
   ```bash
   copy database_config.env.example .env
   ```
   
   Luego edita el archivo `.env` y pega las credenciales que te proporcionó el administrador. Debe verse algo así:
   ```
   DB_NAME=manitas_db
   DB_USER=postgres
   DB_PASSWORD=la_contraseña_compartida
   DB_HOST=localhost
   DB_PORT=5432
   SECRET_KEY=la_secret_key_compartida
   # ... otras variables que te haya dado el administrador
   ```

   **⚠️ IMPORTANTE:** 
   - El archivo `.env` contiene información sensible y NO debe subirse al repositorio. Ya está incluido en `.gitignore`.
   - Solo necesitas copiar las credenciales que el administrador te proporcione en tu archivo `.env` local.

5. **Aplicar migraciones**
   ```bash
   python manage.py migrate
   ```

6. **Crear superusuario compartido**
   ```bash
   python manage.py setup_admin
   ```
   
   Esto creará un usuario admin con las credenciales configuradas en `.env` (o los valores por defecto: `admin`/`admin123`).

7. **Ejecutar el servidor de desarrollo**
   ```bash
   python manage.py runserver
   ```

   La aplicación estará disponible en `http://127.0.0.1:8000/`

## 📋 Configuración de Base de Datos

Este proyecto usa **PostgreSQL** como base de datos principal. Asegúrate de tener PostgreSQL instalado y corriendo antes de iniciar la aplicación.

### Crear la base de datos en PostgreSQL

```sql
CREATE DATABASE manitas_db;
CREATE USER tu_usuario WITH PASSWORD 'tu_contraseña';
GRANT ALL PRIVILEGES ON DATABASE manitas_db TO tu_usuario;
```

## 👥 Credenciales Compartidas

Para que todos los miembros del equipo puedan acceder con las mismas credenciales:

1. **Base de datos:** Usa las mismas credenciales de PostgreSQL en tu archivo `.env`
2. **Admin:** Ejecuta `python manage.py setup_admin` para crear el usuario admin compartido

Las credenciales del admin se pueden configurar en el archivo `.env`:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

## 📚 Documentación Adicional

Para más detalles sobre la configuración, consulta el archivo [SETUP.md](SETUP.md).

## 🔒 Seguridad

- **NUNCA** subas el archivo `.env` al repositorio
- **NUNCA** pongas credenciales reales en `database_config.env.example`
- Usa variables de entorno para toda la información sensible
- El archivo `.gitignore` ya está configurado para proteger archivos sensibles

## 🛠️ Comandos Útiles

```bash
# Crear migraciones
python manage.py makemigrations

# Aplicar migraciones
python manage.py migrate

# Crear superusuario compartido
python manage.py setup_admin

# Crear superusuario personalizado
python manage.py createsuperuser

# Recopilar archivos estáticos
python manage.py collectstatic
```

## 📝 Estructura del Proyecto

```
proyecto/
├── manitas/          # Aplicación principal
├── proyecto/         # Configuración del proyecto Django
├── media/            # Archivos multimedia subidos por usuarios
├── static/           # Archivos estáticos
├── .env              # Variables de entorno (NO se sube al repo)
├── database_config.env.example  # Plantilla de configuración
└── requirements.txt  # Dependencias del proyecto
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

[Especificar licencia si aplica]

