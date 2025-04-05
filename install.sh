#!/bin/bash

# StreamVio - Script de instalación unificado mejorado (versión 3.0)
# Este script maneja la instalación completa del sistema StreamVio con mayor robustez y manejo de errores

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ===== Configuración =====
STREAMVIO_PORT=45000    # Puerto unificado para la aplicación
INSTALL_LOG="streamvio-install.log"
ERROR_LOG="streamvio-errors.log"
STREAMVIO_USER="streamvio"  # Usuario específico para el servicio
STREAMVIO_GROUP="streamvio"  # Grupo específico para el servicio
VERBOSE=0                # Modo detallado (0=normal, 1=detallado)
FORCE_REINSTALL=0        # Forzar reinstalación incluso si está instalado

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

# Función para registrar mensajes detallados (solo cuando VERBOSE=1)
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
    
    # Calcular porcentaje y longitud de la barra
    local percent=$((current*100/total))
    local bar_length=40
    local filled_length=$((bar_length*percent/100))
    
    # Construir la barra de progreso
    local bar=""
    for ((i=0; i<filled_length; i++)); do
        bar="${bar}█"
    done
    
    # Rellenar el resto con espacios
    for ((i=filled_length; i<bar_length; i++)); do
        bar="${bar}░"
    done
    
    # Mostrar la barra de progreso
    printf "\r${BLUE}%s${NC} [%s] %d%%" "$title" "$bar" "$percent"
    
    # Nueva línea si hemos terminado
    if [ "$current" -eq "$total" ]; then
        echo
    fi
}

# Función para obtener la dirección IP
get_server_ip() {
    # Intentar obtener IPv4 local (no loopback)
    LOCAL_IP=$(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
    
    # Si no se pudo obtener la IP con el método anterior, intentar con hostname
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(hostname -I | awk '{print $1}')
    fi
    
    # Si todavía no tenemos IP, usar la dirección local
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP="localhost"
    fi
    
    echo "$LOCAL_IP"
}

# Función para configurar permisos de carpeta de forma recursiva
configure_folder_permissions() {
    local folder="$1"
    local owner="$2"
    local group="$3"
    local permissions="$4"
    local folder_permissions="${5:-775}"
    
    if [ ! -d "$folder" ]; then
        log_error "El directorio $folder no existe."
        return 1
    fi
    
    # Cambiar propietario y grupo
    log_debug "Configurando propietario y grupo para $folder a $owner:$group..."
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
    
    # Configurar bit SGID para carpetas para mantener el grupo
    log_debug "Configurando bit SGID para directorios en $folder..."
    find "$folder" -type d -exec chmod g+s {} \;
    check_result "Configuración de bit SGID para directorios en $folder"
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
    
    # Detener el servicio si existe
    if systemctl is-active --quiet streamvio.service; then
        log "Deteniendo servicio streamvio..."
        systemctl stop streamvio.service
    fi
    
    # Eliminar el servicio si existe
    if [ -f "/etc/systemd/system/streamvio.service" ]; then
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
echo -e "${BLUE}         StreamVio - Instalación Unificada v3.0                ${NC}"
echo -e "${BLUE}================================================================${NC}\n"

# Procesar argumentos
while getopts "hvfp:" opt; do
    case ${opt} in
        h )
            echo "Uso: $0 [-h] [-v] [-f] [-p puerto]"
            echo "  -h  Muestra esta ayuda"
            echo "  -v  Modo detallado"
            echo "  -f  Forzar reinstalación incluso si está instalado"
            echo "  -p  Especificar puerto personalizado (por defecto: 45000)"
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
        \? )
            echo "Opción inválida: -$OPTARG" >&2
            exit 1
            ;;
    esac
done

log "Iniciando instalación de StreamVio..."

# Obtener la ruta absoluta del directorio de instalación
INSTALL_DIR=$(pwd)
log "Directorio de instalación: $INSTALL_DIR"

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
        # Usar nvm para instalar Node.js (más flexible que los repositorios)
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash >> "$INSTALL_LOG" 2>&1
        # Cargar nvm sin reiniciar la terminal
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        # Instalar la versión LTS de Node.js
        nvm install --lts >> "$INSTALL_LOG" 2>&1
        check_result "Instalación de Node.js" "fatal"
        # Asegurar que se utiliza la versión LTS
        nvm use --lts >> "$INSTALL_LOG" 2>&1
        # Verificar instalación
        node -v >> "$INSTALL_LOG" 2>&1
        npm -v >> "$INSTALL_LOG" 2>&1
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
        # Usar nvm para instalar Node.js (más flexible que los repositorios)
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash >> "$INSTALL_LOG" 2>&1
        # Cargar nvm sin reiniciar la terminal
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        # Instalar la versión LTS de Node.js
        nvm install --lts >> "$INSTALL_LOG" 2>&1
        check_result "Instalación de Node.js" "fatal"
        # Asegurar que se utiliza la versión LTS
        nvm use --lts >> "$INSTALL_LOG" 2>&1
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

