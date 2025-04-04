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

# Obtener la ruta absoluta del directorio de instalación
INSTALL_DIR=$(pwd)
echo "Directorio de instalación: $INSTALL_DIR"

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

# Crear o limpiar archivos de log
> "$INSTALL_LOG"
> "$ERROR_LOG"

# Inicio del script
echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}         StreamVio - Instalación Unificada v1.2         ${NC}"
echo -e "${BLUE}=======================================================${NC}\n"

log "Iniciando instalación de StreamVio..."
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

# Configurar archivos .env
log "Configurando archivos de entorno..."

# Crear servidor .env
mkdir -p "$INSTALL_DIR/server"
cat > "$INSTALL_DIR/server/.env" << EOF
PORT=$STREAMVIO_PORT
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./data/streamvio.db
HOST=0.0.0.0
EOF
check_result "Creación de archivo .env del servidor"

# Obtener la IP del servidor
SERVER_IP=$(get_server_ip)

# Crear cliente web .env
mkdir -p "$INSTALL_DIR/clients/web"
echo "PUBLIC_API_URL=http://$SERVER_IP:$STREAMVIO_PORT" > "$INSTALL_DIR/clients/web/.env"
check_result "Creación de archivo .env del cliente web"

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
    useradd -r -g "$STREAMVIO_GROUP" -s /bin/false -M "$STREAMVIO_USER" >> "$INSTALL_LOG" 2>&1
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
if [ -d "$INSTALL_DIR" ]; then
    chown -R "$STREAMVIO_USER":"$STREAMVIO_GROUP" "$INSTALL_DIR"
    # Dar permisos a grupo y otros para leer y ejecutar, propietario tiene control total
    chmod -R 755 "$INSTALL_DIR"
    check_result "Configuración de permisos para directorio de instalación"
else
    log_error "El directorio de instalación $INSTALL_DIR no existe"
fi

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

# Instalar dependencias del servidor
log "Paso 4/8: ${YELLOW}Instalando dependencias del servidor...${NC}"
show_progress 4 8 "Instalando dependencias"

cd "$INSTALL_DIR/server"
# Intentar instalar dependencias sin output detallado para evitar demasiado output en la consola
if [ -f "package.json" ]; then
    npm install --production --no-fund --no-audit --loglevel=error >> "$INSTALL_LOG" 2>&1
    check_result "Instalación de dependencias del servidor"
else
    log_error "No se encontró package.json en el directorio del servidor"
    exit 1
fi

# Compilar el cliente web
log "Paso 5/8: ${YELLOW}Compilando cliente web...${NC}"
show_progress 5 8 "Compilando cliente"

cd "$INSTALL_DIR/clients/web"
if [ -f "package.json" ]; then
    npm install --no-fund --no-audit --loglevel=error >> "$INSTALL_LOG" 2>&1
    check_result "Instalación de dependencias del cliente"
    
    npm run build >> "$INSTALL_LOG" 2>&1
    check_result "Compilación del cliente web"
else
    log_error "No se encontró package.json en el directorio del cliente"
    exit 1
fi

# Inicializar la base de datos
log "Paso 6/8: ${YELLOW}Inicializando la base de datos...${NC}"
show_progress 6 8 "Inicializando base de datos"

cd "$INSTALL_DIR/server"
# Ejecutar directamente como el usuario streamvio para evitar problemas de permisos
sudo -u "$STREAMVIO_USER" node scripts/initDatabase.js >> "$INSTALL_LOG" 2>&1
check_result "Inicialización de la base de datos" "fatal"

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

# Crear archivo de servicio systemd
log "Paso 7/8: ${YELLOW}Configurando servicio del sistema...${NC}"
show_progress 7 8 "Configurando servicio"

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
ReadWritePaths=$INSTALL_DIR/server/data

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
log "Paso 8/8: ${YELLOW}Iniciando el servicio...${NC}"
show_progress 8 8 "Iniciando servicio"

# Habilitar servicio para arranque automático
systemctl enable streamvio.service >> "$INSTALL_LOG" 2>&1
check_result "Habilitación del servicio para arranque automático"

# Iniciar el servicio
systemctl start streamvio.service >> "$INSTALL_LOG" 2>&1
check_result "Inicio del servicio StreamVio"

# Verificar que el servicio está ejecutándose
sleep 2
if systemctl is-active --quiet streamvio.service; then
    log "${GREEN}✓ El servicio StreamVio está activo y funcionando correctamente${NC}"
else
    log_error "El servicio StreamVio no pudo iniciarse. Verificando logs:"
    journalctl -u streamvio.service --no-pager -n 10 | tee -a "$ERROR_LOG"
fi

# Abrir el puerto en el firewall si está activo
if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
    log "Configurando firewall (ufw)..."
    ufw allow $STREAMVIO_PORT/tcp >> "$INSTALL_LOG" 2>&1
    check_result "Apertura del puerto $STREAMVIO_PORT en el firewall"
elif command -v firewall-cmd &> /dev/null; then
    log "Configurando firewall (firewalld)..."
    firewall-cmd --permanent --add-port=$STREAMVIO_PORT/tcp >> "$INSTALL_LOG" 2>&1
    firewall-cmd --reload >> "$INSTALL_LOG" 2>&1
    check_result "Apertura del puerto $STREAMVIO_PORT en el firewall"
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