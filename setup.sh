#!/bin/bash
# StreamVio setup script
# Este script configura el entorno completo para StreamVio en un servidor

echo "==== StreamVio Server Setup ===="
echo ""

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para instalar dependencias en sistemas basados en Debian
install_deps_debian() {
    echo -e "${YELLOW}Instalando dependencias con apt...${NC}"
    sudo apt-get update
    sudo apt-get install -y nodejs npm ffmpeg sqlite3 
    
    # Instalar Node.js más reciente si la versión actual es menor que 14
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VER" -lt 14 ]; then
        echo -e "${YELLOW}Actualizando Node.js a la versión LTS...${NC}"
        sudo npm install -g n
        sudo n lts
        # Reiniciar PATH para usar la nueva versión de Node
        PATH="$PATH"
    fi
    
    # Instalar PM2 globalmente para gestión de servicios
    sudo npm install -g pm2
}

# Función para instalar dependencias en sistemas basados en Red Hat
install_deps_redhat() {
    echo -e "${YELLOW}Instalando dependencias con yum/dnf...${NC}"
    sudo yum install -y nodejs npm ffmpeg sqlite
    
    # Instalar Node.js más reciente si la versión actual es menor que 14
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VER" -lt 14 ]; then
        echo -e "${YELLOW}Actualizando Node.js a la versión LTS...${NC}"
        sudo npm install -g n
        sudo n lts
        # Reiniciar PATH para usar la nueva versión de Node
        PATH="$PATH"
    fi
    
    # Instalar PM2 globalmente para gestión de servicios
    sudo npm install -g pm2
}

# Detectar sistema operativo y instalar dependencias
detect_os_and_install() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            install_deps_debian
        elif [ -f /etc/redhat-release ]; then
            install_deps_redhat
        else
            echo -e "${RED}No se pudo determinar la distribución Linux.${NC}"
            echo "Intentando instalar Node.js, FFmpeg y SQLite manualmente..."
            sudo npm install -g n
            sudo n lts
            # Instalar PM2 globalmente
            sudo npm install -g pm2
        fi
    else
        echo -e "${RED}Sistema operativo no soportado para instalación automática de dependencias.${NC}"
        echo "Este script está optimizado para servidores Linux."
        read -p "¿Deseas continuar con la instalación manual? (s/n): " continue_manual
        if [[ $continue_manual != "s" ]]; then
            exit 1
        fi
    fi
}

# Verificar si se está ejecutando como root o con sudo
check_permissions() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}NOTA: No se está ejecutando con privilegios de administrador.${NC}"
        echo "Algunas operaciones pueden requerir contraseña de administrador."
    fi
}

# Obtener la IP del servidor
get_server_ip() {
    # Intentar obtener la IP pública
    PUBLIC_IP=$(curl -s ifconfig.me)
    # Intentar obtener la IP local si la pública falla
    if [ -z "$PUBLIC_IP" ]; then
        # Intentar con hostname -I para obtener la primera IP
        LOCAL_IP=$(hostname -I | awk '{print $1}')
        if [ -z "$LOCAL_IP" ]; then
            # Último recurso: usar 127.0.0.1
            SERVER_IP="localhost"
        else
            SERVER_IP=$LOCAL_IP
        fi
    else
        SERVER_IP=$PUBLIC_IP
    fi
    
    echo "Dirección IP detectada: $SERVER_IP"
}

# Función para configurar puertos y firewall
configure_firewall() {
    echo -e "${YELLOW}Configurando el firewall...${NC}"
    
    if command -v ufw &> /dev/null; then
        # Si está usando UFW (Ubuntu, Debian)
        sudo ufw allow 3000/tcp  # API
        sudo ufw allow 4321/tcp  # Cliente web
        sudo ufw status
        echo -e "${GREEN}✓ Puertos 3000 y 4321 abiertos en UFW${NC}"
    elif command -v firewall-cmd &> /dev/null; then
        # Si está usando FirewallD (CentOS, Fedora)
        sudo firewall-cmd --permanent --add-port=3000/tcp
        sudo firewall-cmd --permanent --add-port=4321/tcp
        sudo firewall-cmd --reload
        echo -e "${GREEN}✓ Puertos 3000 y 4321 abiertos en FirewallD${NC}"
    else
        echo -e "${YELLOW}No se pudo detectar un firewall compatible.${NC}"
        echo "Asegúrate de abrir manualmente los puertos 3000 (API) y 4321 (Cliente web)."
    fi
}

