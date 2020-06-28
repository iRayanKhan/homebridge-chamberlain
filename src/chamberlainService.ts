
import * as rax from 'retry-axios';
import axios, {AxiosRequestConfig} from 'axios';
import { Logger } from 'homebridge';

import {MyQDevice, MyQAccount} from './MyQTypes';

// attach the retry-axios to axios default instance
rax.attach();

export default class ChamberlainService {
  private static instance: ChamberlainService;

  private DEVICES_API_VERSION = 5.1;
  private DEFAULT_USER_AGENT = 'myQ/19569 CFNetwork/1107.1 Darwin/19.0.0'; //TODO whats this error look like 14041
  private DEFAULT_BRAND_ID = 2;
  private DEFAULT_CULTURE = 'en';
  private DEFAULT_APP_ID = 'JVM/G9Nwih5BwKgNCjLxiFUQxQijAebyyg8QUHr7JOrP+tuPb8iHfRHKwTmDzHOu';
  private DEFAULT_APP_ID_ALT = 'Vj8pQggXLhLy0WHahglCD4N1nAkkXQtGYpq2HrHD7H1nvmbT55KqtN6RSF4ILB/i';

  private MYQ_HEADERS = {
    'Content-Type': 'application/json',
    MyQApplicationId: this.DEFAULT_APP_ID,
    'User-Agent': this.DEFAULT_USER_AGENT,
    ApiVersion: this.DEVICES_API_VERSION,
    BrandId: this.DEFAULT_BRAND_ID,
    Culture: this.DEFAULT_CULTURE,
  };

  // If you are running mock-json-server
  // private URL_BASE = 'http://127.0.0.1:3000';
  private URL_BASE = 'https://api.myqdevice.com';

  private URL_AUTH = `${this.URL_BASE}/api/v5/Login`;
  private URL_DEVICE_BASE = `${this.URL_BASE}/api/v5.1`;
  private URL_MY = `${this.URL_BASE}/api/v5/My`;

  /**
  * The static method that controls the access to the singleton instance.
  *
  * This implementation let you subclass the Singleton class while keeping
  * just one instance of each subclass around.
  */
  public static getInstance(): ChamberlainService {
    if (!ChamberlainService.instance) {
      ChamberlainService.instance = new ChamberlainService();
    }

    return ChamberlainService.instance;
  }

  /**
     * The Singleton's constructor should always be private to prevent direct
     * construction calls with the `new` operator.
     */
  private constructor(){
    this.myqAccount = {} as MyQAccount;
    this.myqDevice = {} as MyQDevice;
    this.deviceId = '';
    this.username = '';
    this.password = '';
    this.securityToken = '';
    this.log = {} as Logger;
  }

  private myqAccount: MyQAccount;
  private myqDevice: MyQDevice;
  private deviceId: string;
  private username: string;
  private password: string;
  private securityToken: string;
  private log: Logger;

  init(username: string, password: string, deviceId: string, log: Logger){
    this.deviceId = deviceId;
    this.username = username;
    this.password = password;
    this.log = log;
  }

  // 'Wrapper' function to handle making sure the token, account and device are populated
  public async setup(): Promise<boolean>{
    // The token should check first as its used in all other calls
    if(!this.securityToken){
      this.log.debug('setup call getSecurityToken()');
      await this.getSecurityToken();
    }

    if(Object.keys(this.myqAccount).length === 0){
      this.log.debug('setup call getAccountId()');
      await this.getAccountId();
    }

    if(Object.keys(this.myqDevice).length === 0){
      this.log.debug('setup call getDevice()');
      await this.getDevice();
    }
    return true;
  }

  // open door
  public async openDoor(): Promise<string>{
    try{
      await this.setup();

      this.log.debug('open');

      // Check the existing device, if it is already open or opening just return that value
      const door_state = await this.getDeviceAttribute('door_state');
      if(door_state === 'open' || door_state === 'opening'){
        this.log.debug(`door already ${door_state}`);
        return Promise.resolve(door_state);
      }

      // request API to open the door
      const openResponse = await this.actOnDevice('open');
      this.log.debug('openResponse: ', openResponse);
      return Promise.resolve('opening');
    } catch(error){
      this.log.debug('open error: ', error);
      return Promise.reject('error');
    }
  }

  public async closeDoor(): Promise<string>{
    try{
      await this.setup();

      this.log.debug('close');

      // Check the existing device, if it is already closed or closing just return that value
      const door_state = await this.getDeviceAttribute('door_state');
      if(door_state === 'closed' || door_state === 'closing'){
        this.log.debug(`door already ${door_state}`);
        return Promise.resolve(door_state);
      }

      // request API to close the door
      const closeResponse = await this.actOnDevice('close');
      this.log.debug('closeResponse : ', closeResponse);
      return Promise.resolve('closing');
    } catch(error){
      this.log.debug('close error: ', error);
      return Promise.reject('error');
    }
  }

  // get the current state of the door
  public async getDoorState(): Promise<string>{
    try {
      await this.setup();

      return await this.getDeviceAttribute('door_state');
    } catch (error) {
      this.log.debug('status error: ', error);
      throw Error(error);
    }
  }

  // get the current, specific attribute (force a refresh)
  private async getDeviceAttribute(attribute: string): Promise<string>{
    try{
      const myqDevice = await this.getDevice(true);
      return myqDevice.state[attribute];
    }catch(error){
      this.log.debug('getDeviceAttribute error: ', error);
      throw Error(error);
    }
  }

