import subprocess
import time
import sys
import os
from pathlib import Path
from urllib.parse import urlparse


def get_frontend_url() -> str:
    """Read the local redirect destination used by the OAuth callback."""
    env_file = Path(__file__).resolve().parent / ".env.local"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("FRONTEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'").rstrip("/")
    return "http://localhost:5173"

def main():
    frontend_url = get_frontend_url()
    parsed_frontend_url = urlparse(frontend_url)
    frontend_port = parsed_frontend_url.port or 5173
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))
    vite_binary = os.path.join(frontend_dir, "node_modules", ".bin", "vite.cmd" if os.name == "nt" else "vite")

    print("==================================================")
    print(" Launching Personalised Vulnerability Triage App ")
    print("==================================================")

    print("[1/2] Starting FastAPI Backend on http://localhost:8001 ...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8001"],
        cwd=os.path.abspath(os.path.dirname(__file__))
    )

    time.sleep(2)

    print(f"[2/2] Starting Vite Frontend on {frontend_url} ...")
    vite_command = [vite_binary] if os.path.exists(vite_binary) else ["npx.cmd" if os.name == "nt" else "npx", "vite"]
    frontend_proc = subprocess.Popen(
        vite_command + ["--port", str(frontend_port), "--host", "0.0.0.0", "--strictPort"],
        cwd=frontend_dir
    )

    print("\n✓ Servers launched!")
    print("  Backend API:  http://localhost:8001/docs")
    print(f"  Frontend App: {frontend_url}\n")
    print("Press Ctrl+C to terminate both servers.")

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping servers...")
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    main()
