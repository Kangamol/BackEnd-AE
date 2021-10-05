const sql = require("mssql");

const dbconfig = {
    user: process.env.USERNAME_DB,
    password: process.env.PASSWORD_DB,
    server: '172.16.0.2\\MSSQL2012',
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        enableArithAbort: false,
    }
}

const poolPromise = new sql.ConnectionPool(dbconfig)
    .connect()
    .then(pool => {
        console.log('Connected to MSSQL')
        return pool
    })
    .catch(err => console.log('Database Connection Failed! Bad Config: ', err))

module.exports = poolPromise;