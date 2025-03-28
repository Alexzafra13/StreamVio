// StreamVio/core/include/transcoder/transcoder.h
#pragma once

#include <string>
#include <vector>
#include <map>
#include <functional>

namespace StreamVio {

struct TranscodeOptions {
    std::string outputFormat;
    int videoBitrate = 0;     // En kbps, 0 = usar bitrate original
    int audioBitrate = 0;     // En kbps, 0 = usar bitrate original
    int width = 0;            // 0 = mantener resolución original
    int height = 0;           // 0 = mantener resolución original
    std::string videoCodec;   // Vacío = usar codec por defecto para el formato
    std::string audioCodec;   // Vacío = usar codec por defecto para el formato
    bool enableHardwareAcceleration = true;
};

struct MediaInfo {
    std::string path;
    std::string format;
    long duration;        // En milisegundos
    int width;
    int height;
    std::string videoCodec;
    int videoBitrate;     // En kbps
    std::string audioCodec;
    int audioBitrate;     // En kbps
    int audioChannels;
    int audioSampleRate;  // En Hz
    std::map<std::string, std::string> metadata;
};

class Transcoder {
public:
    Transcoder();
    ~Transcoder();

    // Inicializa el transcodificador
    bool initialize();
    
    // Obtiene información de un archivo multimedia
    MediaInfo getMediaInfo(const std::string& inputPath);
    
    // Inicia la transcodificación de forma asíncrona
    bool startTranscode(const std::string& inputPath, 
                       const std::string& outputPath,
                       const TranscodeOptions& options,
                       std::function<void(int)> progressCallback);
    
    // Cancela una transcodificación en curso
    bool cancelTranscode(const std::string& outputPath);
    
    // Comprueba el estado de una transcodificación
    int getTranscodeProgress(const std::string& outputPath);
    
    // Crea una miniatura a partir de un archivo de video
    bool generateThumbnail(const std::string& inputPath, 
                          const std::string& outputPath,
                          int timeOffsetMs = 0,
                          int width = 320,
                          int height = 180);

private:
    // Implementación interna
    class Impl;
    Impl* pImpl;
};

} // namespace StreamVio