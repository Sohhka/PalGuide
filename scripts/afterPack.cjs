// Hook electron-builder : embarque l'icône (build/icon.ico) dans PalGuide.exe
// AVANT la création de l'installateur NSIS. Utilise rcedit (binaire autonome,
// sans dépendance à winCodeSign) — donc pas de blocage sur les symlinks macOS.
const path = require('node:path')
const { rcedit } = require('rcedit')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const exeName = context.packager.appInfo.productFilename // "PalGuide"
  const exe = path.join(context.appOutDir, `${exeName}.exe`)
  const icon = path.join(__dirname, '..', 'build', 'icon.ico')
  console.log(`[afterPack] rcedit : icône ${icon} -> ${exe}`)
  await rcedit(exe, {
    icon,
    'version-string': {
      ProductName: 'PalGuide',
      FileDescription: 'PalGuide — compagnon Palworld 1.0',
      CompanyName: 'PalGuide',
      LegalCopyright: 'PalGuide — données : PalCalc (MIT), paldb.cc',
    },
  })
}
