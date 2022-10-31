
const sql = require("mssql");



const dbconfig = {
    user: process.env.USERSQL,
    password: process.env.PASSWORDSQL,
    server: '192.168.3.2\\MSSQL2012',
    // server: '172.16.0.79\\MSSQL2014',
    // server: process.env.PATHSERVER,
    database: 'AEDAT',
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