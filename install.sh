#!/bin/bash

# StreamVio - Script de instalación (v1.0)
# Este script instala y configura StreamVio en sistemas Linux
# Asume que los archivos ya están presentes en el directorio de instalación

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ===== Configuración =====
STREAMVIO_PORT=45000    # Puerto para la aplicación
INSTALL_LOG="streamvio-install.log"
ERROR_LOG="streamvio-errors.log"
STREAMVIO_USER="streamvio"  # Usuario específico para el servicio
STREAMVIO_GROUP="streamvio"  # Grupo específico para el servicio
VERBOSE=0                # Modo detallado (0=normal, 1=detallado)
FORCE_REINSTALL=0        # Forzar reinstalación

# Crear o limpiar archivos de log
> "$INSTALL_LOG"
> "$ERROR_LOG"

# ===== Funciones auxiliares =====

# Función para registrar mensajes
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$INSTALL_LOG"
    echo -e "$1"
}

# Función para registrar errores
log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: $1" | tee -a "$ERROR_LOG"
    echo -e "${RED}ERROR: $1${NC}"
}

# Función para registrar mensajes detallados
log_debug() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - DEBUG: $1" >> "$INSTALL_LOG"
    if [ $VERBOSE -eq 1 ]; then
        echo -e "${BLUE}DEBUG: $1${NC}"
    fi
}

# Función para comprobar el resultado de un comando
check_result() {
    if [ $? -ne 0 ]; then
        log_error "$1"
        if [ "$2" = "fatal" ]; then
            log_error "Error fatal. Abortando instalación."
            log_error "Revisa el log para más detalles: $INSTALL_LOG y $ERROR_LOG"
            exit 1
        fi
        return 1
    else
        log "${GREEN}✓${NC} $1"
        return 0
    fi
}

# Función para mostrar progreso
show_progress() {
    local current=$1
    local total=$2
    local title=$3
    
    # Calcular porcentaje
    local percent=$((current*100/total))
    local bar_length=40
    local filled_length=$((bar_length*percent/100))
    
    # Construir barra de progreso
    local bar=""
    for ((i=0; i<filled_length; i++)); do
        bar="${bar}█"
    done
    
    for ((i=filled_length; i<bar_length; i++)); do
        bar="${bar}░"
    done
    
    printf "\r${BLUE}%s${NC} [%s] %d%%" "$title" "$bar" "$percent"
    
    if [ "$current" -eq "$total" ]; then
        echo
    fi
}

