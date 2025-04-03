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

# Función para obtener la dirección IP actual
get_server_ip() {
    # Intentar obtener IP pública
    PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || 
                curl -s --max-time 5 ipinfo.io/ip 2>/dev/null || 
                curl -s --max-time 5 icanhazip.com 2>/dev/null)
    
    # Si no se puede obtener la IP pública, usar IP local
    if [ -z "$PUBLIC_IP" ]; then
        # Obtener dirección IP local principal (no loopback)
        LOCAL_IP=$(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
        if [ -z "$LOCAL_IP" ]; then
            # Alternativa usando hostname
            LOCAL_IP=$(hostname -I | awk '{print $1}')
        fi
        
        # Si todavía no tenemos IP, usar localhost
        if [ -z "$LOCAL_IP" ]; then
            echo "localhost"
        else
            echo "$LOCAL_IP"
        fi
    else
        echo "$PUBLIC_IP"
    fi
}

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

# Configurar servicio y firewall
log "Paso 4/8: ${YELLOW}Configurando firewall...${NC}"
show_progress 4 8 "Configurando firewall"

# Abrir puerto en el firewall
if command -v ufw &> /dev/null; then
    # Ubuntu/Debian con UFW
    ufw allow $STREAMVIO_PORT/tcp >> "$INSTALL_LOG" 2>&1
    check_result "Configuración de puerto $STREAMVIO_PORT en UFW"
elif command -v firewall-cmd &> /dev/null; then
    # CentOS/Fedora con firewalld
    firewall-cmd --permanent --add-port=$STREAMVIO_PORT/tcp >> "$INSTALL_LOG" 2>&1
    firewall-cmd --reload >> "$INSTALL_LOG" 2>&1
    check_result "Configuración de puerto $STREAMVIO_PORT en firewalld"
else
    log_error "No se detectó un firewall compatible. Asegúrate de abrir manualmente el puerto $STREAMVIO_PORT/tcp."
fi

# Descargar el código si es necesario
log "Paso 5/8: ${YELLOW}Obteniendo código fuente...${NC}"
show_progress 5 8 "Obteniendo código"

# Determinar directorio de instalación
INSTALL_DIR="/opt/streamvio"
log "Instalando StreamVio en: $INSTALL_DIR"

# Clonar o actualizar el repositorio
if [ -d "$INSTALL_DIR/.git" ]; then
    # El repositorio ya existe, actualizar
    cd "$INSTALL_DIR"
    git pull >> "$INSTALL_LOG" 2>&1
    check_result "Actualización del código fuente"
else
    # Nuevo repositorio, clonar
    mkdir -p "$INSTALL_DIR"
    git clone https://github.com/Alexzafra13/StreamVio.git "$INSTALL_DIR" >> "$INSTALL_LOG" 2>&1
    check_result "Clonación del repositorio" "fatal"
fi

# Configurar permisos del directorio de instalación
log "Configurando permisos del directorio de instalación..."
chown -R "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR"
# Dar permisos a grupo y otros para leer y ejecutar, propietario tiene control total
chmod -R 755 "$INSTALL_DIR"
check_result "Configuración de permisos para directorio de instalación"

# Instalación de dependencias del proyecto
log "Paso 6/8: ${YELLOW}Instalando dependencias del proyecto...${NC}"
show_progress 6 8 "Instalando dependencias"

# Instalar dependencias del servidor
cd "$INSTALL_DIR/server"
npm install --production >> "$INSTALL_LOG" 2>&1
check_result "Instalación de dependencias del servidor" "fatal"

# Instalar dependencias del cliente
cd "$INSTALL_DIR/clients/web"
npm install >> "$INSTALL_LOG" 2>&1
check_result "Instalación de dependencias del cliente" "fatal"

# Compilar el frontend
log "Paso 7/8: ${YELLOW}Compilando la interfaz web...${NC}"
show_progress 7 8 "Compilando frontend"

cd "$INSTALL_DIR/clients/web"
npm run build >> "$INSTALL_LOG" 2>&1
check_result "Compilación del frontend" "fatal"

# Crear archivos de configuración
log "Configurando archivos .env..."

# Configurar .env del servidor
cat > "$INSTALL_DIR/server/.env" << EOF
PORT=$STREAMVIO_PORT
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./data/streamvio.db
EOF
check_result "Creación del archivo .env del servidor"

# Configurar .env del cliente web
echo "PUBLIC_API_URL=http://$SERVER_IP:$STREAMVIO_PORT" > "$INSTALL_DIR/clients/web/.env"
check_result "Creación del archivo .env del cliente"

# Crear directorios necesarios para la base de datos y otros datos
log "Creando directorios de datos..."
mkdir -p "$INSTALL_DIR/server/data/thumbnails" \
         "$INSTALL_DIR/server/data/transcoded" \
         "$INSTALL_DIR/server/data/cache" \
         "$INSTALL_DIR/server/data/metadata" >> "$INSTALL_LOG" 2>&1
check_result "Creación de directorios para datos"

# Asegurar permisos correctos para directorios de datos
chown -R "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR/server/data"
chmod -R 755 "$INSTALL_DIR/server/data"
check_result "Configuración de permisos para directorios de datos"

# Inicializar la base de datos
log "Inicializando la base de datos..."
cd "$INSTALL_DIR/server"
# Ejecutar directamente como root para evitar problemas de permisos
node scripts/initDatabase.js >> "$INSTALL_LOG" 2>&1
check_result "Inicialización de la base de datos" "fatal"

# Configurar e iniciar el servicio
log "Paso 8/8: ${YELLOW}Configurando servicio del sistema...${NC}"
show_progress 8 8 "Configurando servicio"

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

