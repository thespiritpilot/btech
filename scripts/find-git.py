import os

paths = [
    r"C:\Program Files\Git\cmd\git.exe",
    r"C:\Program Files\Git\bin\git.exe",
    r"C:\Program Files (x86)\Git\cmd\git.exe",
    os.path.expanduser("~") + r"\AppData\Local\Programs\Git\cmd\git.exe",
    os.path.expanduser("~") + r"\AppData\Local\Programs\Git\bin\git.exe",
    r"C:\Users\merto\AppData\Local\GitHubDesktop\app-3.4.12\resources\app\git\cmd\git.exe"
]

for p in paths:
    if os.path.exists(p):
        print("FOUND_GIT:", p)

# Also check git config
if os.path.exists(".git/config"):
    with open(".git/config", "r") as f:
        print("\n--- .git/config ---")
        print(f.read())
