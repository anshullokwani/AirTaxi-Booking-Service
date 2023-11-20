const express = require('express');
const {ServerConfig, Logger} = require('./config');
const apiRoutes = require('./routes');

const app = express();

app.use('/api', apiRoutes);

app.listen(4000, () => {
    console.log(`Successfully started the server on PORT : 4000`);
})