# homebridge-chamberlain

A Homebridge plugin for Chamberlain garage door openers with MyQ.

First set up your mychamberlain.com account, then add to your `config.json` in
the `accessories` array:

```json
{
  "accessory": "Chamberlain",
  "name": "Garage Door",
  "username": "your mychamberlain.com email",
  "password": "your mychamberlain.com password"
}
```

If you have multiple garage doors, the plugin will throw an error and list the controllable device IDs. Use those IDs to create individual accessories. Be sure to uniquely name the door via the "name" field, otherwise you'll get a UUID error in the console (`Error: Cannot add a bridged Accessory with the same UUID as another bridged Accessory`).

```json
{
  "accessory": "Chamberlain",
  "name": "Main Garage Door",
  "username": "your mychamberlain.com email",
  "password": "your mychamberlain.com password",
  "deviceId": "xxx"
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
