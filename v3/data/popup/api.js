'use strict';

const api = {};

api.fetch = (base, args = {}) => {
  const url = base + '?' + Object.entries(args).filter(([, v]) => v)
    .map(([k, v]) => `${k}=${decodeURIComponent(v)}`).join('&');
  return fetch(url).then(async r => {
    if (r.status === 403 || r.status === 429 || r.status_code === 429) {
      return Promise.reject(Error('Max limit reached'));
    }

    let j;
    // TEXT
    if (base.includes('www.proxy-list.download')) {
      j = await r.text().then(content => {
        const list = content.split('\n').filter(a => a);
        const random = Math.floor(Math.random() * list.length);
        const [ip, port] = list[random].split(':');

        return {
          ip,
          port: parseInt(port),
          protocol: args.type
        };
      });
    }
    else {
      j = await r.json();
    }
    if (base.includes('proxylist.geonode.com')) {
      const random = Math.floor(Math.random() * j.data.length);
      j = j.data[random];
      j.protocol = j.protocols[0];
    }
    else if (base.includes('pubproxy.com')) {
      const random = Math.floor(Math.random() * j.data.length);
      j = j.data[random];
      j.protocol = j.type;
    }
    else if (base.includes('jetkai/proxy-list')) {
      let protocol = 'socks5';
      if (args.protocol === 'socks4' || args.protocol === 'socks4a') {
        protocol = 'socks4';
      }
      else if (args.protocol === 'http') {
        protocol = 'http';
      }
      j = j[protocol];
      const random = Math.floor(Math.random() * j.length);
      const [ip, port] = j[random].split(':');

      j = {
        ip,
        port,
        protocol
      };
    }
    else if (base.includes('scidam/proxy-list')) {
      j = j.proxies;
      const random = Math.floor(Math.random() * j.length);
      const proxy = j[random];
      j = {
        ip: proxy.ip,
        port: proxy.port,
        protocol: 'socks5'
      };
    }

    if (j.error) {
      return Promise.reject(j.error);
    }
    else if (j.status_message) {
      return Promise.reject(j.status_message);
    }
    else if (r.ok) {
      return j;
    }
    else {
      return Promise.reject(Error('Cannot connect to the server'));
    }
  });
};

api.convert = json => {
  const {ip, port, protocol} = json;
  const proxy = {
    host: ip,
    port: Number(port),
    scheme: protocol
  };
  return {
    info: {ip, port, protocol},
    proxy: {
      value: {
        mode: 'fixed_servers',
        rules: {
          proxyForFtp: proxy,
          proxyForHttp: proxy,
          proxyForHttps: proxy
        }
      }
    }
  };
};

api.ping = http => new Promise((resolve, reject) => {
  const timer = setTimeout(reject, 15000, 'timeout');
  const headers = new Headers();
  headers.append('pragma', 'no-cache');
  headers.append('cache-control', 'no-cache');

  fetch(http, {
    method: 'GET',
    headers
  }).then(r => (r.ok ? r.text().then(content => {
    const ip = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/
      .exec(content) || /((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/.exec(content);
    if (ip) {
      resolve(ip[0]);
    }
    resolve(content);
  }) : reject(Error('server error'))), reject).finally(() => clearTimeout(timer));
});
api.verify = proxy => new Promise((resolve, reject) => {
  const next = () => Promise.all([
    api.ping('http://checkip.dyndns.org/').then(resolve, () => false),
    api.ping('http://checkip.dyndns.org/').then(resolve, () => false)
  ]).then(() => reject(Error('Ping Failed')));

  if (proxy) {
    chrome.proxy.settings.set(proxy, next);
  }
  else {
    next();
  }
});


const icon = {};
icon.set = (id = '/') => {
  const path = {
    '16': '/data/icons' + id + '16.png',
    '18': '/data/icons' + id + '18.png',
    '19': '/data/icons' + id + '19.png',
    '32': '/data/icons' + id + '32.png',
    '36': '/data/icons' + id + '36.png',
    '38': '/data/icons' + id + '38.png',
    '48': '/data/icons' + id + '48.png'
  };
  chrome.action.setIcon({path});
};

icon.search = (reset = true) => {
  if (reset) {
    icon.search.index = 1;
  }
  icon.set('/validate/' + icon.search.index + '/');
  icon.search.id = setTimeout(icon.search, 300, false);
  icon.search.index = (icon.search.index + 1) % 5 || 1;
};
icon.search.index = 1;
icon.search.id = null;

icon.active = () => {
  icon.search.id = clearTimeout(icon.search.id);
  icon.set();
};

icon.disabled = () => {
  icon.search.id = clearTimeout(icon.search.id);
  icon.set('/disabled/');
};
