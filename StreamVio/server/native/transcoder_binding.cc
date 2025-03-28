#include <node_api.h>
#include <napi.h>
#include <string>
#include <memory>
#include <functional>
#include <unordered_map>
#include <mutex>
#include "../../core/include/transcoder/transcoder.h"

class TranscoderWrapper : public Napi::ObjectWrap<TranscoderWrapper> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  TranscoderWrapper(const Napi::CallbackInfo& info);
  ~TranscoderWrapper();

 private:
  static Napi::FunctionReference constructor;
  StreamVio::Transcoder transcoder;
  std::unordered_map<std::string, Napi::ThreadSafeFunction> progressCallbacks;
  std::mutex callbackMutex;

  // Métodos JavaScript
  Napi::Value Initialize(const Napi::CallbackInfo& info);
  Napi::Value GetMediaInfo(const Napi::CallbackInfo& info);
  Napi::Value StartTranscode(const Napi::CallbackInfo& info);
  Napi::Value CancelTranscode(const Napi::CallbackInfo& info);
  Napi::Value GetTranscodeProgress(const Napi::CallbackInfo& info);
  Napi::Value GenerateThumbnail(const Napi::CallbackInfo& info);
};

Napi::FunctionReference TranscoderWrapper::constructor;

Napi::Object TranscoderWrapper::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "Transcoder", {
    InstanceMethod("initialize", &TranscoderWrapper::Initialize),
    InstanceMethod("getMediaInfo", &TranscoderWrapper::GetMediaInfo),
    InstanceMethod("startTranscode", &TranscoderWrapper::StartTranscode),
    InstanceMethod("cancelTranscode", &TranscoderWrapper::CancelTranscode),
    InstanceMethod("getTranscodeProgress", &TranscoderWrapper::GetTranscodeProgress),
    InstanceMethod("generateThumbnail", &TranscoderWrapper::GenerateThumbnail),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("Transcoder", func);
  return exports;
}

TranscoderWrapper::TranscoderWrapper(const Napi::CallbackInfo& info) 
  : Napi::ObjectWrap<TranscoderWrapper>(info) {}

TranscoderWrapper::~TranscoderWrapper() {
  // Limpiar todas las ThreadSafeFunctions
  std::lock_guard<std::mutex> lock(callbackMutex);
  for (auto& [key, tsfn] : progressCallbacks) {
    tsfn.Release();
  }
  progressCallbacks.clear();
}

Napi::Value TranscoderWrapper::Initialize(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  bool result = transcoder.initialize();
  return Napi::Boolean::New(env, result);
}

