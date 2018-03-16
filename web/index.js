const express = require('express');
const app = express();
const path = require('path');
const debug = require('../debug')('pongdome:web')

app.use(express.static(path.join(__dirname,'public')));

exports.run = (config)=>{
    app.listen(8080, () => debug('PongDome Webserver listening on port 8080'));
}

if (require.main === module) {
    exports.run()
}