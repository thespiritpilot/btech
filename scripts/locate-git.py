import os

def find_file(start_dir, target):
    for root, dirs, files in os.walk(start_dir):
        if target in files:
            return os.path.join(root, target)
        if "AppData\\Local\\Packages" in root:
            dirs.clear() # skip slow package folders
    return None

git_path = None
for base in [r"C:\Program Files", r"C:\Program Files (x86)", os.path.expanduser("~") + r"\AppData\Local"]:
    if os.path.exists(base):
        try:
            res = find_file(base, "git.exe")
            if res:
                print("FOUND GIT AT:", res)
                git_path = res
                break
        except Exception as e:
            pass
