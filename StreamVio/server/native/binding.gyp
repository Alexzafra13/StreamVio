{
  "targets": [
    {
      "target_name": "streamvio_transcoder",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
        "transcoder_binding.cc",
        "../../core/src/transcoder/transcoder.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "../../core/include"
      ],
      "libraries": [
        "-lavcodec",
        "-lavformat",
        "-lavutil",
        "-lswscale",
        "-lavfilter"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS==\"linux\"", {
          "cflags": [
            "<!@(pkg-config --cflags libavcodec libavformat libavutil libswscale libavfilter)"
          ],
          "ldflags": [
            "<!@(pkg-config --libs libavcodec libavformat libavutil libswscale libavfilter)"
          ]
        }],
        ["OS==\"mac\"", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.7",
            "OTHER_CFLAGS": [
              "-I/usr/local/include"
            ],
            "OTHER_LDFLAGS": [
              "-L/usr/local/lib"
            ]
          }
        }],
        ["OS==\"win\"", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          },
          "conditions": [
            ["target_arch==\"x64\"", {
              "variables": {
                "ffmpeg_arch": "x64"
              }
            }, {
              "variables": {
                "ffmpeg_arch": "Win32"
              }
            }]
          ]
        }]
      ]
    }
  ]
}