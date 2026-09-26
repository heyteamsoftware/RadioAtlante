# Despliegue (Ubuntu 24.04, Apache + PHP 8.3)

1. `apt install icecast2 liquidsoap ffmpeg sqlite3` y `a2enmod proxy proxy_http headers`.
2. Icecast: en `/etc/icecast2/icecast.xml` deja el `listen-socket` solo en `127.0.0.1:8000`.
3. Copia el proyecto a `/var/www/html/Tony_RadioAtlante/` (propietario `www-data`).
4. Crea la BD: tablas `programs` y `admin_users` (ver `api/`), y el admin con
   `password_hash()` de PHP (no guardes la contraseña en el repo).
5. `radio.liq.example` -> `/etc/liquidsoap/radio.liq` con la contraseña real;
   añade el usuario `liquidsoap` al grupo `www-data`.
6. Instala `liquidsoap-radio.service`, `systemctl enable --now liquidsoap-radio`.
7. Añade `apache-proxy.conf.example` al vhost SSL, `apache2ctl configtest` y recarga.

Contraseñas y `db/radio.sqlite` no se versionan.
