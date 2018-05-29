'use strict';

var api = {};

api.fetch = (base, args = {}) => {
  let url = base + '?' + Object.entries(args)
    .filter(([k, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  if (!args.protocol) {
    url += '&protocol[]=socks4&protocol[]=socks5&protocol[]=http';
  }
  return fetch(url).then(r => r.json().then(j => {
    if (j.error) {
      return Promise.reject(j.error);
    }
    else if (r.status === 403) {
      return Promise.reject('Max limit reached');
    }
    else if (r.ok) {
      return j;
    }
    else {
      return Promise.reject('Cannot connect to the server');
    }
  }));
};

api.convert = json => {
  const {ip, port, protocol, country, anonymity, downloadSpeed} = json;
  const proxy = {
    host: ip,
    port: Number(port),
    scheme: protocol
  };
  return {
    info: {ip, port, protocol, country, anonymity, downloadSpeed},
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
  fetch(http, {
    method: 'GET'
  }).then(r => (r.ok ? r.text().then(resolve) : reject()), reject).finally(() => clearTimeout(timer));
});
api.verify = proxy => new Promise((resolve, reject) => {
  const next = () => Promise.all([
    api.ping('http://checkip.dyndns.org/').then(resolve, () => false),
    api.ping('http://checkip.dyndns.org/').then(resolve, () => false)
  ]).then(() => reject('Ping Failed'));

  if (proxy) {
    chrome.proxy.settings.set(proxy, next);
  }
  else {
    next();
  }
});