# Función para crear servicio systemd para la aplicación
create_systemd_service() {
    echo -e "${YELLOW}Configurando StreamVio como servicio del sistema...${NC}"
    
    # Crear archivo de servicio para el backend
    cat > /tmp/streamvio-backend.service << EOF
[Unit]
Description=StreamVio Backend Server
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=$(pwd)/server
ExecStart=$(which pm2) start app.js --name streamvio-backend
ExecReload=$(which pm2) reload streamvio-backend
ExecStop=$(which pm2) stop streamvio-backend
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

    # Crear archivo de servicio para el frontend
    cat > /tmp/streamvio-frontend.service << EOF
[Unit]
Description=StreamVio Frontend Server
After=network.target streamvio-backend.service

[Service]
Type=forking
User=$USER
WorkingDirectory=$(pwd)/clients/web
ExecStart=$(which pm2) start npm --name streamvio-frontend -- run preview
ExecReload=$(which pm2) reload streamvio-frontend
ExecStop=$(which pm2) stop streamvio-frontend
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

    # Copiar archivos de servicio al directorio de systemd
    sudo cp /tmp/streamvio-backend.service /etc/systemd/system/
    sudo cp /tmp/streamvio-frontend.service /etc/systemd/system/
    
    # Recargar systemd
    sudo systemctl daemon-reload
    
    # Habilitar servicios para arranque automático
    sudo systemctl enable streamvio-backend.service
    sudo systemctl enable streamvio-frontend.service
    
    echo -e "${GREEN}✓ Servicios configurados para arranque automático${NC}"
}

# Función para compilar el frontend para producción
build_frontend() {
    echo -e "${YELLOW}Compilando el frontend para producción...${NC}"
    
    # Actualizar el archivo .env con la API URL
    echo "PUBLIC_API_URL=http://$SERVER_IP:3000" > clients/web/.env
    
    # Cambiar al directorio del cliente web
    cd clients/web
    
    # Compilar el frontend
    npm run build
    
    # Volver al directorio principal
    cd ../..
    
    echo -e "${GREEN}✓ Frontend compilado para producción${NC}"
}

# Función para iniciar los servicios
start_services() {
    echo -e "${YELLOW}Iniciando servicios de StreamVio...${NC}"
    
    # Iniciar servicios
    sudo systemctl start streamvio-backend.service
    sudo systemctl start streamvio-frontend.service
    
    # Verificar estado
    echo "Estado del backend:"
    sudo systemctl status streamvio-backend.service --no-pager
    
    echo "Estado del frontend:"
    sudo systemctl status streamvio-frontend.service --no-pager
    
    echo -e "${GREEN}✓ Servicios iniciados correctamente${NC}"
}

# Mostrar mensaje con información de acceso
show_access_info() {
    echo -e "\n${GREEN}===== StreamVio instalado correctamente =====${NC}"
    echo -e "\nPuedes acceder a StreamVio de las siguientes formas:"
    echo -e "- Interfaz web: ${GREEN}http://$SERVER_IP:4321${NC}"
    echo -e "- API: ${GREEN}http://$SERVER_IP:3000${NC}"
    echo -e "\nLos servicios se iniciarán automáticamente cuando el servidor arranque."
    echo -e "\nPara gestionar los servicios manualmente:"
    echo "  sudo systemctl start|stop|restart streamvio-backend"
    echo "  sudo systemctl start|stop|restart streamvio-frontend"
    echo -e "\nPara ver los logs:"
    echo "  sudo journalctl -u streamvio-backend"
    echo "  sudo journalctl -u streamvio-frontend"
    echo -e "\n¡Gracias por usar StreamVio!\n"
}

# Inicio del script principal
check_permissions

# Verificar requisitos
echo -e "${YELLOW}Verificando requisitos...${NC}"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js no está instalado.${NC}"
    read -p "¿Deseas instalar Node.js automáticamente? (s/n): " install_node
    if [[ $install_node == "s" ]]; then
        detect_os_and_install
    else
        echo "Por favor, instala Node.js (v14 o superior) manualmente antes de continuar."
        exit 1
    fi
