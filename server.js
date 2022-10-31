const express = require("express");
const app = express();
const bodyParser = require('body-parser')
const cors = require("cors")
const sql = require("mssql");
const logger = require('morgan');

require('dotenv').config()
app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname + "/uploaded"))


app.use("/api/v2", require("./api"));
app.use("/apiProcess", require("./api_Process"));
app.use("/apiwater", require("./api_waterLog"))
app.use("/apiproduct", require("./api_product"))
app.use("/api_FacwipStatus", require("./api_facwipstatus"))
app.use("/api_FacToQa", require("./api_FacToQA"))

app.listen(60009, () => {
    console.log("Server  Run...Port 60009")
});