# Función para obtener la dirección IP
get_server_ip() {
    LOCAL_IP=$(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
    
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(hostname -I | awk '{print $1}')
    fi
    
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP="localhost"
    fi
    
    echo "$LOCAL_IP"
}

# Función para configurar permisos de carpeta
configure_folder_permissions() {
    local folder="$1"
    local owner="$2"
    local group="$3"
    local permissions="$4"
    local folder_permissions="${5:-775}"
    
    if [ ! -d "$folder" ]; then
        log_error "El directorio $folder no existe."
        mkdir -p "$folder"
        log "Creado directorio $folder."
    fi
    
    # Cambiar propietario
    log_debug "Configurando propietario para $folder a $owner:$group..."
    chown -R "$owner":"$group" "$folder"
    check_result "Cambio de propietario para $folder"
    
    # Cambiar permisos de archivos
    log_debug "Configurando permisos para archivos en $folder a $permissions..."
    find "$folder" -type f -exec chmod "$permissions" {} \;
    check_result "Cambio de permisos para archivos en $folder"
    
    # Cambiar permisos de carpetas
    log_debug "Configurando permisos para directorios en $folder a $folder_permissions..."
    find "$folder" -type d -exec chmod "$folder_permissions" {} \;
    check_result "Cambio de permisos para directorios en $folder"
}

# Función para verificar si una herramienta está instalada
check_tool() {
    local tool="$1"
    local install_command="$2"
    local package_name="${3:-$tool}"
    
    if ! command -v "$tool" &> /dev/null; then
        log_error "$tool no está instalado."
        if [ -n "$install_command" ]; then
            log "Intentando instalar $package_name..."
            eval "$install_command"
            if command -v "$tool" &> /dev/null; then
                log "${GREEN}✓${NC} $tool instalado correctamente"
                return 0
            else
                log_error "No se pudo instalar $tool automáticamente"
                return 1
            fi
        else
            return 1
        fi
    else
        log_debug "$tool está instalado"
        return 0
    fi
}

# Función para limpiar en caso de error
cleanup_on_error() {
    log "Limpiando archivos temporales..."
    
    if systemctl is-active --quiet streamvio.service; then
        log "Deteniendo servicio streamvio..."
        systemctl stop streamvio.service
    fi
    
    if [ -f "/etc/systemd/system/streamvio.service" ] && [ $FORCE_REINSTALL -eq 1 ]; then
        log "Eliminando servicio systemd..."
        rm -f "/etc/systemd/system/streamvio.service"
        systemctl daemon-reload
    fi
    
    log "${YELLOW}La instalación falló pero se limpiaron los archivos temporales.${NC}"
    log "${YELLOW}Revisa los logs en $INSTALL_LOG y $ERROR_LOG para más detalles.${NC}"
}

# Trap para manejar interrupciones y errores
trap cleanup_on_error EXIT INT TERM

# ===== Inicio del script =====
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}         StreamVio - Instalación v1.0                          ${NC}"
echo -e "${BLUE}================================================================${NC}\n"

# Procesar argumentos
while getopts "hvfp:d:" opt; do
    case ${opt} in
        h )
            echo "Uso: $0 [-h] [-v] [-f] [-p puerto] [-d directorio]"
            echo "  -h  Muestra esta ayuda"
            echo "  -v  Modo detallado"
            echo "  -f  Forzar reinstalación incluso si está instalado"
            echo "  -p  Especificar puerto personalizado (por defecto: 45000)"
            echo "  -d  Especificar directorio de instalación (por defecto: directorio actual)"
            exit 0
            ;;
        v )
            VERBOSE=1
            echo "Modo detallado activado"
            ;;
        f )
            FORCE_REINSTALL=1
            echo "Reinstalación forzada activada"
            ;;
        p )
            STREAMVIO_PORT=$OPTARG
            echo "Puerto personalizado: $STREAMVIO_PORT"
            ;;
        d )
            CUSTOM_DIR=$OPTARG
            echo "Directorio personalizado: $CUSTOM_DIR"
            ;;
        \? )
            echo "Opción inválida: -$OPTARG" >&2
            exit 1
            ;;
    esac
done

log "Iniciando instalación de StreamVio..."

# Comprobar si se está ejecutando como root
if [ "$EUID" -ne 0 ]; then
    log_error "Este script debe ejecutarse con privilegios de administrador (sudo)."
    echo -e "${YELLOW}Por favor, ejecuta el script de la siguiente manera:${NC}"
    echo -e "  sudo ./$(basename "$0")"
    exit 1
fi

# Detectar sistema operativo
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$ID
    OS_VERSION=$VERSION_ID
    log "Sistema operativo detectado: $OS_NAME $OS_VERSION"
else
    OS_NAME="unknown"
    log_error "No se pudo detectar la distribución Linux"
fi

# Obtener la IP del servidor
SERVER_IP=$(get_server_ip)
log "Dirección IP detectada: $SERVER_IP"

# Determinar el directorio de instalación
if [ -n "$CUSTOM_DIR" ]; then
    INSTALL_DIR="$CUSTOM_DIR"
else
    INSTALL_DIR=$(pwd)
fi
log "Directorio de instalación: $INSTALL_DIR"

# Verificar que los archivos necesarios existen
if [ ! -d "$INSTALL_DIR/server" ] || [ ! -d "$INSTALL_DIR/clients/web" ]; then
    log_error "No se encontraron los directorios de StreamVio en $INSTALL_DIR"
    log_error "Por favor, ejecuta este script desde la carpeta raíz del proyecto StreamVio."
    exit 1
