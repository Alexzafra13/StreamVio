# StreamVio

StreamVio es un servicio de streaming multimedia personal que te permite organizar y disfrutar de todo tu contenido multimedia desde un solo lugar. Películas, series, música y fotos, todo accesible desde cualquier dispositivo en tu red local.

## Características

- **Organización de contenido multimedia**: Crea bibliotecas personalizadas para tus películas, series, música y fotos
- **Streaming adaptativo**: Reproduce tu contenido en cualquier dispositivo y con cualquier conexión
- **Transcodificación avanzada**: Convierte tus archivos al formato ideal para cada dispositivo con perfiles optimizados
- **Streaming HLS**: Soporte para streaming adaptativo que ajusta la calidad según la conexión del usuario
- **Gestión de usuarios**: Múltiples usuarios con perfiles y preferencias personalizadas
- **Historial y favoritos**: Lleva un registro de lo que has visto y marca tu contenido favorito
- **Interfaz intuitiva**: Diseño moderno y fácil de usar en cualquier dispositivo
- **Seguridad mejorada**: Usuario administrador predeterminado con cambio de contraseña obligatorio

## Requisitos

- **Node.js** (v14 o superior)
- **FFmpeg** (opcional pero recomendado para transcodificación)
- Sistema operativo: Linux, macOS o Windows

## Instalación

### Instalación con script automático

La forma más sencilla de instalar StreamVio es utilizando el script de instalación automática:

```bash
# Clonar el repositorio
git clone https://github.com/Alexzafra13/StreamVio.git
cd StreamVio

# Ejecutar el script de instalación
chmod +x setup.sh
./setup.sh
```

Este script realizará automáticamente todos los pasos necesarios:

- Verificar e instalar las dependencias necesarias (Node.js, FFmpeg)
- Configurar la estructura de directorios
- Inicializar la base de datos con un usuario administrador predeterminado
- Configurar la aplicación como servicio del sistema (en Linux)
- Abrir los puertos necesarios en el firewall

Una vez completada la instalación, la aplicación estará lista para usar.

## Uso

### Acceso a la aplicación

- **Interfaz web**: http://localhost:4321 (o la IP de tu servidor)
- **API**: http://localhost:8000 (o la IP de tu servidor)

### Primer inicio de sesión

Por razones de seguridad, StreamVio viene con un usuario administrador predeterminado que requiere cambiar la contraseña en el primer inicio de sesión:

1. Accede a la interfaz web e inicia sesión con:

   - **Usuario**: admin@streamvio.local
   - **Contraseña**: admin

2. Se te solicitará cambiar la contraseña inmediatamente. Elige una contraseña segura.

3. Una vez cambiada la contraseña, podrás acceder a todas las funcionalidades de la aplicación.

## Transcodificación

StreamVio incluye un sistema avanzado de transcodificación con:

- **Perfiles preconfigurados**: Optimizados para diferentes dispositivos (móvil, tablet, TV)
- **Aceleración por hardware**: Utiliza GPU cuando está disponible para un procesamiento más rápido
- **Streaming adaptativo (HLS)**: Se ajusta dinámicamente a la calidad de conexión del usuario
- **Generación de miniaturas y storyboards**: Para previsualización de contenido

Para transcodificar un elemento multimedia:

1. Navega a la página de detalles del elemento
2. En el panel lateral, selecciona un perfil de calidad
3. Haz clic en "Iniciar Transcodificación" o "Crear Streaming Adaptativo (HLS)"

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
├── core/                   # Núcleo de procesamiento multimedia
│   ├── include/            # Archivos de cabecera C++
│   ├── src/                # Código fuente C++
│   └── CMakeLists.txt      # Configuración de compilación
└── setup.sh                # Script de instalación
```

## Guía de desarrollo

### Servidor API

El servidor API está construido con Express.js y utiliza SQLite para almacenar los datos. Las principales rutas de la API son:

- `/api/auth`: Autenticación y gestión de usuarios
- `/api/libraries`: Gestión de bibliotecas multimedia
- `/api/media`: Gestión y reproducción de contenido multimedia
- `/api/admin`: Funciones administrativas
- `/api/transcoding`: Gestión de transcodificación y streaming adaptativo

### Cliente web

El cliente web está construido con Astro y React, utilizando Tailwind CSS para los estilos. Los principales componentes son:

- `Navigation.jsx`: Barra de navegación principal
- `MediaBrowser.jsx`: Explorador de contenido multimedia
- `MediaViewer.jsx`: Reproductor/visor universal de elementos multimedia
- `TranscodingManager.jsx`: Gestión de transcodificación y perfiles
- `LibrariesManagement.jsx`: Gestión de bibliotecas
- `AuthForm.jsx`: Formularios de inicio de sesión y registro
- `PasswordChangeModal.jsx`: Modal para cambio de contraseña forzado

### Transcodificador

El sistema incluye un transcodificador nativo escrito en C++ que utiliza FFmpeg para procesar archivos multimedia. El transcodificador se encarga de:

- Extraer metadatos de archivos multimedia
- Convertir archivos a diferentes formatos
- Generar miniaturas y storyboards para videos
- Crear streaming adaptativo (HLS)
- Adaptar la calidad del streaming según el dispositivo

## Próximas características

- [ ] Soporte para subtítulos
- [ ] Aplicaciones móviles (iOS, Android)
- [ ] Recomendaciones personalizadas
- [ ] Estadísticas de uso
- [ ] Reconocimiento facial en fotos
- [ ] Integración con servicios de metadatos externos

## Contribuciones

Las contribuciones son bienvenidas. Por favor, sigue estos pasos:

1. Haz un fork del repositorio
2. Crea una rama para tu característica (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'Add some amazing feature'`)
4. Haz push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo LICENSE.md para más detalles.
