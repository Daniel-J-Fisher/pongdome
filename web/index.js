const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('index.html');
});

exports.run = (config) => {
    app.listen(80, ()=>console.log('Webserver listening on port 80'));
}