fi

# ===== Paso 1: Verificar requisitos del sistema =====
log "Paso 1/9: ${YELLOW}Verificando requisitos del sistema...${NC}"
show_progress 1 9 "Verificando requisitos"

# Verificar Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    log "Node.js detectado: v$NODE_VERSION"
    
    if [ "$NODE_MAJOR" -lt 14 ]; then
        log_error "La versión de Node.js es menor que la requerida (v14+). Se procederá a actualizarla."
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

# Comprobar Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    log "Git detectado: $GIT_VERSION"
else
    log_error "Git no está instalado. Se procederá a instalarlo."
    INSTALL_GIT=true
fi

# Comprobar SQLite
if command -v sqlite3 &> /dev/null; then
    SQLITE_VERSION=$(sqlite3 --version | awk '{print $1}')
    log "SQLite detectado: $SQLITE_VERSION"
else
    log_error "SQLite no está instalado. Se procederá a instalarlo."
    INSTALL_SQLITE=true
fi

# Comprobar que el puerto no está en uso
if lsof -Pi :$STREAMVIO_PORT -sTCP:LISTEN -t >/dev/null ; then
    log_error "El puerto $STREAMVIO_PORT está en uso. Por favor, elija otro puerto."
    exit 1
fi

# ===== Paso 2: Instalar dependencias del sistema =====
log "Paso 2/9: ${YELLOW}Instalando dependencias del sistema...${NC}"
show_progress 2 9 "Instalando dependencias"

if [ "$OS_NAME" = "ubuntu" ] || [ "$OS_NAME" = "debian" ]; then
    # Actualizando repositorios
    apt-get update -y >> "$INSTALL_LOG" 2>&1
    check_result "Actualización de repositorios"
    
    # Instalar build-essential y otras dependencias comunes
    log "Instalando dependencias comunes..."
    apt-get install -y build-essential curl libpng-dev acl >> "$INSTALL_LOG" 2>&1
    check_result "Instalación de dependencias comunes"
    
    if [ "$INSTALL_NODE" = true ]; then
        log "Instalando Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_16.x | bash - >> "$INSTALL_LOG" 2>&1
        apt-get install -y nodejs >> "$INSTALL_LOG" 2>&1
        check_result "Instalación de Node.js" "fatal"
    fi
    
    if [ "$INSTALL_FFMPEG" = true ]; then
        log "Instalando FFmpeg..."
        apt-get install -y ffmpeg >> "$INSTALL_LOG" 2>&1
        check_result "Instalación de FFmpeg" "fatal"
    fi
    
    if [ "$INSTALL_GIT" = true ]; then
        log "Instalando Git..."
        apt-get install -y git >> "$INSTALL_LOG" 2>&1
        check_result "Instalación de Git" "fatal"
    fi
    
    if [ "$INSTALL_SQLITE" = true ]; then
        log "Instalando SQLite..."
        apt-get install -y sqlite3 >> "$INSTALL_LOG" 2>&1
        check_result "Instalación de SQLite" "fatal"
    fi
    