  // ask the API to do an action
  private async actOnDevice(action: string): Promise<number>{
    try{
      const myqDevice = await this.getDevice();
      this.log.debug('act on a myqDevice');

      const options = {
        method: 'put',
        url: this.getUrlSetDevices(this.myqAccount.Id, myqDevice.serial_number),
        data: { action_type: action },
      };
      const actOnDeviceResponse = await this.axiosRetry(options);
      this.log.debug('actOnDeviceResponse: ', actOnDeviceResponse);
      return actOnDeviceResponse;
    }catch(error){
      this.log.debug('actOnDevice error: ', error);
      throw Error(error);
    }
  }

  // API call (with axios retry)
  // You can set the number of retries and default delay (with exponential backoff)
  // if the request fails a new security token will be requested (and set) before the next request via axios interceptor onRetryAttempt
  private async axiosRetry(options) {
    const config: AxiosRequestConfig = {
      method: options.method,
      url: options.url,
      headers: {
        ...this.MYQ_HEADERS,
        SecurityToken : this.securityToken,
      },
      params: options.params || {},
      data: options.data || {},
      raxConfig: {
        retry: 1,
        retryDelay: 300,
        backoffType: 'exponential',
        httpMethodsToRetry: ['GET', 'POST', 'PUT'],
        statusCodesToRetry: [[100, 199], [400, 429], [500, 599]],
        onRetryAttempt: async (err) => {
          const cfg = rax.getConfig(err);
          this.log.debug(`Retry attempt #${cfg ? cfg.currentRetryAttempt : 'undefined'}`);
          await this.getSecurityToken(true);
        },
      },
    };

    // console.log('axios: ', config);
    try{
      const {data} = await axios(config);
      return data;
    }catch(error) {
      this.log.debug('error: ', error.response.data);
      this.log.debug('error: ', error.response.status);
      this.log.debug('error: ', error.response.statusText);
      throw Error(`axios error: ${error.response.status}`);
    }
  }

  // helper to create the URL string
  private getUrlSetDevices(accountId: string, deviceId:string): string {
    return `${this.URL_DEVICE_BASE}/Accounts/${accountId}/Devices/${deviceId}/actions`;
  }

  // helper to create the URL string
  private getUrlGetDevices(accountId: string): string{
    return `${this.URL_DEVICE_BASE}/Accounts/${accountId}/Devices`;
  }

  /**
   * if the myqAccount.Id has not been saved, request from myq and populate myqAccount
   * else return the myqAccount.accountId
   */
  public async getAccountId(): Promise<string>{
    try {
      if(Object.keys(this.myqAccount).length === 0){
        this.log.debug('getAccountId empty account');
        const params = { expand: 'account' };
        const options = {
          method: 'get',
          params,
          url: `${this.URL_MY}`,
        };
        const response = await this.axiosRetry(options);
        // this.log.debug('response ', response.Account);
        this.myqAccount = response.Account;
      }
      this.log.debug(`getAccountId return ${this.myqAccount.Id}`);
      return this.myqAccount.Id;
    } catch (error) {
      this.log.debug('getAccountId error: ', error);
      throw Error(error);
    }
  }

  /**
   * if the myqDevice has not been saved or a refresh is requested, request from myq and populate myqDevice
   * else return the saved myqDevice
   */
  public async getDevice(refresh = false): Promise<MyQDevice>{
    this.log.debug('getDevice');
    try {
      if(Object.keys(this.myqDevice).length === 0 || refresh){
        this.log.debug('request a myqDevice');
        const options = {
          method: 'get',
          url: this.getUrlGetDevices(this.myqAccount.Id),
        };
        const response = await this.axiosRetry(options);
        const fullDeviceList = response.items;
        const filteredDeviceList = this.filterDeviceList(fullDeviceList);

        if (filteredDeviceList.length === 0) {
          throw Error('No controllable devices found');
        }

        if (filteredDeviceList.length === 1) {
          this.myqDevice = filteredDeviceList[0];
        } else {
          throw Error(`Multiple controllable devices found: ${filteredDeviceList.join(', ')}`);
        }
      }
      if(!this.deviceId || this.deviceId === ''){
        // output the device ID for the first time configuration
        this.log.error(`***** deviceId ${this.myqDevice.serial_number} *****`);
      }
      this.log.debug('return this.myqDevice');
      return this.myqDevice;
    } catch (error) {
      this.log.debug('getDevice error: ', error);
      throw Error(error);
    }
  }

  private filterDeviceList(deviceList: MyQDevice[]){
    const filteredDevices:MyQDevice[] = deviceList.filter(device => {
      if(device.state.online === false){
        return false;
      }

      if(device.device_type === 'hub'){
        return false;
      }

      if(device.device_type === 'ethernetgateway'){
        return false;
      }

      return true;
    });
    return filteredDevices;
  }

  // get and request a token
  private async getSecurityToken(getNew = false) {
    if(getNew){
      this.log.debug('getSecurityToken ** NEW **');
      this.securityToken = '';
    }

    if(this.securityToken){
      // we already have a token
      this.log.debug('give you existing token: ', this.securityToken);
      return this.securityToken;
    } else {
      this.log.debug('get a new token: ');

      // get a new token
      try {
        const axiosConfig: AxiosRequestConfig = {
          method: 'post',
          url: `${this.URL_AUTH}`,
          data: {
            Username: this.username,
            Password: this.password,
          },
        };

        const response = await axios(axiosConfig);
        const { data } = response;
        this.log.debug(`new token ${data.SecurityToken}`);
        this.securityToken = data.SecurityToken;
        return data.SecurityToken;
      } catch (error) {
        this.log.debug('getSecurityToken error: ', error);
        throw Error(error);
      }
    }
  }


}
