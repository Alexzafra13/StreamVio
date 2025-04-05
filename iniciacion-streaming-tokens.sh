#!/bin/bash
# Script para inicializar la tabla de tokens de streaming

# Colores para mejor legibilidad
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Iniciando configuración de Streaming Tokens para StreamVio ===${NC}"

# Obtener directorio actual del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo -e "${YELLOW}Directorio del script: ${SCRIPT_DIR}${NC}"

# Directorio del servidor
SERVER_DIR="${SCRIPT_DIR}/server"

# Verificar si el directorio del servidor existe
if [ ! -d "$SERVER_DIR" ]; then
  echo -e "${RED}Error: Directorio del servidor no encontrado: $SERVER_DIR${NC}"
  exit 1
fi

# Ejecutar el script de migración
echo -e "${YELLOW}Ejecutando migración de streaming_tokens...${NC}"
cd "$SERVER_DIR"
node scripts/add-streaming-tokens.js

# Verificar resultado
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Migración completada exitosamente${NC}"
  echo -e "${BLUE}=== Configuración finalizada ===${NC}"
else
  echo -e "${RED}Error durante la migración${NC}"
  exit 1
fi

echo -e "\n${GREEN}El sistema de streaming mejorado está listo.${NC}"
echo -e "${YELLOW}Los tokens ahora son específicos para cada sesión de reproducción.${NC}"