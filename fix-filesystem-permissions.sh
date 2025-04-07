#!/bin/bash
# Ajustes para corregir problemas de permisos en el servidor de StreamVio
# Ejecutar como sudo: sudo bash fix-filesystem-permissions.sh

# Colores para la salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensaje de ayuda
show_help() {
  echo -e "${BLUE}Script para corregir permisos del sistema de archivos para StreamVio${NC}"
  echo -e "Uso: sudo bash $0 [opciones]"
  echo -e ""
  echo -e "Opciones:"
  echo -e "  --help           Muestra esta ayuda"
  echo -e "  --fix-tmp        Corrige permisos en /tmp (recomendado)"
  echo -e "  --fix-var        Corrige permisos en /var (requiere privilegios)"
  echo -e "  --fix-media      Corrige permisos en /media (requiere privilegios)"
  echo -e "  --fix-home       Corrige permisos en tu directorio home"
  echo -e "  --create-media   Crea y configura directorio /var/lib/streamvio con permisos correctos"
  echo -e "  --all            Corrige todos los directorios (recomendado)"
  echo -e ""
  echo -e "Ejemplo: sudo bash $0 --all"
}

# Verificar si se está ejecutando como root
check_root() {
  if [ "$(id -u)" != "0" ]; then
    echo -e "${RED}¡Este script debe ejecutarse como root!${NC}"
    echo -e "${YELLOW}Ejecuta: sudo bash $0${NC}"
    exit 1
  fi
}

# Verificar argumento de ayuda
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
  show_help
  exit 0
fi

# Verificar permisos de root
check_root

# Bandera para verificar si alguna opción fue especificada
ANY_OPTION=false

echo -e "${BLUE}=== StreamVio - Reparación de Permisos de Sistema de Archivos ===${NC}"
echo -e "${YELLOW}Este script corregirá problemas comunes de permisos en el servidor.${NC}"

# Obtener el usuario que ejecuta el servidor
SERVICE_USER=${SUDO_USER:-$(logname)}
if [ -z "$SERVICE_USER" ]; then
  SERVICE_USER=$(whoami)
fi

echo -e "${BLUE}Usuario detectado: ${SERVICE_USER}${NC}"

# Función para reparar permisos
fix_permissions() {
  local dir="$1"
  local description="$2"
  
  echo -e "\n${BLUE}Corrigiendo permisos en ${dir} (${description})...${NC}"
  
  # Verificar si el directorio existe
  if [ ! -d "$dir" ]; then
    echo -e "${YELLOW}El directorio $dir no existe. Intentando crear...${NC}"
    mkdir -p "$dir" || { echo -e "${RED}No se pudo crear $dir${NC}"; return 1; }
  fi
  
  # Cambiar propietario y permisos
  chown -R "$SERVICE_USER":"$SERVICE_USER" "$dir" || { echo -e "${RED}No se pudo cambiar propietario de $dir${NC}"; }
  chmod -R 755 "$dir" || { echo -e "${RED}No se pudo cambiar permisos de $dir${NC}"; }
  
  # Para algunos directorios, ser más permisivo
  if [[ "$dir" == "/tmp"* || "$dir" == "/var/lib/streamvio"* ]]; then
    chmod -R 777 "$dir" || { echo -e "${RED}No se pudo establecer permisos 777 en $dir${NC}"; }
    echo -e "${GREEN}Permisos amplios (777) aplicados a $dir${NC}"
  fi
  
  echo -e "${GREEN}✓ Permisos corregidos para $dir${NC}"
}

