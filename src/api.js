const _ = require('underscore');
const fetch = require('node-fetch');
const url = require('url');

const appId =
  'JVM/G9Nwih5BwKgNCjLxiFUQxQijAebyyg8QUHr7JOrP+tuPb8iHfRHKwTmDzHOu';
const protocol = 'https:';
const host = 'myqexternal.myqdevice.com';

const MyQDeviceTypeId = 2;

const req = ({body, headers, method, pathname, query}) =>
  fetch(url.format({host, pathname, protocol, query}), {
    body: body == null ? body : JSON.stringify(body),
    headers: _.extend({
      'Content-Type': 'application/json'
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
    const {password, securityToken, username} = options;
    if (securityToken) return Promise.resolve(securityToken);

    return req({
      method: 'GET',
      pathname: '/api/user/validatewithculture',
      query: {appId, culture: 'en', password, username}
    }).then(({SecurityToken: securityToken}) => {
      this.options = _.extend({}, this.options, {securityToken});
      return securityToken;
    });
  }

  getDeviceList(options = {}) {
    return this.getSecurityToken(options).then(securityToken =>
      req({
        method: 'GET',
        pathname: '/api/userdevicedetails',
        query: {appId, securityToken}
      })
    ).then(({Devices}) => Devices);
  }

  getDeviceId(options = {}) {
    options = _.extend({}, this.options, options);
    const {deviceId} = options;
    if (deviceId) return Promise.resolve(deviceId);

    return this.getDeviceList(options).then(devices => {
      const ids = _.map(_.filter(devices, {MyQDeviceTypeId}), 'MyQDeviceId');
      const {0: deviceId, length} = ids;
      if (length === 0) throw new Error('No controllable devices found');

      if (length === 1) {
        this.options = _.extend({}, this.options, {deviceId});
        return deviceId;
      }

      throw new Error(`Multiple controllable devices found: ${ids.join(', ')}`);
    });
  }

  getSecurityTokenAndDeviceId(options = {}) {
    return this.getSecurityToken(options).then(securityToken =>
      this.getDeviceId(options).then(deviceId => ({securityToken, deviceId}))
    );
  }

  getDeviceAttribute(options = {}) {
    return this.getDeviceId(options).then(MyQDeviceId =>
      this.getDeviceList(options).then(devices => {
        const device = _.find(devices, {MyQDeviceId});
        if (!device) throw new Error(`Cannot find device ${MyQDeviceId}`);

        const {name} = options;
        const attribute = _.find(device.Attributes, {Name: name});
        if (!attribute) throw new Error(`Cannot find attribute ${name}`);

        return attribute.Value;
      })
    );
  }

  setDeviceAttribute(options = {}) {
    const {name: AttributeName, value: AttributeValue} = options;
    return this.getSecurityTokenAndDeviceId(options).then(
      ({securityToken: SecurityToken, deviceId: MyQDeviceId}) =>
        req({
          method: 'PUT',
          pathname: '/api/v4/deviceattribute/putdeviceattribute',
          headers: {
            MyQApplicationId: appId,
            SecurityToken
          },
          body: {
            ApplicationId: appId,
            AttributeName,
            AttributeValue,
            MyQDeviceId,
            SecurityToken
          }
        })
    );
  }
};
