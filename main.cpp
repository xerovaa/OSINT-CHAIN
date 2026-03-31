// XEROVAA — native host v5
// WebView2 + Win32 bridge

#include <windows.h>
#include <shlwapi.h>
#include <commdlg.h>
#include <wrl.h>
#include <string>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include "WebView2.h"

#pragma comment(lib, "Shlwapi.lib")

using namespace Microsoft::WRL;

// ── Globals ───────────────────────────────────────────────────────────────────
static HWND                  g_hWnd = nullptr;
static ICoreWebView2Controller* g_controller = nullptr;
static ICoreWebView2* g_webview = nullptr;

// ── String helpers ────────────────────────────────────────────────────────────
static std::wstring xerovaa_toWide(const std::string& str) {
    if (str.empty()) return L"";
    int sz = MultiByteToWideChar(CP_UTF8, 0, str.c_str(), -1, nullptr, 0);
    if (sz <= 0) return L"";
    std::wstring out(sz - 1, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, str.c_str(), -1, &out[0], sz);
    return out;
}

static std::string xerovaa_toUtf8(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    int sz = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), -1, nullptr, 0, nullptr, nullptr);
    if (sz <= 0) return "";
    std::string out(sz - 1, '\0');
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), -1, &out[0], sz, nullptr, nullptr);
    return out;
}

// ── Path helpers ──────────────────────────────────────────────────────────────
static std::wstring xerovaa_getExeDir() {
    wchar_t path[MAX_PATH] = {};
    GetModuleFileNameW(nullptr, path, MAX_PATH);
    PathRemoveFileSpecW(path);
    return path;
}

static std::wstring xerovaa_buildFileUrl(const std::wstring& absPath) {
    std::wstring url = L"file:///" + absPath;
    for (wchar_t& ch : url)
        if (ch == L'\\') ch = L'/';
    return url;
}

// ── File I/O ──────────────────────────────────────────────────────────────────
static bool xerovaa_writeFile(const std::wstring& path, const std::string& content) {
    std::ofstream f(path, std::ios::binary);
    if (!f.is_open()) return false;
    f.write(content.c_str(), static_cast<std::streamsize>(content.size()));
    return f.good();
}

// ── Save dialog ───────────────────────────────────────────────────────────────
static std::wstring xerovaa_showSaveDialog(
    const wchar_t* filter,
    const wchar_t* defExt,
    const wchar_t* title)
{
    wchar_t fileName[MAX_PATH] = {};
    OPENFILENAMEW ofn = {};
    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = g_hWnd;
    ofn.lpstrFilter = filter;
    ofn.lpstrFile = fileName;
    ofn.nMaxFile = MAX_PATH;
    ofn.Flags = OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST;
    ofn.lpstrDefExt = defExt;
    ofn.lpstrTitle = title;
    return GetSaveFileNameW(&ofn) ? fileName : L"";
}

// ── Send JSON back to web ─────────────────────────────────────────────────────
static void xerovaa_sendToWeb(const std::wstring& json) {
    if (!g_webview) return;
    std::wstring script = L"window.nativeReceive(" + json + L");";
    g_webview->ExecuteScript(script.c_str(), nullptr);
}

// ── Message dispatch ──────────────────────────────────────────────────────────
static void xerovaa_handleMessage(const std::wstring& msg) {
    const std::wstring kSave = L"SAVE_PROJECT:";
    const std::wstring kExport = L"EXPORT_REPORT:";

    auto startsWith = [&](const std::wstring& prefix) -> bool {
        return msg.rfind(prefix, 0) == 0;
        };

    if (startsWith(kSave)) {
        std::string payload = xerovaa_toUtf8(msg.substr(kSave.size()));

        std::wstring path = xerovaa_showSaveDialog(
            L"JSON Files (*.json)\0*.json\0All Files (*.*)\0*.*\0",
            L"json",
            L"Save Project — XEROVAA"
        );

        if (!path.empty()) {
            bool ok = xerovaa_writeFile(path, payload);
            xerovaa_sendToWeb(ok
                ? L"{\"type\":\"save-project-result\",\"ok\":true}"
                : L"{\"type\":\"save-project-result\",\"ok\":false}");
        }
        return;
    }

    if (startsWith(kExport)) {
        std::string payload = xerovaa_toUtf8(msg.substr(kExport.size()));

        std::wstring path = xerovaa_showSaveDialog(
            L"HTML Files (*.html)\0*.html\0All Files (*.*)\0*.*\0",
            L"html",
            L"Export HTML Report — XEROVAA"
        );

        if (!path.empty()) {
            bool ok = xerovaa_writeFile(path, payload);
            xerovaa_sendToWeb(ok
                ? L"{\"type\":\"export-report-result\",\"ok\":true}"
                : L"{\"type\":\"export-report-result\",\"ok\":false}");
        }
        return;
    }
}

