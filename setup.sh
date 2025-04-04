#!/bin/bash
# StreamVio - Script de instalación unificado con gestión mejorada de permisos
# Este script instala y configura StreamVio como un servicio unificado (API + frontend) en un solo puerto

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
STREAMVIO_PORT=45000    # Puerto unificado para la aplicación
INSTALL_LOG="streamvio-install.log"
ERROR_LOG="streamvio-errors.log"
STREAMVIO_USER="streamvio"  # Usuario específico para el servicio
STREAMVIO_GROUP="streamvio"  # Grupo específico para el servicio

# Función para registrar mensajes en el log
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$INSTALL_LOG"
    echo -e "$1"
}

# Función para registrar errores
log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: $1" | tee -a "$ERROR_LOG"
    echo -e "${RED}ERROR: $1${NC}"
}

# Función para comprobar el resultado del último comando
check_result() {
    if [ $? -ne 0 ]; then
        log_error "$1"
        if [ "$2" = "fatal" ]; then
            log_error "Error fatal. Abortando instalación."
            exit 1
        fi
        return 1
    else
        log "${GREEN}✓${NC} $1"
        return 0
    fi
}

# Función para mostrar el progreso
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

# Obtener la dirección IP actual
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

# Configurar archivos .env
cat > "$INSTALL_DIR/server/.env" << EOF
PORT=$STREAMVIO_PORT
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./data/streamvio.db
HOST=0.0.0.0
EOF

# Obtener la IP del servidor
SERVER_IP=$(get_server_ip)

# Configurar .env del cliente web con la IP detectada
echo "PUBLIC_API_URL=http://$SERVER_IP:$STREAMVIO_PORT" > "$INSTALL_DIR/clients/web/.env"

# Crear o limpiar archivos de log
> "$INSTALL_LOG"
> "$ERROR_LOG"

# Inicio del script
echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}         StreamVio - Instalación Unificada v1.1         ${NC}"
echo -e "${BLUE}=======================================================${NC}\n"

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

# Verificar requisitos previos
log "Paso 1/8: ${YELLOW}Verificando requisitos del sistema...${NC}"
show_progress 1 8 "Verificando requisitos"

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

# Comprobar que el puerto no está en uso
if lsof -Pi :$STREAMVIO_PORT -sTCP:LISTEN -t >/dev/null ; then
    log_error "El puerto $STREAMVIO_PORT está en uso. Por favor, elija otro puerto."
    exit 1
fi

# Instalar dependencias del sistema
log "Paso 2/8: ${YELLOW}Instalando dependencias del sistema...${NC}"
show_progress 2 8 "Instalando dependencias"

if [ "$OS_NAME" = "ubuntu" ] || [ "$OS_NAME" = "debian" ]; then
    # Actualizando repositorios
    apt-get update -y >> "$INSTALL_LOG" 2>&1
    check_result "Actualización de repositorios"
    
    # Instalar build-essential
    apt-get install -y build-essential >> "$INSTALL_LOG" 2>&1
    check_result "Instalación de build-essential"
    
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
    
    # Paquetes adicionales útiles
    log "Instalando paquetes adicionales necesarios..."
    apt-get install -y curl libpng-dev sqlite3 acl >> "$INSTALL_LOG" 2>&1
    check_result "Instalación de paquetes adicionales"
    
elif [ "$OS_NAME" = "centos" ] || [ "$OS_NAME" = "rhel" ] || [ "$OS_NAME" = "fedora" ]; then
    # Actualizar repositorios
    if [ "$OS_NAME" = "fedora" ]; then
        dnf update -y >> "$INSTALL_LOG" 2>&1
    else
        yum update -y >> "$INSTALL_LOG" 2>&1
    fi
    check_result "Actualización de repositorios"
    
    # Instalar grupo de desarrollo
    if [ "$OS_NAME" = "fedora" ]; then
        dnf groupinstall -y "Development Tools" >> "$INSTALL_LOG" 2>&1
    else
        yum groupinstall -y "Development Tools" >> "$INSTALL_LOG" 2>&1
    fi
    check_result "Instalación de herramientas de desarrollo"
    
    if [ "$INSTALL_NODE" = true ]; then
        log "Instalando Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_16.x | bash - >> "$INSTALL_LOG" 2>&1
        
        if [ "$OS_NAME" = "fedora" ]; then
            dnf install -y nodejs >> "$INSTALL_LOG" 2>&1
        else
            yum install -y nodejs >> "$INSTALL_LOG" 2>&1
        fi
        check_result "Instalación de Node.js" "fatal"
    fi
    
    if [ "$INSTALL_FFMPEG" = true ]; then
        log "Instalando FFmpeg..."
        
        if [ "$OS_NAME" = "fedora" ]; then
            dnf install -y ffmpeg ffmpeg-devel >> "$INSTALL_LOG" 2>&1
        else
            # Para CentOS/RHEL, ffmpeg no está en los repos estándar
            yum install -y epel-release >> "$INSTALL_LOG" 2>&1
            yum localinstall -y --nogpgcheck https://download1.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm >> "$INSTALL_LOG" 2>&1
            yum install -y ffmpeg ffmpeg-devel >> "$INSTALL_LOG" 2>&1
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
    
    # Paquetes adicionales útiles
    log "Instalando paquetes adicionales necesarios..."
    if [ "$OS_NAME" = "fedora" ]; then
        dnf install -y curl libpng-devel sqlite sqlite-devel acl >> "$INSTALL_LOG" 2>&1
    else
        yum install -y curl libpng-devel sqlite sqlite-devel acl >> "$INSTALL_LOG" 2>&1
    fi
    check_result "Instalación de paquetes adicionales"