else
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    echo -e "${GREEN}✓ Node.js detectado: v$NODE_VERSION${NC}"
    
    # Verificar si la versión es inferior a 14
    if [ "$NODE_MAJOR" -lt 14 ]; then
        echo -e "${RED}La versión de Node.js es menor que la recomendada (v14+).${NC}"
        read -p "¿Deseas actualizar Node.js automáticamente? (s/n): " update_node
        if [[ $update_node == "s" ]]; then
            detect_os_and_install
        else
            echo -e "${YELLOW}Continuando con Node.js v$NODE_VERSION. Pueden surgir problemas de compatibilidad.${NC}"
        fi
    fi
fi

# Verificar FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}FFmpeg no está instalado.${NC}"
    read -p "¿Deseas instalar FFmpeg automáticamente? (s/n): " install_ffmpeg
    if [[ $install_ffmpeg == "s" ]]; then
        detect_os_and_install
    else
        echo -e "${YELLOW}⚠ ADVERTENCIA: FFmpeg es necesario para la transcodificación de vídeo.${NC}"
        echo "  Algunas funciones estarán limitadas sin FFmpeg."
        read -p "Presiona ENTER para continuar de todos modos..." continue_anyway
    fi
else
    FFMPEG_VERSION=$(ffmpeg -version | head -n1 | awk '{print $3}')
    echo -e "${GREEN}✓ FFmpeg detectado: $FFMPEG_VERSION${NC}"
fi

# Verificar SQLite
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}SQLite no está instalado.${NC}"
    read -p "¿Deseas instalar SQLite automáticamente? (s/n): " install_sqlite
    if [[ $install_sqlite == "s" ]]; then
        detect_os_and_install
    else
        echo -e "${YELLOW}⚠ ADVERTENCIA: SQLite es necesario para la base de datos.${NC}"
        echo "  La aplicación puede fallar sin SQLite."
        read -p "Presiona ENTER para continuar de todos modos..." continue_anyway
    fi
else
    SQLITE_VERSION=$(sqlite3 --version | awk '{print $1}')
    echo -e "${GREEN}✓ SQLite detectado: $SQLITE_VERSION${NC}"
fi

# Verificar PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2 no está instalado.${NC}"
    read -p "¿Deseas instalar PM2 automáticamente? (s/n): " install_pm2
    if [[ $install_pm2 == "s" ]]; then
        echo -e "${YELLOW}Instalando PM2 globalmente...${NC}"
        sudo npm install -g pm2
    else
        echo -e "${YELLOW}⚠ ADVERTENCIA: PM2 es necesario para ejecutar StreamVio como servicio.${NC}"
        read -p "Presiona ENTER para continuar de todos modos..." continue_anyway
    fi
else
    PM2_VERSION=$(pm2 --version)
    echo -e "${GREEN}✓ PM2 detectado: $PM2_VERSION${NC}"
fi

# Obtener IP del servidor
get_server_ip

# Crear directorios de datos si no existen
echo ""
echo -e "${YELLOW}Creando estructura de directorios...${NC}"

mkdir -p server/data/thumbnails
mkdir -p server/data/transcoded
mkdir -p server/public/assets

echo -e "${GREEN}✓ Estructura de directorios creada${NC}"

# Copiar archivos de configuración
echo ""
echo -e "${YELLOW}Configurando archivos de entorno...${NC}"

if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
    # Configurar variables de entorno para producción
    sed -i "s|PORT=3000|PORT=3000|g" server/.env
    sed -i "s|NODE_ENV=development|NODE_ENV=production|g" server/.env
    sed -i "s|CORS_ORIGINS=http://localhost:4321|CORS_ORIGINS=http://$SERVER_IP:4321|g" server/.env
    sed -i "s|JWT_SECRET=tu_clave_secreta_para_jwt_aqui_cambiala_en_produccion|JWT_SECRET=$(openssl rand -hex 32)|g" server/.env
    echo -e "${GREEN}✓ Archivo .env creado y configurado para producción${NC}"
else
    echo -e "${GREEN}✓ Archivo .env ya existe${NC}"
fi

# Configurar puertos y firewall
configure_firewall

# Instalar dependencias
echo ""
echo -e "${YELLOW}Instalando dependencias del servidor...${NC}"
cd server && npm install --production
cd ..

echo ""
echo -e "${YELLOW}Instalando dependencias del cliente web...${NC}"
cd clients/web && npm install
cd ../..

# Compilar el frontend para producción
build_frontend

# Inicializar la base de datos
echo ""
echo -e "${YELLOW}Inicializando la base de datos...${NC}"
cd server && npm run init-db
cd ..

# Configurar servicios systemd
create_systemd_service

# Iniciar servicios
start_services

# Mostrar información de acceso
show_access_info