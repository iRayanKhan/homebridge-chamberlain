const _ = require('underscore');
const fetch = require('node-fetch');
const url = require('url');

const MyQApplicationId =
  'Vj8pQggXLhLy0WHahglCD4N1nAkkXQtGYpq2HrHD7H1nvmbT55KqtN6RSF4ILB/i';
const protocol = 'https:';
const host = 'api.myqdevice.com';

const GATEWAY_ID = 1;

const req = ({body, headers, method, pathname, query}) =>
  fetch(url.format({host, pathname, protocol, query}), {
    body: body == null ? body : JSON.stringify(body),
    headers: _.extend({
      'Content-Type': 'application/json',
      'User-Agent': 'myQ/14041 CFNetwork/1107.1 Darwin/19.0.0',
      ApiVersion: '5.1',
      BrandId: '2',
      Culture: 'en',
      MyQApplicationId
    }, headers),
    method
  }).then((res) => {
    if (res.status < 200 || res.status >= 300) {
      return res.text().then(body => {
        throw new Error('invalid response, got HTTP ' + res.status + ': ' + body)
      })
    }
    return res.text()
  }).then(data => {
    if (data) {
      return JSON.parse(data);
    } else {
      return null
    }
  });

module.exports = class {
  constructor(options = {}) {
    this.options = options;
  }

  getSecurityToken(options = {}) {
    options = _.extend({}, this.options, options);
    const {password, SecurityToken, username} = options;
    if (SecurityToken) return Promise.resolve(SecurityToken);

    return req({
      method: 'POST',
      pathname: '/api/v5/Login',
      body: {Password: password, UserName: username}
    }).then(({SecurityToken}) => {
      this.options = _.extend({}, this.options, {SecurityToken});
      return SecurityToken;
    });
  }

  getAccountId(options = {}) {
    options = _.extend({}, this.options, options);
    const {SecurityToken, AccountID} = options;
    if (AccountID) return Promise.resolve(AccountID);

    return this.getSecurityToken(options).then(SecurityToken =>
      req({
        method: 'GET',
        pathname: '/api/v5/My',
        query: {expand: 'account'},
        headers: {SecurityToken}
      })
      ).then(({Account}) => {
        this.options = _.extend({}, this.options, {AccountID: Account.Id});
        return Account.Id
      })
  }

  getDeviceList(options = {}) {
    options = _.extend({}, this.options, options);
    return this.getSecurityToken(options).then(SecurityToken =>
      this.getAccountId(options).then(AccountId =>
        req({
          method: 'GET',
          pathname: '/api/v5.1/Accounts/' + AccountId + '/Devices',
          headers: {SecurityToken},
          query: {filterOn: 'true'}
        })
      )
    ).then(({items}) => items);
  }

  getDeviceId(options = {}) {
    options = _.extend({}, this.options, options);
    const {MyQDeviceId} = options;
    if (MyQDeviceId) return Promise.resolve(MyQDeviceId);

    return this.getDeviceList(options).then(devices => {
      const withoutGateways = _.reject(devices, {device_type: 'hub'});
      const ids = _.map(withoutGateways, 'serial_number');
      if (ids.length === 0)  throw new Error('No controllable devices found');

      if (ids.length === 1) {
        this.options = _.extend({}, this.options, {MyQDeviceId: ids[0]});
        return ids[0];
      }

      throw new Error(`Multiple controllable devices found: ${ids.join(', ')}`);
    });
  }

  maybeRetry(fn) {
    return fn().catch(er => {
      if (er.message.indexOf('Security Token has expired') === -1) throw er;

      this.options = _.omit(this.options, 'SecurityToken');
      return fn();
    });
  }

  getSecurityTokenAccountIdAndMyQDeviceId(options = {}) {
    return this.maybeRetry(() =>
      this.getSecurityToken(options).then(SecurityToken =>
        this.getAccountId(options).then(AccountId =>
          this.getDeviceId(options).then(MyQDeviceId => ({
            SecurityToken,
            AccountId,
            MyQDeviceId
          }))
        )
      )
    );
  }

  getDeviceAttribute(options = {}) {
    const {name} = options;
    return this.maybeRetry(() =>
      this.getSecurityTokenAccountIdAndMyQDeviceId(options).then(
        ({SecurityToken, AccountId, MyQDeviceId}) =>
          req({
            method: 'GET',
            pathname: '/api/v5.1/Accounts/' + AccountId + '/devices/' + MyQDeviceId,
            headers: {SecurityToken},
          }).then(({state}) => state[name])
      )
    );
  }

  actOnDevice(options = {}) {
    const {action_type} = options;
    return this.maybeRetry(() =>
      this.getSecurityTokenAccountIdAndMyQDeviceId(options).then(
        ({SecurityToken, AccountId, MyQDeviceId}) =>
          req({
            method: 'PUT',
            pathname: '/api/v5.1/Accounts/' + AccountId + '/Devices/' + MyQDeviceId + '/actions',
            body: {action_type},
            headers: {SecurityToken}
          })
      )
    );
  }
};
