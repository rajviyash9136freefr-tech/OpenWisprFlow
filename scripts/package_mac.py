import os
import shutil
import zipfile

cache_zip = r"C:\Users\Yashr\AppData\Local\electron\Cache\electron-v29.4.6-darwin-x64.zip"
release_dir = os.path.abspath("release")
temp_dir = os.path.join(release_dir, "mac-temp")
app_asar = os.path.join(release_dir, "win-unpacked", "resources", "app.asar")
app_asar_unpacked = os.path.join(release_dir, "win-unpacked", "resources", "app.asar.unpacked")
output_zip = os.path.join(release_dir, "Open-Wispr-1.0.6-Mac.zip")

print("1. Extracting macOS base template...")
if os.path.exists(temp_dir):
    shutil.rmtree(temp_dir)
os.makedirs(temp_dir, exist_ok=True)

with zipfile.ZipFile(cache_zip, 'r') as zf:
    zf.extractall(temp_dir)

orig_app = os.path.join(temp_dir, "Electron.app")
target_app = os.path.join(temp_dir, "Open Wispr.app")
if os.path.exists(orig_app):
    os.rename(orig_app, target_app)

print("2. Renaming binary and injecting app.asar...")
macos_dir = os.path.join(target_app, "Contents", "MacOS")
electron_bin = os.path.join(macos_dir, "Electron")
openwispr_bin = os.path.join(macos_dir, "Open Wispr")
if os.path.exists(electron_bin):
    os.rename(electron_bin, openwispr_bin)

resources_dir = os.path.join(target_app, "Contents", "Resources")
default_asar = os.path.join(resources_dir, "default_app.asar")
if os.path.exists(default_asar):
    os.remove(default_asar)

shutil.copy2(app_asar, os.path.join(resources_dir, "app.asar"))
if os.path.exists(app_asar_unpacked):
    shutil.copytree(app_asar_unpacked, os.path.join(resources_dir, "app.asar.unpacked"), dirs_exist_ok=True)

print("3. Updating Info.plist metadata...")
plist_file = os.path.join(target_app, "Contents", "Info.plist")
if os.path.exists(plist_file):
    with open(plist_file, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace("<string>Electron</string>", "<string>Open Wispr</string>")
    content = content.replace("<string>com.github.Electron</string>", "<string>com.openwispr.app</string>")
    content = content.replace("<string>1.0</string>", "<string>1.0.6</string>")
    with open(plist_file, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"4. Packaging {output_zip}...")
if os.path.exists(output_zip):
    os.remove(output_zip)

with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(target_app):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, temp_dir)
            zf.write(full_path, rel_path)

print("5. Cleaning up temp directory...")
shutil.rmtree(temp_dir)
print(f"SUCCESS: macOS release bundle created at {output_zip} ({os.path.getsize(output_zip) / (1024*1024):.1f} MB)")
