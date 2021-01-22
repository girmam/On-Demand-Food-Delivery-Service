const express = require("express");
const path = require('path');
const mysql = require("mysql");
const dotenv = require('dotenv');
var bodyParser = require('body-parser')
const cookiparser = require('cookie-parser');

dotenv.config({ path: './.env' });

const app = express();


var db = mysql.createConnection({
    host: process.env.HOST,
    user: "root",
    password: process.env.PASSWORED,
    database: process.env.DATABASE
});
const publicDirectory = path.join(__dirname, './public')
app.use(express.static(publicDirectory));
//parse url encoded
app.use(express.urlencoded({ extended: false }));
//parse joson body
app.use(bodyParser.urlencoded({extend:true}));
app.use(express.json());
app.use(cookiparser());
app.set('view engine', 'hbs');




db.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

//define routes
app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));


app.listen(3000, () => {
    console.log(`Server is running on port 3000}.`);
});