Napi::Value TranscoderWrapper::GetMediaInfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Se espera una ruta de archivo").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string inputPath = info[0].As<Napi::String>().Utf8Value();
  
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
    
    Napi::Object metadata = Napi::Object::New(env);
    for (const auto& [key, value] : mediaInfo.metadata) {
      metadata.Set(key, Napi::String::New(env, value));
    }
    result.Set("metadata", metadata);
    
    return result;
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Value TranscoderWrapper::StartTranscode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsObject()) {
    Napi::TypeError::New(env, "Se esperan: rutaDeEntrada, rutaDeSalida, opciones").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string inputPath = info[0].As<Napi::String>().Utf8Value();
  std::string outputPath = info[1].As<Napi::String>().Utf8Value();
  Napi::Object jsOptions = info[2].As<Napi::Object>();
  
  StreamVio::TranscodeOptions options;
  
  if (jsOptions.Has("outputFormat") && jsOptions.Get("outputFormat").IsString()) {
    options.outputFormat = jsOptions.Get("outputFormat").As<Napi::String>().Utf8Value();
  }
  
  if (jsOptions.Has("videoBitrate") && jsOptions.Get("videoBitrate").IsNumber()) {
    options.videoBitrate = jsOptions.Get("videoBitrate").As<Napi::Number>().Int32Value();
  }
  
  if (jsOptions.Has("audioBitrate") && jsOptions.Get("audioBitrate").IsNumber()) {
    options.audioBitrate = jsOptions.Get("audioBitrate").As<Napi::Number>().Int32Value();
  }
  
  if (jsOptions.Has("width") && jsOptions.Get("width").IsNumber()) {
    options.width = jsOptions.Get("width").As<Napi::Number>().Int32Value();
  }
  
  if (jsOptions.Has("height") && jsOptions.Get("height").IsNumber()) {
    options.height = jsOptions.Get("height").As<Napi::Number>().Int32Value();
  }
  
  if (jsOptions.Has("videoCodec") && jsOptions.Get("videoCodec").IsString()) {
    options.videoCodec = jsOptions.Get("videoCodec").As<Napi::String>().Utf8Value();
  }
  
  if (jsOptions.Has("audioCodec") && jsOptions.Get("audioCodec").IsString()) {
    options.audioCodec = jsOptions.Get("audioCodec").As<Napi::String>().Utf8Value();
  }
  
  if (jsOptions.Has("enableHardwareAcceleration") && jsOptions.Get("enableHardwareAcceleration").IsBoolean()) {
    options.enableHardwareAcceleration = jsOptions.Get("enableHardwareAcceleration").As<Napi::Boolean>().Value();
  }
  
  // Revisar si se proporcionó un callback para el progreso
  Napi::ThreadSafeFunction tsfn;
  if (info.Length() >= 4 && info[3].IsFunction()) {
    Napi::Function progressCallback = info[3].As<Napi::Function>();
    
    tsfn = Napi::ThreadSafeFunction::New(
      env,
      progressCallback,
      "Progress Callback",
      0,
      1
    );
    
    // Guardar la función ThreadSafe para poder usarla en el callback
    std::lock_guard<std::mutex> lock(callbackMutex);
    progressCallbacks[outputPath] = tsfn;
  }
  
  // Configurar la función de callback para el progreso
  std::function<void(int)> progressHandler = [this, outputPath](int progress) {
    std::lock_guard<std::mutex> lock(this->callbackMutex);
    auto it = this->progressCallbacks.find(outputPath);
    if (it != this->progressCallbacks.end()) {
      auto tsfn = it->second;
      
      // Llamar a la función de JavaScript desde el hilo de trabajo
      auto callback = [progress](Napi::Env env, Napi::Function jsCallback) {
        jsCallback.Call({Napi::Number::New(env, progress)});
      };
      
      tsfn.BlockingCall(callback);
      
      // Si la transcodificación ha terminado, liberar el recurso
      if (progress >= 100) {
        tsfn.Release();
        this->progressCallbacks.erase(it);
      }
    }
  };
  
  // Iniciar la transcodificación
  try {
    bool result = transcoder.startTranscode(inputPath, outputPath, options, progressHandler);
    return Napi::Boolean::New(env, result);
  } catch (const std::exception& e) {
    // Si hay un error, liberar el recurso ThreadSafeFunction
    if (!tsfn.IsEmpty()) {
      std::lock_guard<std::mutex> lock(callbackMutex);
      auto it = progressCallbacks.find(outputPath);
      if (it != progressCallbacks.end()) {
        it->second.Release();
        progressCallbacks.erase(it);
      }
    }
    
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Value TranscoderWrapper::CancelTranscode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Se espera una ruta de salida").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string outputPath = info[0].As<Napi::String>().Utf8Value();
  bool result = transcoder.cancelTranscode(outputPath);
  
  // Si se canceló correctamente, liberar la función de callback
  if (result) {
    std::lock_guard<std::mutex> lock(callbackMutex);
    auto it = progressCallbacks.find(outputPath);
    if (it != progressCallbacks.end()) {
      it->second.Release();
      progressCallbacks.erase(it);
    }
  }
  
  return Napi::Boolean::New(env, result);
}

Napi::Value TranscoderWrapper::GetTranscodeProgress(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Se espera una ruta de salida").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string outputPath = info[0].As<Napi::String>().Utf8Value();
  int progress = transcoder.getTranscodeProgress(outputPath);
  
  return Napi::Number::New(env, progress);
}

Napi::Value TranscoderWrapper::GenerateThumbnail(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
    Napi::TypeError::New(env, "Se esperan rutas de entrada y salida").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string inputPath = info[0].As<Napi::String>().Utf8Value();
  std::string outputPath = info[1].As<Napi::String>().Utf8Value();
  int timeOffset = 0;
  int width = 320;
  int height = 180;
  
  if (info.Length() >= 3 && info[2].IsNumber()) {
    timeOffset = info[2].As<Napi::Number>().Int32Value();
  }
  
  if (info.Length() >= 4 && info[3].IsNumber()) {
    width = info[3].As<Napi::Number>().Int32Value();
  }
  
  if (info.Length() >= 5 && info[4].IsNumber()) {
    height = info[4].As<Napi::Number>().Int32Value();
  }
  
  try {
    bool result = transcoder.generateThumbnail(inputPath, outputPath, timeOffset, width, height);
    return Napi::Boolean::New(env, result);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

// Inicializar el módulo Node.js
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  return TranscoderWrapper::Init(env, exports);
}

NODE_API_MODULE(streamvio_transcoder, InitAll)