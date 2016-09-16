const Api = require('./api');
const instance = require('./instance');

let waitTimeoutId;
const wait = delay =>
  new Promise(resolve => {
    clearTimeout(waitTimeoutId);
    waitTimeoutId = setTimeout(resolve, delay * 1000);
  });

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

    this.reportState();
  }

  getState(cb) {
    return this.api.getDeviceAttribute({name: 'doorstate'}).then(
      state => {
        state = this.doorstateToHap[state];
        this.log(`current state is ${this.hapToEnglish[state]}`);
        cb(null, state);
      },
      cb
    );
  }

  setState(state, cb) {
    this.log(`setting target state to ${this.hapToEnglish[state]}`);
    return this.api.setDeviceAttribute({
      name: 'desireddoorstate',
      value: this.hapToDesireddoorstate[state]
    }).then(
      () => {
        this.log(`target state set to ${this.hapToEnglish[state]}`);
        cb();

        // Immediately report the current state then report the state over the
        // next 30 seconds;
        Promise.resolve()
          .then(() => this.reportState())
          .then(() => wait(10))
          .then(() => this.reportState())
          .then(() => wait(10))
          .then(() => this.reportState())
          .then(() => wait(10))
          .then(() => this.reportState())
          .catch(er => this.log(er));
      },
      cb
    );
  }

  reportState() {
    const {CurrentDoorState} = instance.homebridge.hap.Characteristic;
    return new Promise((resolve, reject) =>
      this.getState((er, state) => {
        if (er) return reject(er);

        this.service.setCharacteristic(CurrentDoorState, state);
        resolve();
      })
    );
  }

  getServices() {
    return [this.service];
  }
};
