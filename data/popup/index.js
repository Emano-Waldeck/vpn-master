'use strict';

var power = document.getElementById('power');

var log = (msg, c = '') => {
  const span = document.createElement('span');
  span.title = span.textContent = msg;
  if (c) {
    span.classList.add(c);
  }
  document.getElementById('log').appendChild(span);
  span.scrollIntoView();
};

document.addEventListener('DOMContentLoaded', () => chrome.storage.local.get({
  server: '0',
  servers: [
    'https://gimmeproxy.com/api/getProxy',
    'https://api.getproxylist.com/proxy'
  ]
}, prefs => {
  const select = document.getElementById('server');
  prefs.servers.forEach((server, index) => {
    select.options[select.options.length] = new Option(
      (new URL(server)).hostname,
      index,
      Number(prefs.server) === index
    );
  });
  select.value = prefs.server;
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

// do I have the control?
chrome.proxy.settings.get({}, ({levelOfControl, value}) => {
  log('Proxy mode: "' + {
    'fixed_servers': 'Manual Proxy',
    'direct': 'Direct Connection',
    'system': 'System-wide Proxy',
    'auto_detect': 'Automatic Proxy',
    'pac_script': 'Controlled by a PAC Script'
  }[value.mode] + '"');
  if (value.mode === 'fixed_servers') {
    const http = value.rules.proxyForHttp;
    log(`Proxy for HTTP [${http.scheme}] ${http.host}:${[http.port]}`);
    const https = value.rules.proxyForFtp;
    log(`Proxy for HTTPS [${https.scheme}] ${https.host}:${[https.port]}`);
    const ftp = value.rules.proxyForFtp;
    log(`Proxy for FTP [${ftp.scheme}] ${ftp.host}:${[ftp.port]}`);
  }
  if (levelOfControl !== 'controlled_by_this_extension' && levelOfControl !== 'controllable_by_this_extension') {
    log('No control over proxy configuration; ' + levelOfControl, 'important');
    document.body.dataset.status = 'not-available';
  }
  else {
    document.body.dataset.status = localStorage.getItem('vpn.status') || 'disabled';
    log('Welcome to VPN Master');
    chrome.runtime.getBackgroundPage(bg => {
      bg.log.cache.forEach(([m, c]) => log(m, c));
    });
  }
});

power.addEventListener('click', () => {
  const status = document.body.dataset.status;
  chrome.runtime.sendMessage({
    method: status === 'searching' || status === 'active' ? 'stop' : 'search'
  });
});

chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'log') {
    log(request.message, request.c || '');
  }
  else if (request.method === 'vpn.status') {
    document.body.dataset.status = request.status;
  }
});
