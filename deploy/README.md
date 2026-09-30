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

## Estadísticas de oyentes (opcional)

`cron/collect_stats.php` muestrea los oyentes de Icecast y los guarda en la
tabla `listener_stats`. Instálalo con cron cada minuto:

    (crontab -u www-data -l 2>/dev/null; echo '* * * * * /usr/bin/php /var/www/html/Tony_RadioAtlante/cron/collect_stats.php') | crontab -u www-data -

El panel admin (`admin/`) muestra oyentes actuales, pico de 30 días y un
gráfico de las últimas 24h vía `api/admin_stats.php`.

## PWA

`service-worker.js` cachea solo el shell estático (HTML/CSS/JS/iconos);
nunca intercepta `/api/`, `/admin/`, `/stream`, `/media/`, `/covers/` ni
`/tmp_uploads/`, para no afectar al directo ni a los datos en vivo.
