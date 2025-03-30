#!/bin/bash
# StreamVio - Script de instalación mejorado
# Este script instala y configura StreamVio en sistemas Linux

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Archivo de log para registrar todo el proceso
LOG_FILE="streamvio-install.log"
ERROR_LOG="streamvio-errors.log"

# Función para registrar mensajes en el log
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
    echo -e "$1"
}

# Función para registrar errores
log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: $1" >> "$ERROR_LOG"
    echo -e "${RED}ERROR: $1${NC}"
}

# Función para comprobar el resultado del último comando
check_result() {
    if [ $? -ne 0 ]; then
        log_error "$1"
        if [ "$2" = "fatal" ]; then
            log_error "Error fatal. Abortando instalación."
            echo -e "\n${RED}=============================================${NC}"
            echo -e "${RED}La instalación ha fallado. Revisa el archivo $ERROR_LOG para más detalles.${NC}"
            echo -e "${RED}=============================================${NC}"
            exit 1
        fi
        return 1
    else
        log "$1 - ${GREEN}OK${NC}"
        return 0
    fi
}

# Función para mostrar el progreso de la instalación
progress_bar() {
    local total=$1
    local current=$2
    local width=50
    local percent=$((current*100/total))
    local completed=$((width*current/total))
    local remaining=$((width-completed))
    
    printf "\r[${GREEN}"
    for ((i=0; i<completed; i++)); do printf "#"; done
    printf "${NC}"
    for ((i=0; i<remaining; i++)); do printf "."; done
    printf "] %d%%" "$percent"
    
    if [ "$current" -eq "$total" ]; then
        printf "\n"
    fi
}

# Función para mostrar resumen al finalizar
show_summary() {
    local error_count=$(wc -l < "$ERROR_LOG")
    
    echo -e "\n${BLUE}=================== RESUMEN DE INSTALACIÓN ===================${NC}"
    if [ "$error_count" -gt 0 ]; then
        echo -e "${YELLOW}Instalación completada con $error_count advertencias/errores.${NC}"
        echo -e "${YELLOW}Revisa $ERROR_LOG para más detalles.${NC}"
    else
        echo -e "${GREEN}¡Instalación completada exitosamente sin errores!${NC}"
    fi
    
    echo -e "\n${GREEN}StreamVio está disponible en:${NC}"
    echo -e "  - Interfaz web: ${GREEN}http://$SERVER_IP:4321${NC}"
    echo -e "  - API: ${GREEN}http://$SERVER_IP:3000${NC}"
    
    echo -e "\n${YELLOW}Credenciales de acceso inicial:${NC}"
    echo -e "  - Usuario: ${YELLOW}admin${NC}"
    echo -e "  - Contraseña: ${YELLOW}admin${NC}"
    echo -e "${YELLOW}Se te pedirá cambiar la contraseña en el primer inicio de sesión.${NC}"
    
    echo -e "\n${BLUE}Para gestionar los servicios:${NC}"
    echo -e "  sudo systemctl start|stop|restart streamvio-backend"
    echo -e "  sudo systemctl start|stop|restart streamvio-frontend"
    echo -e "\n${BLUE}Logs:${NC}"
    echo -e "  sudo journalctl -u streamvio-backend"
    echo -e "  sudo journalctl -u streamvio-frontend"
    echo -e "${BLUE}=================== FIN DEL RESUMEN ===================${NC}"
}

# Crear archivos de log
> "$LOG_FILE"
> "$ERROR_LOG"

# Inicio del script
echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}       StreamVio - Asistente de Instalación            ${NC}"
echo -e "${BLUE}=======================================================${NC}\n"

log "Iniciando instalación de StreamVio..."

# Verificar requisitos previos
log "Paso 1/8: ${YELLOW}Verificando requisitos del sistema...${NC}"

# Verificar si se está ejecutando como root o con sudo
if [ "$EUID" -ne 0 ]; then
    log_error "Este script debe ejecutarse con privilegios de administrador (sudo)."
    echo -e "${YELLOW}Por favor, ejecuta el script de la siguiente manera:${NC}"
    echo -e "  sudo ./$(basename "$0")"
    exit 1
fi

# Verificar si la distribución es compatible
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$ID
    OS_VERSION=$VERSION_ID
    log "Sistema operativo detectado: $OS_NAME $OS_VERSION"
else
    OS_NAME="unknown"
    log_error "No se pudo detectar la distribución Linux"
fi

# Comprobar Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    log "Node.js detectado: v$NODE_VERSION"
    
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 14 ]; then
        log_error "La versión de Node.js es menor que la recomendada (v14+). Se procederá a actualizarla."
        INSTALL_NODE=true
    fi
