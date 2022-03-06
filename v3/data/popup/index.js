/* global vpn */
'use strict';

const isFirefox = /Firefox/.test(navigator.userAgent) || typeof InstallTrigger !== 'undefined';
const power = document.getElementById('power');

const log = (msg, c = '', bypass = false, ignore = false) => {
  const span = document.createElement('span');
  span.title = span.textContent = msg;
  if (c) {
    span.classList.add(c);
  }
  document.getElementById('log').appendChild(span);
  span.scrollIntoView();

  if (ignore) {
    return;
  }

  log.cache.push([msg, c]);
  if (bypass === false) {
    chrome.storage.local.set({
      logs: log.cache
    });
  }
};
log.cache = [];

document.addEventListener('DOMContentLoaded', () => chrome.storage.local.get({
  server: '0',
  servers: [
    'http://pubproxy.com/api/proxy',
    'https://api.getproxylist.com/proxy',
    'https://www.proxy-list.download/api/v1/get',
    'https://proxylist.geonode.com/api/proxy-list',
    'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/json/proxies.json',
    'https://raw.githubusercontent.com/scidam/proxy-list/master/proxy.json'
  ]
}, prefs => {
  const select = document.getElementById('server');
  prefs.servers.forEach((server, index) => {
    const o = new URL(server);
    const name = o.hostname + ' -> ' + o.pathname.split('/')[1];

    const option = new Option(name, index, Number(prefs.server) === index);
    select.options[select.options.length] = option;
  });
  window.setTimeout(() => select.value = prefs.server, 100);
}));
{
  const args = [...document.querySelectorAll('[type=args]')].reduce((p, c) => {
    p[c.id] = '';
    return p;
  }, {});
  chrome.storage.local.get(args, prefs => {
    Object.entries(prefs).forEach(([k, v]) => {
      document.getElementById(k).value = v;
    });
  });
}
document.addEventListener('change', ({target}) => {
  if (target.getAttribute('type') === 'args') {
    chrome.storage.local.set({
      [target.id]: target.value
    });
  }
});


chrome.storage.local.get({
  logs: []
}, prefs => {
  prefs.logs.forEach(([m, c]) => log(m, c, true));

  // do I have the control?
  chrome.proxy.settings.get({}, ({levelOfControl, value}) => {
    // get the current state
    if (levelOfControl === 'controlled_by_this_extension') {
      if (value.mode === 'fixed_servers') {
        vpn._s = 'active';
        document.body.dataset.status = 'active';
      }
    }
    else {
      document.body.dataset.status = 'disabled';
      log('Welcome to VPN Master', '', true, true);
    }

    log('Proxy mode: "' + {
      'fixed_servers': 'Manual Proxy',
      'direct': 'Direct Connection',
      'system': 'System-wide Proxy',
      'auto_detect': 'Automatic Proxy',
      'pac_script': 'Controlled by a PAC Script'
    }[value.mode || value.proxyType] + '"', '', true, true);
    if (value.mode === 'fixed_servers') {
      const http = value.rules.proxyForHttp;
      log(`Proxy for HTTP [${http.scheme}] ${http.host}:${[http.port]}`, '', true, true);
      const https = value.rules.proxyForFtp;
      log(`Proxy for HTTPS [${https.scheme}] ${https.host}:${[https.port]}`, '', true, true);
    }
    if (levelOfControl !== 'controlled_by_this_extension' && levelOfControl !== 'controllable_by_this_extension') {
      log('No control over proxy configuration; ' + levelOfControl, 'important', true, true);
      document.body.dataset.status = 'not-available';
    }
    else {
      if (isFirefox) {
        chrome.extension.isAllowedIncognitoAccess(s => {
          if (s === false) {
            log('Enable "Run in Private Windows" from Add-ons Manager and retry', 'important', true, true);
          }
        });
      }
    }
  });
});


power.addEventListener('click', () => {
  const status = document.body.dataset.status;
  if (status === 'searching' || status === 'active') {
    vpn.stop();
  }
  else {
    vpn.search().catch(e => log(e.message, 'important'));
  }
});

document.getElementById('faqs').href = chrome.runtime.getManifest().homepage_url;