# Recargar systemd
systemctl daemon-reload
check_result "Recarga de systemd"

# Habilitar servicio para arranque automático
systemctl enable streamvio.service >> "$INSTALL_LOG" 2>&1
check_result "Habilitación del servicio para arranque automático"

# Crear script para ayudar a añadir carpetas multimedia
log "Creando script de ayuda para el manejo de permisos de carpetas multimedia..."
cat > "$INSTALL_DIR/add-media-folder.sh" << EOF
#!/bin/bash
# Script para añadir una carpeta multimedia a StreamVio

if [ \$# -ne 1 ]; then
    echo "Uso: \$0 /ruta/a/carpeta/multimedia"
    exit 1
fi

MEDIA_FOLDER="\$1"

# Verificar que la carpeta existe
if [ ! -d "\$MEDIA_FOLDER" ]; then
    echo "Error: La carpeta \$MEDIA_FOLDER no existe"
    exit 1
fi

# Dar permisos al usuario streamvio para acceder a la carpeta
setfacl -R -m u:$STREAMVIO_USER:rx "\$MEDIA_FOLDER"

echo "Permisos configurados: el usuario $STREAMVIO_USER ahora puede acceder a \$MEDIA_FOLDER"
echo "Ya puedes añadir esta carpeta como biblioteca en StreamVio"
EOF

chmod +x "$INSTALL_DIR/add-media-folder.sh"
check_result "Creación del script de ayuda para carpetas multimedia"

# Iniciar servicio
log "Iniciando servicio StreamVio..."
systemctl start streamvio.service
check_result "Inicio del servicio"

# Verificar que el servicio está funcionando
sleep 3
if systemctl is-active --quiet streamvio.service; then
    log "${GREEN}✓ Servicio StreamVio activo y funcionando${NC}"
else
    log_error "El servicio StreamVio no está activo. Verificando logs..."
    journalctl -u streamvio.service --no-pager -n 20 >> "$ERROR_LOG"
    
    # Intentar iniciar manualmente para ver errores
    log_error "Intentando iniciar manualmente para obtener más información:"
    cd "$INSTALL_DIR/server"
    sudo -u "$STREAMVIO_USER" node app.js >> "$ERROR_LOG" 2>&1 &
    PID=$!
    sleep 5
    kill $PID 2>/dev/null
fi

# Mostrar resumen de la instalación
echo -e "\n${BLUE}=================== RESUMEN DE INSTALACIÓN ===================${NC}"
echo -e "${GREEN}StreamVio ha sido instalado en:${NC} $INSTALL_DIR"
echo -e "\n${GREEN}Acceso a la aplicación:${NC}"
echo -e "  ✓ Acceso local: ${YELLOW}http://localhost:$STREAMVIO_PORT${NC}"
echo -e "  ✓ Acceso en red: ${YELLOW}http://$SERVER_IP:$STREAMVIO_PORT${NC}"

echo -e "\n${BLUE}Credenciales de acceso inicial:${NC}"
echo -e "  ✓ Usuario: ${YELLOW}admin${NC}"
echo -e "  ✓ Contraseña: ${YELLOW}admin${NC}"
echo -e "  ✓ Se te pedirá cambiar la contraseña en el primer inicio de sesión."

echo -e "\n${BLUE}Gestión del servicio:${NC}"
echo -e "  ✓ Iniciar: ${YELLOW}sudo systemctl start streamvio.service${NC}"
echo -e "  ✓ Detener: ${YELLOW}sudo systemctl stop streamvio.service${NC}"
echo -e "  ✓ Reiniciar: ${YELLOW}sudo systemctl restart streamvio.service${NC}"
echo -e "  ✓ Ver logs: ${YELLOW}sudo journalctl -u streamvio.service -f${NC}"

echo -e "\n${BLUE}Añadir carpetas multimedia:${NC}"
echo -e "  ✓ Usa el script: ${YELLOW}sudo $INSTALL_DIR/add-media-folder.sh /ruta/a/tu/carpeta${NC}"
echo -e "  ✓ Esto dará al usuario $STREAMVIO_USER los permisos necesarios para acceder a tus archivos"

echo -e "\n${BLUE}Ubicaciones importantes:${NC}"
echo -e "  ✓ Código: ${YELLOW}$INSTALL_DIR${NC}"
echo -e "  ✓ Base de datos: ${YELLOW}$INSTALL_DIR/server/data/streamvio.db${NC}"
echo -e "  ✓ Archivo systemd: ${YELLOW}/etc/systemd/system/streamvio.service${NC}"
echo -e "  ✓ Logs de instalación: ${YELLOW}$PWD/$INSTALL_LOG${NC} y ${YELLOW}$PWD/$ERROR_LOG${NC}"

echo -e "\n${BLUE}Para actualizar StreamVio en el futuro:${NC}"
echo -e "  1. ${YELLOW}cd $INSTALL_DIR${NC}"
echo -e "  2. ${YELLOW}git pull${NC}"
echo -e "  3. ${YELLOW}cd clients/web && npm install && npm run build${NC}"
echo -e "  4. ${YELLOW}cd ../../server && npm install${NC}"
echo -e "  5. ${YELLOW}chown -R $STREAMVIO_USER:$STREAMVIO_GROUP $INSTALL_DIR${NC}"
echo -e "  6. ${YELLOW}sudo systemctl restart streamvio.service${NC}"

echo -e "\n${GREEN}¡Instalación completada con éxito!${NC}"
echo -e "${BLUE}=================== FIN DEL RESUMEN ===================${NC}\n"

log "Instalación finalizada. ¡Disfruta de StreamVio!"