else
    log_error "Node.js no está instalado. Se procederá a instalarlo."
    INSTALL_NODE=true
fi

# Comprobar FFmpeg
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n1 | awk '{print $3}')
    log "FFmpeg detectado: $FFMPEG_VERSION"
else
    log_error "FFmpeg no está instalado. Se procederá a instalarlo."
    INSTALL_FFMPEG=true
fi

# Comprobar SQLite
if command -v sqlite3 &> /dev/null; then
    SQLITE_VERSION=$(sqlite3 --version | awk '{print $1}')
    log "SQLite detectado: $SQLITE_VERSION"
else
    log_error "SQLite no está instalado. Se procederá a instalarlo."
    INSTALL_SQLITE=true
fi

# Comprobar PM2
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    log "PM2 detectado: $PM2_VERSION"
else
    log_error "PM2 no está instalado. Se procederá a instalarlo."
    INSTALL_PM2=true
fi

# Detectar IP del servidor
log "Paso 2/8: ${YELLOW}Detectando IP del servidor...${NC}"
PUBLIC_IP=$(curl -s ifconfig.me)
if [ -z "$PUBLIC_IP" ]; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    if [ -z "$LOCAL_IP" ]; then
        SERVER_IP="localhost"
        log_error "No se pudo detectar una IP válida. Se usará 'localhost'"
    else
        SERVER_IP=$LOCAL_IP
        log "IP local detectada: $SERVER_IP"
    fi
else
    SERVER_IP=$PUBLIC_IP
    log "IP pública detectada: $SERVER_IP"
fi

# Instalar dependencias necesarias
log "Paso 3/8: ${YELLOW}Instalando dependencias del sistema...${NC}"
progress_bar 4 1

# Actualizar repositorios
if [ "$OS_NAME" = "ubuntu" ] || [ "$OS_NAME" = "debian" ]; then
    apt-get update -y >> "$LOG_FILE" 2>&1
    check_result "Actualización de repositorios"
    
    if [ "$INSTALL_NODE" = true ]; then
        log "Instalando Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_16.x | bash - >> "$LOG_FILE" 2>&1
        apt-get install -y nodejs >> "$LOG_FILE" 2>&1
        check_result "Instalación de Node.js" "fatal"
    fi
    
    if [ "$INSTALL_FFMPEG" = true ]; then
        log "Instalando FFmpeg..."
        apt-get install -y ffmpeg >> "$LOG_FILE" 2>&1
        check_result "Instalación de FFmpeg" "fatal"
    fi
    
    if [ "$INSTALL_SQLITE" = true ]; then
        log "Instalando SQLite..."
        apt-get install -y sqlite3 >> "$LOG_FILE" 2>&1
        check_result "Instalación de SQLite" "fatal"
    fi
    
    if [ "$INSTALL_PM2" = true ]; then
        log "Instalando PM2..."
        npm install -g pm2 >> "$LOG_FILE" 2>&1
        check_result "Instalación de PM2" "fatal"
    fi
    
elif [ "$OS_NAME" = "centos" ] || [ "$OS_NAME" = "rhel" ] || [ "$OS_NAME" = "fedora" ]; then
    yum update -y >> "$LOG_FILE" 2>&1
    check_result "Actualización de repositorios"
    
    if [ "$INSTALL_NODE" = true ]; then
        log "Instalando Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_16.x | bash - >> "$LOG_FILE" 2>&1
        yum install -y nodejs >> "$LOG_FILE" 2>&1
        check_result "Instalación de Node.js" "fatal"
    fi
    
    if [ "$INSTALL_FFMPEG" = true ]; then
        log "Instalando FFmpeg..."
        yum install -y ffmpeg >> "$LOG_FILE" 2>&1
        check_result "Instalación de FFmpeg" "fatal"
    fi
    
    if [ "$INSTALL_SQLITE" = true ]; then
        log "Instalando SQLite..."
        yum install -y sqlite >> "$LOG_FILE" 2>&1
        check_result "Instalación de SQLite" "fatal"
    fi
    
    if [ "$INSTALL_PM2" = true ]; then
        log "Instalando PM2..."
        npm install -g pm2 >> "$LOG_FILE" 2>&1
        check_result "Instalación de PM2" "fatal"
    fi
else
    log_error "Distribución no soportada automáticamente. Intentando instalación genérica."
    
    if [ "$INSTALL_PM2" = true ]; then
        log "Instalando PM2..."
        npm install -g pm2 >> "$LOG_FILE" 2>&1
        check_result "Instalación de PM2" "fatal"
    fi
fi

progress_bar 4 2

# Crear directorios necesarios
log "Paso 4/8: ${YELLOW}Configurando directorios...${NC}"
mkdir -p server/data/thumbnails server/data/transcoded server/public/assets >> "$LOG_FILE" 2>&1
check_result "Creación de directorios"
progress_bar 4 3