// ── WebView resize ────────────────────────────────────────────────────────────
static void xerovaa_resizeWebView() {
    if (!g_controller || !g_hWnd) return;
    RECT bounds = {};
    GetClientRect(g_hWnd, &bounds);
    g_controller->put_Bounds(bounds);
}

// ── WebView init ──────────────────────────────────────────────────────────────
static void xerovaa_initWebView() {
    std::wstring dataDir = xerovaa_getExeDir() + L"\\xv_userdata";

    HRESULT hr = CreateCoreWebView2EnvironmentWithOptions(
        nullptr,
        dataDir.c_str(),
        nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [](HRESULT hr, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(hr) || !env) return E_FAIL;

                env->CreateCoreWebView2Controller(
                    g_hWnd,
                    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [](HRESULT hr, ICoreWebView2Controller* controller) -> HRESULT {
                            if (FAILED(hr) || !controller) return E_FAIL;

                            g_controller = controller;
                            g_controller->AddRef();
                            g_controller->get_CoreWebView2(&g_webview);

                            xerovaa_resizeWebView();

                            // Settings
                            ICoreWebView2Settings* settings = nullptr;
                            if (SUCCEEDED(g_webview->get_Settings(&settings)) && settings) {
                                settings->put_IsStatusBarEnabled(FALSE);
                                settings->put_AreDevToolsEnabled(FALSE);
                                settings->put_IsZoomControlEnabled(FALSE);
                                settings->put_AreDefaultContextMenusEnabled(FALSE);
                                settings->Release();
                            }

                            // Message handler
                            g_webview->add_WebMessageReceived(
                                Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                                    [](ICoreWebView2* sender,
                                        ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT
                                    {
                                        LPWSTR raw = nullptr;
                                        if (SUCCEEDED(args->TryGetWebMessageAsString(&raw)) && raw) {
                                            xerovaa_handleMessage(raw);
                                            CoTaskMemFree(raw);
                                        }
                                        return S_OK;
                                    }
                                ).Get(),
                                nullptr
                            );

                            // Navigate
                            std::wstring htmlPath = xerovaa_getExeDir() + L"\\ui\\index.html";
                            g_webview->Navigate(xerovaa_buildFileUrl(htmlPath).c_str());

                            return S_OK;
                        }
                    ).Get()
                );

                return S_OK;
            }
        ).Get()
    );

    if (FAILED(hr)) {
        MessageBoxW(
            g_hWnd,
            L"Failed to initialize WebView2.\n\nMake sure the WebView2 Runtime is installed.",
            L"XEROVAA — Error",
            MB_OK | MB_ICONERROR
        );
    }
}

// ── Window proc ───────────────────────────────────────────────────────────────
static LRESULT CALLBACK xerovaa_wndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_SIZE:
        xerovaa_resizeWebView();
        return 0;

    case WM_GETMINMAXINFO: {
        auto* mmi = reinterpret_cast<MINMAXINFO*>(lParam);
        mmi->ptMinTrackSize.x = 900;
        mmi->ptMinTrackSize.y = 600;
        return 0;
    }

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;

    default:
        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────
int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, PWSTR, int nCmdShow) {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (FAILED(hr)) return 1;

    const wchar_t CLASS_NAME[] = L"XEROVAA_MainWindow";

    WNDCLASSW wc = {};
    wc.lpfnWndProc = xerovaa_wndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = CLASS_NAME;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    wc.hbrBackground = CreateSolidBrush(RGB(4, 6, 9));
    wc.hIcon = LoadIcon(hInstance, IDI_APPLICATION);

    if (!RegisterClassW(&wc)) {
        CoUninitialize();
        return 1;
    }

    g_hWnd = CreateWindowExW(
        0,
        CLASS_NAME,
        L"XEROVAA",
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT,
        1600, 980,
        nullptr, nullptr,
        hInstance, nullptr
    );

    if (!g_hWnd) {
        CoUninitialize();
        return 1;
    }

    ShowWindow(g_hWnd, nCmdShow);
    UpdateWindow(g_hWnd);

    xerovaa_initWebView();

    MSG msg = {};
    while (GetMessageW(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    if (g_webview) {
        g_webview->Release();
        g_webview = nullptr;
    }
    if (g_controller) {
        g_controller->Release();
        g_controller = nullptr;
    }

    CoUninitialize();
    return static_cast<int>(msg.wParam);
}