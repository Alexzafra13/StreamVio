# StreamVio

StreamVio es un servicio de streaming multimedia personal que te permite organizar y disfrutar de todo tu contenido multimedia desde un solo lugar. Películas, series, música y fotos, todo accesible desde cualquier dispositivo en tu red local.

## Características

- **Organización de contenido multimedia**: Crea bibliotecas personalizadas para tus películas, series, música y fotos
- **Streaming adaptativo**: Reproduce tu contenido en cualquier dispositivo y con cualquier conexión
- **Transcodificación automática**: Convierte tus archivos al formato ideal para cada dispositivo
- **Gestión de usuarios**: Múltiples usuarios con perfiles y preferencias personalizadas
- **Historial y favoritos**: Lleva un registro de lo que has visto y marca tu contenido favorito
- **Interfaz intuitiva**: Diseño moderno y fácil de usar en cualquier dispositivo

## Requisitos

- **Node.js** (v14 o superior)
- **FFmpeg** (opcional pero recomendado para transcodificación)
- Sistema operativo: Linux, macOS o Windows

## Instalación

### Método 1: Instalación automática

Utiliza nuestro script de instalación para configurar StreamVio automáticamente:

```

## Guía de desarrollo

### Servidor API

El servidor API está construido con Express.js y utiliza SQLite para almacenar los datos. Las principales rutas de la API son:

- `/api/auth`: Autenticación y gestión de usuarios
- `/api/libraries`: Gestión de bibliotecas multimedia
- `/api/media`: Gestión y reproducción de contenido multimedia
- `/api/admin`: Funciones administrativas

### Cliente web

El cliente web está construido con Astro y React, utilizando Tailwind CSS para los estilos. Los principales componentes son:

- `Navigation.jsx`: Barra de navegación principal
- `MediaBrowser.jsx`: Explorador de contenido multimedia
- `VideoPlayer.jsx`: Reproductor de video
- `LibrariesManagement.jsx`: Gestión de bibliotecas
- `AuthForm.jsx`: Formularios de inicio de sesión y registro

### Transcodificador

El sistema incluye un transcodificador nativo escrito en C++ que utiliza FFmpeg para procesar archivos multimedia. El transcodificador se encarga de:

- Extraer metadatos de archivos multimedia
- Convertir archivos a diferentes formatos
- Generar miniaturas para videos
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

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo LICENSE.md para más detalles.bash
chmod +x setup.sh
./setup.sh
```

### Método 2: Instalación manual

1. Clona el repositorio:

   ```bash
   git clone https://github.com/Alexzafra13/StreamVio.git
   cd streamvio
   ```

2. Configura el servidor:

   ```bash
   cd server
   cp .env.example .env
   npm install
   npm run init-db
   ```

3. Configura el cliente web:
   ```bash
   cd clients/web
   npm install
   ```

## Uso

### Iniciar el servidor

```bash
cd server
npm run dev
```

El servidor API estará disponible en http://localhost:3000

### Iniciar el cliente web

```bash
cd clients/web
npm run dev
```

La interfaz web estará disponible en http://localhost:4321

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
