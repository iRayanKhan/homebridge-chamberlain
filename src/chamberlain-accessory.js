const _ = require('underscore');
const Api = require('./api');
const instance = require('./instance');

const IDLE_DELAY = 1000 * 60;
const ACTIVE_DELAY = 1000 * 5;

module.exports = class {
  constructor(log, {deviceId, name, password, username}) {
    this.log = log;
    this.api = new Api({deviceId, password, username});

    const {Service, Characteristic} = instance.homebridge.hap;
    const {CurrentDoorState, TargetDoorState} = Characteristic;

    this.apiToHap = {
      doorstate: {
        1: CurrentDoorState.OPEN,
        2: CurrentDoorState.CLOSED,
        4: CurrentDoorState.OPENING,
        5: CurrentDoorState.CLOSING
      },
      desireddoorstate: {
        0: TargetDoorState.CLOSED,
        1: TargetDoorState.OPEN
      }
    };

    this.hapToApi = {
      doorstate: _.invert(this.apiToHap.doorstate),
      desireddoorstate: _.invert(this.apiToHap.desireddoorstate)
    };

    this.hapToEnglish = {
      doorstate: {
        [CurrentDoorState.OPEN]: 'open',
        [CurrentDoorState.CLOSED]: 'closed',
        [CurrentDoorState.OPENING]: 'opening',
        [CurrentDoorState.CLOSING]: 'closing'
      },
      desireddoorstate: {
        [TargetDoorState.OPEN]: 'open',
        [TargetDoorState.CLOSED]: 'closed'
      }
    };

    const service = this.service = new Service.GarageDoorOpener(name);

    this.states = {
      doorstate:
        service
          .getCharacteristic(Characteristic.CurrentDoorState)
          .on('get', this.getState.bind(this, 'doorstate')),
      desireddoorstate:
        service
          .getCharacteristic(Characteristic.TargetDoorState)
          .on('get', this.setState.bind(this, 'desireddoorstate'))
          .on('set', this.setState.bind(this, 'desireddoorstate'))
    };

    (this.poll = this.poll.bind(this))();
  }

  poll() {
    let delay = IDLE_DELAY;
    Promise.all(_.map(['doorstate', 'desireddoorstate'], name =>
      new Promise((resolve, reject) =>
        this.states[name].getValue((er, value) => {
          if (er) return reject(er);

          resolve(value);
        })
      )
    )).then(([doorstate, desireddoorstate]) => {
      const current = this.hapToEnglish.doorstate[doorstate];
      const target = this.hapToEnglish.desireddoorstate[desireddoorstate];
      if (current !== target) delay = ACTIVE_DELAY;
    }).catch(er => this.log(er)).then(() => setTimeout(this.poll, delay));
  }

  getErrorHandler(cb) {
    return er => {
      this.log(er);
      if (er) return cb(er);

      throw er;
    };
  }

  getState(name, cb) {
    return this.api.getDeviceAttribute({name}).then(
      state => {
        state = this.apiToHap[name][state];
        this.log(`${name} is ${this.hapToEnglish[name][state]}`);
        if (cb) return cb(null, state);

        return state;
      },
      this.getErrorHandler(cb)
    );
  }

  setState(state, cb) {
    const value = this.hapToApi[name][state];
    this.log(`setting ${name} to ${this.hapToEnglish[name][state]}`);
    return this.api.setDeviceAttribute({name, value}).then(
      () => {
        this.states[name].setValue(state);
        if (cb) return cb();
      },
      this.getErrorHandler(cb)
    );
  }

  getServices() {
    return [this.service];
  }
};
