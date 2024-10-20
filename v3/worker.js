/* global icon */

self.importScripts('/data/popup/api.js');

// status
{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;

    chrome.proxy.settings.get({}, ({levelOfControl, value}) => {
      if (levelOfControl === 'controlled_by_this_extension') {
        if (value.mode === 'fixed_servers') {
          icon.active();
        }
        else {
          icon.disabled();
          // release the control
          chrome.proxy.settings.clear({});
        }
      }
      else {
        icon.disabled();
      }
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);

  chrome.runtime.onConnect.addListener(port => {
    let state;
    port.onMessage.addListener(v => state = v);
    port.onDisconnect.addListener(() => {
      if (state === 'searching') {
        chrome.proxy.settings.clear({}, once);
      }
      else {
        once();
      }
    });
  });
}

// clear log list on start
{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;

    chrome.storage.local.set({
      logs: []
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const {homepage_url: page, name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, lastFocusedWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
