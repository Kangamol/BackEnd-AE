const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");
const lineNotify = require('line-notify-nodejs')('XdMETk7H1UjsI2QnzITlaGFSsvMKSVsmR9MB939Ng9n');


module.exports = router;



let checkSendLine = true


setInterval( async() => {
    let timeCheck = new Date();
    // console.log(timeCheck - 1)
    // console.log(timeCheck.getHours())
    // console.log(timeCheck.getMinutes())
    if(timeCheck.getHours() === 8 && timeCheck.getMinutes() >= 36 && timeCheck.getMinutes() <=36 && checkSendLine) {
         try {
            const pool = await poolPromise;
            const result3 = await pool.request().query(`
            SELECT	CONVERT(VARCHAR,(GETDATE() - 1),103)AS DateShow,
                    [WT-01]AS WT1, [WT-02]AS WT2, [WT-03]AS WT3, [WT-04]AS WT4, [WT-05]AS WT5, [WT-06]AS WT6,
					[WT-07]AS WT7, [WT-08]AS WT8, [WT-09]AS WT9, [WT-10]AS WT10, [WT-11]AS WT11, [WT-12]AS WT12
					FROM(SELECT	waterLimit.deviceCode, ISNULL(DataCount * exrate,0)AS Total
							FROM	waterLimit LEFT JOIN
							(
							SELECT		deviceCode, CAST(transDate AS date)AS transDate, COUNT(*)AS DataCount
							FROM		waterLog
							WHERE		CAST(transDate AS date) = CAST((GETDATE() - 1)AS date)
							GROUP BY	deviceCode, CAST(transDate AS date)
							) AS CountLog   ON CountLog.deviceCode = waterLimit.deviceCode)
                    AS PIVOTTABLE PIVOT (SUM(Total) FOR deviceCode IN ([WT-01],[WT-02],[WT-03],[WT-04],[WT-05],[WT-06],[WT-07],[WT-08],[WT-09],[WT-10],[WT-11],[WT-12]))AS RR
            `)
            if(result3) {
                checkSendLine = false
                let dataSendLine = result3.recordset[0]
                await lineNotify.notify({
                            message: `วันที่ ${dataSendLine.DateShow}
WT-01 ใช้น้ำไป ${ dataSendLine.WT1 } ลิตร
WT-02 ใช้น้ำไป ${ dataSendLine.WT2 } ลิตร
WT-03 ใช้น้ำไป ${ dataSendLine.WT3 } ลิตร
WT-04 ใช้น้ำไป ${ dataSendLine.WT4 } ลิตร
WT-05 ใช้น้ำไป ${ dataSendLine.WT5 } ลิตร
WT-06 ใช้น้ำไป ${ dataSendLine.WT6 } ลิตร
WT-07 ใช้น้ำไป ${ dataSendLine.WT7 } ลิตร
WT-08 ใช้น้ำไป ${ dataSendLine.WT8 } ลิตร
WT-09 ใช้น้ำไป ${ dataSendLine.WT9 } ลิตร
WT-10 ใช้น้ำไป ${ dataSendLine.WT10 } ลิตร
WT-11 ใช้น้ำไป ${ dataSendLine.WT11 } ลิตร
WT-12 ใช้น้ำไป ${ dataSendLine.WT12 } ลิตร`,              
                        });
                // dataSendLine.forEach(async(loopdata) =>{
                //     await lineNotify.notify({
                //         message: `${ loopdata.deviceCode } ใช้น้ำไป ${ loopdata.DataCount * loopdata.exrate }`,
                //     });
                // })
            }
         }   catch {}
    }
    if(timeCheck.getHours() === 8 && timeCheck.getMinutes() >= 30 && timeCheck.getMinutes() <= 30 && !checkSendLine) {
        checkSendLine = true
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT  CountLog.deviceCode, transDate, DataCount, exrate, rateLimit, LastUpdateLine
        FROM    (
                SELECT		deviceCode, CAST(transDate AS date)AS transDate, COUNT(*)AS DataCount
                FROM		waterLog
                WHERE		CAST(transDate AS date) = CAST(GETDATE()AS date)
                GROUP BY	deviceCode, CAST(transDate AS date)
                ) AS CountLog LEFT JOIN waterLimit ON CountLog.deviceCode = waterLimit.deviceCode
        WHERE	(DataCount * exrate) >= rateLimit AND CAST(ISNULL(LastUpdateLine, '20210101') AS date) != CAST(GETDATE() AS date)      
        `)
        // let { deviceCode, transDate, DataCount, exrate, rateLimit, LastUpdateLine } = result.recordset[0]
        // console.log(' ทำงาน')
        if(result.recordset.length > 0) {
            // console.log(result.recordset)
            let data = result.recordset
            data.forEach(async(loop) => {
                try {
                    const pool2 = await poolPromise;
                    const result2 = await pool2.request().query(`
                        UPDATE waterLimit SET LastUpdateLine = GETDATE()
                        WHERE deviceCode = '${ loop.deviceCode }'
                    `) // console.log('ส่ง Line')
                        if(result2) {
                            await lineNotify.notify({
                                message: `${ loop.deviceCode } = ใช้น้ำเกิน`,
                            });
                        }
                } catch { }
            });
        }
    } catch { console.log('ERROR เช็คค่าเกินแล้วส่ง LINE', new Date()) }
}, 30000)


// Get MonthDay
router.get("/getMonthDay/:year/:month", async (req, res) => {
    const year = req.params.year;
    const month = req.params.month
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
            Declare @year int = ${year}, @month int = ${month};
            WITH numbers
            as  
            (
                Select 1 as value
                UNion ALL
                Select value + 1 from numbers
                where value + 1 <= Day(EOMONTH(datefromparts(@year,@month,1)))
            )
            SELECT day(datefromparts(@year,@month,numbers.value)) dayNum, 
            (select (count(*)*10) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-01') v01,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-02') v02,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-03') v03,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-04') v04,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-05') v05,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-06') v06,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-07') v07,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-08') v08,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-09') v09,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-10') v10,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-11') v11,
            (select count(*) from waterLog where year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)) and deviceCode='WT-12') v12
            FROM numbers
            `);
      res.json(result.recordset);
      await pool.close;
    } catch (error) {
      res.json({ err_message: error.message });
    }
  });


  // Get sum ToDay
router.get("/getDay/:dayString/:year/:month", async (req, res) => {
    const day = req.params.dayString;  
    const year = Number(req.params.year);  
    const month = Number(req.params.month);
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
              select A.deviceCode, A.daySum, B.monthSum from 
              (
              select deviceCode, (count(*)) daySum 
              from waterLog 
              where cast(transDate as date) = '${day}'
              group by deviceCode
              ) A left join (
              select deviceCode, (count(*)) monthSum 
              from waterLog 
              where year(transDate) = ${year} and month(transDate) = ${month}
              group by deviceCode) B on A.deviceCode = B.deviceCode    
            `);
      res.json(result.recordset);
      await pool.close;
    } catch (error) {
      res.json({ err_message: error.message });
    }
  });


  