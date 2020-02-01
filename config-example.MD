# Config
> How to get ```deviceID's```, and entering them into your config

# Get ID's:
>  Add the snippet below to your config file, to generate your ```deviceID's``` then go to the next step.
>> If you get more than one, use trial and error to see which one works.


```json
{
  "accessory": "Chamberlain",
  "name": "Garage Door",
  "username": "your mychamberlain.com email",
  "password": "your mychamberlain.com password"
}

```

# Configuring
> Add the ```deviceID's```
>> If you are using a light controller, specify ```isLight``` to ```true```.

```json
{
  "accessory": "Chamberlain",
  "name": "Garage Door",
  "username": "your mychamberlain.com email",
  "password": "your mychamberlain.com password",
  "deviceId": "xxx"
}
```

If you have multiple devices, the plugin will throw an error and list the controllable device IDs. Use those IDs to create individual accessories. Be sure to uniquely name the device via the ```"name"``` field, otherwise you'll get a UUID error in the console (`Error: Cannot add a bridged Accessory with the same UUID as another bridged Accessory`).

```json
{
  "accessory": "Chamberlain",
  "name": "Main Garage Door",
  "username": "your mychamberlain.com email",
  "password": "your mychamberlain.com password",
  "deviceId": "xxx",
  "isLight": false
},
{
  "accessory": "Chamberlain",
  "name": "Side Garage Door",
  "username": "your mychamberlain.com email",
  "password": "your mychamberlain.com password",
  "deviceId": "xxx"
},
...
```

If you're using a light controller, here is an example of how to define it:
```json
{
  "accessory": "Chamberlain",
  "name": "Living Room Light",
  "username": "your mychamberlain.com email",
  "password": "your mychamberlain.com password",
  "deviceId": "xxx",
  "isLight": true
  
}
```

