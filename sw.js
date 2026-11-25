importScripts('./offline-navigation.v1.js');

installOfflineNavigation({
  title: 'LinFamily',
  version: '1',
  family: true,
  assets: [
    'js/vendor/firebase-app-compat.10.8.0.js',
    'js/vendor/firebase-auth-compat.10.8.0.js',
    'js/firebase-config.js?v=1',
    'js/offline-desktop.js?v=1'
  ]
});
