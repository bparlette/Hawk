import { packager } from '/workspace/work/esde_mac/app/node_modules/@electron/packager/dist/index.js';
(async () => {
  const [platform, arch] = process.argv.slice(2);
  const paths = await packager({
    dir: '/workspace/work/esde_mac/app', out: '/workspace/work/esde_mac/build', overwrite: true,
    platform, arch, electronVersion: '44.7.0', name: 'Browser Arcade', executableName: platform === 'linux' ? 'browser-arcade' : undefined,
    appBundleId: 'com.bparlette.browserarcade', appCategoryType: 'public.app-category.arcade-games',
    icon: '/workspace/work/esde_mac/app/icons/arcade', asar: false, prune: true, appVersion: '1.0.0', buildVersion: '1.0.0',
    appCopyright: 'Fan games. Personal use.',
    ignore: [/^\/node_modules/, /^\/package-lock\.json$/],
    extendInfo: { NSHighResolutionCapable: true, LSApplicationCategoryType: 'public.app-category.arcade-games' },
  });
  console.log(paths);
})().catch((e) => { console.error(e); process.exit(1); });