else
    log_error "Distribución no soportada automáticamente: $OS_NAME"
    log_error "Por favor, instala Node.js v14+, FFmpeg y Git manualmente."
    exit 1
fi

# Crear usuario y grupo específicos para StreamVio
log "Paso 3/8: ${YELLOW}Creando usuario y grupo para StreamVio...${NC}"
show_progress 3 8 "Creando usuario"

# Comprobar si el usuario ya existe
if id "$STREAMVIO_USER" &>/dev/null; then
    log "El usuario $STREAMVIO_USER ya existe"
else
    # Crear usuario y grupo
    groupadd "$STREAMVIO_GROUP" >> "$INSTALL_LOG" 2>&1
    # Crear usuario sin directorio home ni shell de login
    useradd -r -g "$STREAMVIO_GROUP" -s /bin/false -d /nonexistent "$STREAMVIO_USER" >> "$INSTALL_LOG" 2>&1
    check_result "Creación de usuario $STREAMVIO_USER y grupo $STREAMVIO_GROUP"
fi

# Añadir usuario actual al grupo streamvio para facilitar desarrollo
log "Añadiendo usuario actual al grupo $STREAMVIO_GROUP para facilitar la administración..."
if [ "$EUID" -eq 0 ]; then
    # Si estamos ejecutando como root, añadir el usuario que ejecutó sudo
    REAL_USER=$(who am i | awk '{print $1}')
    if [ -n "$REAL_USER" ]; then
        usermod -a -G "$STREAMVIO_GROUP" "$REAL_USER" >> "$INSTALL_LOG" 2>&1
        check_result "Añadir usuario $REAL_USER al grupo $STREAMVIO_GROUP"
    fi
fi

# Configurar permisos del directorio de instalación
log "Configurando permisos del directorio de instalación..."
chown -R "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR"
# Dar permisos a grupo y otros para leer y ejecutar, propietario tiene control total
chmod -R 755 "$INSTALL_DIR"
check_result "Configuración de permisos para directorio de instalación"

# Crear directorios necesarios para la base de datos y otros datos con permisos adecuados
log "Creando directorios de datos..."
mkdir -p "$INSTALL_DIR/server/data/thumbnails" \
         "$INSTALL_DIR/server/data/transcoded" \
         "$INSTALL_DIR/server/data/cache" \
         "$INSTALL_DIR/server/data/metadata" >> "$INSTALL_LOG" 2>&1
check_result "Creación de directorios para datos"

# Asegurar permisos correctos para directorios de datos (escritura para streamvio)
chown -R "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR/server/data"
chmod -R 755 "$INSTALL_DIR/server/data"
# Permisos especiales para directorios que necesitan escritura
find "$INSTALL_DIR/server/data" -type d -exec chmod 775 {} \;
check_result "Configuración de permisos para directorios de datos"

# Configurar el directorio de datos para que nuevos archivos hereden grupo
chmod g+s "$INSTALL_DIR/server/data"
chmod g+s "$INSTALL_DIR/server/data/thumbnails"
chmod g+s "$INSTALL_DIR/server/data/transcoded"
chmod g+s "$INSTALL_DIR/server/data/cache"
chmod g+s "$INSTALL_DIR/server/data/metadata"
check_result "Configuración de permisos para herencia de grupo"

# Inicializar la base de datos
log "Inicializando la base de datos..."
cd "$INSTALL_DIR/server"
# Ejecutar directamente como root para evitar problemas de permisos
node scripts/initDatabase.js >> "$INSTALL_LOG" 2>&1
check_result "Inicialización de la base de datos" "fatal"

