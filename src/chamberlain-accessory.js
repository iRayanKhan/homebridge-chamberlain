const _ = require('underscore');
const Api = require('./api');
const instance = require('./instance');

const ACTIVE_DELAY = 1000 * 2;
const IDLE_DELAY = 1000 * 10;

module.exports = class {
  constructor(log, {deviceId, name, password, username, isLight}) {
    this.log = log;
    this.isLight = isLight;
    this.api = new Api({MyQDeviceId: deviceId, password, username});

    const {Service, Characteristic} = instance.homebridge.hap;
    const {CurrentDoorState, TargetDoorState} = Characteristic;

    this.apiToHap = {
      'open': CurrentDoorState.OPEN,
      'closed': CurrentDoorState.CLOSED,
    };

    this.hapToApi = {
      [TargetDoorState.OPEN]: 'open',
      [TargetDoorState.CLOSED]: 'close'
    };

    this.hapToEnglish = {
      [CurrentDoorState.OPEN]: 'open',
      [CurrentDoorState.CLOSED]: 'closed',
      [CurrentDoorState.OPENING]: 'opening',
      [CurrentDoorState.CLOSING]: 'closing'
    };

    this.currentToTarget = {
      [CurrentDoorState.OPEN]: TargetDoorState.OPEN,
      [CurrentDoorState.CLOSED]: TargetDoorState.CLOSED,
      [CurrentDoorState.OPENING]: TargetDoorState.OPEN,
      [CurrentDoorState.CLOSING]: TargetDoorState.CLOSED
    };


    if (this.isLight) {
      const service = this.service = new Service.Switch(name);

      service
        .getCharacteristic(Characteristic.On)
          .on('get', this.getCurrentLightState.bind(this))
          .on('set', this.setTargetLightState.bind(this));

    } else {
      const service = this.service = new Service.GarageDoorOpener(name);

      this.states = {
        doorstate:
          service
            .getCharacteristic(Characteristic.CurrentDoorState)
            .on('get', this.getCurrentDoorState.bind(this))
            .on('change', this.logChange.bind(this, 'doorstate')),
        desireddoorstate:
          service
            .getCharacteristic(Characteristic.TargetDoorState)
            .on('set', this.setTargetDoorState.bind(this))
            .on('change', this.logChange.bind(this, 'desireddoorstate'))
      };

      this.states.doorstate.value = CurrentDoorState.CLOSED;
      this.states.desireddoorstate.value = TargetDoorState.CLOSED;

      (this.poll = this.poll.bind(this))();
    }

  }

  poll() {
    clearTimeout(this.pollTimeoutId);
    const {doorstate, desireddoorstate} = this.states;
    return new Promise((resolve, reject) =>
      doorstate.getValue(er => er ? reject(er) : resolve())
    ).then(() =>
      doorstate.value !== desireddoorstate.value ? ACTIVE_DELAY : IDLE_DELAY
    ).catch(_.noop).then((delay = IDLE_DELAY) => {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = setTimeout(this.poll, delay);
    });
  }

  logChange(name, {oldValue, newValue}) {
    const from = this.hapToEnglish[oldValue];
    const to = this.hapToEnglish[newValue];
    this.log.info(`${name} changed from ${from} to ${to}`);

    if (name === 'doorstate') {
      this.reactiveSetTargetDoorState = true;
      this.states.desireddoorstate.setValue(this.currentToTarget[newValue]);
      delete this.reactiveSetTargetDoorState;
    }
  }

  getErrorHandler(cb) {
    return er => {
      this.log.error(er);
      cb(er);
    };
  }

  getCurrentDoorState(cb) {
    return this.api.getDeviceAttribute({name: 'door_state'})
      .then(value =>{
        cb(null, this.apiToHap[value])
      })
      .catch(this.getErrorHandler(cb));
  }

  setTargetDoorState(value, cb) {
    if (this.reactiveSetTargetDoorState) return cb();

    const action_type = this.hapToApi[value];
    this.targetDoorState = value;

    return this.api.actOnDevice({action_type})
      .then(() => {
        this.poll();
        this.targetDoorState = null;
        cb();
      })
      .catch(this.getErrorHandler(cb));
  }

  getCurrentLightState(cb) {
    return this.api.getDeviceAttribute({name: 'lightstate'})
      .then(value => cb(null, this.apiToHap[value?0:1]))
      .catch(this.getErrorHandler(cb));
  }

  setTargetLightState(value, cb) {
    value = this.hapToApi[value?0:1];
    return this.api.setDeviceAttribute({name: 'desiredlightstate', value})
      .then(() => {
        cb();
      })
      .catch(this.getErrorHandler(cb));
  }
  getServices() {
    return [this.service];
  }
};
