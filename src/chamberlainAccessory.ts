import { Service, PlatformAccessory, CharacteristicEventTypes, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback, Characteristic } from 'homebridge';
import ChamberlainService from './chamberlainService';
import { ChamberlainHomebridgePlatform } from './platform';

enum TargetDoorState {
  OPEN = 0,
  CLOSED = 1,
}

enum CurrentDoorState {
  OPEN = 0,
  CLOSED = 1,
  OPENING = 2,
  CLOSING = 3,
  STOPPED = 4,
}

/**
 * Chamberlain Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ChamberlainAccessory {
  private service: Service;
  private chamberlainService = ChamberlainService.getInstance();

  private currentDoorState: CurrentDoorState;

  private FAKE_GARAGE = {
    opened: false,
    open: async (callback: (status:boolean) => void) => {
      console.log('Opening the Garage!');
      const result = await this.chamberlainService.open();
      console.log('Done waiting for - Opening the Garage!');
      // this.FAKE_GARAGE.opened = result;
      callback(result);
    },
    close: async (callback: (status:boolean) => void) => {
      console.log('Closing the Garage!');
      const result = await this.chamberlainService.close();
      console.log('Done waiting for - Closing the Garage!');
      // this.FAKE_GARAGE.opened = result;
      callback(result);
    },
    identify: () => {
      //add your code here which allows the garage to be identified
      console.log('Identify the Garage');
    },
    status: async (callback: (status:boolean) => void) =>{
      //use this section to get sensor values. set the boolean FAKE_GARAGE.opened with a sensor value.
      console.log('Status queried!');
      // this.FAKE_GARAGE.opened = false;
      const result = await this.chamberlainService.status();
      // this.FAKE_GARAGE.opened = result;
      callback(result);
    },
  };

  constructor(
    private readonly platform: ChamberlainHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ){
    const {username, password, deviceId} = accessory.context.device;
    this.chamberlainService.init(username, password, deviceId);

    // get the GarageDoorOpener service if it exists, otherwise create a new GarageDoorOpener service
    this.service = this.accessory.getService(this.platform.Service.GarageDoorOpener)
    || this.accessory.addService(this.platform.Service.GarageDoorOpener);

    // set the service name, this is what is displayed as the default name on the Home app
    // we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentDoorState)
      .on('get', this.getCurrentDoorState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetDoorState)
      .on('set', this.setTargetDoorState.bind(this));

    this.currentDoorState = CurrentDoorState.CLOSED;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentDoorState, this.currentDoorState);
  }

  readonly setCurrentDoorState = (state: CurrentDoorState) => {
    this.platform.log.debug('setting current door state to ' + CurrentDoorState[state]);
    this.currentDoorState = state;
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentDoorState)
      .setValue(state);
  };

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setTargetDoorState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    if (value === this.platform.Characteristic.TargetDoorState.CLOSED) {
      const closedCallback = () => {
        this.service.setCharacteristic(this.platform.Characteristic.CurrentDoorState, this.platform.Characteristic.CurrentDoorState.CLOSED);
        this.platform.log.debug('callback close');
        callback();
        this.platform.log.debug('callback close done');
      };

      this.FAKE_GARAGE.close(closedCallback);
      this.platform.log.debug('done setTargetDoorState closing');

    } else if (value === this.platform.Characteristic.TargetDoorState.OPEN) {
      const openCallback = () => {
        this.service.setCharacteristic(this.platform.Characteristic.CurrentDoorState, this.platform.Characteristic.CurrentDoorState.OPEN);
        this.platform.log.debug('callback open');
        callback();
        this.platform.log.debug('callback open done');

      };

      this.FAKE_GARAGE.open(openCallback);
      this.platform.log.debug('done setTargetDoorState opening');
    }
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getCurrentDoorState(callback: CharacteristicGetCallback) {
    const statusCallback = (status: boolean) => {
      console.log(`status: ${status}`);
      this.service.setCharacteristic(this.platform.Characteristic.CurrentDoorState, this.platform.Characteristic.CurrentDoorState.CLOSED);
      this.platform.log.debug('callback status');
      callback();
      this.platform.log.debug('callback status done');
    };

    this.FAKE_GARAGE.status(statusCallback);

    // if (this.FAKE_GARAGE.opened) {
    //   console.log('Query: Is Garage Open? Yes.');
    //   callback(err, this.platform.Characteristic.CurrentDoorState.OPEN);
    // } else {
    //   console.log('Query: Is Garage Open? No.');
    //   callback(err, this.platform.Characteristic.CurrentDoorState.CLOSED);
    // }
  }
}
