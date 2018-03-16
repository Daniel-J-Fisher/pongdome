const express = require('express');
const app = express();
const path = require('path');
const debug = require('../debug')('pongdome:web')

app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});

exports.run = (config)=>{
    app.listen(8080, () => debug('PongDome Webserver listening on port 8080'));
}

if (require.main === module) {
    exports.run()
}