const express = require('express');
const app = express();
const path = require('path');

app.use('/css', express.static('css'));
app.use('/img', express.static('img'));
app.use('/js', express.static('js'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.listen(8080, ()=>console.log('Webserver listening on port 8080'));