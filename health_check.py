import subprocess
import urllib.request
import urllib.error
import json

GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

def ok(label, msg=""):
    print(f"{GREEN}[✓]{RESET} {label:<25} {msg}")

def fail(label, msg=""):
    print(f"{RED}[✗]{RESET} {label:<25} {msg}")

print("\n=== Client Finder Health Check ===\n")

# 1. Check containers
expected = ["client_finder_backend", "client_finder_frontend", "client_finder_db"]
try:
    result = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}|{{.Status}}"],
        capture_output=True, text=True
    )
    running = result.stdout.strip().split("\n")
    container_map = {}
    for line in running:
        if "|" in line:
            name, status = line.split("|", 1)
            container_map[name.strip()] = status.strip()

    for name in expected:
        if name in container_map:
            ok(name, container_map[name])
        else:
            fail(name, "not running")
except Exception as e:
    fail("docker ps", str(e))

# 2. Check backend /health
try:
    res = urllib.request.urlopen("http://localhost:8000/health", timeout=5)
    data = json.loads(res.read())
    if data.get("status") == "ok":
        ok("Backend /health", "200 ok")
    else:
        fail("Backend /health", str(data))
except Exception as e:
    fail("Backend /health", str(e))

# 3. Check frontend
try:
    res = urllib.request.urlopen("http://localhost:5173", timeout=5)
    if res.status == 200:
        ok("Frontend :5173", "200 ok")
    else:
        fail("Frontend :5173", f"status {res.status}")
except Exception as e:
    fail("Frontend :5173", str(e))

# 4. Check database via pg_isready
try:
    result = subprocess.run(
        ["docker", "exec", "client_finder_db",
         "pg_isready", "-U", "postgres", "-d", "clientfinder"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        ok("Database", result.stdout.strip())
    else:
        fail("Database", result.stderr.strip())
except Exception as e:
    fail("Database", str(e))

print()