# Función para crear directorio de medios dedicado
create_media_dir() {
  local media_dir="/var/lib/streamvio"
  
  echo -e "\n${BLUE}Creando directorio dedicado para medios en $media_dir...${NC}"
  
  # Crear el directorio si no existe
  if [ ! -d "$media_dir" ]; then
    mkdir -p "$media_dir" || { echo -e "${RED}No se pudo crear $media_dir${NC}"; return 1; }
    echo -e "${GREEN}✓ Directorio creado: $media_dir${NC}"
  else
    echo -e "${YELLOW}El directorio $media_dir ya existe${NC}"
  fi
  
  # Cambiar propietario y permisos
  chown -R "$SERVICE_USER":"$SERVICE_USER" "$media_dir" || { echo -e "${RED}No se pudo cambiar propietario de $media_dir${NC}"; }
  chmod -R 777 "$media_dir" || { echo -e "${RED}No se pudo cambiar permisos de $media_dir${NC}"; }
  
  # Crear subdirectorios específicos
  for subdir in "movies" "series" "music" "photos"; do
    mkdir -p "$media_dir/$subdir" || { echo -e "${RED}No se pudo crear $media_dir/$subdir${NC}"; continue; }
    chown -R "$SERVICE_USER":"$SERVICE_USER" "$media_dir/$subdir" || { echo -e "${RED}No se pudo cambiar propietario de $media_dir/$subdir${NC}"; }
    chmod -R 777 "$media_dir/$subdir" || { echo -e "${RED}No se pudo cambiar permisos de $media_dir/$subdir${NC}"; }
    echo -e "${GREEN}✓ Subdirectorio $subdir configurado${NC}"
  done
  
  echo -e "${GREEN}✓ Directorio de medios creado y configurado: $media_dir${NC}"
  echo -e "${YELLOW}Ahora puedes usar este directorio para tus bibliotecas en StreamVio${NC}"
}

# Función para reparar /tmp
fix_tmp() {
  ANY_OPTION=true
  fix_permissions "/tmp" "Directorio temporal"
}

# Función para reparar /var
fix_var() {
  ANY_OPTION=true
  fix_permissions "/var/lib" "Directorio de datos de aplicaciones"
  
  # Verificar si existe /var/lib/streamvio
  if [ -d "/var/lib/streamvio" ]; then
    fix_permissions "/var/lib/streamvio" "Directorio de datos de StreamVio"
  fi
}

# Función para reparar /media
fix_media() {
  ANY_OPTION=true
  fix_permissions "/media" "Directorio de montaje de dispositivos"
}

# Función para reparar directorio home
fix_home() {
  ANY_OPTION=true
  HOME_DIR=$(eval echo ~${SERVICE_USER})
  fix_permissions "$HOME_DIR" "Directorio home del usuario"
}

# Procesar argumentos
for arg in "$@"; do
  case $arg in
    --fix-tmp)
      fix_tmp
      ;;
    --fix-var)
      fix_var
      ;;
    --fix-media)
      fix_media
      ;;
    --fix-home)
      fix_home
      ;;
    --create-media)
      ANY_OPTION=true
      create_media_dir
      ;;
    --all)
      ANY_OPTION=true
      fix_tmp
      fix_var
      fix_media
      fix_home
      create_media_dir
      ;;
  esac
done

# Si no se especificó ninguna opción, corregir /tmp y crear directorio de medios
if ! $ANY_OPTION; then
  echo -e "${YELLOW}No se especificó ninguna opción. Aplicando correcciones básicas...${NC}"
  fix_tmp
  create_media_dir
fi

echo -e "\n${GREEN}¡Corrección de permisos completada!${NC}"
echo -e "${YELLOW}Ahora deberías poder usar las siguientes carpetas en StreamVio:${NC}"
echo -e "  - /tmp (para pruebas temporales)"
echo -e "  - /var/lib/streamvio (directorio recomendado para bibliotecas)"
echo -e "  - $HOME_DIR (tu directorio personal)"

# Información adicional
echo -e "\n${BLUE}Información adicional:${NC}"
echo -e "Si sigues teniendo problemas con los permisos, considera:"
echo -e "1. Reiniciar el servidor de StreamVio"
echo -e "2. Usar 'chmod 777' en directorios específicos donde quieras almacenar medios"
echo -e "3. Revisar los logs del servidor para más detalles sobre errores de permisos"