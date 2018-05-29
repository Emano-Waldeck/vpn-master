/* globals vpn */
'use strict';

var log = (e, c = '') => {
  const message = (new Date()).toTimeString().split(' ')[0] + ': ' + (e.message || e.error || e || 'unknown');

  log.cache.push([message, c]);
  log.cache = log.cache.slice(-10);
  // console.log(message);
  chrome.runtime.sendMessage({
    method: 'log',
    message,
    c
  });
};
log.cache = [];

var icon = {};
icon.set = (id = '/') => {
  const path = {
    '16': 'data/icons' + id + '16.png',
    '18': 'data/icons' + id + '18.png',
    '19': 'data/icons' + id + '19.png',
    '32': 'data/icons' + id + '32.png',
    '36': 'data/icons' + id + '36.png',
    '38': 'data/icons' + id + '38.png',
    '48': 'data/icons' + id + '48.png'
  };
  chrome.browserAction.setIcon({path});
};

icon.search = (reset = true) => {
  if (reset) {
    icon.search.index = 1;
  }
  icon.set('/validate/' + icon.search.index + '/');
  icon.search.id = window.setTimeout(icon.search, 300, false);
  icon.search.index = (icon.search.index + 1) % 5 || 1;
};
icon.search.index = 1;
icon.search.id = null;

icon.active = () => {
  icon.search.id = window.clearTimeout(icon.search.id);
  icon.set();
};

icon.disabled = () => {
  icon.search.id = window.clearTimeout(icon.search.id);
  icon.set('/disabled/');
};

chrome.runtime.onMessage.addListener(({method}) => {
  if (method === 'search') {
    vpn.search().catch(e => log(e, 'important'));
  }
  else if (method === 'stop') {
    vpn.stop();
  }
});

// FAQs & Feedback
chrome.storage.local.get({
  'version': null,
  'faqs': navigator.userAgent.indexOf('Firefox') === -1,
  'last-update': 0,
}, prefs => {
  const version = chrome.runtime.getManifest().version;

  if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
    const now = Date.now();
    const doUpdate = (now - prefs['last-update']) / 1000 / 60 / 60 / 24 > 30;
    chrome.storage.local.set({
      version,
      'last-update': doUpdate ? Date.now() : prefs['last-update']
    }, () => {
      // do not display the FAQs page if last-update occurred less than 30 days ago.
      if (doUpdate) {
        const p = Boolean(prefs.version);
        window.setTimeout(() => chrome.tabs.create({
          url: chrome.runtime.getManifest().homepage_url + '?version=' + version +
            '&type=' + (p ? ('upgrade&p=' + prefs.version) : 'install'),
          active: p === false
        }), 3000);
      }
    });
  }
});

{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL(
    chrome.runtime.getManifest().homepage_url + '?rd=feedback&name=' + name + '&version=' + version
  );
}
