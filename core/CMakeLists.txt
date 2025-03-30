cmake_minimum_required(VERSION 3.10)
project(StreamVioCore VERSION 0.1.0 LANGUAGES CXX)

# Configurar el estándar de C++
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Opciones del proyecto
option(BUILD_SHARED_LIBS "Construir bibliotecas compartidas" ON)
option(USE_HARDWARE_ACCELERATION "Utilizar aceleración por hardware si está disponible" ON)

# Directorios de código fuente
set(SOURCES 
    src/main.cpp
    src/transcoder/transcoder.cpp
)

# Directorios de cabeceras
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Buscar dependencias
find_package(PkgConfig REQUIRED)
pkg_check_modules(FFMPEG REQUIRED 
    libavcodec 
    libavformat 
    libavutil 
    libswscale 
    libavfilter
)

include_directories(${FFMPEG_INCLUDE_DIRS})
link_directories(${FFMPEG_LIBRARY_DIRS})

# Definir las banderas del compilador
add_definitions(${FFMPEG_CFLAGS_OTHER})

if(USE_HARDWARE_ACCELERATION)
    add_definitions(-DUSE_HARDWARE_ACCELERATION)
endif()

# Definir objetivos
add_library(streamvio_core ${SOURCES})
target_link_libraries(streamvio_core ${FFMPEG_LIBRARIES})

# Programa principal
add_executable(streamvio_transcoder src/main.cpp)
target_link_libraries(streamvio_transcoder streamvio_core)

# Instalar
install(TARGETS streamvio_core streamvio_transcoder
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
)

# Instalar cabeceras
install(DIRECTORY include/ DESTINATION include)

# Configuración para pruebas
enable_testing()
# Aquí se agregarían las pruebas unitarias cuando se implementen