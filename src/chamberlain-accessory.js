const _ = require('underscore');
const Api = require('./api');
const instance = require('./instance');

const IDLE_DELAY = 1000 * 15;
const ACTIVE_DELAY = 1000 * 3;

module.exports = class {
  constructor(log, {deviceId, name, password, username}) {
    this.log = log;
    this.api = new Api({deviceId, password, username});

    const {Service, Characteristic} = instance.homebridge.hap;
    const {CurrentDoorState, TargetDoorState} = Characteristic;

    this.apiToHap = {
      1: CurrentDoorState.OPEN,
      2: CurrentDoorState.CLOSED,
      4: CurrentDoorState.OPENING,
      5: CurrentDoorState.CLOSING
    };

    this.hapToApi = {
      [TargetDoorState.OPEN]: 1,
      [TargetDoorState.CLOSED]: 0
    };

    this.hapToEnglish = {
      [CurrentDoorState.OPEN]: 'open',
      [CurrentDoorState.CLOSED]: 'closed',
      [CurrentDoorState.OPENING]: 'opening',
      [CurrentDoorState.CLOSING]: 'closing'
    };

    const service = this.service = new Service.GarageDoorOpener(name);

    this.states = {
      doorstate:
        service
          .getCharacteristic(Characteristic.CurrentDoorState)
          .on('get', this.getState.bind(this)),
      desireddoorstate:
        service
          .getCharacteristic(Characteristic.TargetDoorState)
          .on('set', this.setState.bind(this))
    };

    this.states.doorstate.value = CurrentDoorState.CLOSED;
    this.states.desireddoorstate.value = TargetDoorState.CLOSED;

    (this.poll = this.poll.bind(this))();
  }

  poll() {
    return this.getState().then(() =>
      this.states.doorstate.value !== this.state.desireddoorstate.value ?
      ACTIVE_DELAY : IDLE_DELAY
    ).catch(_.noop).then((delay = IDLE_DELAY) => setTimeout(this.poll, delay));
  }

  getErrorHandler(cb) {
    return er => {
      this.log(er);
      if (er) return cb(er);

      throw er;
    };
  }

  getState(cb) {
    return this.api.getDeviceAttribute({name: 'doorstate'}).then(
      state => {
        state = this.apiToHap[state];
        this.log(`current state is ${this.hapToEnglish[state]}`);
        if (cb) return cb(null, state);

        return state;
      },
      this.getErrorHandler(cb)
    );
  }

  setState(state, cb) {
    const value = this.hapToApi[state];
    this.log(`setting target state to ${this.hapToEnglish[state]}`);
    return this.api.setDeviceAttribute({name: 'desireddoorstate', value}).then(
      () => cb(),
      this.getErrorHandler(cb)
    );
  }

  getServices() {
    return [this.service];
  }
};
