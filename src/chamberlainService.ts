import axios, {AxiosRequestConfig} from 'axios';
import {MyQDevice, MyQAccount} from './interfaces';

export default class ChamberlainService {
  private static instance: ChamberlainService;

  private DEVICES_API_VERSION = 5.1;
  private DEFAULT_USER_AGENT = 'myQ/14041 CFNetwork/1107.1 Darwin/19.0.0';
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
  private URL_BASE = 'http://127.0.0.1:3000';
  // private URL_BASE = 'https://api.myqdevice.com';

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
  }

  private myqAccount: MyQAccount;
  private myqDevice: MyQDevice;
  private deviceId: string;
  private username: string;
  private password: string;
  private securityToken: string;

  init(username: string, password: string, deviceId: string ){
    this.deviceId = deviceId;
    this.username = username;
    this.password = password;
  }

  public async setup(): Promise<boolean>{
    await this.getAccountId();
    await this.getDevice();
    return true;
  }

  public async open(): Promise<boolean>{
    try{
      await this.sleep(2000);
      return Promise.resolve(true);
    } catch(error){
      console.log('open error: ', error);
      return Promise.reject(false);
    }
  }

  public async close(): Promise<boolean>{
    await this.sleep(2000);
    return Promise.resolve(false);
  }

  public async status(): Promise<string>{
    try {
      const status = await this.getDeviceAttribute('door_state');
      return status;
    } catch (error) {
      console.log('status error: ', error);
      throw Error(error);
    }
  }

  private async getDeviceAttribute(attribute: string): Promise<string>{
    return 'true';
  }

  private async axiosRetry(method, params = {}, url, retries = 1, backoff = 300) {
    // The token should check first as its used in all other calls
    if(!this.securityToken){
      await this.getSecurityToken();
    }

    // if for some reason (maybe the rist time this was run) the account isnt populated run setup()
    if(Object.keys(this.myqAccount).length === 0){
      await this.setup();
    }

    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        ...this.MYQ_HEADERS,
        SecurityToken : this.securityToken,
      },
      params: params,
    };

    try{
      const {data}= await axios(config);
      return data;
    }catch(error) {
      console.log('error: ', error.response.data);
      console.log('error: ', error.response.status);
      console.log('error: ', error.response.statusText);
      const errorData = error.response.data;

      // 401's
      /**
        // Your headers are missing
        data: {
          code: '401.102'
          message: 'Unauthorized',
          description: 'The current call is Unauthorized.'
        }

        // SecurityToken expired
        error:  {
          code: '401.101',
          message: 'Unauthorized',
          description: 'The Security Token has expired.'
        }
      */
      if(error.response.data === '401'){
        await this.getSecurityToken(true);
      }

      if (retries > 0) {
        setTimeout(() => {
          return this.axiosRetry(method, url, retries - 1, backoff * 2);
        }, backoff);
      } else {
        console.log('too many retires');
        throw new Error(error);
      }
    }
  }

  // TODO: REMOVE FOR SIMULATING SLOW API ONLY
  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getUrlSetDevices(accountId: string, deviceId:string): string {
    return `${this.URL_DEVICE_BASE}/Accounts/${accountId}/Devices/${deviceId}/actions`;
  }

  private getUrlGetDevices(accountId: string): string{
    return `${this.URL_DEVICE_BASE}/Accounts/${accountId}/Devices`;
  }

  /**
   * if the account has not been set up, request from myq and populate myqAccount
   *
   * else return the accountId
   */
  public async getAccountId(): Promise<string>{
    try {
      if(Object.keys(this.myqAccount).length === 0){
        const params = {expand: 'account'};
        const response = await this.axiosRetry('get', params, `${this.URL_MY}`);
        this.myqAccount = response.Account;
      }
      return this.myqAccount.Id;
    } catch (error) {
      console.log('getAccountId error: ', error);
      throw Error(error);
    }
  }

  public async getDevice(): Promise<MyQDevice>{
    try {
      if(Object.keys(this.myqDevice).length === 0 && this.myqAccount.Id){
        const response = await this.axiosRetry('get', {}, this.getUrlGetDevices(this.myqAccount.Id));
        const fullDeviceList = response.items;
        const filteredDeviceList = this.filterDeviceList(fullDeviceList);

        if (filteredDeviceList.length === 0) {
          throw new Error('No controllable devices found');
        }

        if (filteredDeviceList.length === 1) {
          this.myqDevice = filteredDeviceList[0];
        } else {
          throw new Error(`Multiple controllable devices found: ${filteredDeviceList.join(', ')}`);
        }
      }
      return this.myqDevice;
    } catch (error) {
      console.log('getDevice error: ', error);
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

  private async getSecurityToken(getNew = false) {
    if(getNew){
      this.securityToken = '';
    }

    if(this.securityToken){
      // we already have a token
      console.log('give you existing token: ', this.securityToken);
      return this.securityToken;
    } else {
      console.log('get a new token: ');

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
        return data.SecurityToken;
      } catch (error) {
        console.log('getSecurityToken error: ', error);
        throw Error(error);
      }
    }
  }


}
