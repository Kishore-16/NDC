import subprocess
import time
import sys
import os

def main():
    print("==================================================")
    print(" Launching Personalised Vulnerability Triage App ")
    print("==================================================")

    print("[1/2] Starting FastAPI Backend on http://localhost:8000 ...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=os.path.abspath(os.path.dirname(__file__))
    )

    time.sleep(2)

    print("[2/2] Starting Vite Frontend on http://localhost:5173 ...")
    frontend_proc = subprocess.Popen(
        ["npx.cmd" if os.name == 'nt' else "npx", "vite", "--port", "5173", "--host"],
        cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))
    )

    print("\n✓ Servers launched!")
    print("  Backend API:  http://localhost:8000/docs")
    print("  Frontend App: http://localhost:5173\n")
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