elif [ "$OS_NAME" = "centos" ] || [ "$OS_NAME" = "rhel" ] || [ "$OS_NAME" = "fedora" ]; then
    # Manejar distribuciones basadas en RPM
    log "Distribución basada en RPM detectada. Instalando dependencias..."
    
    # Actualizar repositorios dependiendo de la distribución
    if [ "$OS_NAME" = "fedora" ]; then
        dnf update -y >> "$INSTALL_LOG" 2>&1
    else
        yum update -y >> "$INSTALL_LOG" 2>&1
    fi
    check_result "Actualización de repositorios"
    
    # Instalar dependencias comunes
    if [ "$OS_NAME" = "fedora" ]; then
        dnf install -y gcc-c++ make curl libpng-devel acl >> "$INSTALL_LOG" 2>&1
    else
        yum install -y gcc-c++ make curl libpng-devel acl >> "$INSTALL_LOG" 2>&1
    fi
    check_result "Instalación de dependencias comunes"
    
    if [ "$INSTALL_NODE" = true ]; then
        log "Instalando Node.js..."
        if [ "$OS_NAME" = "fedora" ]; then
            dnf module install -y nodejs:16 >> "$INSTALL_LOG" 2>&1
        else
            curl -fsSL https://rpm.nodesource.com/setup_16.x | bash - >> "$INSTALL_LOG" 2>&1
            yum install -y nodejs >> "$INSTALL_LOG" 2>&1
        fi
        check_result "Instalación de Node.js" "fatal"
    fi
    
    if [ "$INSTALL_FFMPEG" = true ]; then
        log "Instalando FFmpeg..."
        if [ "$OS_NAME" = "fedora" ]; then
            dnf install -y ffmpeg >> "$INSTALL_LOG" 2>&1
        else
            # CentOS y RHEL requieren el repositorio EPEL
            yum install -y epel-release >> "$INSTALL_LOG" 2>&1
            yum install -y ffmpeg >> "$INSTALL_LOG" 2>&1
        fi
        check_result "Instalación de FFmpeg" "fatal"
    fi
    
    if [ "$INSTALL_GIT" = true ]; then
        log "Instalando Git..."
        if [ "$OS_NAME" = "fedora" ]; then
            dnf install -y git >> "$INSTALL_LOG" 2>&1
        else
            yum install -y git >> "$INSTALL_LOG" 2>&1
        fi
        check_result "Instalación de Git" "fatal"
    fi
    
    if [ "$INSTALL_SQLITE" = true ]; then
        log "Instalando SQLite..."
        if [ "$OS_NAME" = "fedora" ]; then
            dnf install -y sqlite >> "$INSTALL_LOG" 2>&1
        else
            yum install -y sqlite >> "$INSTALL_LOG" 2>&1
        fi
        check_result "Instalación de SQLite" "fatal"
    fi
    
else
    log_error "Distribución no soportada automáticamente: $OS_NAME"
    log_error "Por favor, instala Node.js v14+, FFmpeg, Git y SQLite manualmente."
    log "Intentando continuar de todos modos..."
fi

# ===== Paso 3: Preparar la estructura de directorios =====
log "Paso 3/9: ${YELLOW}Preparando estructura de directorios...${NC}"
show_progress 3 9 "Preparando directorios"

# Crear directorios necesarios
log "Creando directorios de datos..."
mkdir -p "$INSTALL_DIR/server/data-storage/thumbnails" \
         "$INSTALL_DIR/server/data-storage/transcoded" \
         "$INSTALL_DIR/server/data-storage/metadata" >> "$INSTALL_LOG" 2>&1
check_result "Creación de directorios para datos"

# ===== Paso 4: Crear usuario y grupo para StreamVio =====
log "Paso 4/9: ${YELLOW}Creando usuario y grupo para StreamVio...${NC}"
show_progress 4 9 "Creando usuario"

# Comprobar si el usuario ya existe
if id "$STREAMVIO_USER" &>/dev/null; then
    log "El usuario $STREAMVIO_USER ya existe"
    USER_EXISTS=1
else
    # Crear grupo si no existe
    if ! getent group "$STREAMVIO_GROUP" &>/dev/null; then
        groupadd "$STREAMVIO_GROUP" >> "$INSTALL_LOG" 2>&1
        check_result "Creación de grupo $STREAMVIO_GROUP"
    else
        log "El grupo $STREAMVIO_GROUP ya existe"
    fi
    
    # Crear usuario sin directorio home ni shell de login
    useradd -r -g "$STREAMVIO_GROUP" -s /bin/false -M "$STREAMVIO_USER" >> "$INSTALL_LOG" 2>&1
    check_result "Creación de usuario $STREAMVIO_USER"
    USER_EXISTS=0