# Verificar que la base de datos se creó correctamente
DB_PATH="$INSTALL_DIR/server/data/streamvio.db"
if [ -f "$DB_PATH" ]; then
    # Aplicar permisos correctos a la base de datos
    chown "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$DB_PATH"
    chmod 664 "$DB_PATH"  # rw-rw-r--
    check_result "Ajuste de permisos para la base de datos"
fi

# Verificar que systemd puede ejecutar el servicio correctamente
log "Verificando permisos para Node.js..."
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    log_error "No se pudo encontrar node en el sistema"
else
    if [ -x "$NODE_PATH" ]; then
        log "${GREEN}✓${NC} Node.js tiene permisos de ejecución correctos"
    else
        log_error "Node.js no tiene permisos de ejecución"
        chmod +x "$NODE_PATH"
        check_result "Corrección de permisos para Node.js"
    fi
fi

# Verificar permisos de app.js
APP_JS="$INSTALL_DIR/server/app.js"
if [ -f "$APP_JS" ]; then
    if [ -r "$APP_JS" ]; then
        log "${GREEN}✓${NC} app.js tiene permisos de lectura correctos"
    else
        log_error "app.js no tiene permisos de lectura"
        chmod +r "$APP_JS"
        check_result "Corrección de permisos para app.js"
    fi
fi

# Verificar si SELinux está activo y configurar contextos si es necesario
if command -v sestatus &> /dev/null && sestatus | grep -q "enabled"; then
    log "SELinux detectado. Configurando contextos..."
    
    # Instalar policymgmt si no está presente
    if ! command -v semanage &> /dev/null; then
        if [ "$OS_NAME" = "ubuntu" ] || [ "$OS_NAME" = "debian" ]; then
            apt-get install -y policycoreutils-python-utils >> "$INSTALL_LOG" 2>&1
        elif [ "$OS_NAME" = "centos" ] || [ "$OS_NAME" = "rhel" ] || [ "$OS_NAME" = "fedora" ]; then
            if [ "$OS_NAME" = "fedora" ]; then
                dnf install -y policycoreutils-python-utils >> "$INSTALL_LOG" 2>&1
            else
                yum install -y policycoreutils-python-utils >> "$INSTALL_LOG" 2>&1
            fi
        fi
    fi
    
    # Configurar contexto para permitir que el servicio acceda a los archivos
    if command -v semanage &> /dev/null; then
        semanage fcontext -a -t httpd_sys_content_t "$INSTALL_DIR(/.*)?" >> "$INSTALL_LOG" 2>&1
        restorecon -Rv "$INSTALL_DIR" >> "$INSTALL_LOG" 2>&1
        check_result "Configuración de contextos SELinux"
    else
        log_error "No se pudo instalar semanage. Es posible que SELinux interfiera con la aplicación."
    fi
fi

# Crear script para verificar permisos en cualquier momento
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