# Configurar firewall
log "Paso 5/8: ${YELLOW}Configurando firewall...${NC}"
if command -v ufw &> /dev/null; then
    # Si está usando UFW (Ubuntu, Debian)
    ufw allow 3000/tcp >> "$LOG_FILE" 2>&1
    ufw allow 4321/tcp >> "$LOG_FILE" 2>&1
    check_result "Configuración de puertos en UFW"
elif command -v firewall-cmd &> /dev/null; then
    # Si está usando FirewallD (CentOS, Fedora)
    firewall-cmd --permanent --add-port=3000/tcp >> "$LOG_FILE" 2>&1
    firewall-cmd --permanent --add-port=4321/tcp >> "$LOG_FILE" 2>&1
    firewall-cmd --reload >> "$LOG_FILE" 2>&1
    check_result "Configuración de puertos en FirewallD"
else
    log_error "No se detectó un firewall compatible. Asegúrate de abrir manualmente los puertos 3000 (API) y 4321 (Cliente web)."
fi
progress_bar 4 4

# Instalar dependencias de la aplicación
log "Paso 6/8: ${YELLOW}Instalando dependencias de la aplicación...${NC}"
log "Instalando dependencias del servidor..."
cd server
npm install --production >> "../$LOG_FILE" 2>&1
check_result "Instalación de dependencias del servidor" "fatal"
cd ..

log "Instalando dependencias del cliente web..."
cd clients/web
npm install >> "../../$LOG_FILE" 2>&1
check_result "Instalación de dependencias del cliente web" "fatal"
cd ../..

# Configurar archivos .env
log "Paso 7/8: ${YELLOW}Configurando archivos de entorno...${NC}"
if [ ! -f server/.env ]; then
    cp server/.env.example server/.env 2>/dev/null || touch server/.env
    
    # Configurar variables de entorno para producción
    cat > server/.env << EOF
PORT=3000
NODE_ENV=production
CORS_ORIGINS=http://$SERVER_IP:4321
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./data/streamvio.db
EOF
    check_result "Creación del archivo .env del servidor"
else
    log "El archivo .env del servidor ya existe, se mantiene la configuración actual"
fi

# Configurar .env del cliente
echo "PUBLIC_API_URL=http://$SERVER_IP:3000" > clients/web/.env
check_result "Creación del archivo .env del cliente"

# Compilar el frontend
log "Compilando el frontend para producción..."
cd clients/web
npm run build >> "../../$LOG_FILE" 2>&1
check_result "Compilación del frontend" "fatal"
cd ../..

# Inicializar la base de datos
log "Inicializando la base de datos..."
cd server
npm run init-db >> "../$LOG_FILE" 2>&1
check_result "Inicialización de la base de datos" "fatal"
cd ..

# Configurar servicios systemd
log "Paso 8/8: ${YELLOW}Configurando servicios del sistema...${NC}"

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
cp /tmp/streamvio-backend.service /etc/systemd/system/
cp /tmp/streamvio-frontend.service /etc/systemd/system/
check_result "Configuración de servicios systemd"

# Recargar systemd
systemctl daemon-reload
check_result "Recarga de systemd"

# Habilitar servicios para arranque automático
systemctl enable streamvio-backend.service >> "$LOG_FILE" 2>&1
systemctl enable streamvio-frontend.service >> "$LOG_FILE" 2>&1
check_result "Habilitación de servicios para arranque automático"

# Iniciar servicios
log "Iniciando servicios de StreamVio..."
systemctl start streamvio-backend.service
check_result "Inicio del servicio backend"
systemctl start streamvio-frontend.service
check_result "Inicio del servicio frontend"

# Verificar que los servicios están funcionando
if systemctl is-active --quiet streamvio-backend.service; then
    log "Servicio backend: ${GREEN}ACTIVO${NC}"
else
    log_error "Servicio backend: NO ESTÁ ACTIVO"
fi

if systemctl is-active --quiet streamvio-frontend.service; then
    log "Servicio frontend: ${GREEN}ACTIVO${NC}"
else
    log_error "Servicio frontend: NO ESTÁ ACTIVO"
fi

# Verificar conectividad a los servicios
log "Verificando conectividad a la API..."
if curl -s "http://localhost:3000/api/health" | grep -q "ok"; then
    log "API de StreamVio: ${GREEN}ACCESIBLE${NC}"
else
    log_error "API de StreamVio: NO ACCESIBLE. Verifica los logs con 'journalctl -u streamvio-backend'"
fi

# Mostrar resumen final
show_summary

log "Instalación completada. ¡Disfruta de StreamVio!"