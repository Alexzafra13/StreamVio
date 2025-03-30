// StreamVio/core/src/main.cpp
#include <iostream>
#include <string>
#include <vector>
#include <iterator>
#include <vector>
#include <memory>
#include <fstream>
#include <cstdlib>
#include <thread>

#include "transcoder/transcoder.h"

void printUsage() {
    std::cout << "StreamVio Transcoder - Versión 0.1.0" << std::endl;
    std::cout << "Uso: streamvio_transcoder [opciones] [comando] [parámetros]" << std::endl;
    std::cout << std::endl;
    std::cout << "Comandos:" << std::endl;
    std::cout << "  info <archivo_entrada>                   - Obtener información de un archivo multimedia" << std::endl;
    std::cout << "  transcode <entrada> <salida> [opciones]  - Transcodificar un archivo" << std::endl;
    std::cout << "  thumbnail <entrada> <salida> [tiempo]    - Generar una miniatura del video" << std::endl;
    std::cout << std::endl;
    std::cout << "Opciones de transcodificación:" << std::endl;
    std::cout << "  --format=<formato>        - Formato de salida (mp4, webm, etc.)" << std::endl;
    std::cout << "  --vcodec=<codec>          - Codec de video (h264, vp9, etc.)" << std::endl;
    std::cout << "  --acodec=<codec>          - Codec de audio (aac, opus, etc.)" << std::endl;
    std::cout << "  --vbitrate=<kbps>         - Bitrate de video en kbps" << std::endl;
    std::cout << "  --abitrate=<kbps>         - Bitrate de audio en kbps" << std::endl;
    std::cout << "  --width=<pixeles>         - Ancho de salida" << std::endl;
    std::cout << "  --height=<pixeles>        - Alto de salida" << std::endl;
    std::cout << "  --no-hwaccel              - Desactivar aceleración por hardware" << std::endl;
}

std::string getOptionValue(const std::vector<std::string>& args, const std::string& option, const std::string& defaultValue = "") {
    for (const auto& arg : args) {
        if (arg.find(option + "=") == 0) {
            return arg.substr(option.length() + 1);
        }
    }
    return defaultValue;
}

int getOptionValueInt(const std::vector<std::string>& args, const std::string& option, int defaultValue = 0) {
    std::string value = getOptionValue(args, option);
    if (value.empty()) {
        return defaultValue;
    }
    try {
        return std::stoi(value);
    } catch (...) {
        return defaultValue;
    }
}

bool hasOption(const std::vector<std::string>& args, const std::string& option) {
    for (const auto& arg : args) {
        if (arg == option) {
            return true;
        }
    }
    return false;
}

// Callback para reportar el progreso
void progressCallback(int progress) {
    static int lastProgress = -1;
    if (progress != lastProgress) {
        std::cout << "\rProgreso: " << progress << "%" << std::flush;
        lastProgress = progress;
    }
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printUsage();
        return 1;
    }

    std::vector<std::string> args(argv + 1, argv + argc);

    std::string command = args[0];
    
    // Inicializar el transcodificador
    StreamVio::Transcoder transcoder;
    if (!transcoder.initialize()) {
        std::cerr << "Error: No se pudo inicializar el transcodificador." << std::endl;
        return 1;
    }

    // Procesar comandos
    if (command == "info") {
        if (args.size() < 2) {
            std::cerr << "Error: Se requiere una ruta de archivo para el comando info." << std::endl;
            return 1;
        }

        std::string inputPath = args[1];
        try {
            StreamVio::MediaInfo info = transcoder.getMediaInfo(inputPath);
            
            std::cout << "Información del archivo: " << inputPath << std::endl;
            std::cout << "Formato: " << info.format << std::endl;
            std::cout << "Duración: " << (info.duration / 1000.0) << " segundos" << std::endl;
            std::cout << "Resolución: " << info.width << "x" << info.height << std::endl;
            std::cout << "Codec de video: " << info.videoCodec << " (" << info.videoBitrate << " kbps)" << std::endl;
            std::cout << "Codec de audio: " << info.audioCodec << " (" << info.audioBitrate << " kbps)" << std::endl;
            std::cout << "Canales de audio: " << info.audioChannels << std::endl;
            std::cout << "Frecuencia de muestreo: " << info.audioSampleRate << " Hz" << std::endl;
            
            if (!info.metadata.empty()) {
                std::cout << "Metadatos:" << std::endl;
                for (const auto& pair : info.metadata) {
                    std::cout << "  " << pair.first << ": " << pair.second << std::endl;
                }
            }
        } catch (const std::exception& e) {
            std::cerr << "Error: " << e.what() << std::endl;
            return 1;
        }
    } else if (command == "transcode") {
        if (args.size() < 3) {
            std::cerr << "Error: Se requieren rutas de entrada y salida para el comando transcode." << std::endl;
            return 1;
        }

        std::string inputPath = args[1];
        std::string outputPath = args[2];
        
        // Configurar opciones de transcodificación
        StreamVio::TranscodeOptions options;
        options.outputFormat = getOptionValue(args, "--format");
        options.videoCodec = getOptionValue(args, "--vcodec");
        options.audioCodec = getOptionValue(args, "--acodec");
        options.videoBitrate = getOptionValueInt(args, "--vbitrate");
        options.audioBitrate = getOptionValueInt(args, "--abitrate");
        options.width = getOptionValueInt(args, "--width");
        options.height = getOptionValueInt(args, "--height");
        options.enableHardwareAcceleration = !hasOption(args, "--no-hwaccel");
        
        // Iniciar transcodificación
        try {
            std::cout << "Iniciando transcodificación..." << std::endl;
            if (!transcoder.startTranscode(inputPath, outputPath, options, progressCallback)) {
                std::cerr << "Error: No se pudo iniciar la transcodificación." << std::endl;
                return 1;
            }
            
            // La función startTranscode es asíncrona, pero podemos esperar a que termine
            // verificando el progreso hasta que llegue al 100%
            while (transcoder.getTranscodeProgress(outputPath) < 100) {
                // Esperamos un poco para no consumir demasiada CPU
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            std::cout << std::endl << "Transcodificación completada exitosamente." << std::endl;
        } catch (const std::exception& e) {
            std::cerr << "Error durante la transcodificación: " << e.what() << std::endl;
            return 1;
        }
    } else if (command == "thumbnail") {
        if (args.size() < 3) {
            std::cerr << "Error: Se requieren rutas de entrada y salida para el comando thumbnail." << std::endl;
            return 1;
        }

        std::string inputPath = args[1];
        std::string outputPath = args[2];
        int timeOffset = (args.size() > 3) ? std::stoi(args[3]) : 0;
        
        try {
            std::cout << "Generando miniatura..." << std::endl;
            if (transcoder.generateThumbnail(inputPath, outputPath, timeOffset)) {
                std::cout << "Miniatura generada exitosamente: " << outputPath << std::endl;
            } else {
                std::cerr << "Error: No se pudo generar la miniatura." << std::endl;
                return 1;
            }
        } catch (const std::exception& e) {
            std::cerr << "Error al generar miniatura: " << e.what() << std::endl;
            return 1;
        }
    } else {
        std::cerr << "Error: Comando no reconocido: " << command << std::endl;
        printUsage();
        return 1;
    }
    
    return 0;
}