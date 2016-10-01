const _ = require('underscore');
const fetch = require('node-fetch');
const url = require('url');

const MyQApplicationId =
  'NWknvuBd7LoFHfXmKNMBcgajXtZEgKUh4V7WNzMidrpUUluDpVYVZx+xT4PCM5Kx';
const protocol = 'https:';
const host = 'myqexternal.myqdevice.com';

const GATEWAY_ID = 1;

const req = ({body, headers, method, pathname, query}) =>
  fetch(url.format({host, pathname, protocol, query}), {
    body: body == null ? body : JSON.stringify(body),
    headers: _.extend({
      'Content-Type': 'application/json',
      'User-Agent': 'Chamberlain/3.61.1 (iPhone; iOS 10.0.1; Scale/2.00)',
      ApiVersion: '4.1',
      BrandId: '2',
      Culture: 'en',
      MyQApplicationId
    }, headers),
    method
  }).then(res => res.json()).then(data => {
    const {ReturnCode: code, ErrorMessage: message} = data;
    if (code !== '0') throw new Error(message || `Unknown Error (${code})`);

    return data;
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
      pathname: '/api/v4/User/Validate',
      body: {password, username}
    }).then(({SecurityToken}) => {
      this.options = _.extend({}, this.options, {SecurityToken});
      return SecurityToken;
    });
  }

  getDeviceList(options = {}) {
    return this.getSecurityToken(options).then(SecurityToken =>
      req({
        method: 'GET',
        pathname: '/api/v4/UserDeviceDetails/Get',
        headers: {SecurityToken},
        query: {filterOn: 'true'}
      })
    ).then(({Devices}) => Devices);
  }

  getDeviceId(options = {}) {
    options = _.extend({}, this.options, options);
    const {MyQDeviceId} = options;
    if (MyQDeviceId) return Promise.resolve(MyQDeviceId);

    return this.getDeviceList(options).then(devices => {
      const withoutGateways = _.reject(devices, {MyQDeviceTypeId: GATEWAY_ID});
      const ids = _.map(withoutGateways, 'MyQDeviceId');
      const {0: MyQDeviceId, length} = ids;
      if (length === 0) throw new Error('No controllable devices found');

      if (length === 1) {
        this.options = _.extend({}, this.options, {MyQDeviceId});
        return MyQDeviceId;
      }

      throw new Error(`Multiple controllable devices found: ${ids.join(', ')}`);
    });
  }

  maybeRetry(fn) {
    return fn().catch(er => {
      if (er.message.indexOf('Please login again') === -1) throw er;

      this.options = _.omit(this.options, 'SecurityToken');
      return fn();
    });
  }

  getSecurityTokenAndMyQDeviceId(options = {}) {
    return this.maybeRetry(() =>
      this.getSecurityToken(options).then(SecurityToken =>
        this.getDeviceId(options).then(MyQDeviceId => ({
          SecurityToken,
          MyQDeviceId
        }))
      )
    );
  }

  getDeviceAttribute(options = {}) {
    const {name: AttributeName} = options;
    return this.maybeRetry(() =>
      this.getSecurityTokenAndMyQDeviceId(options).then(
        ({SecurityToken, MyQDeviceId}) =>
          req({
            method: 'GET',
            pathname: '/api/v4/DeviceAttribute/GetDeviceAttribute',
            headers: {SecurityToken},
            query: {AttributeName, MyQDeviceId}
          }).then(({AttributeValue}) => AttributeValue)
      )
    );
  }

  setDeviceAttribute(options = {}) {
    const {name: AttributeName, value: AttributeValue} = options;
    return this.maybeRetry(() =>
      this.getSecurityTokenAndMyQDeviceId(options).then(
        ({SecurityToken, MyQDeviceId}) =>
          req({
            method: 'PUT',
            pathname: '/api/v4/DeviceAttribute/PutDeviceAttribute',
            headers: {SecurityToken},
            body: {AttributeName, AttributeValue, MyQDeviceId}
          })
      )
    );
  }
};
