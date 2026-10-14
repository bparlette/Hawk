// Packages the wrapper with @electron/packager.  usage: node package.mjs <platform> <arch> [outDir]
// darwin universal = arm64 + x64 merged with lipo (must run on macOS). site/ must already be copied into desktop/site.
import { packager } from '@electron/packager';
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const [platform = 'darwin', arch = 'universal', out = path.join(here, 'dist')] = process.argv.slice(2);
if (!fs.existsSync(path.join(here, 'site', 'index.html')) || !fs.existsSync(path.join(here, 'site', 'game.js'))) {
  console.error('desktop/site/index.html + game.js missing: copy the built site/ in first'); process.exit(1);
}
const version = process.env.TOADCITY_VERSION || '1.0.0';
const icon = path.join(here, 'icons', 'icon'); // icon.icns on macOS (made by the workflow), icon.png elsewhere
const paths = await packager({
  dir: here, out, overwrite: true, platform, arch,
  name: 'Toad City Baltimore',
  executableName: platform === 'linux' ? 'toad-city-baltimore' : undefined,
  appBundleId: 'com.bparlette.toadcitybaltimore',
  appCategoryType: 'public.app-category.action-games',
  icon: fs.existsSync(icon + (platform === 'darwin' ? '.icns' : '.png')) ? icon : undefined,
  asar: false, prune: true,
  appVersion: version, buildVersion: version,
  appCopyright: 'Toad City Baltimore, Brad Parlette. Personal use.',
  ignore: [/^\/node_modules/, /^\/package-lock\.json$/, /^\/dist/, /^\/test/, /^\/icons\/.*\.iconset/, /^\/README\.md$/],
  extendInfo: { NSHighResolutionCapable: true, LSApplicationCategoryType: 'public.app-category.action-games', NSRequiresAquaSystemAppearance: false },
});
console.log(paths.join('\n'));
