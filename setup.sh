#!/bin/bash
# StreamVio - Script de instalación mejorado v2.0
# Este script instala y configura StreamVio en sistemas Linux

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Versiones requeridas
REQUIRED_NODE_VERSION="18" # Versión mínima de Node.js
DEFAULT_API_PORT="8000"    # Puerto para la API (cambiado de 3000)
DEFAULT_WEB_PORT="4321"    # Puerto para la interfaz web

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

# Función para verificar si un puerto está en uso
check_port() {
    local port=$1
    local service=$2
    local alternative=$3
    
    # Verificar si el puerto está en uso
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        log_error "El puerto $port para $service está en uso."
        
        if [ -n "$alternative" ]; then
            log "Intentando usar el puerto alternativo $alternative para $service..."
            if lsof -Pi :$alternative -sTCP:LISTEN -t >/dev/null ; then
                log_error "El puerto alternativo $alternative también está en uso."
                return 1
            else
                log "Usando puerto alternativo $alternative para $service."
                return 2  # Indica que se usará el puerto alternativo
            fi
        else
            return 1  # Error si no hay puerto alternativo
        fi
    fi
    
    return 0  # Puerto disponible
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
    echo -e "  - Interfaz web: ${GREEN}http://$SERVER_IP:$WEB_PORT${NC}"
    echo -e "  - API: ${GREEN}http://$SERVER_IP:$API_PORT${NC}"
    
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
    
    echo -e "\n${YELLOW}Acceso desde fuera de la red local:${NC}"
    echo -e "  Para acceder desde Internet, necesitarás:"
    echo -e "  1. Una IP pública estática o un dominio"
    echo -e "  2. Configurar el reenvío de puertos en tu router (puertos $API_PORT y $WEB_PORT)"
    
    echo -e "\n${BLUE}Configuración en caso de problemas:${NC}"
    echo -e "  Edita los archivos .env en server/ y clients/web/ si necesitas"
    echo -e "  cambiar los puertos o las direcciones IP."
    
    echo -e "${BLUE}=================== FIN DEL RESUMEN ===================${NC}"
}

# Función para verificar y sugerir comandos a ejecutar como superusuario
check_sudo_commands() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}Para completar la instalación correctamente, ejecuta estos comandos como superusuario:${NC}"
        echo -e "  sudo ufw allow $API_PORT/tcp    # Abrir puerto de la API"
        echo -e "  sudo ufw allow $WEB_PORT/tcp    # Abrir puerto de la interfaz web"
        echo -e "  sudo cp /tmp/streamvio-backend.service /etc/systemd/system/"
        echo -e "  sudo cp /tmp/streamvio-frontend.service /etc/systemd/system/"
        echo -e "  sudo systemctl daemon-reload"
        echo -e "  sudo systemctl enable streamvio-backend.service"
        echo -e "  sudo systemctl enable streamvio-frontend.service"
        echo -e "  sudo systemctl start streamvio-backend.service"
        echo -e "  sudo systemctl start streamvio-frontend.service"
    fi
}

# Crear archivos de log
> "$LOG_FILE"
> "$ERROR_LOG"

# Inicio del script
echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}       StreamVio - Asistente de Instalación v2.0       ${NC}"
echo -e "${BLUE}=======================================================${NC}\n"

log "Iniciando instalación de StreamVio..."

# Verificar requisitos previos
log "Paso 1/10: ${YELLOW}Verificando requisitos del sistema...${NC}"

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
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    log "Node.js detectado: v$NODE_VERSION"
    
    if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_VERSION" ]; then
        log_error "La versión de Node.js es menor que la requerida (v$REQUIRED_NODE_VERSION+). Se procederá a actualizarla."
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

# Comprobar si build-essential está instalado (necesario para módulos nativos)
if [ "$OS_NAME" = "ubuntu" ] || [ "$OS_NAME" = "debian" ]; then
    if ! dpkg -l | grep -q build-essential; then
        log_error "build-essential no está instalado. Se procederá a instalarlo."
        INSTALL_BUILD_ESSENTIAL=true
    else
        log "build-essential detectado"
    fi
fi

# Verificar puertos disponibles
log "Paso 2/10: ${YELLOW}Verificando puertos disponibles...${NC}"

