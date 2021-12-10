const sql = require("mssql");

const dbconfig = {
    user: 'sa',
    password: 'sqlpassword',
    // server: '172.16.0.2\\MSSQL2012',
    server: '172.16.0.2\\MSSQL2012',
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