#!/usr/bin/env node
/**
 * 若 electron 二进制未装好，尝试用国内镜像补齐（macOS arm64/x64）
 */
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { execSync } = require('child_process')

const electronDir = path.join(__dirname, '../node_modules/electron')
const pkgPath = path.join(electronDir, 'package.json')
if (!fs.existsSync(pkgPath)) process.exit(0)

const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const platform = process.platform
const arch = process.arch
const distDir = path.join(electronDir, 'dist')
const pathTxt = path.join(electronDir, 'path.txt')

function platformPath() {
  if (platform === 'darwin') return 'Electron.app/Contents/MacOS/Electron'
  if (platform === 'win32') return 'electron.exe'
  return 'electron'
}

const binary = path.join(distDir, platformPath())
if (fs.existsSync(binary) && fs.existsSync(pathTxt)) {
  process.exit(0)
}

if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
  console.warn('[ensure-electron] 跳过：不支持的平台', platform)
  process.exit(0)
}

const archName =
  platform === 'darwin'
    ? `darwin-${arch}`
    : platform === 'win32'
      ? `win32-${arch}`
      : `linux-${arch}`

const zipName = `electron-v${version}-${archName}.zip`
const mirror = (process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/').replace(
  /\/?$/,
  '/'
)
const url = `${mirror}v${version}/${zipName}`
const tmpZip = path.join(require('os').tmpdir(), zipName)

console.log('[ensure-electron] 下载', url)

function download(fileUrl, dest) {
  return new Promise((resolve, reject) => {
    const mod = fileUrl.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    mod
      .get(fileUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          fs.unlinkSync(dest)
          download(res.headers.location, dest).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
      })
      .on('error', reject)
  })
}

;(async () => {
  try {
    fs.rmSync(distDir, { recursive: true, force: true })
    fs.mkdirSync(distDir, { recursive: true })
    await download(url, tmpZip)
    execSync(`unzip -q "${tmpZip}" -d "${distDir}"`, { stdio: 'inherit' })
    fs.writeFileSync(pathTxt, platformPath())
    fs.writeFileSync(path.join(distDir, 'version'), version)
    console.log('[ensure-electron] 完成', version)
  } catch (e) {
    console.warn('[ensure-electron] 失败，可手动执行 electron/install.js：', e.message)
  }
})()