# Verificar puerto de la API
API_PORT=$DEFAULT_API_PORT
API_PORT_ALTERNATIVE="8080"
api_port_status=$(check_port $API_PORT "API" $API_PORT_ALTERNATIVE)
if [ $? -eq 2 ]; then
    # Puerto alternativo será usado
    API_PORT=$API_PORT_ALTERNATIVE
    log "Puerto para API cambiado a: $API_PORT"
elif [ $? -eq 1 ]; then
    log_error "No se pudo encontrar un puerto disponible para la API. Por favor, elige manualmente un puerto libre y edita los archivos .env después de la instalación."
fi

# Verificar puerto de la interfaz web
WEB_PORT=$DEFAULT_WEB_PORT
WEB_PORT_ALTERNATIVE="4000"
web_port_status=$(check_port $WEB_PORT "interfaz web" $WEB_PORT_ALTERNATIVE)
if [ $? -eq 2 ]; then
    # Puerto alternativo será usado
    WEB_PORT=$WEB_PORT_ALTERNATIVE
    log "Puerto para interfaz web cambiado a: $WEB_PORT"
elif [ $? -eq 1 ]; then
    log_error "No se pudo encontrar un puerto disponible para la interfaz web. Por favor, elige manualmente un puerto libre y edita los archivos .env después de la instalación."
fi

# Detectar IP del servidor
log "Paso 3/10: ${YELLOW}Detectando IP del servidor...${NC}"
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
log "Paso 4/10: ${YELLOW}Instalando dependencias del sistema...${NC}"
progress_bar 6 1

# Actualizar repositorios
if [ "$OS_NAME" = "ubuntu" ] || [ "$OS_NAME" = "debian" ]; then
    apt-get update -y >> "$LOG_FILE" 2>&1
    check_result "Actualización de repositorios"
    
    if [ "$INSTALL_BUILD_ESSENTIAL" = true ]; then
        apt-get install -y build-essential >> "$LOG_FILE" 2>&1
        check_result "Instalación de build-essential" "fatal"
    fi
    
    if [ "$INSTALL_NODE" = true ]; then
        log "Instalando Node.js v$REQUIRED_NODE_VERSION..."
        curl -fsSL https://deb.nodesource.com/setup_${REQUIRED_NODE_VERSION}.x | bash - >> "$LOG_FILE" 2>&1
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
    
    progress_bar 6 2
    
    # Paquetes adicionales útiles
    log "Instalando paquetes adicionales necesarios..."
    apt-get install -y git curl libpng-dev >> "$LOG_FILE" 2>&1
    check_result "Instalación de paquetes adicionales"
    
elif [ "$OS_NAME" = "centos" ] || [ "$OS_NAME" = "rhel" ] || [ "$OS_NAME" = "fedora" ]; then
    yum update -y >> "$LOG_FILE" 2>&1
    check_result "Actualización de repositorios"
    
    # Paquetes de desarrollo para CentOS/RHEL
    yum groupinstall -y "Development Tools" >> "$LOG_FILE" 2>&1
    check_result "Instalación de herramientas de desarrollo"
    
    if [ "$INSTALL_NODE" = true ]; then
        log "Instalando Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_${REQUIRED_NODE_VERSION}.x | bash - >> "$LOG_FILE" 2>&1
        yum install -y nodejs >> "$LOG_FILE" 2>&1
        check_result "Instalación de Node.js" "fatal"
    fi
    
    if [ "$INSTALL_FFMPEG" = true ]; then
        log "Instalando FFmpeg..."
        
        if [ "$OS_NAME" = "fedora" ]; then
            dnf install -y ffmpeg ffmpeg-devel >> "$LOG_FILE" 2>&1
        else
            # Para CentOS/RHEL, ffmpeg no está en los repos estándar
            yum install -y epel-release >> "$LOG_FILE" 2>&1
            yum localinstall -y --nogpgcheck https://download1.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm >> "$LOG_FILE" 2>&1
            yum install -y ffmpeg ffmpeg-devel >> "$LOG_FILE" 2>&1
        fi
        
        check_result "Instalación de FFmpeg" "fatal"
    fi
    
    if [ "$INSTALL_SQLITE" = true ]; then
        log "Instalando SQLite..."
        yum install -y sqlite sqlite-devel >> "$LOG_FILE" 2>&1
        check_result "Instalación de SQLite" "fatal"
    fi
    
    progress_bar 6 2
    
    # Paquetes adicionales útiles
    log "Instalando paquetes adicionales necesarios..."
    yum install -y git curl libpng-devel >> "$LOG_FILE" 2>&1
    check_result "Instalación de paquetes adicionales"
    
