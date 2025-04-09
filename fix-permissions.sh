#!/bin/bash
# fix-permissions.sh - Script para corregir problemas de permisos en StreamVio

# Colores para salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# Directorios a verificar
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATA_DIR="${APP_DIR}/server/data"
MEDIA_DIRS=(
  "${DATA_DIR}"
  "${DATA_DIR}/thumbnails"
  "${DATA_DIR}/transcoded"
  "${DATA_DIR}/cache"
  "${DATA_DIR}/metadata"
)

# Usuario y grupo del servicio (modificar según configuración)
SERVICE_USER=${1:-$(whoami)}
SERVICE_GROUP=${2:-$(id -gn)}

echo -e "${BLUE}===== StreamVio - Reparación de Permisos =====${RESET}"
echo -e "${BLUE}Usuario del servicio: ${SERVICE_USER}${RESET}"
echo -e "${BLUE}Grupo del servicio: ${SERVICE_GROUP}${RESET}"
echo -e "${BLUE}=========================================${RESET}\n"

# Verificar si se está ejecutando como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}Advertencia: Este script no se está ejecutando como root.${RESET}"
  echo -e "${YELLOW}Algunos cambios de permisos podrían fallar.${RESET}"
  echo -e "${YELLOW}Considera ejecutar: sudo $0 ${SERVICE_USER} ${SERVICE_GROUP}${RESET}\n"
fi

# Función para verificar y corregir permisos
fix_directory_permissions() {
  local dir="$1"
  local is_media_dir="$2"
  
  if [ ! -d "$dir" ]; then
    echo -e "${YELLOW}Creando directorio: $dir${RESET}"
    mkdir -p "$dir"
  fi
  
  echo -e "${BLUE}Verificando permisos en: $dir${RESET}"
  
  # Corregir propietario
  echo -e "  ${GREEN}→ Ajustando propietario a ${SERVICE_USER}:${SERVICE_GROUP}${RESET}"
  chown -R ${SERVICE_USER}:${SERVICE_GROUP} "$dir"
  
  if [ "$is_media_dir" = true ]; then
    # Para directorios de datos: permisos 775 (rwxrwxr-x)
    echo -e "  ${GREEN}→ Ajustando permisos de directorios a 775 (rwxrwxr-x)${RESET}"
    find "$dir" -type d -exec chmod 775 {} \;
    
    # Para archivos: permisos 664 (rw-rw-r--)
    echo -e "  ${GREEN}→ Ajustando permisos de archivos a 664 (rw-rw-r--)${RESET}"
    find "$dir" -type f -exec chmod 664 {} \;
  else
    # Para directorios de código: 755 (rwxr-xr-x)
    echo -e "  ${GREEN}→ Ajustando permisos de directorio a 755 (rwxr-xr-x)${RESET}"
    chmod -R 755 "$dir"
  fi
  
  echo -e "  ${GREEN}✓ Permisos corregidos en: $dir${RESET}"
}

# Verificar la base de datos SQLite
DB_FILE="${DATA_DIR}/streamvio.db"
if [ -f "$DB_FILE" ]; then
  echo -e "${BLUE}Verificando permisos de la base de datos: $DB_FILE${RESET}"
  chown ${SERVICE_USER}:${SERVICE_GROUP} "$DB_FILE"
  chmod 664 "$DB_FILE"
  echo -e "  ${GREEN}✓ Permisos de base de datos corregidos${RESET}"
else
  echo -e "${YELLOW}Base de datos no encontrada en: $DB_FILE${RESET}"
  echo -e "${YELLOW}Se creará al iniciar la aplicación${RESET}"
fi

# Corregir permisos en directorios principales
echo -e "\n${BLUE}Corrigiendo permisos en directorios principales...${RESET}"
for dir in "${MEDIA_DIRS[@]}"; do
  fix_directory_permissions "$dir" true
done

# Corregir permisos en directorios de código
echo -e "\n${BLUE}Corrigiendo permisos en directorios de código...${RESET}"
fix_directory_permissions "${APP_DIR}/server" false
fix_directory_permissions "${APP_DIR}/clients" false

# Dar permisos de ejecución a scripts
echo -e "\n${BLUE}Asegurando permisos de ejecución en scripts...${RESET}"
find "${APP_DIR}" -name "*.sh" -exec chmod +x {} \;
chmod +x "${APP_DIR}/server/scripts/"*.js 2>/dev/null || true

echo -e "\n${GREEN}¡Permisos corregidos correctamente!${RESET}"
echo -e "${BLUE}Para reiniciar el servicio, ejecuta:${RESET}"
echo -e "  ${YELLOW}sudo systemctl restart streamvio.service${RESET}"

exit 0