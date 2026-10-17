using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

class FlowHelper {
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;

    private const byte VK_CONTROL = 0x11;
    private const byte VK_LCONTROL = 0xA2;
    private const byte VK_RCONTROL = 0xA3;
    private const byte VK_SHIFT = 0x10;
    private const byte VK_MENU = 0x12; // Alt
    private const byte VK_SPACE = 0x20;
    private const byte VK_CAPITAL = 0x14; // Caps Lock
    private const byte VK_V = 0x56;

    private const uint KEYEVENTF_KEYUP = 0x0002;

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr hWnd);

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    private static LowLevelKeyboardProc _proc = HookCallback;
    private static IntPtr _hookID = IntPtr.Zero;

    private static volatile bool _isPressed = false;
    private static volatile bool _ctrlOnlyCandidate = false;
    private static volatile bool _ctrlOtherKeyPressed = false;
    private static long _ctrlDownTick = 0;
    private static DateTime _pressStartTime = DateTime.UtcNow;
    private static IntPtr _targetHwnd = IntPtr.Zero;

    // Configured hotkey mode: "Caps Lock" (Default), "Ctrl", "Ctrl+Space", or "Custom:VK_CODE"
    private static volatile string _configuredMode = "Caps Lock";
    private static volatile int _customVk = 0x77; // Default F8

    public static void Main(string[] args) {
        if (args.Length > 0 && !string.IsNullOrEmpty(args[0])) {
            SetHotkeyMode(args[0]);
        }

        Thread stdinThread = new Thread(ListenStdin);
        stdinThread.IsBackground = true;
        stdinThread.Start();

        Thread watchdogThread = new Thread(WatchdogLoop);
        watchdogThread.IsBackground = true;
        watchdogThread.Start();

        _hookID = SetHook(_proc);
        Console.WriteLine("HELPER_READY");
        Console.Out.Flush();

        Application.Run();

        UnhookWindowsHookEx(_hookID);
    }

    private static void SetHotkeyMode(string modeStr) {
        modeStr = (modeStr ?? "").Trim();
        if (modeStr.StartsWith("Custom:", StringComparison.OrdinalIgnoreCase)) {
            int vk;
            if (int.TryParse(modeStr.Substring(7), out vk)) {
                _customVk = vk;
                _configuredMode = "Custom";
            } else {
                _configuredMode = "Caps Lock";
            }
        } else if (modeStr.Equals("Ctrl+Space", StringComparison.OrdinalIgnoreCase)) {
            _configuredMode = "Ctrl+Space";
        } else if (modeStr.Equals("Ctrl", StringComparison.OrdinalIgnoreCase)) {
            _configuredMode = "Ctrl";
        } else {
            _configuredMode = "Caps Lock";
        }

        _isPressed = false;
        _ctrlOnlyCandidate = false;
        Console.WriteLine("HOTKEY_CONFIGURED:" + _configuredMode);
        Console.Out.Flush();
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int vkCode = Marshal.ReadInt32(lParam);
            bool isDown = (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN);
            bool isUp = (wParam == (IntPtr)WM_KEYUP || wParam == (IntPtr)WM_SYSKEYUP);

            // MODE 1: Caps Lock & Dual Ctrl Support
            if (_configuredMode == "Caps Lock") {
                if (vkCode == VK_CAPITAL) {
                    if (isDown) {
                        if (!_isPressed) {
                            IntPtr fg = GetForegroundWindow();
                            if (fg != IntPtr.Zero) _targetHwnd = fg;
                            _isPressed = true;
                            _pressStartTime = DateTime.UtcNow;
                            Console.WriteLine("HOTKEY_DOWN");
                            Console.Out.Flush();
                        }
                        return (IntPtr)1; // Suppress Caps toggle so it doesn't flip keyboard casing
                    } else if (isUp) {
                        if (_isPressed) {
                            _isPressed = false;
                            Console.WriteLine("HOTKEY_UP");
                            Console.Out.Flush();
                        }
                        return (IntPtr)1; // Suppress Caps release
                    }
                } else if (vkCode == VK_CONTROL || vkCode == VK_LCONTROL || vkCode == VK_RCONTROL) {
                    if (isDown) {
                        if (!_ctrlOnlyCandidate && !_isPressed) {
                            _ctrlOnlyCandidate = true;
                            _ctrlOtherKeyPressed = false;
                            _ctrlDownTick = Stopwatch.GetTimestamp();
                            IntPtr fg = GetForegroundWindow();
                            if (fg != IntPtr.Zero) _targetHwnd = fg;
                        }
                    } else if (isUp) {
                        _ctrlOnlyCandidate = false;
                        if (_isPressed) {
                            _isPressed = false;
                            Console.WriteLine("HOTKEY_UP");
                            Console.Out.Flush();
                        }
                    }
                } else {
                    if (isDown && _ctrlOnlyCandidate) {
                        _ctrlOtherKeyPressed = true;
                    }
                }
                return CallNextHookEx(_hookID, nCode, wParam, lParam);
            }

            // MODE 2: Custom Key
            if (_configuredMode == "Custom") {
                if (vkCode == _customVk) {
                    if (isDown) {
                        if (!_isPressed) {
                            IntPtr fg = GetForegroundWindow();
                            if (fg != IntPtr.Zero) _targetHwnd = fg;
                            _isPressed = true;
                            _pressStartTime = DateTime.UtcNow;
                            Console.WriteLine("HOTKEY_DOWN");
                            Console.Out.Flush();
                        }
                        return (IntPtr)1; // Suppress key typing while holding push-to-talk
                    } else if (isUp) {
                        if (_isPressed) {
                            _isPressed = false;
                            Console.WriteLine("HOTKEY_UP");
                            Console.Out.Flush();
                        }
                        return (IntPtr)1;
                    }
                }
                return CallNextHookEx(_hookID, nCode, wParam, lParam);
            }

            // MODE 3: Ctrl + Spacebar
            if (_configuredMode == "Ctrl+Space") {
                if (vkCode == VK_SPACE) {
                    bool ctrlDown = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0 ||
                                    (GetAsyncKeyState(VK_LCONTROL) & 0x8000) != 0 ||
                                    (GetAsyncKeyState(VK_RCONTROL) & 0x8000) != 0;
                    if (ctrlDown) {
                        if (isDown) {
                            if (!_isPressed) {
                                IntPtr fg = GetForegroundWindow();
                                if (fg != IntPtr.Zero) _targetHwnd = fg;
                                _isPressed = true;
                                _pressStartTime = DateTime.UtcNow;
                                Console.WriteLine("HOTKEY_DOWN");
                                Console.Out.Flush();
                            }
                            return (IntPtr)1; // Suppress space typing
                        } else if (isUp) {
                            if (_isPressed) {
                                _isPressed = false;
                                Console.WriteLine("HOTKEY_UP");
                                Console.Out.Flush();
                            }
                            return (IntPtr)1;
                        }
                    }
                } else if ((vkCode == VK_CONTROL || vkCode == VK_LCONTROL || vkCode == VK_RCONTROL) && isUp) {
                    if (_isPressed) {
                        _isPressed = false;
                        Console.WriteLine("HOTKEY_UP");
                        Console.Out.Flush();
                    }
                }
                return CallNextHookEx(_hookID, nCode, wParam, lParam);
            }

            // MODE 4: Single Control Key (Hold > 180ms without other keys)
            if (_configuredMode == "Ctrl") {
                if (vkCode == VK_CONTROL || vkCode == VK_LCONTROL || vkCode == VK_RCONTROL) {
                    if (isDown) {
                        if (!_ctrlOnlyCandidate && !_isPressed) {
                            _ctrlOnlyCandidate = true;
                            _ctrlOtherKeyPressed = false;
                            _ctrlDownTick = Stopwatch.GetTimestamp();
                            IntPtr fg = GetForegroundWindow();
                            if (fg != IntPtr.Zero) _targetHwnd = fg;
                        }
                    } else if (isUp) {
                        _ctrlOnlyCandidate = false;
                        if (_isPressed) {
                            _isPressed = false;
                            Console.WriteLine("HOTKEY_UP");
                            Console.Out.Flush();
                        }
                    }
                } else {
                    // Any other key pressed cancels single Ctrl dictation
                    if (isDown && _ctrlOnlyCandidate) {
                        _ctrlOtherKeyPressed = true;
                    }
                }
            }
        }
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
    }

    private static void WatchdogLoop() {
        while (true) {
            Thread.Sleep(20);

            // Single Ctrl hold timer check (> 180ms without any other key)
            if ((_configuredMode == "Ctrl" || _configuredMode == "Caps Lock") && _ctrlOnlyCandidate && !_ctrlOtherKeyPressed && !_isPressed) {
                long elapsedMs = (Stopwatch.GetTimestamp() - _ctrlDownTick) * 1000 / Stopwatch.Frequency;
                if (elapsedMs >= 180) {
                    bool ctrlDown = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0 ||
                                    (GetAsyncKeyState(VK_LCONTROL) & 0x8000) != 0 ||
                                    (GetAsyncKeyState(VK_RCONTROL) & 0x8000) != 0;
                    if (ctrlDown) {
                        _isPressed = true;
                        _pressStartTime = DateTime.UtcNow;
                        Console.WriteLine("HOTKEY_DOWN");
                        Console.Out.Flush();
                    } else {
                        _ctrlOnlyCandidate = false;
                    }
                }
            }

            // Safety timeout: If hotkey has been held > 120 seconds, automatically release
            if (_isPressed) {
                if ((DateTime.UtcNow - _pressStartTime).TotalSeconds > 120) {
                    _isPressed = false;
                    _ctrlOnlyCandidate = false;
                    Console.WriteLine("HOTKEY_UP");
                    Console.Out.Flush();
                }
            }
        }
    }

    private static void ListenStdin() {
        string line;
        while ((line = Console.ReadLine()) != null) {
            line = line.Trim();
            if (line.StartsWith("SET_HOTKEY ")) {
                SetHotkeyMode(line.Substring(11));
            } else if (line == "PASTE") {
                PerformPaste();
            } else if (line == "EXIT") {
                Environment.Exit(0);
            }
        }
    }

    public static void PerformPaste() {
        try {
            IntPtr target = _targetHwnd;
            if (target == IntPtr.Zero || !IsWindow(target)) {
                target = GetForegroundWindow();
            }

            if (target != IntPtr.Zero) {
                IntPtr fg = GetForegroundWindow();
                if (fg != target) {
                    uint curThread = GetCurrentThreadId();
                    uint targetPid;
                    uint targetThread = GetWindowThreadProcessId(target, out targetPid);
                    uint fgPid;
                    uint fgThread = GetWindowThreadProcessId(fg, out fgPid);

                    if (fgThread != 0 && fgThread != curThread) {
                        AttachThreadInput(curThread, fgThread, true);
                    }
                    if (targetThread != 0 && targetThread != curThread) {
                        AttachThreadInput(curThread, targetThread, true);
                    }

                    SetForegroundWindow(target);
                    BringWindowToTop(target);

                    if (targetThread != 0 && targetThread != curThread) {
                        AttachThreadInput(curThread, targetThread, false);
                    }
                    if (fgThread != 0 && fgThread != curThread) {
                        AttachThreadInput(curThread, fgThread, false);
                    }
                }
            }

            Thread.Sleep(80);

            // Release modifiers
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_LCONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_RCONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_CAPITAL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(30);

            // Send Ctrl + V
            keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
            keybd_event(VK_V, 0, 0, UIntPtr.Zero);
            Thread.Sleep(40);
            keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

            Console.WriteLine("PASTED");
            Console.Out.Flush();
        } catch (Exception ex) {
            Console.WriteLine("PASTE_ERROR:" + ex.Message);
            Console.Out.Flush();
        }
    }
}
