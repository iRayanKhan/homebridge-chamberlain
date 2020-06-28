import type {
  Logger,
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge';

import { CharacteristicEventTypes } from 'homebridge';

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
  private readonly log: Logger;

  private service: Service;
  private chamberlainService = ChamberlainService.getInstance();

  // private currentDoorState: CurrentDoorState;

  open = async (callback: (status: boolean) => void) => {
    this.log.debug('Opening the Garage!');
    let result = false;
    try {
      result = await this.chamberlainService.open();
      this.log.debug('Opening the Garage: ', result);
      callback(result);
    } catch (error) {
      this.log.debug('Error opening garage: ', error);
    }
  };

  close = async (callback: (status: boolean) => void) => {
    this.log.debug('Closing the Garage!');
    let result = false;
    try {
      result = await this.chamberlainService.close();
      this.log.debug('Closing the Garage result: ', result);
      callback(result);
    } catch (error) {
      this.log.debug('Error closing garage: ', error);
    }
  };

  status = async (callback: (status: string) => void) => {
    this.log.debug('Status of the Garage!');
    let result = 'Closed';
    try {
      result = await this.chamberlainService.status();
      this.log.debug('Status of the Garage result: ', result);
      callback(result);
    } catch (error) {
      this.log.debug('Error checking status: ', error);
    }
  };

  constructor(
    private readonly platform: ChamberlainHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.log = this.platform.log;

    const { username, password, deviceId } = accessory.context.device;
    const garageDoorOpener = this.platform.Service.GarageDoorOpener;

    this.chamberlainService.init(username, password, deviceId, this.log);

    // get the GarageDoorOpener service if it exists, otherwise create a new GarageDoorOpener service
    this.service =
      this.accessory.getService(garageDoorOpener) ||
      this.accessory.addService(garageDoorOpener);

    // set the service name, this is what is displayed as the default name on the Home app
    // we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name,
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentDoorState)
      .on(CharacteristicEventTypes.GET, this.getCurrentDoorState.bind(this))
      .getValue();

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetDoorState)
      .on(CharacteristicEventTypes.SET, this.setTargetDoorState.bind(this));
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setTargetDoorState(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ) {
    if (value === this.platform.Characteristic.TargetDoorState.CLOSED) {
      const closedCallback = () => {
        this.service.setCharacteristic(
          this.platform.Characteristic.CurrentDoorState,
          this.platform.Characteristic.CurrentDoorState.CLOSED,
        );
        this.platform.log.debug('closedCallback');
        callback();
        this.platform.log.debug('closedCallback done');
      };

      this.close(closedCallback);
      this.platform.log.debug('done setTargetDoorState closing');
    } else if (value === this.platform.Characteristic.TargetDoorState.OPEN) {
      const openCallback = () => {
        this.service.setCharacteristic(
          this.platform.Characteristic.CurrentDoorState,
          this.platform.Characteristic.CurrentDoorState.OPEN,
        );
        this.platform.log.debug('openCallback');
        callback();
        this.platform.log.debug('openCallback done');
      };

      this.open(openCallback);
      this.platform.log.debug('done setTargetDoorState opening');
    }
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   */
  getCurrentDoorState(callback: CharacteristicGetCallback) {
    const statusCallback = (status: string) => {
      this.platform.log.debug(`statusCallback: ${status}`);

      let statusMapValue = this.platform.Characteristic.CurrentDoorState.CLOSED;
      switch(status){
        case 'open':
          statusMapValue = this.platform.Characteristic.CurrentDoorState.OPEN;
          break;
        case 'opening':
          statusMapValue = this.platform.Characteristic.CurrentDoorState.OPENING;
          break;
        case 'closed':
          statusMapValue = this.platform.Characteristic.CurrentDoorState.CLOSED;
          break;
        case 'closing':
          statusMapValue = this.platform.Characteristic.CurrentDoorState.CLOSING;
          break;
        case 'stopped':
          statusMapValue = this.platform.Characteristic.CurrentDoorState.STOPPED;
          break;
        default: //CLOSED
          break;
      }

      this.platform.log.debug('callback setvalue:', statusMapValue);
      this.service.getCharacteristic(this.platform.Characteristic.CurrentDoorState).setValue(statusMapValue);
      this.platform.log.debug('callback status', statusMapValue);
      callback(null, statusMapValue);
      this.platform.log.debug('callback status done');
    };

    this.log.debug('1 status');
    this.status(statusCallback);
    this.log.debug('2 status');


    // if (this.FAKE_GARAGE.opened) {
    //   this.platform.log.debug('Query: Is Garage Open? Yes.');
    //   callback(err, this.platform.Characteristic.CurrentDoorState.OPEN);
    // } else {
    //   this.platform.log.debug('Query: Is Garage Open? No.');
    //   callback(err, this.platform.Characteristic.CurrentDoorState.CLOSED);
    // }
  }
}