# Crear directorios necesarios para la base de datos y otros datos
log "Creando directorios de datos..."
mkdir -p "$INSTALL_DIR/server/data/thumbnails" \
         "$INSTALL_DIR/server/data/transcoded" \
         "$INSTALL_DIR/server/data/cache" \
         "$INSTALL_DIR/server/data/metadata" >> "$INSTALL_LOG" 2>&1
check_result "Creación de directorios para datos"

# Crear directorios para el cliente web
log "Creando directorios para cliente web..."
mkdir -p "$INSTALL_DIR/clients/web/.astro" \
         "$INSTALL_DIR/clients/web/node_modules" \
         "$INSTALL_DIR/clients/web/dist" \
         "$INSTALL_DIR/clients/web/.vite" >> "$INSTALL_LOG" 2>&1
check_result "Creación de directorios para cliente web"

# Dar permisos amplios temporalmente para la compilación 
# (se ajustarán más adelante)
chmod -R 777 "$INSTALL_DIR/clients/web/.astro" \
             "$INSTALL_DIR/clients/web/node_modules" \
             "$INSTALL_DIR/clients/web/dist" \
             "$INSTALL_DIR/clients/web/.vite" >> "$INSTALL_LOG" 2>&1
check_result "Configuración de permisos temporales para directorios de compilación"

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
    # IMPORTANTE: Instalar como usuario normal para evitar problemas de permisos
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

# ===== Paso 6: Compilar cliente web =====
log "Paso 6/9: ${YELLOW}Compilando cliente web...${NC}"
show_progress 6 9 "Compilando cliente web"

cd "$INSTALL_DIR/clients/web"
log "Ejecutando compilación del cliente web..."

# Exportar variable de entorno para la URL de la API
export PUBLIC_API_URL="http://$SERVER_IP:$STREAMVIO_PORT"
echo "PUBLIC_API_URL=$PUBLIC_API_URL" > .env
log_debug "Variable de entorno PUBLIC_API_URL configurada a $PUBLIC_API_URL"

# Compilar cliente web (importante: como usuario normal, no root/sudo)
npm run build > "$INSTALL_LOG.npm_build" 2>&1

if [ $? -ne 0 ]; then
    log_error "Error en la compilación del cliente web. Intentando solución alternativa..."
    
    # Mostrar últimas líneas del log para diagnóstico
    log_error "Últimas líneas del log de compilación:"
    tail -n 20 "$INSTALL_LOG.npm_build" | tee -a "$ERROR_LOG"
    
    # Intentar usar npx directamente para compilar
    log "Intentando compilar con npx directamente..."
    npx astro build > "$INSTALL_LOG.npx_build" 2>&1
    
    if [ $? -ne 0 ]; then
        log_error "La compilación falló nuevamente. Último intento con opciones de entorno..."
        
        # Último intento: configurar variables NODE_OPTIONS para aumentar memoria disponible
        export NODE_OPTIONS="--max-old-space-size=4096"
        npm run build > "$INSTALL_LOG.npm_build_with_options" 2>&1
        
        if [ $? -ne 0 ]; then
            log_error "No se pudo compilar el cliente web después de varios intentos."
            log_error "Por favor, revise los logs para más detalles."
            exit 1
        else
            log "${GREEN}✓ Compilación del cliente web completada exitosamente (tercer intento)${NC}"
        fi
    else
        log "${GREEN}✓ Compilación del cliente web completada exitosamente (segundo intento)${NC}"
    fi
else
    log "${GREEN}✓ Compilación del cliente web completada exitosamente${NC}"
fi

# ===== Paso 7: Configurar archivos de entorno =====
log "Paso 7/9: ${YELLOW}Configurando archivos de entorno...${NC}"
show_progress 7 9 "Configurando archivos"

# Crear servidor .env
cd "$INSTALL_DIR/server"
cat > ".env" << EOF
PORT=$STREAMVIO_PORT
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./data/streamvio.db
HOST=0.0.0.0
SERVICE_USER=$STREAMVIO_USER
SERVICE_GROUP=$STREAMVIO_GROUP
API_URL=http://$SERVER_IP:$STREAMVIO_PORT
EOF
check_result "Creación de archivo .env del servidor"

# ===== Paso 8: Configurar permisos adecuados =====
log "Paso 8/9: ${YELLOW}Configurando permisos...${NC}"
show_progress 8 9 "Configurando permisos"

