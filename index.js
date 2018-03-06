const api = require('./api')
const chat = require('./chat')
const gpio = process.platform === 'linux' ? require('./gpio') : { run () {} }
const screen = require('./screen')
const web = require('./web')

api.run()
web.run()
//Disable chat for now
//chat.run()
gpio.run()
screen.run()
