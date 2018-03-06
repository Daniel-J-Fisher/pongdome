const express = require('express');
const app = express();
const path = require('path');

app.use('/css', express.static(path.join(__dirname + 'css')));
app.use('/img', express.static(path.join(__dirname + 'img')));
app.use('/js', express.static(path.join(__dirname + 'js')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.listen(8080, ()=>console.log('Webserver listening on port 8080'));