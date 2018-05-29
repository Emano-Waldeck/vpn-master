/* globals icon, log, api */
'use strict';

var vpn = {};
Object.defineProperty(vpn, 'status', {
  get() {
    return localStorage.getItem('vpn.status');
  },
  set(val) {
    localStorage.setItem('vpn.status', val);
    chrome.runtime.sendMessage({
      method: 'vpn.status',
      status: val
    });
    if (val === 'searching') {
      icon.search();
    }
    else if (val === 'failed' || val === 'disabled') {
      icon.disabled();
    }
    else if (val === 'active') {
      icon.active();
    }
  }
});
{
  const onStartup = () => chrome.proxy.settings.get({}, ({levelOfControl, value}) => {
    if (levelOfControl === 'controlled_by_this_extension') {
      if (value.mode === 'fixed_servers') {
        vpn.status = 'active';
      }
      else {
        vpn.status = 'disabled';
        vpn.proxy.clear(); // release the control
      }
    }
    else {
      vpn.status = 'disabled';
    }
  });
  chrome.runtime.onInstalled.addListener(onStartup);
  chrome.runtime.onStartup.addListener(onStartup);
}

vpn.storage = prefs => new Promise(resolve => chrome.storage.local.get(prefs, resolve));

vpn.timer = period => new Promise(resolve => window.setTimeout(resolve, period));

vpn.proxy = {};
vpn.proxy.clear = () => new Promise(resolve => chrome.proxy.settings.clear({}, resolve));
vpn.proxy.set = proxy => new Promise(resolve => chrome.proxy.settings.set(proxy, resolve));

vpn.api = async(server) => {
  const args = await vpn.storage({
    'get': '',
    'post': '',
    'cookies': '',
    'referer': '',
    'agent': '',
    'supportsHttps': '',
    'anonymityLevel': '',
    'protocol': '',
    'country': ''
  });
  log('Connecting to the API server "' + server + '"');
  const j = await api.fetch(server, args);
  const {proxy, info} = api.convert(j);

  log('Validating proxy server: [' + info.protocol.toUpperCase() + '] ' + info.ip + ':' + info.port);
  const r = await api.verify(proxy);
  return r;
};

vpn.search = async(max = 4) => {
  let i = 0;

  const prefs = await vpn.storage({
    servers: [
      'https://gimmeproxy.com/api/getProxy',
      'https://api.getproxylist.com/proxy'
    ],
    server: 0,
    'validate-mode': 'direct'
  });
  const once = async() => {
    log('Proxy mode is changed to ' + prefs['validate-mode']);
    if (prefs['validate-mode'] !== 'fixed_servers') {
      await vpn.proxy.set({
        value: {
          mode: prefs['validate-mode']
        }
      });
    }
    log('Searching for a proxy server #' + i);
    if (vpn.status !== 'searching') {
      return;
    }
    if (i > max) {
      await vpn.proxy.clear();
      vpn.status = 'failed';
      throw Error('Max retires reached. Please wait for a few minutes and retry');
    }
    i += 1;
    const server = prefs.servers[prefs.server];
    try {
      const r = await vpn.api(server);
      if (vpn.status === 'searching') {
        log(r);
        vpn.status = 'active';
      }
    }
    catch (e) {
      if (vpn.status === 'searching') {
        log('API Server: ' + e, 'warning');
        if (e === 'Max limit reached') {
          prefs.server = (prefs.server + 1) % prefs.servers.length;
          log('Switching to ' + prefs.servers[prefs.server]);
        }
        log('Pausing for 5 seconds');
        return vpn.timer(5000).then(once);
      }
    }
  };
  vpn.status = 'searching';

  return once();
};

vpn.stop = async() => {
  await vpn.proxy.clear();
  vpn.status = 'disabled';
  log('VPN is disabled', 'warning');
};

vpn.check = api.verify;
