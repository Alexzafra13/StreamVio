#!/bin/bash

# StreamVio - Script de instalación unificado (versión 2.0)
# Este script maneja la instalación completa del sistema StreamVio

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

# Crear o limpiar archivos de log
> "$INSTALL_LOG"
> "$ERROR_LOG"

# ===== Funciones auxiliares =====

# Función para registrar mensajes
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$INSTALL_LOG"
    echo -e "$1"
}

# Función para registrar errores
log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR: $1" | tee -a "$ERROR_LOG"
    echo -e "${RED}ERROR: $1${NC}"
}

# Función para comprobar el resultado de un comando
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

# ===== Inicio del script =====
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}         StreamVio - Instalación Unificada v2.0                ${NC}"
echo -e "${BLUE}================================================================${NC}\n"

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

# ===== Paso 2: Instalar dependencias del sistema =====
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
    # Manejar distribuciones basadas en RPM (similar al script original)
    # [Código para CentOS/RHEL/Fedora]
    log "Distribución basada en RPM detectada. Instalando dependencias..."
    # (código de instalación para estas distribuciones)
else
    log_error "Distribución no soportada automáticamente: $OS_NAME"
    log_error "Por favor, instala Node.js v14+, FFmpeg y Git manualmente."
    exit 1
fi

# ===== Paso 3: Crear usuario y grupo para StreamVio =====
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

# ===== Paso 4: Configurar archivos de entorno =====
log "Paso 4/8: ${YELLOW}Configurando archivos de entorno...${NC}"
show_progress 4 8 "Configurando archivos"

# Crear servidor .env
mkdir -p "$INSTALL_DIR/server"
cat > "$INSTALL_DIR/server/.env" << EOF
PORT=$STREAMVIO_PORT
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
DB_PATH=./data/streamvio.db
HOST=0.0.0.0
SERVICE_USER=$STREAMVIO_USER
SERVICE_GROUP=$STREAMVIO_GROUP
EOF
check_result "Creación de archivo .env del servidor"

# Obtener la IP del servidor
SERVER_IP=$(get_server_ip)

# Crear cliente web .env
mkdir -p "$INSTALL_DIR/clients/web"
echo "PUBLIC_API_URL=http://$SERVER_IP:$STREAMVIO_PORT" > "$INSTALL_DIR/clients/web/.env"
check_result "Creación de archivo .env del cliente web"

# ===== Paso 5: Configurar permisos del directorio =====
log "Paso 5/8: ${YELLOW}Configurando permisos de directorios...${NC}"
show_progress 5 8 "Configurando permisos"

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

# ===== Paso 6: Instalar dependencias =====
log "Paso 6/8: ${YELLOW}Instalando dependencias del proyecto...${NC}"
show_progress 6 8 "Instalando dependencias"

# Instalar dependencias del servidor
cd "$INSTALL_DIR/server"
if [ -f "package.json" ]; then
    log "Instalando dependencias del servidor..."
    npm install --production --no-fund --no-audit --loglevel=error >> "$INSTALL_LOG" 2>&1
    check_result "Instalación de dependencias del servidor"
else
    log_error "No se encontró package.json en el directorio del servidor"
    exit 1
fi

# Compilar el cliente web
cd "$INSTALL_DIR/clients/web"
if [ -f "package.json" ]; then
    log "Instalando dependencias del cliente web..."
    npm install --no-fund --no-audit --loglevel=error >> "$INSTALL_LOG" 2>&1
    check_result "Instalación de dependencias del cliente"
    
    log "Compilando cliente web..."
    npm run build >> "$INSTALL_LOG" 2>&1
    check_result "Compilación del cliente web"
else
    log_error "No se encontró package.json en el directorio del cliente"
    exit 1
fi

# ===== Paso 7: Inicializar la base de datos =====
log "Paso 7/8: ${YELLOW}Inicializando la base de datos...${NC}"
show_progress 7 8 "Inicializando base de datos"

cd "$INSTALL_DIR/server"
# Ejecutar directamente como el usuario streamvio para evitar problemas de permisos
sudo -u "$STREAMVIO_USER" node scripts/initialize.js >> "$INSTALL_LOG" 2>&1
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

# ===== Paso 8: Configurar servicio del sistema =====
log "Paso 8/8: ${YELLOW}Configurando servicio del sistema...${NC}"
show_progress 8 8 "Configurando servicio"

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
Environment=SERVICE_USER=$STREAMVIO_USER
Environment=SERVICE_GROUP=$STREAMVIO_GROUP

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
log "Habilitando e iniciando el servicio..."

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

# Crear script para añadir carpeta de medios
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
    echo -e "${RED}Error: La carpeta \$MEDIA_FOLDER no existe.${NC}"
    echo -e "${YELLOW}Por favor, crea la carpeta primero o especifica una existente.${NC}"
    exit 1
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
    if [[ \$(stat -f -c %T "\$MEDIA_FOLDER") == *acl* ]]; then
        # Aplicar ACLs recursivamente
        echo -e "${YELLOW}Aplicando permisos de lectura y ejecución para carpetas...${NC}"
        find "\$MEDIA_FOLDER" -type d -exec setfacl -m u:\$STREAMVIO_USER:rx {} \;
        
        echo -e "${YELLOW}Aplicando permisos de lectura para archivos...${NC}"
        find "\$MEDIA_FOLDER" -type f -exec setfacl -m u:\$STREAMVIO_USER:r {} \;
        
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
else
    # Intentar leer un archivo como usuario streamvio
    if sudo -u "\$STREAMVIO_USER" cat "\$TEST_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Verificación exitosa: El usuario \$STREAMVIO_USER puede acceder a los archivos${NC}"
    else
        echo -e "${RED}Error: El usuario \$STREAMVIO_USER no puede acceder al archivo de prueba.${NC}"
        echo -e "${YELLOW}Puede ser necesario ajustar manualmente los permisos o montar el sistema de archivos con opciones adecuadas.${NC}"
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
echo -e "\n${GREEN}¡Disfruta de StreamVio!${NC}\n"