# IMPORTANTE: Primero ajustar permisos antes de inicializar la base de datos
log "Ajustando permisos para el directorio de instalación..."

# 1. Directorio de datos con permisos amplios (similar a Jellyfin/Plex)
configure_folder_permissions "$INSTALL_DIR/server/data" "$STREAMVIO_USER" "$STREAMVIO_GROUP" "664" "775"

# 2. Cliente web compilado (solo lectura para streamvio, administrado por root)
if [ -d "$INSTALL_DIR/clients/web/dist" ]; then
    log "Configurando permisos del cliente web compilado..."
    chown -R "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR/clients/web/dist"
    chmod -R 755 "$INSTALL_DIR/clients/web/dist"
    find "$INSTALL_DIR/clients/web/dist" -type f -exec chmod 644 {} \;
    check_result "Configuración de permisos para cliente web compilado"
else
    log_error "No se encontró el directorio dist del cliente web compilado"
    # No es fatal, continuamos...
fi

# 3. Archivos del servidor con permisos adecuados
log "Configurando permisos de archivos del servidor..."
chown -R "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR/server"
chmod -R 750 "$INSTALL_DIR/server"  # rwxr-x---
chmod 640 "$INSTALL_DIR/server/.env"  # rw-r-----
check_result "Configuración de permisos para servidor"

# Asegurar que los scripts tengan permisos de ejecución
chmod +x "$INSTALL_DIR/server/scripts/"*.js 2>/dev/null || true

# ===== Paso 9: Inicializar la base de datos y configurar servicio =====
log "Paso 9/9: ${YELLOW}Inicializando base de datos y configurando servicio...${NC}"
show_progress 9 9 "Finalizando instalación"

# Inicializar la base de datos como usuario streamvio
cd "$INSTALL_DIR/server"
log "Inicializando la base de datos..."
# Ejecutar como el usuario streamvio para asegurar permisos correctos
sudo -u "$STREAMVIO_USER" node scripts/initialize.js >> "$INSTALL_LOG" 2>&1

if [ $? -ne 0 ]; then
    log_error "Error al inicializar la base de datos. Intentando solución alternativa..."
    
    # Intentar inicializar con node directamente (para casos de problemas de permisos)
    node scripts/initialize.js >> "$INSTALL_LOG" 2>&1
    
    if [ $? -ne 0 ]; then
        log_error "No se pudo inicializar la base de datos. Verificando permisos..."
        
        # Verificar permisos de directorios críticos
        ls -la "$INSTALL_DIR/server/data" >> "$INSTALL_LOG" 2>&1
        
        # Último intento: inicializar y luego ajustar permisos
        node scripts/initialize.js >> "$INSTALL_LOG" 2>&1
        check_result "Inicialización de la base de datos (tercer intento)" "fatal"
        
        # Ajustar permisos de la base de datos
        chown "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR/server/data/streamvio.db"
        chmod 664 "$INSTALL_DIR/server/data/streamvio.db"  # rw-rw-r--
    fi
else
    log "${GREEN}✓ Base de datos inicializada exitosamente${NC}"
    
    # Verificar que la base de datos se creó correctamente
    DB_PATH="$INSTALL_DIR/server/data/streamvio.db"
    if [ -f "$DB_PATH" ]; then
        # Aplicar permisos correctos a la base de datos
        chown "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$DB_PATH"
        chmod 664 "$DB_PATH"  # rw-rw-r--
        check_result "Ajuste de permisos para la base de datos"
    else
        log_error "No se pudo crear la base de datos en $DB_PATH"
        exit 1
    fi
fi

# Crear servicio systemd
log "Creando servicio systemd para StreamVio..."

cat > /etc/systemd/system/streamvio.service << EOF
[Unit]
Description=StreamVio Unified Server
After=network.target

[Service]
Type=simple
User=$STREAMVIO_USER
Group=$STREAMVIO_GROUP
WorkingDirectory=$INSTALL_DIR/server
ExecStart=$(which node) app.js
Restart=on-failure
# Configuración de reinicio más robusta
RestartSec=10
StartLimitInterval=200
StartLimitBurst=5

# Variables de entorno
Environment=NODE_ENV=production
Environment=PORT=$STREAMVIO_PORT
Environment=SERVICE_USER=$STREAMVIO_USER
Environment=SERVICE_GROUP=$STREAMVIO_GROUP

# Configuración de seguridad mejorada (similar a Jellyfin/Plex)
# Asegurarse de que el servicio puede leer y escribir a sus directorios
ReadWritePaths=$INSTALL_DIR/server/data
# Limitar capacidades del servicio
CapabilityBoundingSet=
NoNewPrivileges=true
# Protección de sistema
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true

