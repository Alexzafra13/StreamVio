#include <napi.h>
#include "transcoder/transcoder.h"
#include <iostream>
#include <string>

class TranscoderWrapper : public Napi::ObjectWrap<TranscoderWrapper> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  TranscoderWrapper(const Napi::CallbackInfo& info);

private:
  // Métodos expuestos a JavaScript
  Napi::Value GetMediaInfo(const Napi::CallbackInfo& info);
  Napi::Value StartTranscode(const Napi::CallbackInfo& info);
  Napi::Value CancelTranscode(const Napi::CallbackInfo& info);
  Napi::Value GetTranscodeProgress(const Napi::CallbackInfo& info);
  Napi::Value GenerateThumbnail(const Napi::CallbackInfo& info);
  
  // Instancia del transcodificador
  StreamVio::Transcoder transcoder;
};

TranscoderWrapper::TranscoderWrapper(const Napi::CallbackInfo& info) 
  : Napi::ObjectWrap<TranscoderWrapper>(info) {
  Napi::Env env = info.Env();
  
  if (!transcoder.initialize()) {
    Napi::Error::New(env, "No se pudo inicializar el transcodificador").ThrowAsJavaScriptException();
  }
}

Napi::Value TranscoderWrapper::GetMediaInfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Se espera una ruta de archivo").ThrowAsJavaScriptException();
    return env.Null();
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
    
    Napi::Object metadata = Napi::Object::New(env);
    for (const auto& entry : mediaInfo.metadata) {
      metadata.Set(entry.first, Napi::String::New(env, entry.second));
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
  
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
    Napi::TypeError::New(env, "Se esperan rutas de entrada y salida").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string inputPath = info[0].As<Napi::String>();
  std::string outputPath = info[1].As<Napi::String>();
  
  StreamVio::TranscodeOptions options;
  if (info.Length() >= 3 && info[2].IsObject()) {
    Napi::Object jsOptions = info[2].As<Napi::Object>();
    
    if (jsOptions.Has("outputFormat") && jsOptions.Get("outputFormat").IsString()) {
      options.outputFormat = jsOptions.Get("outputFormat").As<Napi::String>();
    }
    
    if (jsOptions.Has("videoCodec") && jsOptions.Get("videoCodec").IsString()) {
      options.videoCodec = jsOptions.Get("videoCodec").As<Napi::String>();
    }
    
    if (jsOptions.Has("audioCodec") && jsOptions.Get("audioCodec").IsString()) {
      options.audioCodec = jsOptions.Get("audioCodec").As<Napi::String>();
    }
    
    if (jsOptions.Has("videoBitrate") && jsOptions.Get("videoBitrate").IsNumber()) {
      options.videoBitrate = jsOptions.Get("videoBitrate").As<Napi::Number>();
    }
    
    if (jsOptions.Has("audioBitrate") && jsOptions.Get("audioBitrate").IsNumber()) {
      options.audioBitrate = jsOptions.Get("audioBitrate").As<Napi::Number>();
    }
    
    if (jsOptions.Has("width") && jsOptions.Get("width").IsNumber()) {
      options.width = jsOptions.Get("width").As<Napi::Number>();
    }
    
    if (jsOptions.Has("height") && jsOptions.Get("height").IsNumber()) {
      options.height = jsOptions.Get("height").As<Napi::Number>();
    }
    
    if (jsOptions.Has("enableHardwareAcceleration") && jsOptions.Get("enableHardwareAcceleration").IsBoolean()) {
      options.enableHardwareAcceleration = jsOptions.Get("enableHardwareAcceleration").As<Napi::Boolean>();
    }
  }
  
  Napi::Function progressCallback;
  if (info.Length() >= 4 && info[3].IsFunction()) {
    progressCallback = info[3].As<Napi::Function>();
  }
  
  try {
    std::function<void(int)> nativeCallback;
    if (!progressCallback.IsEmpty()) {
      Napi::FunctionReference* callbackRef = new Napi::FunctionReference();
      *callbackRef = Napi::Persistent(progressCallback);
      
      nativeCallback = [env, callbackRef](int progress) {
        callbackRef->Call({Napi::Number::New(env, progress)});
      };
    }
    
    bool success = transcoder.startTranscode(inputPath, outputPath, options, nativeCallback);
    
    return Napi::Boolean::New(env, success);
  } catch (const std::exception& e) {
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
  
  std::string outputPath = info[0].As<Napi::String>();
  
  try {
    bool success = transcoder.cancelTranscode(outputPath);
    
    return Napi::Boolean::New(env, success);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Value TranscoderWrapper::GetTranscodeProgress(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Se espera una ruta de salida").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string outputPath = info[0].As<Napi::String>();
  
  try {
    int progress = transcoder.getTranscodeProgress(outputPath);
    
    return Napi::Number::New(env, progress);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Value TranscoderWrapper::GenerateThumbnail(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
    Napi::TypeError::New(env, "Se esperan rutas de entrada y salida").ThrowAsJavaScriptException();
    return env.Null();
  }
  
  std::string inputPath = info[0].As<Napi::String>();
  std::string outputPath = info[1].As<Napi::String>();
  
  int timeOffsetMs = 0;
  if (info.Length() >= 3 && info[2].IsNumber()) {
    timeOffsetMs = info[2].As<Napi::Number>();
  }
  
  int width = 320;
  if (info.Length() >= 4 && info[3].IsNumber()) {
    width = info[3].As<Napi::Number>();
  }
  
  int height = 180;
  if (info.Length() >= 5 && info[4].IsNumber()) {
    height = info[4].As<Napi::Number>();
  }
  
  try {
    bool success = transcoder.generateThumbnail(inputPath, outputPath, timeOffsetMs, width, height);
    
    return Napi::Boolean::New(env, success);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Object TranscoderWrapper::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "Transcoder", {
    InstanceMethod("getMediaInfo", &TranscoderWrapper::GetMediaInfo),
    InstanceMethod("startTranscode", &TranscoderWrapper::StartTranscode),
    InstanceMethod("cancelTranscode", &TranscoderWrapper::CancelTranscode),
    InstanceMethod("getTranscodeProgress", &TranscoderWrapper::GetTranscodeProgress),
    InstanceMethod("generateThumbnail", &TranscoderWrapper::GenerateThumbnail),
  });
  
  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  
  env.SetInstanceData(constructor);
  
  exports.Set("Transcoder", func);
  return exports;
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  return TranscoderWrapper::Init(env, exports);
}

NODE_API_MODULE(transcoder, InitAll)