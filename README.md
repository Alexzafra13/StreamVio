# StreamVio

StreamVio es un servicio de streaming multimedia personal que te permite organizar y disfrutar de todo tu contenido multimedia desde un solo lugar. Películas, series, música y fotos, todo accesible desde cualquier dispositivo en tu red local.

## Características

- **Organización de contenido multimedia**: Crea bibliotecas personalizadas para tus películas, series, música y fotos
- **Streaming adaptativo**: Reproduce tu contenido en cualquier dispositivo y con cualquier conexión
- **Transcodificación avanzada**: Convierte tus archivos al formato ideal para cada dispositivo con perfiles optimizados
- **Streaming HLS**: Soporte para streaming adaptativo que ajusta la calidad según la conexión del usuario
- **Gestión de usuarios**: Múltiples usuarios con perfiles y preferencias personalizadas
- **Historial y favoritos**: Lleva un registro de lo que has visto y marca tu contenido favorito
- **Interfaz unificada**: Diseño moderno y fácil de usar accesible desde un único puerto
- **Configuración inicial sencilla**: Crea tu cuenta de administrador en el primer acceso

## Requisitos

- **Node.js** (v18.2 o superior)
- **FFmpeg** (opcional pero recomendado para transcodificación)
- Sistema operativo: Linux, macOS o Windows

## Instalación

### Instalación con script automático

La forma más sencilla de instalar StreamVio es utilizando el script de instalación automática:

```bash
# Navegar al directorio de instalación
cd /opt/streamvio

# Dar permisos de ejecución al script
sudo chmod +x install.sh

# Ejecutar el script de instalación
sudo ./install.sh
```

Este script realizará automáticamente todos los pasos necesarios:

- Verificar e instalar las dependencias necesarias (Node.js, FFmpeg)
- Configurar la estructura de directorios
- Inicializar la base de datos
- Configurar la aplicación como servicio del sistema
- Abrir los puertos necesarios en el firewall

### Configuración de permisos adicionales (recomendado)

Para asegurar que StreamVio pueda acceder correctamente a las carpetas multimedia, es recomendable ajustar la configuración del servicio:

```bash
# Editar la configuración del servicio
sudo systemctl edit streamvio
```

Y añadir el siguiente contenido:

```
[Service]
User=streamvio
Group=streamvio
ReadWritePaths=/opt/streamvio/server/data
ReadWritePaths=/opt
ReadWritePaths=/mnt
ReadWritePaths=/media
ProtectSystem=no
ProtectHome=no
PrivateTmp=no
PrivateDevices=no
```

Después de guardar, reinicia el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl restart streamvio
```

## Uso

### Acceso a la aplicación

- **Aplicación completa**: http://tu-ip-del-servidor:45000

StreamVio ahora utiliza un puerto único (45000) tanto para la API como para la interfaz web.

### Configuración inicial

En tu primer acceso a StreamVio, serás recibido con una pantalla de configuración inicial:

1. Crea tu cuenta de administrador proporcionando:

   - Nombre de usuario
   - Correo electrónico
   - Contraseña

2. Una vez completado el registro, podrás iniciar sesión con las credenciales que acabas de crear.

3. Ahora puedes comenzar a configurar tus bibliotecas multimedia.

## Gestión de bibliotecas

Para añadir una nueva biblioteca de medios:

1. Navega a "Gestionar Bibliotecas" en el menú principal
2. Haz clic en "Añadir biblioteca"
3. Selecciona la ubicación de tu contenido multimedia usando el explorador de archivos
4. Asigna un nombre descriptivo a la biblioteca
5. Selecciona el tipo de contenido (Películas, Series, Música o Fotos)
6. Haz clic en "Guardar"

Si encuentras problemas de permisos, puedes usar el script incluido para configurar los permisos adecuados:

```bash
sudo /opt/streamvio/add-media-folder.sh /ruta/a/tu/carpeta/multimedia
```

## Solución de problemas

Si experimentas problemas con StreamVio, puedes utilizar los siguientes scripts de mantenimiento:

### Verificar permisos

```bash
sudo /opt/streamvio/check-permissions.sh
```

### Reiniciar servicio

```bash
sudo /opt/streamvio/restart-service.sh
```

### Reparar instalación

```bash
sudo /opt/streamvio/repair-installation.sh
```

## Estructura del proyecto

```
streamvio/
├── clients/                 # Aplicaciones cliente
│   └── web/                # Cliente web (Astro + React)
│       ├── src/            # Código fuente del cliente
│       ├── public/         # Archivos estáticos
│       └── package.json    # Dependencias del cliente
├── server/                 # Servidor backend
│   ├── config/             # Configuración del servidor
│   ├── data/               # Datos y archivos generados
│   ├── middleware/         # Middleware Express
│   ├── routes/             # Rutas de la API
│   ├── scripts/            # Scripts de utilidad
│   ├── services/           # Servicios de negocio
│   └── app.js              # Punto de entrada del servidor
└── install.sh              # Script de instalación
```

## Licencia

Este proyecto es desarrollado por Alejandro Osuna y está protegido bajo licencia ISC.
