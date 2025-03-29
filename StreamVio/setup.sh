#!/bin/bash
# StreamVio setup script
# Este script configura el entorno para StreamVio

echo "==== StreamVio Setup ===="
echo ""

# Verificar requisitos
echo "Verificando requisitos..."

# Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js no está instalado. Por favor, instala Node.js (v14 o superior)."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
echo "✓ Node.js detectado: v$NODE_VERSION"

# FFmpeg (opcional pero recomendado)
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n1 | awk '{print $3}')
    echo "✓ FFmpeg detectado: $FFMPEG_VERSION"
else
    echo "⚠ FFmpeg no detectado. Se recomienda instalar FFmpeg para funciones de transcodificación."
    echo "  Puedes continuar sin FFmpeg, pero algunas funciones estarán limitadas."
fi

# Crear directorios de datos si no existen
echo ""
echo "Creando estructura de directorios..."

mkdir -p server/data/thumbnails
mkdir -p server/data/transcoded
mkdir -p server/public/assets

echo "✓ Estructura de directorios creada"

# Copiar archivos de configuración
echo ""
echo "Configurando archivos de entorno..."

if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
    echo "✓ Archivo .env creado a partir de .env.example"
else
    echo "✓ Archivo .env ya existe"
fi

# Instalar dependencias
echo ""
echo "Instalando dependencias del servidor..."
cd server && npm install
cd ..

echo ""
echo "Instalando dependencias del cliente web..."
cd clients/web && npm install
cd ../..

# Configurar archivo .env para el cliente web
echo "Configurando cliente web..."
if [ ! -f clients/web/.env ]; then
    echo "PUBLIC_API_URL=http://localhost:3000" > clients/web/.env
    echo "✓ Archivo .env para cliente web creado"
else
    echo "✓ Archivo .env para cliente web ya existe"
fi

# Inicializar la base de datos
echo ""
echo "Inicializando la base de datos..."
cd server && npm run init-db
cd ..

echo ""
echo "===== Configuración completada ====="
echo ""
echo "Para iniciar el servidor:"
echo "  cd server && npm run dev"
echo ""
echo "Para iniciar el cliente web:"
echo "  cd clients/web && npm run dev"
echo ""
echo "Accede a la aplicación en: http://localhost:4321"
echo "El servidor API estará disponible en: http://localhost:3000"
echo ""
echo "¡Gracias por usar StreamVio!"