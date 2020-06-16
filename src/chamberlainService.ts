import axios, {AxiosRequestConfig} from 'axios';

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

  private URL_AUTH = 'https://api.myqdevice.com/api/v5/Login';
  private URL_DEVICE_BASE = 'https://api.myqdevice.com/api/v5.1';
  private URL_MY = 'https://api.myqdevice.com/api/v5/My';

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
    this.deviceId = '';
    this.username = '';
    this.password = '';
    this.securityToken = '';
  }

  private deviceId: string;
  private username: string;
  private password: string;
  private securityToken: string;

  init(username: string, password: string, deviceId: string ){
    this.deviceId = deviceId;
    this.username = username;
    this.password = password;
  }

  public async open(): Promise<boolean>{
    try{
      //this.securityToken = await this.getSecurityToken();
      console.log('heres your token: ', this.securityToken);

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

  public async status(): Promise<boolean>{
    try {
      const response = await this.axiosRetry('get', `${this.URL_MY}`);

      console.log(JSON.parse(JSON.stringify(response)));
      return false;
    } catch (error) {
      console.log('status error: ', error);
      throw Error(error);
    }

    // "door_state"
    console.log('state');
    return Promise.resolve(true);
  }

  private async axiosRetry(method, url, retries = 1, backoff = 300) {
    if(!this.securityToken){
      this.securityToken = await this.getSecurityToken();
    }

    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        ...this.MYQ_HEADERS,
        SecurityToken : this.securityToken,
      },
      params: {
        expand: 'account',
      },
    };

    console.log('axiosRetry config: ', config);

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
        this.securityToken = '';
        this.securityToken = await this.getSecurityToken();
        console.log('new token: ', this.securityToken);
      }

      if (retries > 0) {
        // if (retries > 0 && retryCodes.includes(res.status)) {
        setTimeout(() => {
          return this.axiosRetry(method, url, retries - 1, backoff * 2);
        }, backoff);
      } else {
        console.log('too many retires');
        throw new Error(error);
      }
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getUrlSetDevices(accountId: string, deviceId:string): string {
    return `${this.URL_DEVICE_BASE}/Accounts/${accountId}/Devices/${deviceId}/actions`;
  }

  private getUrlGetDevices(accountId: string): string{
    return `${this.URL_DEVICE_BASE}/Accounts/${accountId}/Devices`;
  }

  private getUrlActions(accountId: string, deviceId: string): string {
    return `${this.URL_DEVICE_BASE}/Accounts/${accountId}/Devices/${deviceId}/actions`;
  }

  private async getSecurityToken() {
    console.log('getSecurityToken');

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
