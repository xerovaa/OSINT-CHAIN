cmake_minimum_required(VERSION 3.20)
project(XEROVAA LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

add_executable(XEROVAA WIN32
    src/main.cpp
)

if(MSVC)
    target_compile_options(XEROVAA PRIVATE /W4 /EHsc)
    target_compile_definitions(XEROVAA PRIVATE
        $<$<CONFIG:Release>:NDEBUG>
        UNICODE
        _UNICODE
    )
    target_link_options(XEROVAA PRIVATE
        $<$<CONFIG:Release>:/LTCG>
    )
else()
    target_compile_options(XEROVAA PRIVATE -Wall -Wextra -Wpedantic)
endif()

find_path(WEBVIEW2_INCLUDE_DIR
    NAMES WebView2.h
    PATHS
        "$ENV{WEBVIEW2_SDK_DIR}/build/native/include"
        "C:/Program Files (x86)/Microsoft SDKs/WebView2/1.0.3065.39/build/native/include"
        "C:/Program Files (x86)/Microsoft SDKs/WebView2/1.0.2903.40/build/native/include"
        "${CMAKE_SOURCE_DIR}/sdk/webview2/include"
)

find_library(WEBVIEW2_LOADER
    NAMES WebView2Loader
    PATHS
        "$ENV{WEBVIEW2_SDK_DIR}/build/native/x64"
        "$ENV{WEBVIEW2_SDK_DIR}/build/native/x86"
        "C:/Program Files (x86)/Microsoft SDKs/WebView2/1.0.3065.39/build/native/x64"
        "C:/Program Files (x86)/Microsoft SDKs/WebView2/1.0.2903.40/build/native/x64"
        "${CMAKE_SOURCE_DIR}/sdk/webview2/x64"
)

if(NOT WEBVIEW2_INCLUDE_DIR)
    message(FATAL_ERROR
        "[XEROVAA] WebView2.h not found.\n"
        "Install WebView2 SDK via NuGet or set WEBVIEW2_SDK_DIR env variable.\n"
        "Or drop SDK into: ${CMAKE_SOURCE_DIR}/sdk/webview2/"
    )
endif()

if(NOT WEBVIEW2_LOADER)
    message(FATAL_ERROR
        "[XEROVAA] WebView2Loader.lib not found.\n"
        "Check WEBVIEW2_SDK_DIR or put lib into: ${CMAKE_SOURCE_DIR}/sdk/webview2/x64/"
    )
endif()

target_include_directories(XEROVAA PRIVATE ${WEBVIEW2_INCLUDE_DIR})

target_link_libraries(XEROVAA PRIVATE
    ${WEBVIEW2_LOADER}
    user32
    ole32
    shell32
    gdi32
    comdlg32
    shlwapi
)

add_custom_command(TARGET XEROVAA POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory
        "$<TARGET_FILE_DIR:XEROVAA>/ui"

    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_SOURCE_DIR}/ui/index.html"
        "$<TARGET_FILE_DIR:XEROVAA>/ui/index.html"

    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_SOURCE_DIR}/ui/style.css"
        "$<TARGET_FILE_DIR:XEROVAA>/ui/style.css"

    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_SOURCE_DIR}/ui/app.js"
        "$<TARGET_FILE_DIR:XEROVAA>/ui/app.js"

    COMMENT "[XEROVAA] Copying UI assets..."
)


find_file(WEBVIEW2_LOADER_DLL
    NAMES WebView2Loader.dll
    PATHS
        "$ENV{WEBVIEW2_SDK_DIR}/build/native/x64"
        "C:/Program Files (x86)/Microsoft SDKs/WebView2/1.0.3065.39/build/native/x64"
        "C:/Program Files (x86)/Microsoft SDKs/WebView2/1.0.2903.40/build/native/x64"
        "${CMAKE_SOURCE_DIR}/sdk/webview2/x64"
)

if(WEBVIEW2_LOADER_DLL)
    add_custom_command(TARGET XEROVAA POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${WEBVIEW2_LOADER_DLL}"
            "$<TARGET_FILE_DIR:XEROVAA>/WebView2Loader.dll"
        COMMENT "[XEROVAA] Copying WebView2Loader.dll..."
    )
endif()