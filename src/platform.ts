import type {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ChamberlainAccessory } from './chamberlainAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ChamberlainHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.platform);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();

      // CAUTION run this to sudo rm -rf your accessories CAUTION
      // this.unregisterAccessories();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  unregisterAccessories(){
    this.accessories.forEach(accessory => {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    });
  }

  discoverDeviceID(){
    // create a new temporary accessory to perform the initial mq setup.
    // this should not turn on polling and uses the device name + '_SALT' as UUID
    // device will be added and removed in 30 seconds (SO GO CHECK YOUR LOG FILE)
    this.log.error('discoverDeviceID - temporarily adding a device to find deviceID');
    for (const device of this.config.devices) {
      const uuid = this.api.hap.uuid.generate(device.username+'_SALT');
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if(existingAccessory){
        this.log.error(`discoverDeviceID - update ${uuid}`);
        this.unregisterAccessories();
        this.discoverDeviceID();
      } else {
        const accessory = new this.api.platformAccessory(device.name, uuid);
        accessory.context.device = device;
        new ChamberlainAccessory(this, accessory);
        this.log.error(`discoverDeviceID - register ${uuid}`);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        setTimeout(() => {
          this.log.error(`discoverDeviceID - unregister ${uuid}`);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }, 30000);
      }
    }
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    // loop over the discovered devices and register each one if it has not already been registered
    if(!this.config || !this.config.devices){
      this.log.error('No device array found in your config.json - see config.schema.json');
      return;
    }

    for (const device of this.config.devices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      if(!device.username){
        this.log.error('No username found in your config.json - see config.schema.json');
        return;
      }

      if(!device.password){
        this.log.error('No password found in your config.json - see config.schema.json');
        return;
      }

      if(!device.deviceId || device.deviceId === ''){
        this.log.error('No deviceId found in your config.json');
        this.discoverDeviceID();
        return;
      }

      const uuid = this.api.hap.uuid.generate(device.deviceId);
      this.log.debug(`Device '${device.name}' generated uuid: '${uuid}'`);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info(`Restoring existing accessory from cache '${existingAccessory.displayName}'`);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `chamberlainAccessory.ts`
        new ChamberlainAccessory(this, existingAccessory);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info(`Adding new accessory '${device.name}'`);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.name, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `chamberlainAccessory.ts`
        new ChamberlainAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