fi

# Añadir usuario actual al grupo streamvio para facilitar desarrollo/administración
log "Añadiendo usuario actual al grupo $STREAMVIO_GROUP para facilitar la administración..."
if [ "$EUID" -eq 0 ]; then
    # Si estamos ejecutando como root, añadir el usuario que ejecutó sudo
    REAL_USER=$(who am i | awk '{print $1}')
    if [ -n "$REAL_USER" ]; then
        usermod -a -G "$STREAMVIO_GROUP" "$REAL_USER" >> "$INSTALL_LOG" 2>&1
        check_result "Añadir usuario $REAL_USER al grupo $STREAMVIO_GROUP"
    fi
fi

# ===== Paso 5: Instalar dependencias de Node.js (NPM) =====
log "Paso 5/9: ${YELLOW}Instalando dependencias de Node.js...${NC}"
show_progress 5 9 "Instalando dependencias npm"

# Instalar dependencias del servidor
cd "$INSTALL_DIR/server"
log "Instalando dependencias del servidor..."
if [ -f "package.json" ]; then
    npm install --no-fund --no-audit --loglevel=error > "$INSTALL_LOG.npm_server" 2>&1
    check_result "Instalación de dependencias del servidor" "fatal"
else
    log_error "No se encontró package.json en el directorio del servidor"
    exit 1
fi

# Instalar dependencias del cliente web
cd "$INSTALL_DIR/clients/web"
log "Instalando dependencias del cliente web..."
if [ -f "package.json" ]; then
    npm install --no-fund --no-audit --loglevel=error > "$INSTALL_LOG.npm_client" 2>&1
    check_result "Instalación de dependencias del cliente" "fatal"
else
    log_error "No se encontró package.json en el directorio del cliente"
    exit 1
fi

# Si hay un módulo core con C++, compilar también
if [ -d "$INSTALL_DIR/core" ] && [ -f "$INSTALL_DIR/core/package.json" ]; then
    cd "$INSTALL_DIR/core"
    log "Instalando y compilando dependencias del módulo core..."
    npm install --no-fund --no-audit --loglevel=error > "$INSTALL_LOG.npm_core" 2>&1
    check_result "Instalación de dependencias del módulo core"
    
    # Compilar módulo core si hay binding.gyp
    if [ -f "$INSTALL_DIR/core/bindings/node/binding.gyp" ]; then
        cd "$INSTALL_DIR/core/bindings/node"
        log "Compilando módulo nativo..."
        npx node-gyp rebuild > "$INSTALL_LOG.core_build" 2>&1
        check_result "Compilación del módulo nativo"
    fi
fi

# ===== Paso 6: Compilar cliente web =====
log "Paso 6/9: ${YELLOW}Compilando cliente web...${NC}"
show_progress 6 9 "Compilando cliente web"

cd "$INSTALL_DIR/clients/web"
log "Ejecutando compilación del cliente web..."

# Exportar variable de entorno para la URL de la API
export PUBLIC_API_URL="http://$SERVER_IP:$STREAMVIO_PORT/api"
echo "PUBLIC_API_URL=$PUBLIC_API_URL" > .env
log_debug "Variable de entorno PUBLIC_API_URL configurada a $PUBLIC_API_URL"

# Compilar cliente web
npm run build > "$INSTALL_LOG.npm_build" 2>&1

if [ $? -ne 0 ]; then
    log_error "Error en la compilación del cliente web. Verificando logs..."
    tail -n 20 "$INSTALL_LOG.npm_build" | tee -a "$ERROR_LOG"
    
    # Intentar con opciones aumentadas de memoria
    export NODE_OPTIONS="--max-old-space-size=4096"
    log "Reintentando con más memoria asignada..."
    npm run build > "$INSTALL_LOG.npm_build_retry" 2>&1
    
    if [ $? -ne 0 ]; then
        log_error "Compilación fallida nuevamente."
        exit 1
    else
        log "${GREEN}✓ Compilación del cliente web completada exitosamente (segundo intento)${NC}"
    fi
