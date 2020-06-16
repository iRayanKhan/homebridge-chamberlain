export default class ChamberlainService {
  private static instance: ChamberlainService;

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
  }

  private deviceId: string;
  private username: string;
  private password: string;

  init(username: string, password: string, deviceId: string ){
    this.deviceId = deviceId;
    this.username = username;
    this.password = password;
  }

  public async open(): Promise<boolean>{
    return true;
  }

  public async close(): Promise<boolean>{
    return false;
  }
}
