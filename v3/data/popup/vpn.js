/* globals icon, log, api */
'use strict';

const vpn = {};
const port = chrome.runtime.connect();
Object.defineProperty(vpn, 'status', {
  get() {
    return vpn._s || 'disabled';
  },
  set(val) {
    vpn._s = val;
    document.body.dataset.status = val;

    if (val === 'searching') {
      icon.search();
    }
    else if (val === 'failed' || val === 'disabled') {
      icon.disabled();
    }
    else if (val === 'active') {
      icon.active();
    }
    port.postMessage(val);
  }
});


vpn.storage = prefs => new Promise(resolve => chrome.storage.local.get(prefs, resolve));

vpn.timer = period => new Promise(resolve => window.setTimeout(resolve, period));

vpn.proxy = {};
vpn.proxy.clear = () => new Promise(resolve => chrome.proxy.settings.clear({}, resolve));
vpn.proxy.set = proxy => new Promise(resolve => chrome.proxy.settings.set(proxy, resolve));

vpn.api = async server => {
  const args = await vpn.storage({
    'get': '',
    'post': '',
    'cookies': '',
    'referer': '',
    'user-agent': '',
    'supportsHttps': '',
    'anonymityLevel': '',
    'protocol': '',
    'country': ''
  });
  log('Connecting to the API server "' + server + '"');

  if (args.anonymityLevel === '1') {
    args.anonymityLevel = 'anonymous';
  }
  else if (args.anonymityLevel === '0') {
    args.anonymityLevel = '';
  }

  if (server.includes('proxylist.geonode.com')) {
    args.limit = 20;
    args['sort_by'] = 'lastChecked';
    args['sort_type'] = 'desc';
    delete args.get;
    delete args.post;
    delete args.cookies;
    delete args.referer;
    delete args['user-agent'];
    delete args.supportsHttps;
    if (args.anonymityLevel === 'high anonymity') {
      args.anonymityLevel = 'elite';
    }
    if (args.protocol === 'http') {
      args.protocols === 'http';
    }
    else if (args.protocol === 'socks4' || args.protocol === 'socks4a') {
      args.protocols = 'socks4';
    }
    else if (args.protocol === 'socks5' || args.protocol === 'socks5h') {
      args.protocols === 'socks5';
    }
    delete args.protocol;
  }
  else if (server.includes('www.proxy-list.download')) {
    delete args.get;
    delete args.post;
    delete args.cookies;
    delete args.referer;
    delete args['user-agent'];
    delete args.supportsHttps;
    if (args.anonymityLevel === 'transparent' || args.anonymityLevel === 'anonymous' || args.anonymityLevel === 'elite') {
      args.anon = args.anonymityLevel;
    }
    else if (args.anonymityLevel === 'high anonymity') {
      args.anonymityLevel === 'elite';
    }
    delete args.anonymityLevel;
    if (args.protocol === 'http') {
      args.type === 'http';
    }
    else if (args.protocol === 'socks4' || args.protocol === 'socks4a') {
      args.type = 'socks4';
    }
    else if (args.protocol === 'socks5' || args.protocol === 'socks5h') {
      args.type === 'socks5';
    }
    else { // type is mandatory
      args.type = ['http', 'socks4', 'socks5'][Math.floor(Math.random() * 3)];
    }
    delete args.protocol;
  }
  else if (server.includes('pubproxy.com')) {
    args.format = 'json';
    args.https = args.supportsHttps;

    delete args.get;
    delete args.supportsHttps;
    if (args.anonymityLevel === 'anonymous' || args.anonymityLevel === 'elite') {
      args.level = args.anonymityLevel;
    }
    delete args.anonymityLevel;
    args['user_agent'] = args['user-agent'];
    delete args['user-agent'];
    if (args.protocol === 'http') {
      args.type === 'http';
    }
    else if (args.protocol === 'socks4' || args.protocol === 'socks4a') {
      args.type = 'socks4';
    }
    else if (args.protocol === 'socks5' || args.protocol === 'socks5h') {
      args.type === 'socks5';
    }
    delete args.protocol;
  }
  else if (server.includes('getproxylist.com')) {
    delete args.get;
    args.allowsPost = args.post;
    delete args.post;
    args.allowsCookies = args.cookies;
    delete args.cookies;
    args.allowsRefererHeader = args.referer;
    delete args.referer;
    args.allowsUserAgentHeader = args['user-agent'];
    delete args['user-agent'];
    args.allowsHttps = args.supportsHttps;
    delete args.supportsHttps;
    if (args.anonymityLevel === 'transparent' || args.anonymityLevel === 'anonymous' || args.anonymityLevel === 'high anonymity') {
      args['anonymity[]'] = args.anonymityLevel;
    }
    delete args.anonymityLevel;
    if (args.protocol) {
      args['protocol[]='] = args.protocol;
    }
    delete args.protocol;
  }

  const j = await api.fetch(server, args);
  const {proxy, info} = api.convert(j);

  log('Validating proxy server: [' + (info.protocol || 'NA').toUpperCase() + '] ' + info.ip + ':' + info.port);
  const r = 'Reported IP address: ' + await api.verify(proxy);
  return r;
};

vpn.search = async (max = 4) => {
  let i = 0;
  let ii = 1;

  const prefs = await vpn.storage({
    'servers': [
      'http://pubproxy.com/api/proxy',
      'https://api.getproxylist.com/proxy',
      'https://www.proxy-list.download/api/v1/get',
      'https://proxylist.geonode.com/api/proxy-list',
      'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/json/proxies.json',
      'https://raw.githubusercontent.com/scidam/proxy-list/master/proxy.json'
    ],
    'server': 0,
    'validate-mode': 'direct'
  });
  const once = async () => {
    log('Proxy mode is changed to ' + prefs['validate-mode']);
    if (prefs['validate-mode'] !== 'fixed_servers') {
      await vpn.proxy.set({
        value: {
          mode: prefs['validate-mode']
        }
      });
    }
    log('Searching for a proxy server #' + ii);
    if (vpn.status !== 'searching') {
      return;
    }
    if (i > max) {
      prefs.server += 1;
      prefs.server = prefs.server % prefs.servers.length;
      i = 0;
    }
    const server = prefs.servers[prefs.server];
    i += 1;
    ii += 1;
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
        if (e.message === 'Max limit reached') {
          prefs.server = (prefs.server + 1) % prefs.servers.length;
          i = 0;
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

vpn.stop = async () => {
  await vpn.proxy.clear();
  vpn.status = 'disabled';
  log('VPN is disabled', 'warning');
};

vpn.check = api.verify;
