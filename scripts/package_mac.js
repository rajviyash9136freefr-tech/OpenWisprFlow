const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const cacheZip = '/mnt/c/Users/Yashr/AppData/Local/electron/Cache/electron-v29.4.6-darwin-x64.zip';
const releaseDir = path.join(__dirname, '..', 'release');
const tempMacDir = path.join(releaseDir, 'mac-temp');
const appAsar = path.join(releaseDir, 'win-unpacked', 'resources', 'app.asar');
const appAsarUnpacked = path.join(releaseDir, 'win-unpacked', 'resources', 'app.asar.unpacked');

async function buildMacZip() {
  console.log('Unzipping Electron macOS template...');
  if (fs.existsSync(tempMacDir)) {
    fs.rmSync(tempMacDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempMacDir, { recursive: true });

  cp.execSync(`unzip -q "${cacheZip}" -d "${tempMacDir}"`);
  
  const originalApp = path.join(tempMacDir, 'Electron.app');
  const targetApp = path.join(tempMacDir, 'Open Wispr.app');
  fs.renameSync(originalApp, targetApp);

  console.log('Configuring Open Wispr.app...');
  const macOSDir = path.join(targetApp, 'Contents', 'MacOS');
  fs.renameSync(path.join(macOSDir, 'Electron'), path.join(macOSDir, 'Open Wispr'));

  const resourcesDir = path.join(targetApp, 'Contents', 'Resources');
  // Remove default_app.asar
  const defaultAsar = path.join(resourcesDir, 'default_app.asar');
  if (fs.existsSync(defaultAsar)) {
    fs.unlinkSync(defaultAsar);
  }

  // Copy app.asar
  console.log('Copying app.asar into Open Wispr.app/Contents/Resources...');
  fs.copyFileSync(appAsar, path.join(resourcesDir, 'app.asar'));

  // Copy app.asar.unpacked if exists
  if (fs.existsSync(appAsarUnpacked)) {
    cp.execSync(`cp -r "${appAsarUnpacked}" "${path.join(resourcesDir, 'app.asar.unpacked')}"`);
  }

  // Update Info.plist
  const plistPath = path.join(targetApp, 'Contents', 'Info.plist');
  if (fs.existsSync(plistPath)) {
    let plist = fs.readFileSync(plistPath, 'utf8');
    plist = plist.replace(/<string>Electron<\/string>/g, '<string>Open Wispr</string>');
    plist = plist.replace(/<string>com\.github\.Electron<\/string>/g, '<string>com.openwispr.app</string>');
    plist = plist.replace(/<string>1\.0<\/string>/g, '<string>1.0.6</string>');
    fs.writeFileSync(plistPath, plist, 'utf8');
  }

  // Zip the macOS application
  const outputZip = path.join(releaseDir, 'Open-Wispr-1.0.6-Mac.zip');
  console.log('Creating', outputZip, '...');
  if (fs.existsSync(outputZip)) {
    fs.unlinkSync(outputZip);
  }
  cp.execSync(`cd "${tempMacDir}" && zip -r -y -q "${outputZip}" "Open Wispr.app"`);

  // Cleanup temp dir
  fs.rmSync(tempMacDir, { recursive: true, force: true });
  console.log('macOS package built successfully:', outputZip);
}

buildMacZip().catch(console.error);