else
    log "${GREEN}✓ Compilación del cliente web completada exitosamente${NC}"
fi

# ===== Paso 7: Configurar archivos de entorno =====
log "Paso 7/9: ${YELLOW}Configurando archivos de entorno...${NC}"
show_progress 7 9 "Configurando archivos"

# Crear archivo .env para el servidor
cd "$INSTALL_DIR/server"
cat > ".env" << EOF
PORT=$STREAMVIO_PORT
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./data/streamvio.db
HOST=0.0.0.0
API_URL=http://$SERVER_IP:$STREAMVIO_PORT/api
EOF
check_result "Creación de archivo .env del servidor"

# ===== Paso 8: Configurar permisos adecuados =====
log "Paso 8/9: ${YELLOW}Configurando permisos...${NC}"
show_progress 8 9 "Configurando permisos"

# 1. Directorio de datos
configure_folder_permissions "$INSTALL_DIR/server/data-storage" "$STREAMVIO_USER" "$STREAMVIO_GROUP" "664" "775"

# 2. Cliente web compilado
if [ -d "$INSTALL_DIR/clients/web/dist" ]; then
    configure_folder_permissions "$INSTALL_DIR/clients/web/dist" "$STREAMVIO_USER" "$STREAMVIO_GROUP" "644" "755"
else
    log_error "No se encontró el directorio dist del cliente web compilado"
fi

# 3. Archivos del servidor con permisos adecuados
chown -R "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR/server"
chmod -R 750 "$INSTALL_DIR/server"  # rwxr-x---
chmod 640 "$INSTALL_DIR/server/.env"  # rw-r-----
check_result "Configuración de permisos para servidor"

# ===== Paso 9: Crear servicio e inicializarlo =====
log "Paso 9/9: ${YELLOW}Configurando servicio systemd...${NC}"
show_progress 9 9 "Configurando servicio"

# Crear subdirectorio para la base de datos si no existe
mkdir -p "$INSTALL_DIR/server/data"
chown "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR/server/data"
chmod 775 "$INSTALL_DIR/server/data"

# Crear servicio systemd
log "Creando servicio systemd para StreamVio..."

cat > /etc/systemd/system/streamvio.service << EOF
[Unit]
Description=StreamVio Media Server
After=network.target

[Service]
Type=simple
User=$STREAMVIO_USER
Group=$STREAMVIO_GROUP
WorkingDirectory=$INSTALL_DIR/server
ExecStart=$(which node) server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Variables de entorno
Environment=NODE_ENV=production
Environment=PORT=$STREAMVIO_PORT

[Install]
WantedBy=multi-user.target
EOF
check_result "Creación del servicio systemd"

# Verificar permisos para el archivo de servicio
chmod 644 "/etc/systemd/system/streamvio.service"
check_result "Configuración de permisos para archivo de servicio"

# Inicializar base de datos si no existe
if [ ! -f "$INSTALL_DIR/server/data/streamvio.db" ]; then
    log "Inicializando la base de datos..."
    cd "$INSTALL_DIR/server"
    
    # Verificar si existe un script de inicialización específico
    if [ -f "$INSTALL_DIR/server/scripts/initialize.js" ]; then
        sudo -u "$STREAMVIO_USER" node scripts/initialize.js >> "$INSTALL_LOG" 2>&1
        check_result "Inicialización de la base de datos"
    else
        # Aplicar migraciones si no hay un script de inicialización específico
        log "No se encontró scripts/initialize.js, intentando aplicar migraciones..."
        if [ -f "$INSTALL_DIR/server/scripts/migrate.js" ]; then
            sudo -u "$STREAMVIO_USER" node scripts/migrate.js >> "$INSTALL_LOG" 2>&1
            check_result "Aplicación de migraciones"
        else
            log_error "No se encontraron scripts de inicialización o migración. La base de datos se creará automáticamente al iniciar el servicio."
        fi
    fi