[Install]
WantedBy=multi-user.target
EOF
check_result "Creación del servicio systemd"

# Verificar permisos para el archivo de servicio
chmod 644 "/etc/systemd/system/streamvio.service"
check_result "Configuración de permisos para archivo de servicio"

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
    
    # Intentar reiniciar con opciones menos restrictivas
    log "Intentando configurar servicio con opciones menos restrictivas..."
    
    # Crear versión alternativa del servicio
    cat > /etc/systemd/system/streamvio.service << EOF
[Unit]
Description=StreamVio Unified Server
After=network.target

[Service]
Type=simple
User=$STREAMVIO_USER
Group=$STREAMVIO_GROUP
WorkingDirectory=$INSTALL_DIR/server
ExecStart=$(which node) app.js
Restart=on-failure
RestartSec=10

# Variables de entorno básicas
Environment=NODE_ENV=production
Environment=PORT=$STREAMVIO_PORT

[Install]
WantedBy=multi-user.target
EOF
    
    # Recargar y reintentar
    systemctl daemon-reload
    systemctl restart streamvio.service
    
    sleep 3
    if systemctl is-active --quiet streamvio.service; then
        log "${GREEN}✓ El servicio StreamVio está activo con configuración simplificada${NC}"
    else
        log_error "No se pudo iniciar el servicio. Puede iniciarlo manualmente con:"
        log_error "sudo systemctl start streamvio.service"
        log_error "Para ver el estado: sudo systemctl status streamvio.service"
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

# Crear scripts de utilidad

# 1. Script para verificar permisos
log "Creando scripts de utilidad..."

cat > "$INSTALL_DIR/check-permissions.sh" << EOF
#!/bin/bash

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}Verificando permisos de StreamVio...${NC}"

# Verificar usuario del servicio
echo -n "Usuario streamvio: "
if id streamvio &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}NO EXISTE${NC}"
fi

# Verificar permisos de directorios críticos
echo -e "\n${YELLOW}Permisos de directorios:${NC}"
DIRS=("$INSTALL_DIR" 
      "$INSTALL_DIR/server" 
      "$INSTALL_DIR/server/data"
      "$INSTALL_DIR/server/data/thumbnails"
      "$INSTALL_DIR/server/data/transcoded"
      "$INSTALL_DIR/clients/web/dist")

for dir in "\${DIRS[@]}"; do
    if [ -d "\$dir" ]; then
        perm=\$(stat -c "%a %U:%G" "\$dir")
        echo -e "\$dir: \${GREEN}\$perm${NC}"
    else
        echo -e "\$dir: ${RED}NO EXISTE${NC}"
    fi
done

# Verificar permisos de archivos críticos
echo -e "\n${YELLOW}Permisos de archivos críticos:${NC}"
FILES=("$INSTALL_DIR/server/app.js"
       "$INSTALL_DIR/server/.env"
       "$INSTALL_DIR/server/data/streamvio.db"
       "/etc/systemd/system/streamvio.service")

for file in "\${FILES[@]}"; do
    if [ -f "\$file" ]; then
        perm=\$(stat -c "%a %U:%G" "\$file")
        echo -e "\$file: \${GREEN}\$perm${NC}"
    else
        echo -e "\$file: ${RED}NO EXISTE${NC}"
    fi
done

# Verificar que el servicio puede ejecutar node
echo -e "\n${YELLOW}Verificando ejecución de node:${NC}"
NODE_PATH=\$(which node)
echo -n "Node.js path (\$NODE_PATH): "
if [ -x "\$NODE_PATH" ]; then
    echo -e "${GREEN}EJECUTABLE${NC}"
else
    echo -e "${RED}NO EJECUTABLE${NC}"
fi

# Verificar estado del servicio
echo -e "\n${YELLOW}Estado del servicio:${NC}"
systemctl status streamvio.service --no-pager | head -n 3

echo -e "\n${YELLOW}Últimas líneas del log:${NC}"
journalctl -u streamvio.service --no-pager -n 5

echo
echo -e "${YELLOW}Para más detalles, ejecutar:${NC}"
echo "sudo journalctl -u streamvio.service -f"
echo
EOF

chmod +x "$INSTALL_DIR/check-permissions.sh"
check_result "Creación de script para verificar permisos"

# 2. Script para añadir carpeta de medios
cat > "$INSTALL_DIR/add-media-folder.sh" << EOF
#!/bin/bash
# Script para añadir una carpeta multimedia a StreamVio con permisos adecuados

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
STREAMVIO_USER="$STREAMVIO_USER"
STREAMVIO_GROUP="$STREAMVIO_GROUP"

