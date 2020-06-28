export interface MyQDeviceState {
  gdo_lock_connected: boolean;
  attached_work_light_error_present: boolean;
  door_state: string;
  open: string;
  close: string;
  last_update: string;
  passthrough_interval: string;
  door_ajar_interval: string;
  invalid_credential_window: string;
  invalid_shutout_period: string;
  is_unattended_open_allowed: boolean;
  is_unattended_close_allowed: boolean;
  aux_relay_delay: string;
  use_aux_relay: boolean;
  aux_relay_behavior: string;
  rex_fires_door: boolean;
  command_channel_report_status: boolean;
  control_from_browser: boolean;
  report_forced: boolean;
  report_ajar: boolean;
  max_invalid_attempts: number;
  online: boolean;
  last_status: string;
}

export interface MyQDevice {
  href: string;
  serial_number: string;
  device_family: string;
  device_platform: string;
  device_type: string;
  name: string;
  parent_device: string;
  parent_device_id: string;
  created_date: string;
  state: MyQDeviceState;
}

export interface MyQAccount {
  href: string;
  Id: string;
  Name: string;
  Email: string;
  Address: MyQAddress;
  Phone: string;
  ContactName: string;
  DirectoryCodeLength: number;
  UserAllowance: number;
  TimeZone: string;
  Devices: {
    href: string;
  };
  Users: {
    href: string;
  };
  AccessGroups: {
    href: string;
  };
  Roles: {
    href: string;
  };
  AccessSchedules: {
    href: string;
  };
  Zones: {
    href: string;
  };
}

interface MyQAddress {
  AddressLine1: string;
  AddressLine2: string;
  City: string;
  PostalCode: string;
  Country: {
    Code: string;
    IsEEACountry: boolean;
    href: string;
  };
}
