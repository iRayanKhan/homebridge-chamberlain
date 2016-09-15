const Api = require('./api');
const instance = require('./instance');

module.exports = class {
  constructor(log, {deviceId, name, password, username}) {
    this.log = log;
    this.api = new Api({deviceId, password, username});

    const {Service, Characteristic} = instance.homebridge.hap;
    const {CurrentDoorState: states} = Characteristic;

    this.doorstateToHap = {
      1: states.OPEN,
      2: states.CLOSED,
      4: states.OPENING,
      5: states.CLOSING
    };

    this.hapToDesireddoorstate = {
      [states.OPEN]: 1,
      [states.CLOSED]: 0
    };

    this.hapToEnglish = {
      [states.OPEN]: 'open',
      [states.CLOSED]: 'closed',
      [states.OPENING]: 'opening',
      [states.CLOSING]: 'closing'
    };

    const service = this.service = new Service.GarageDoorOpener(name);

    service
      .getCharacteristic(Characteristic.CurrentDoorState)
      .on('get', this.getState.bind(this));

    service
      .getCharacteristic(Characteristic.TargetDoorState)
      .on('set', this.setState.bind(this));
  }

  getState(cb) {
    return this.api.getDeviceAttribute({name: 'doorstate'}).then(
      state => {
        state = this.doorstateToHap[state];
        this.log(`${this.name} state read as ${this.hapToEnglish[state]}`);
        cb(null, state);
      },
      cb
    );
  }

  setState(state, cb) {
    return this.api.setDeviceAttribute({
      name: 'desireddoorstate',
      value: this.hapToDesireddoorstate[state]
    }).then(
      () => {
        this.log(`${this.name} state set to ${this.hapToEnglish[state]}`);
        cb();
      },
      cb
    );
  }

  getServices() {
    return [this.service];
  }
};