# Crear script para reparación de permisos en caso de problemas
cat > "$INSTALL_DIR/fix-permissions.sh" << EOF
#!/bin/bash
# Script para corregir permisos de StreamVio

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar si se ejecuta como root
if [ "\$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Este script debe ejecutarse con privilegios de administrador (sudo).${NC}"
    echo -e "${YELLOW}Por favor, ejecuta el script de la siguiente manera:${NC}"
    echo -e "  sudo ./\$(basename "\$0")"
    exit 1
fi

STREAMVIO_USER="$STREAMVIO_USER"
STREAMVIO_GROUP="$STREAMVIO_GROUP"
INSTALL_DIR="$INSTALL_DIR"

echo -e "${BLUE}=================== CORRECCIÓN DE PERMISOS STREAMVIO ===================${NC}"

# 1. Verificar que el usuario y grupo existen
echo -e "${YELLOW}Verificando usuario y grupo StreamVio...${NC}"
if ! id "\$STREAMVIO_USER" &>/dev/null; then
    echo -e "${RED}El usuario \$STREAMVIO_USER no existe. Creándolo...${NC}"
    groupadd "\$STREAMVIO_GROUP"
    useradd -r -g "\$STREAMVIO_GROUP" -s /bin/false -d /nonexistent "\$STREAMVIO_USER"
    echo -e "${GREEN}✓ Usuario y grupo creados correctamente${NC}"
else
    echo -e "${GREEN}✓ Usuario \$STREAMVIO_USER existe${NC}"
fi

# 2. Corregir permisos de directorios principales
echo -e "${YELLOW}Corrigiendo permisos de directorios principales...${NC}"
chown -R "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$INSTALL_DIR"
chmod -R 755 "\$INSTALL_DIR"
echo -e "${GREEN}✓ Permisos básicos corregidos${NC}"

# 3. Corregir permisos de directorios de datos (necesitan escritura)
echo -e "${YELLOW}Configurando directorios de datos...${NC}"
DATA_DIRS=(
    "\$INSTALL_DIR/server/data"
    "\$INSTALL_DIR/server/data/thumbnails"
    "\$INSTALL_DIR/server/data/transcoded"
    "\$INSTALL_DIR/server/data/cache"
    "\$INSTALL_DIR/server/data/metadata"
)

for dir in "\${DATA_DIRS[@]}"; do
    if [ ! -d "\$dir" ]; then
        echo -e "Creando directorio \$dir"
        mkdir -p "\$dir"
    fi
    chown -R "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$dir"
    chmod -R 775 "\$dir"
    # Establecer bit SGID para heredar grupo
    chmod g+s "\$dir"
done
echo -e "${GREEN}✓ Permisos de directorios de datos corregidos${NC}"

# 4. Verificar y corregir permisos de base de datos
DB_PATH="\$INSTALL_DIR/server/data/streamvio.db"
if [ -f "\$DB_PATH" ]; then
    echo -e "${YELLOW}Corrigiendo permisos de base de datos...${NC}"
    chown "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$DB_PATH"
    chmod 664 "\$DB_PATH"  # rw-rw-r--
    echo -e "${GREEN}✓ Permisos de base de datos corregidos${NC}"
fi

# 5. Verificar y corregir permisos del archivo de servicio
SERVICE_FILE="/etc/systemd/system/streamvio.service"
if [ -f "\$SERVICE_FILE" ]; then
    echo -e "${YELLOW}Corrigiendo permisos del archivo de servicio...${NC}"
    chmod 644 "\$SERVICE_FILE"
    echo -e "${GREEN}✓ Permisos del archivo de servicio corregidos${NC}"
fi

# 6. Corregir permisos de archivos críticos
echo -e "${YELLOW}Corrigiendo permisos de archivos críticos...${NC}"
APP_JS="\$INSTALL_DIR/server/app.js"
ENV_FILE="\$INSTALL_DIR/server/.env"

if [ -f "\$APP_JS" ]; then
    chown "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$APP_JS"
    chmod 644 "\$APP_JS"
fi

if [ -f "\$ENV_FILE" ]; then
    chown "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$ENV_FILE" 
    chmod 640 "\$ENV_FILE"  # Más restrictivo por contener secretos
fi

echo -e "${GREEN}✓ Permisos de archivos críticos corregidos${NC}"

# 7. Verificar permisos del frontend (directorio dist)
DIST_DIR="\$INSTALL_DIR/clients/web/dist"
if [ -d "\$DIST_DIR" ]; then
    echo -e "${YELLOW}Corrigiendo permisos del frontend...${NC}"
    chown -R "\$STREAMVIO_USER":"\$STREAMVIO_GROUP" "\$DIST_DIR"
    chmod -R 755 "\$DIST_DIR"
    echo -e "${GREEN}✓ Permisos del frontend corregidos${NC}"
fi

# 8. Reiniciar servicio
echo -e "${YELLOW}Reiniciando servicio StreamVio...${NC}"
systemctl daemon-reload
systemctl restart streamvio.service

# Verificar estado
sleep 2
if systemctl is-active --quiet streamvio.service; then
    echo -e "${GREEN}✓ Servicio StreamVio reiniciado correctamente${NC}"
else
    echo -e "${RED}⚠ El servicio StreamVio no pudo iniciarse${NC}"
    echo -e "${YELLOW}Revisando los logs para detectar problemas:${NC}"
    journalctl -u streamvio.service --no-pager -n 10
fi

echo -e "\n${BLUE}=================== CORRECCIÓN COMPLETADA ===================${NC}"
echo -e "Si el servicio no ha podido iniciarse, ejecuta: sudo journalctl -u streamvio.service -f"
EOF

chmod +x "$INSTALL_DIR/fix-permissions.sh"
check_result "Creación de script para reparar permisos"

# Crear archivo de servicio systemd
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
Environment=NODE_ENV=production
Environment=PORT=$STREAMVIO_PORT

# Asegurarnos de que el servicio puede leer y escribir a sus directorios
# Esta es una configuración permisiva, ajustar según necesidad
ReadWritePaths=$INSTALL_DIR/server/data
# Para mayor seguridad, podríamos usar ProtectSystem=strict, etc.

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

# Habilitar servicio para arranque automático
systemctl enable streamvio.service >> "$INSTALL_LOG" 2>&1
check_result "Habilitación del servicio para arranque automático"