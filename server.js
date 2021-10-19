const express = require("express");
const app = express();
const bodyParser = require('body-parser')
const cors = require("cors")
const sql = require("mssql");
require("dotenv").config();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname + "/uploaded"))


app.use("/api/v2", require("./api"))
app.use("/apiwater", require("./api_waterLog"))

app.listen(3000, () => {
    console.log("Server  Run...Port 3000")
    // console.log(process.env.DB_NAME)
    // console.log(process.env.USERNAME_DB)
    // console.log(process.env.PASSWORD_DB)
    // console.log(process.env.HOST_DB)
});