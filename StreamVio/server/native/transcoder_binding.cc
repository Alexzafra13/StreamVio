#include <napi.h>
#include "transcoder/transcoder.h"

namespace {

StreamVio::Transcoder transcoder;

Napi::Boolean Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    try {
        bool result = transcoder.initialize();
        return Napi::Boolean::New(env, result);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
}

Napi::Object GetMediaInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected a string").ThrowAsJavaScriptException();
        return Napi::Object::New(env);
    }
    
    std::string inputPath = info[0].As<Napi::String>();
    
    try {
        StreamVio::MediaInfo mediaInfo = transcoder.getMediaInfo(inputPath);
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("path", Napi::String::New(env, mediaInfo.path));
        result.Set("format", Napi::String::New(env, mediaInfo.format));
        result.Set("duration", Napi::Number::New(env, mediaInfo.duration));
        result.Set("width", Napi::Number::New(env, mediaInfo.width));
        result.Set("height", Napi::Number::New(env, mediaInfo.height));
        result.Set("videoCodec", Napi::String::New(env, mediaInfo.videoCodec));
        result.Set("videoBitrate", Napi::Number::New(env, mediaInfo.videoBitrate));
        result.Set("audioCodec", Napi::String::New(env, mediaInfo.audioCodec));
        result.Set("audioBitrate", Napi::Number::New(env, mediaInfo.audioBitrate));
        result.Set("audioChannels", Napi::Number::New(env, mediaInfo.audioChannels));
        result.Set("audioSampleRate", Napi::Number::New(env, mediaInfo.audioSampleRate));
        
        // Convertir metadatos
        Napi::Object metadata = Napi::Object::New(env);
        for (const auto& pair : mediaInfo.metadata) {
            metadata.Set(pair.first, Napi::String::New(env, pair.second));
        }
        result.Set("metadata", metadata);
        
        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return Napi::Object::New(env);
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("getMediaInfo", Napi::Function::New(env, GetMediaInfo));
    // Agrega aquí las demás funciones que necesites exponer
    
    return exports;
}

NODE_API_MODULE(transcoder, Init)

}  // namespace