else
    log "Base de datos ya existe, omitiendo inicialización."
fi

# Recargar systemd
systemctl daemon-reload
check_result "Recarga de systemd"

# Habilitar e iniciar el servicio
log "Habilitando e iniciando el servicio..."

# Habilitar servicio para arranque automático
systemctl enable streamvio.service >> "$INSTALL_LOG" 2>&1
check_result "Habilitación del servicio para arranque automático"

# Iniciar el servicio
systemctl start streamvio.service >> "$INSTALL_LOG" 2>&1

# Verificar que el servicio está ejecutándose
sleep 5
if systemctl is-active --quiet streamvio.service; then
    log "${GREEN}✓ El servicio StreamVio está activo y funcionando correctamente${NC}"
else
    log_error "El servicio StreamVio no pudo iniciarse. Verificando logs:"
    journalctl -u streamvio.service --no-pager -n 20 | tee -a "$ERROR_LOG"
    
    # Intentar iniciar con comando directo para depurar
    log "Intentando iniciar manualmente para depurar..."
    cd "$INSTALL_DIR/server"
    sudo -u "$STREAMVIO_USER" NODE_ENV=production PORT=$STREAMVIO_PORT node server.js > "$INSTALL_LOG.manual_start" 2>&1 &
    MANUAL_PID=$!
    
    sleep 5
    if kill -0 $MANUAL_PID 2>/dev/null; then
        log "${GREEN}Iniciado manualmente con éxito (PID: $MANUAL_PID)${NC}"
        log "Por favor revise los logs y configure el servicio manualmente."
    else
        log_error "Fallo al iniciar manualmente. Consulta los logs para más detalles."
    fi
fi

# Abrir el puerto en el firewall si está activo
if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
    log "Configurando firewall (ufw)..."
    ufw allow $STREAMVIO_PORT/tcp >> "$INSTALL_LOG" 2>&1
    check_result "Apertura del puerto $STREAMVIO_PORT en el firewall"
elif command -v firewall-cmd &> /dev/null && firewall-cmd --state | grep -q "running"; then
    log "Configurando firewall (firewalld)..."
    firewall-cmd --permanent --add-port=$STREAMVIO_PORT/tcp >> "$INSTALL_LOG" 2>&1
    firewall-cmd --reload >> "$INSTALL_LOG" 2>&1
    check_result "Apertura del puerto $STREAMVIO_PORT en el firewall"
fi

# Desactivar trap para permitir salida exitosa
trap - EXIT INT TERM

# Mostrar información final de instalación
ACTUAL_URL="http://$SERVER_IP:$STREAMVIO_PORT"

echo -e "\n${GREEN}=====================================================${NC}"
echo -e "${GREEN}      ¡Instalación de StreamVio completada!           ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo -e "\n${YELLOW}Información de acceso:${NC}"
echo -e "• URL de acceso: ${GREEN}$ACTUAL_URL${NC}"
echo -e "• Puerto: ${GREEN}$STREAMVIO_PORT${NC}"
echo -e "\n${YELLOW}Configuración inicial:${NC}"
echo -e "1. Accede a la URL en tu navegador"
echo -e "2. Completa el formulario de configuración inicial para crear el usuario administrador"
echo -e "\n${YELLOW}Estado del servicio:${NC}"
echo -e "• El servicio está ${GREEN}activo${NC} y configurado para iniciar automáticamente al arrancar"
echo -e "• Logs: ${GREEN}journalctl -u streamvio.service -f${NC}"
echo -e "\n${YELLOW}Gestión del servicio:${NC}"
echo -e "• Reiniciar: ${GREEN}sudo systemctl restart streamvio.service${NC}"
echo -e "• Detener: ${GREEN}sudo systemctl stop streamvio.service${NC}"
echo -e "• Ver estado: ${GREEN}sudo systemctl status streamvio.service${NC}"
echo -e "\n${GREEN}¡Disfruta de StreamVio!${NC}\n"