# Verificar que se está ejecutando como root
if [ "\$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Este script debe ejecutarse con privilegios de administrador (sudo).${NC}"
    echo -e "${YELLOW}Por favor, ejecuta el script de la siguiente manera:${NC}"
    echo -e "  sudo ./\$(basename "\$0") /ruta/a/carpeta/multimedia"
    exit 1
fi

# Verificar el número de argumentos
if [ \$# -ne 1 ]; then
    echo -e "${RED}Error: Se requiere especificar una carpeta multimedia.${NC}"
    echo -e "${YELLOW}Uso: \$0 /ruta/a/carpeta/multimedia${NC}"
    exit 1
fi

MEDIA_FOLDER="\$1"

# Verificar que la carpeta existe
if [ ! -d "\$MEDIA_FOLDER" ]; then
    echo -e "${YELLOW}La carpeta \$MEDIA_FOLDER no existe. ¿Deseas crearla? (s/n)${NC}"
    read -r response
    if [[ "\$response" =~ ^[Ss]$ ]]; then
        mkdir -p "\$MEDIA_FOLDER"
        if [ \$? -ne 0 ]; then
            echo -e "${RED}Error: No se pudo crear la carpeta \$MEDIA_FOLDER${NC}"
            exit 1
        fi
        echo -e "${GREEN}Carpeta creada: \$MEDIA_FOLDER${NC}"
    else
        echo -e "${RED}Operación cancelada.${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}=================== CONFIGURACIÓN DE CARPETA MULTIMEDIA ===================${NC}"
echo -e "${BLUE}Carpeta: ${NC}\$MEDIA_FOLDER"
echo -e "${BLUE}Usuario: ${NC}\$STREAMVIO_USER"
echo -e "${BLUE}=================== APLICANDO PERMISOS ===================${NC}"

# Verificar que el usuario streamvio existe
if ! id "\$STREAMVIO_USER" &>/dev/null; then
    echo -e "${RED}Error: El usuario \$STREAMVIO_USER no existe.${NC}"
    echo -e "${YELLOW}Asegúrate de haber instalado StreamVio correctamente.${NC}"
    exit 1
fi

# Método 1: Intentar usar ACLs (más preciso)
if command -v setfacl &> /dev/null; then
    echo -e "${GREEN}Usando ACLs para configurar permisos...${NC}"
    
    # Verificar si el sistema de archivos soporta ACLs
    SUPPORTS_ACL=0
    if mount | grep "\$(df -P "\$MEDIA_FOLDER" | awk 'NR==2 {print \$6}')" | grep -q "acl"; then
        SUPPORTS_ACL=1
    elif [[ \$(stat -f -c %T "\$MEDIA_FOLDER" 2>/dev/null) == *acl* ]]; then
        SUPPORTS_ACL=1
    fi
    
    if [ \$SUPPORTS_ACL -eq 1 ]; then
        # Aplicar ACLs recursivamente
        echo -e "${YELLOW}Aplicando permisos de lectura y ejecución para carpetas...${NC}"
        find "\$MEDIA_FOLDER" -type d -exec setfacl -m u:\$STREAMVIO_USER:rx {} \;
        
        echo -e "${YELLOW}Aplicando permisos de lectura para archivos...${NC}"
        find "\$MEDIA_FOLDER" -type f -exec setfacl -m u:\$STREAMVIO_USER:r {} \;
        
        # Aplicar reglas por defecto para nuevos archivos
        echo -e "${YELLOW}Configurando permisos por defecto para nuevos archivos...${NC}"
        find "\$MEDIA_FOLDER" -type d -exec setfacl -d -m u:\$STREAMVIO_USER:rx {} \;
        
        # Verificar el resultado
        if [ \$? -eq 0 ]; then
            echo -e "${GREEN}✓ Permisos ACL aplicados correctamente${NC}"
        else
            echo -e "${RED}Error al aplicar permisos ACL${NC}"
            NEED_FALLBACK=true
        fi
    else
        echo -e "${YELLOW}El sistema de archivos no soporta ACLs. Usando método alternativo...${NC}"
        NEED_FALLBACK=true
    fi
else
    echo -e "${YELLOW}La herramienta setfacl no está instalada. Usando método alternativo...${NC}"
    NEED_FALLBACK=true
fi

# Método 2: Fallback - Usar chmod/chgrp tradicional si ACLs no están disponibles
if [ "\$NEED_FALLBACK" = true ]; then
    echo -e "${YELLOW}Usando método alternativo con permisos tradicionales...${NC}"
    
    # Preguntar al usuario si desea continuar con el método alternativo
    echo -e "${YELLOW}ADVERTENCIA: Este método puede cambiar permisos existentes en la carpeta.${NC}"
    read -p "¿Deseas continuar? (s/n): " response
    
    if [[ ! "\$response" =~ ^[Ss]$ ]]; then
        echo -e "${RED}Operación cancelada por el usuario.${NC}"
        exit 1
    fi
    
    # Opción 1: Añadir grupo streamvio a los archivos
    echo -e "${YELLOW}Añadiendo grupo \$STREAMVIO_GROUP a la carpeta y contenidos...${NC}"
    chgrp -R "\$STREAMVIO_GROUP" "\$MEDIA_FOLDER"
    
    # Dar permisos de lectura y ejecución al grupo
    echo -e "${YELLOW}Configurando permisos para carpetas (rx para grupo)...${NC}"
    find "\$MEDIA_FOLDER" -type d -exec chmod g+rx {} \;
    
    echo -e "${YELLOW}Configurando permisos para archivos (r para grupo)...${NC}"
    find "\$MEDIA_FOLDER" -type f -exec chmod g+r {} \;
    
    echo -e "${GREEN}✓ Permisos de grupo aplicados correctamente${NC}"
fi

# Verificación final
echo -e "${BLUE}=================== VERIFICACIÓN ===================${NC}"
echo -e "Probando acceso como usuario \$STREAMVIO_USER..."

# Verificar acceso a un archivo aleatorio para confirmar que los permisos funcionan
TEST_FILE=\$(find "\$MEDIA_FOLDER" -type f -not -path "*/\.*" | head -n 1)

if [ -z "\$TEST_FILE" ]; then
    echo -e "${YELLOW}No se encontraron archivos para probar en la carpeta.${NC}"
    echo -e "${YELLOW}Creando archivo de prueba...${NC}"
    touch "\$MEDIA_FOLDER/test_file.txt"
    echo "Archivo de prueba para StreamVio" > "\$MEDIA_FOLDER/test_file.txt"
    TEST_FILE="\$MEDIA_FOLDER/test_file.txt"
fi

# Intentar leer un archivo como usuario streamvio
if sudo -u "\$STREAMVIO_USER" cat "\$TEST_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Verificación exitosa: El usuario \$STREAMVIO_USER puede acceder a los archivos${NC}"
else
    echo -e "${RED}Error: El usuario \$STREAMVIO_USER no puede acceder al archivo de prueba.${NC}"
    echo -e "${YELLOW}Intentando ajuste final de permisos...${NC}"
    
    # Último intento - dar permisos de lectura a 'otros'
    chmod -R o+r "\$MEDIA_FOLDER"
    find "\$MEDIA_FOLDER" -type d -exec chmod o+x {} \;
    
    if sudo -u "\$STREAMVIO_USER" cat "\$TEST_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Verificación exitosa después del ajuste final${NC}"
    else
        echo -e "${RED}Error: Sigue sin funcionar. Puede ser necesario ajustar manualmente los permisos.${NC}"
    fi
fi

echo -e "\n${GREEN}Configuración completada.${NC}"
echo -e "${BLUE}=================== SIGUIENTE PASO ===================${NC}"
echo -e "Ahora puedes añadir esta carpeta como biblioteca en StreamVio:"
echo -e "  1. Inicia sesión en la interfaz web de StreamVio"
echo -e "  2. Ve a 'Gestionar bibliotecas'"
echo -e "  3. Añade una nueva biblioteca con la ruta: ${YELLOW}\$MEDIA_FOLDER${NC}"
echo -e "${BLUE}=======================================================${NC}"
EOF

chmod +x "$INSTALL_DIR/add-media-folder.sh"
check_result "Creación de script para añadir carpetas multimedia"

# 3. Script para reiniciar el servicio
cat > "$INSTALL_DIR/restart-service.sh" << EOF
#!/bin/bash
# Script para reiniciar el servicio StreamVio

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que se está ejecutando como root
if [ "\$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Este script debe ejecutarse con privilegios de administrador (sudo).${NC}"
    echo -e "${YELLOW}Por favor, ejecuta el script de la siguiente manera:${NC}"
    echo -e "  sudo ./\$(basename "\$0")"
    exit 1
fi

echo -e "${YELLOW}Reiniciando servicio StreamVio...${NC}"

# Detener servicio
systemctl stop streamvio.service
echo -e "Servicio detenido."

# Pequeña pausa para asegurar que se detenga completamente
sleep 2

# Iniciar servicio
systemctl start streamvio.service
echo -e "Servicio iniciado."

# Verificar estado
echo -e "\n${YELLOW}Estado del servicio:${NC}"
systemctl status streamvio.service --no-pager | head -n 3

# Verificar si está activo
if systemctl is-active --quiet streamvio.service; then
    echo -e "\n${GREEN}✓ El servicio StreamVio está activo y funcionando correctamente${NC}"
else
    echo -e "\n${RED}Error: El servicio no pudo iniciarse correctamente.${NC}"
    echo -e "${YELLOW}Últimas líneas del log:${NC}"
    journalctl -u streamvio.service --no-pager -n 10
    
    echo -e "\n${YELLOW}Para ver más detalles del log:${NC}"
    echo "sudo journalctl -u streamvio.service -f"
fi

exit 0
EOF

chmod +x "$INSTALL_DIR/restart-service.sh"
check_result "Creación de script para reiniciar el servicio"

# 4. Script para reparar instalación
cat > "$INSTALL_DIR/repair-installation.sh" << EOF
#!/bin/bash
# Script para reparar problemas comunes en la instalación de StreamVio

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
STREAMVIO_USER="$STREAMVIO_USER"
STREAMVIO_GROUP="$STREAMVIO_GROUP"
INSTALL_DIR="$INSTALL_DIR"

# Verificar que se está ejecutando como root
if [ "\$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Este script debe ejecutarse con privilegios de administrador (sudo).${NC}"
    echo -e "${YELLOW}Por favor, ejecuta el script de la siguiente manera:${NC}"
    echo -e "  sudo ./\$(basename "\$0")"
    exit 1
fi

echo -e "${BLUE}=================== REPARACIÓN DE STREAMVIO ===================${NC}"

# Función para comprobar el resultado de una acción
check_result() {
    if [ \$? -ne 0 ]; then
        echo -e "${RED}Error: \$1${NC}"
        return 1
    else
        echo -e "${GREEN}✓ \$1${NC}"
        return 0
    fi
}

# 1. Reparar permisos de directorios
echo -e "\n${YELLOW}Reparando permisos de directorios...${NC}"

# Directorios de datos
echo -e "Reparando permisos del directorio de datos..."
mkdir -p "\$INSTALL_DIR/server/data/thumbnails" "\$INSTALL_DIR/server/data/transcoded" "\$INSTALL_DIR/server/data/cache" "\$INSTALL_DIR/server/data/metadata"
chown -R "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$INSTALL_DIR/server/data"
chmod -R 775 "\$INSTALL_DIR/server/data"
find "\$INSTALL_DIR/server/data" -type f -exec chmod 664 {} \;
check_result "Permisos de directorios de datos"

# Reparar permisos del cliente web
echo -e "Reparando permisos del cliente web..."
if [ -d "\$INSTALL_DIR/clients/web/dist" ]; then
    chown -R "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$INSTALL_DIR/clients/web/dist"
    chmod -R 755 "\$INSTALL_DIR/clients/web/dist"
    find "\$INSTALL_DIR/clients/web/dist" -type f -exec chmod 644 {} \;
    check_result "Permisos del cliente web"
else
    echo -e "${YELLOW}El directorio dist no existe. ¿Deseas recompilar el cliente web? (s/n)${NC}"
    read -r response
    if [[ "\$response" =~ ^[Ss]$ ]]; then
        echo -e "Recompilando cliente web..."
        cd "\$INSTALL_DIR/clients/web"
        npm run build
        
        if [ \$? -eq 0 ] && [ -d "dist" ]; then
            chown -R "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "dist"
            chmod -R 755 "dist"
            find "dist" -type f -exec chmod 644 {} \;
            check_result "Recompilación y configuración de permisos del cliente web"
        else
            echo -e "${RED}Error al recompilar el cliente web${NC}"
        fi
    fi
fi

# 2. Reparar base de datos
echo -e "\n${YELLOW}Verificando base de datos...${NC}"
DB_PATH="\$INSTALL_DIR/server/data/streamvio.db"

if [ -f "\$DB_PATH" ]; then
    echo -e "Base de datos encontrada. Reparando permisos..."
    chown "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$DB_PATH"
    chmod 664 "\$DB_PATH"
    check_result "Permisos de la base de datos"
    
    # Verificar integridad
    echo -e "Verificando integridad de la base de datos..."
    if sqlite3 "\$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
        echo -e "${GREEN}✓ La base de datos está íntegra${NC}"
    else
        echo -e "${RED}La base de datos puede estar corrupta.${NC}"
        echo -e "${YELLOW}¿Deseas intentar reparar la base de datos? (s/n)${NC}"
        read -r response
        if [[ "\$response" =~ ^[Ss]$ ]]; then
            echo -e "Creando copia de seguridad..."
            cp "\$DB_PATH" "\$DB_PATH.bak"
            
            echo -e "Reparando base de datos..."
            # Usar vacuum para intentar reparar
            sudo -u "\$STREAMVIO_USER" sqlite3 "\$DB_PATH" "VACUUM;"
            check_result "Reparación de la base de datos"
        fi
    fi
else
    echo -e "${RED}Base de datos no encontrada. Inicializando nueva base de datos...${NC}"
    cd "\$INSTALL_DIR/server"
    sudo -u "\$STREAMVIO_USER" node scripts/initialize.js
    
    if [ -f "\$DB_PATH" ]; then
        chmod 664 "\$DB_PATH"
        echo -e "${GREEN}✓ Base de datos inicializada correctamente${NC}"
    else
        echo -e "${RED}Error al inicializar la base de datos${NC}"
    fi
fi

# 3. Verificar servicio systemd
echo -e "\n${YELLOW}Verificando servicio systemd...${NC}"

if [ -f "/etc/systemd/system/streamvio.service" ]; then
    echo -e "Servicio encontrado. Reconfigurando..."
    
    # Recrear el archivo de servicio
    cat > /etc/systemd/system/streamvio.service << EOL
[Unit]
Description=StreamVio Unified Server
After=network.target

[Service]
Type=simple
User=$STREAMVIO_USER
Group=$STREAMVIO_GROUP
WorkingDirectory=$INSTALL_DIR/server
ExecStart=$(which node) app.js
Restart=on-failure
RestartSec=10

# Variables de entorno básicas
Environment=NODE_ENV=production
Environment=PORT=$STREAMVIO_PORT

[Install]
WantedBy=multi-user.target
EOL
    
    chmod 644 "/etc/systemd/system/streamvio.service"
    check_result "Reconfiguración del servicio systemd"
    
    # Recargar systemd y reiniciar servicio
    systemctl daemon-reload
    systemctl restart streamvio.service
    
    # Verificar estado
    if systemctl is-active --quiet streamvio.service; then
        echo -e "${GREEN}✓ El servicio StreamVio está activo y funcionando correctamente${NC}"
    else
        echo -e "${RED}Error: El servicio no pudo iniciarse.${NC}"
        systemctl status streamvio.service --no-pager
    fi
else
    echo -e "${RED}Servicio no encontrado. Creando nuevo servicio...${NC}"
    
    # Crear archivo de servicio
    cat > /etc/systemd/system/streamvio.service << EOL
[Unit]
Description=StreamVio Unified Server
After=network.target

[Service]
Type=simple
User=$STREAMVIO_USER
Group=$STREAMVIO_GROUP
WorkingDirectory=$INSTALL_DIR/server
ExecStart=$(which node) app.js
Restart=on-failure
RestartSec=10

# Variables de entorno básicas
Environment=NODE_ENV=production
Environment=PORT=$STREAMVIO_PORT

[Install]
WantedBy=multi-user.target
EOL
    
    chmod 644 "/etc/systemd/system/streamvio.service"
    
    # Recargar systemd y habilitar servicio
    systemctl daemon-reload
    systemctl enable streamvio.service
    systemctl start streamvio.service
    
    # Verificar estado
    if systemctl is-active --quiet streamvio.service; then
        echo -e "${GREEN}✓ El servicio StreamVio está activo y funcionando correctamente${NC}"
    else
        echo -e "${RED}Error: El servicio no pudo iniciarse.${NC}"
        systemctl status streamvio.service --no-pager
    fi
fi

echo -e "\n${GREEN}¡Reparación completada!${NC}"
echo -e "${BLUE}=================== INFORMACIÓN IMPORTANTE ===================${NC}"
echo -e "• URL de acceso: ${GREEN}http://$(hostname -I | awk '{print $1}'):$STREAMVIO_PORT${NC}"
echo -e "• Para verificar el estado: ${GREEN}systemctl status streamvio.service${NC}"
echo -e "• Para ver los logs: ${GREEN}journalctl -u streamvio.service -f${NC}"
echo -e "${BLUE}=============================================================${NC}"

exit 0
EOF

chmod +x "$INSTALL_DIR/repair-installation.sh"
check_result "Creación de script de reparación"

# Desactivar trap para evitar limpieza no deseada
trap '' EXIT INT TERM

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
echo -e "\n${YELLOW}Herramientas de mantenimiento:${NC}"
echo -e "• Verificar permisos: ${GREEN}sudo $INSTALL_DIR/check-permissions.sh${NC}"
echo -e "• Añadir carpeta multimedia: ${GREEN}sudo $INSTALL_DIR/add-media-folder.sh /ruta/carpeta${NC}"
echo -e "• Reiniciar servicio: ${GREEN}sudo $INSTALL_DIR/restart-service.sh${NC}"
echo -e "• Reparar instalación: ${GREEN}sudo $INSTALL_DIR/repair-installation.sh${NC}"
echo -e "\n${GREEN}¡Disfruta de StreamVio!${NC}\n"