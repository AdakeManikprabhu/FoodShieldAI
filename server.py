#!/usr/bin/env python3
"""
server.py — FoodShieldAI Single-Command Application Launcher.

Starts both the FastAPI backend and React Vite frontend concurrently,
monitors their health, displays access URLs, handles port conflicts,
and cleanly terminates all child processes on Ctrl+C.

Usage:
    .\\backend\\venv\\Scripts\\python.exe server.py
"""

import os
import sys
import time
import socket
import signal
import shutil
import subprocess
import threading
import urllib.request
import urllib.error
from pathlib import Path

# Ensure unbuffered and UTF-8 output on Windows consoles/pipes
os.environ["PYTHONUNBUFFERED"] = "1"
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    except Exception:
        pass

# Paths
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

# Virtual environment python & binaries
VENV_PYTHON = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
if not VENV_PYTHON.exists():
    VENV_PYTHON = Path(sys.executable)

BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8000
FRONTEND_HOST = "127.0.0.1"
FRONTEND_PORT = 5173

BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"
BACKEND_DOCS_URL = f"{BACKEND_URL}/docs"
BACKEND_HEALTH_URL = f"{BACKEND_URL}/api/health"
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

# Global process handles for cleanup
backend_proc = None
frontend_proc = None
shutdown_initiated = False


def log(msg: str):
    """Print message with timestamp and immediate flush."""
    print(msg, flush=True)


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check if a TCP port is currently open and bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def check_existing_backend_health() -> bool:
    """Check if an already-running process on port 8000 is FoodShieldAI."""
    try:
        req = urllib.request.Request(BACKEND_HEALTH_URL, headers={"User-Agent": "FoodShieldAI-Launcher"})
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            return resp.getcode() == 200
    except Exception:
        return False


def kill_proc_tree(pid: int):
    """Cleanly terminate a process and all its child processes on Windows."""
    if not pid:
        return
    if sys.platform == "win32":
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        except Exception:
            pass
    else:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass


def cleanup():
    """Terminate both backend and frontend processes cleanly."""
    global shutdown_initiated, backend_proc, frontend_proc
    if shutdown_initiated:
        return
    shutdown_initiated = True

    log("\n[Launcher] Shutting down FoodShieldAI services...")

    if backend_proc and backend_proc.poll() is None:
        log("[Launcher] Stopping FastAPI backend...")
        kill_proc_tree(backend_proc.pid)
        try:
            backend_proc.wait(timeout=2)
        except Exception:
            pass

    if frontend_proc and frontend_proc.poll() is None:
        log("[Launcher] Stopping React/Vite frontend...")
        kill_proc_tree(frontend_proc.pid)
        try:
            frontend_proc.wait(timeout=2)
        except Exception:
            pass

    log("[Launcher] All services stopped. Goodbye!\n")


def stream_logs(pipe, prefix: str):
    """Stream process logs asynchronously with a prefix."""
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            stripped = line.rstrip()
            if stripped:
                log(f"[{prefix}] {stripped}")
    except Exception:
        pass


