// EnvProxy uses the proxy vaiables passed to it in set and sets the
// process.env uppercase proxy variables to them with the ability
// to restore the original values later
var EnvProxy = function() {
  this.restoreFrom = {};
};

EnvProxy.prototype.set = function (config) {
  this.config = config;

  // Override environment defaults if proxy config options are set
  // This will make requests.js follow the proxies in config
  if (Object.prototype.hasOwnProperty.call(config, 'no-proxy')) {
    this.restoreFrom.NO_PROXY = process.env.NO_PROXY;
    this.restoreFrom.no_proxy = process.env.no_proxy;
    process.env.NO_PROXY = config['no-proxy'];
    delete process.env.no_proxy;
  }

  if (Object.prototype.hasOwnProperty.call(config, 'proxy')) {
    this.restoreFrom.HTTP_PROXY = process.env.HTTP_PROXY;
    this.restoreFrom.http_proxy = process.env.http_proxy;
    process.env.HTTP_PROXY = config.proxy;
    delete process.env.http_proxy;
  }

  if (Object.prototype.hasOwnProperty.call(config, 'https-proxy')) {
    this.restoreFrom.HTTPS_PROXY = process.env.HTTPS_PROXY;
    this.restoreFrom.https_proxy = process.env.https_proxy;
    process.env.HTTPS_PROXY = config['https-proxy'];
    delete process.env.https_proxy;
  }
};

EnvProxy.prototype.restore = function () {
  if (Object.prototype.hasOwnProperty.call(this.config, 'no-proxy')) {
    process.env.NO_PROXY = this.restoreFrom.NO_PROXY;
    process.env.no_proxy = this.restoreFrom.no_proxy;
  }

  if (Object.prototype.hasOwnProperty.call(this.config, 'proxy')) {
    process.env.HTTP_PROXY = this.restoreFrom.HTTP_PROXY;
    process.env.http_proxy = this.restoreFrom.http_proxy;
  }

  if (Object.prototype.hasOwnProperty.call(this.config, 'https-proxy')) {
    process.env.HTTPS_PROXY = this.restoreFrom.HTTPS_PROXY;
    process.env.https_proxy = this.restoreFrom.https_proxy;
  }
};

module.exports = EnvProxy;