else
    log_error "Distribución no soportada automáticamente. Intentando instalación genérica."
    log "Se recomienda instalar manualmente Node.js v$REQUIRED_NODE_VERSION+, FFmpeg y SQLite3."
fi

progress_bar 6 3

# Instalar PM2 globalmente
if [ "$INSTALL_PM2" = true ]; then
    log "Instalando PM2..."
    npm install -g pm2 >> "$LOG_FILE" 2>&1
    check_result "Instalación de PM2" "fatal"
    
    # Configurar PM2 para arrancar con el sistema
    pm2 startup >> "$LOG_FILE" 2>&1
    log "PM2 configurado para arranque automático"
fi

progress_bar 6 4

# Crear directorios necesarios
log "Paso 5/10: ${YELLOW}Configurando directorios...${NC}"
mkdir -p server/data/thumbnails server/data/transcoded server/data/cache server/public/assets >> "$LOG_FILE" 2>&1
check_result "Creación de directorios"
progress_bar 6 5

# Configurar firewall
log "Paso 6/10: ${YELLOW}Configurando firewall...${NC}"
if command -v ufw &> /dev/null; then
    # Si está usando UFW (Ubuntu, Debian)
    ufw allow $API_PORT/tcp >> "$LOG_FILE" 2>&1
    ufw allow $WEB_PORT/tcp >> "$LOG_FILE" 2>&1
    check_result "Configuración de puertos en UFW"
elif command -v firewall-cmd &> /dev/null; then
    # Si está usando FirewallD (CentOS, Fedora)
    firewall-cmd --permanent --add-port=$API_PORT/tcp >> "$LOG_FILE" 2>&1
    firewall-cmd --permanent --add-port=$WEB_PORT/tcp >> "$LOG_FILE" 2>&1
    firewall-cmd --reload >> "$LOG_FILE" 2>&1
    check_result "Configuración de puertos en FirewallD"
else
    log_error "No se detectó un firewall compatible. Asegúrate de abrir manualmente los puertos $API_PORT (API) y $WEB_PORT (Cliente web)."
fi
progress_bar 6 6

# Instalar dependencias de la aplicación
log "Paso 7/10: ${YELLOW}Instalando dependencias de la aplicación...${NC}"
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
log "Paso 8/10: ${YELLOW}Configurando archivos de entorno...${NC}"
if [ ! -f server/.env ]; then
    cp server/.env.example server/.env 2>/dev/null || touch server/.env
    
    # Configurar variables de entorno para producción
    cat > server/.env << EOF
PORT=$API_PORT
NODE_ENV=production
CORS_ORIGINS=http://$SERVER_IP:$WEB_PORT
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./data/streamvio.db
EOF
    check_result "Creación del archivo .env del servidor"
else
    log "El archivo .env del servidor ya existe, se mantiene la configuración actual"
    
    # Modificar el puerto de la API si es necesario
    sed -i "s/^PORT=.*/PORT=$API_PORT/" server/.env
    log "Puerto de la API actualizado en .env existente"
fi

# Configurar .env del cliente
echo "PUBLIC_API_URL=http://$SERVER_IP:$API_PORT" > clients/web/.env
check_result "Creación del archivo .env del cliente"

# Compilar el frontend
log "Compilando el frontend para producción..."
cd clients/web
npm run build >> "../../$LOG_FILE" 2>&1
check_result "Compilación del frontend" "fatal"
cd ../..

# Inicializar la base de datos
log "Paso 9/10: ${YELLOW}Inicializando la base de datos...${NC}"
cd server
npm run init-db >> "../$LOG_FILE" 2>&1
check_result "Inicialización de la base de datos" "fatal"
cd ..

# Configurar servicios systemd
log "Paso 10/10: ${YELLOW}Configurando servicios del sistema...${NC}"

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
ExecStart=$(which pm2) start npm --name streamvio-frontend -- run preview -- --host --port $WEB_PORT
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
if curl -s "http://localhost:$API_PORT/api/health" | grep -q "ok"; then
    log "API de StreamVio: ${GREEN}ACCESIBLE${NC}"
else
    log_error "API de StreamVio: NO ACCESIBLE. Verifica los logs con 'journalctl -u streamvio-backend'"
fi

# Verificar si hay pasos que el usuario debe realizar (si no se ejecuta como root)
check_sudo_commands

# Mostrar resumen final
show_summary

log "Instalación completada. ¡Disfruta de StreamVio!"