def wait_for_service(url: str, name: str, timeout: float = 15.0) -> bool:
    """Poll an HTTP URL until it returns HTTP 200 or times out."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "FoodShieldAI-HealthCheck"})
            with urllib.request.urlopen(req, timeout=0.8) as resp:
                if resp.getcode() == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def main():
    global backend_proc, frontend_proc

    # Register signal handlers for graceful Ctrl+C exit
    def handle_signal(sig, frame):
        cleanup()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    log("\n" + "=" * 70)
    log("  FoodShieldAI -- Unified Application Launcher")
    log("=" * 70)
    log(f"  Working Directory: {ROOT_DIR}")
    log(f"  Python Runtime:    {VENV_PYTHON}")

    # 1. Port conflict detection
    if is_port_in_use(BACKEND_PORT, BACKEND_HOST):
        if check_existing_backend_health():
            log(f"\n[WARNING] Port {BACKEND_PORT} is already hosting a running FoodShieldAI backend.")
            log(f"          Existing Backend URL: {BACKEND_URL}")
        else:
            log(f"\n[ERROR] Port {BACKEND_PORT} is already occupied by another application.")
            log(f"        Please free port {BACKEND_PORT} or terminate the conflicting process.")
            sys.exit(1)

    if is_port_in_use(FRONTEND_PORT, FRONTEND_HOST):
        log(f"\n[ERROR] Port {FRONTEND_PORT} is already occupied by another application.")
        log(f"        Please free port {FRONTEND_PORT} before starting the frontend.")
        sys.exit(1)

    # 2. Check npm availability for frontend
    npm_cmd = shutil.which("npm.cmd") if sys.platform == "win32" else shutil.which("npm")
    if not npm_cmd:
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    log("\n[Launcher] Starting services...")
    t_start = time.perf_counter()

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"

    # 3. Start Backend Process
    backend_cmd = [
        str(VENV_PYTHON),
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        BACKEND_HOST,
        "--port",
        str(BACKEND_PORT),
    ]

    try:
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(BACKEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
        )
    except Exception as e:
        log(f"[ERROR] Failed to launch backend: {e}")
        cleanup()
        sys.exit(1)

    # Launch background thread for backend log streaming
    threading.Thread(
        target=stream_logs,
        args=(backend_proc.stdout, "Backend"),
        daemon=True,
    ).start()

    # 4. Start Frontend Process
    frontend_cmd = [npm_cmd, "run", "dev"]
    try:
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
        )
    except Exception as e:
        log(f"[ERROR] Failed to launch frontend: {e}")
        cleanup()
        sys.exit(1)

    # Launch background thread for frontend log streaming
    threading.Thread(
        target=stream_logs,
        args=(frontend_proc.stdout, "Frontend"),
        daemon=True,
    ).start()

    # 5. Await backend and frontend readiness
    log("[Launcher] Waiting for services to become ready...")
    backend_ok = wait_for_service(BACKEND_HEALTH_URL, "Backend", timeout=12.0)
    frontend_ok = wait_for_service(f"http://{FRONTEND_HOST}:{FRONTEND_PORT}", "Frontend", timeout=12.0)

    t_ready = time.perf_counter()
    ready_elapsed = t_ready - t_start

    if not backend_ok or not frontend_ok:
        log("\n[WARNING] One or more services did not respond in expected time.")
        if not backend_ok:
            log(f"  [!] Backend health check failed at {BACKEND_HEALTH_URL}")
        if not frontend_ok:
            log(f"  [!] Frontend response check failed at http://{FRONTEND_HOST}:{FRONTEND_PORT}")
    else:
        log(f"\n[Launcher] Both services verified healthy in {ready_elapsed:.2f}s!")

    # 6. Display Service Access URLs Banner
    log("\n" + "=" * 70)
    log("  FoodShieldAI Application Services Ready!")
    log("=" * 70)
    log(f"  Frontend Application:     {FRONTEND_URL}")
    log(f"  Backend REST API:         {BACKEND_URL}")
    log(f"  Swagger Documentation:    {BACKEND_DOCS_URL}")
    log("=" * 70)
    log("  Press Ctrl+C at any time to gracefully stop all services.")
    log("=" * 70 + "\n")

    # 7. Monitor processes until interrupt or failure
    try:
        while True:
            # Check if backend unexpectedly died
            b_poll = backend_proc.poll()
            if b_poll is not None:
                log(f"\n[ERROR] Backend process terminated unexpectedly with exit code {b_poll}.")
                break

            # Check if frontend unexpectedly died
            f_poll = frontend_proc.poll()
            if f_poll is not None:
                log(f"\n[ERROR] Frontend process terminated unexpectedly with exit code {f_poll}.")
                break

            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
