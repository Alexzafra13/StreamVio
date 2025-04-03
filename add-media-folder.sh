#!/bin/bash
# Script para añadir una carpeta multimedia a StreamVio

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
STREAMVIO_USER="streamvio"
STREAMVIO_GROUP="streamvio"

# Verificar que se está ejecutando como root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Este script debe ejecutarse con privilegios de administrador (sudo).${NC}"
    echo -e "${YELLOW}Por favor, ejecuta el script de la siguiente manera:${NC}"
    echo -e "  sudo ./$(basename "$0") /ruta/a/carpeta/multimedia"
    exit 1
fi

# Verificar el número de argumentos
if [ $# -ne 1 ]; then
    echo -e "${RED}Error: Se requiere especificar una carpeta multimedia.${NC}"
    echo -e "${YELLOW}Uso: $0 /ruta/a/carpeta/multimedia${NC}"
    exit 1
fi

MEDIA_FOLDER="$1"

# Verificar que la carpeta existe
if [ ! -d "$MEDIA_FOLDER" ]; then
    echo -e "${RED}Error: La carpeta $MEDIA_FOLDER no existe.${NC}"
    echo -e "${YELLOW}Por favor, crea la carpeta primero o especifica una existente.${NC}"
    exit 1
fi

echo -e "${BLUE}=================== CONFIGURACIÓN DE CARPETA MULTIMEDIA ===================${NC}"
echo -e "${BLUE}Carpeta: ${NC}$MEDIA_FOLDER"
echo -e "${BLUE}Usuario: ${NC}$STREAMVIO_USER"
echo -e "${BLUE}=================== APLICANDO PERMISOS ===================${NC}"

# Verificar que el usuario streamvio existe
if ! id "$STREAMVIO_USER" &>/dev/null; then
    echo -e "${RED}Error: El usuario $STREAMVIO_USER no existe.${NC}"
    echo -e "${YELLOW}Asegúrate de haber instalado StreamVio correctamente.${NC}"
    exit 1
fi

# Método 1: Intentar usar ACLs (más preciso)
if command -v setfacl &> /dev/null; then
    echo -e "${GREEN}Usando ACLs para configurar permisos...${NC}"
    
    # Verificar si el sistema de archivos soporta ACLs
    if [[ $(stat -f -c %T "$MEDIA_FOLDER") == *acl* ]]; then
        # Aplicar ACLs recursivamente
        echo -e "${YELLOW}Aplicando permisos de lectura y ejecución para carpetas...${NC}"
        find "$MEDIA_FOLDER" -type d -exec setfacl -m u:$STREAMVIO_USER:rx {} \;
        
        echo -e "${YELLOW}Aplicando permisos de lectura para archivos...${NC}"
        find "$MEDIA_FOLDER" -type f -exec setfacl -m u:$STREAMVIO_USER:r {} \;
        
        # Verificar el resultado
        if [ $? -eq 0 ]; then
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
if [ "$NEED_FALLBACK" = true ]; then
    echo -e "${YELLOW}Usando método alternativo con permisos tradicionales...${NC}"
    
    # Preguntar al usuario si desea continuar con el método alternativo
    echo -e "${YELLOW}ADVERTENCIA: Este método puede cambiar permisos existentes en la carpeta.${NC}"
    read -p "¿Deseas continuar? (s/n): " response
    
    if [[ ! "$response" =~ ^[Ss]$ ]]; then
        echo -e "${RED}Operación cancelada por el usuario.${NC}"
        exit 1
    fi
    
    # Opción 1: Añadir grupo streamvio a los archivos
    echo -e "${YELLOW}Añadiendo grupo $STREAMVIO_GROUP a la carpeta y contenidos...${NC}"
    chgrp -R "$STREAMVIO_GROUP" "$MEDIA_FOLDER"
    
    # Dar permisos de lectura y ejecución al grupo
    echo -e "${YELLOW}Configurando permisos para carpetas (rx para grupo)...${NC}"
    find "$MEDIA_FOLDER" -type d -exec chmod g+rx {} \;
    
    echo -e "${YELLOW}Configurando permisos para archivos (r para grupo)...${NC}"
    find "$MEDIA_FOLDER" -type f -exec chmod g+r {} \;
    
    echo -e "${GREEN}✓ Permisos de grupo aplicados correctamente${NC}"
fi

# Verificación final
echo -e "${BLUE}=================== VERIFICACIÓN ===================${NC}"
echo -e "Probando acceso como usuario $STREAMVIO_USER..."

# Verificar acceso a un archivo aleatorio para confirmar que los permisos funcionan
TEST_FILE=$(find "$MEDIA_FOLDER" -type f -not -path "*/\.*" | head -n 1)

if [ -z "$TEST_FILE" ]; then
    echo -e "${YELLOW}No se encontraron archivos para probar en la carpeta.${NC}"
else
    # Intentar leer un archivo como usuario streamvio
    if sudo -u "$STREAMVIO_USER" cat "$TEST_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Verificación exitosa: El usuario $STREAMVIO_USER puede acceder a los archivos${NC}"
    else
        echo -e "${RED}Error: El usuario $STREAMVIO_USER no puede acceder al archivo de prueba.${NC}"
        echo -e "${YELLOW}Puede ser necesario ajustar manualmente los permisos o montar el sistema de archivos con opciones adecuadas.${NC}"
    fi
fi

echo -e "\n${GREEN}Configuración completada.${NC}"
echo -e "${BLUE}=================== SIGUIENTE PASO ===================${NC}"
echo -e "Ahora puedes añadir esta carpeta como biblioteca en StreamVio:"
echo -e "  1. Inicia sesión en la interfaz web de StreamVio"
echo -e "  2. Ve a 'Gestionar bibliotecas'"
echo -e "  3. Añade una nueva biblioteca con la ruta: ${YELLOW}$MEDIA_FOLDER${NC}"
echo -e "${BLUE}=======================================================${NC}"