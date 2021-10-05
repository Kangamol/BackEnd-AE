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
    if(timeCheck.getHours() === 8 && timeCheck.getMinutes() >= 30 && timeCheck.getMinutes() <=30 && checkSendLine) {
         try {
            const pool = await poolPromise;
            const result3 = await pool.request().query(`
            SELECT	CONVERT(VARCHAR,(GETDATE() - 1),103)AS DateShow,
                    [WT-01]AS WT1, [WT-02]AS WT2, [WT-03]AS WT3, [WT-04]AS WT4, [WT-05]AS WT5, [WT-06]AS WT6,
                    [WT-07]AS WT7, [WT-08]AS WT8, [WT-09]AS WT9, [WT-10]AS WT10, [WT-11]AS WT11, [WT-12]AS WT12,
                    ([WT-05] - [WT-06] - [WT-07])AS WT13, (([WT-09] + [WT-10]) - [WT-11])AS WT14
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
                            message: `
วันที่ ${dataSendLine.DateShow}
มิเตอร์น้ำชั้น 6 Lab 
ใช้น้ำไป ${ dataSendLine.WT1.toLocaleString() } ลิตร ( ${ (dataSendLine.WT1 / 1000) } ) Q

มิเตอร์น้ำชั้น 6 QC Fac1 
ใช้น้ำไป ${ dataSendLine.WT2.toLocaleString() } ลิตร ( ${ (dataSendLine.WT2 / 1000)} ) Q

มิเตอร์น้ำชั้น 6 ช่าง Fac1 
ใช้น้ำไป ${ dataSendLine.WT3.toLocaleString() } ลิตร ( ${ (dataSendLine.WT3 / 1000)} ) Q

มิเตอร์น้ำชั้น 6 ชุบ 
ใช้น้ำไป ${ dataSendLine.WT4.toLocaleString() } ลิตร ( ${ (dataSendLine.WT4 / 1000)} ) Q

มิเตอร์น้ำชั้น 1 เข้าอาคาร 
ใช้น้ำไป ${ dataSendLine.WT5.toLocaleString() } ลิตร ( ${ (dataSendLine.WT5 / 1000)} ) Q

มิเตอร์น้ำชั้น 1 ปั๊มลมส่งถังเก็บชั้น 8 
ใช้น้ำไป ${ dataSendLine.WT6.toLocaleString() } ลิตร ( ${ (dataSendLine.WT6 / 1000)} ) Q

มิเตอร์น้ำชั้น 1 เข้าถังเก็บดับเพลิง 
ใช้น้ำไป ${ dataSendLine.WT7.toLocaleString() } ลิตร ( ${ (dataSendLine.WT7 / 1000)} ) Q

มิเตอร์น้ำชั้น 8 ประปาชั้น 7,ห้องน้ำ 6 
ใช้น้ำไป ${ dataSendLine.WT8.toLocaleString() } ลิตร ( ${ (dataSendLine.WT8 / 1000)} ) Q

มิเตอร์น้ำชั้น 8 น้ำดิบไป RO เล็ก 
ใช้น้ำไป ${ dataSendLine.WT9.toLocaleString() } ลิตร ( ${ (dataSendLine.WT9 / 1000)} ) Q

มิเตอร์น้ำชั้น 8 น้ำดิบผลิต RO ตัวใหญ่ 
ใช้น้ำไป ${ dataSendLine.WT10.toLocaleString() } ลิตร ( ${ (dataSendLine.WT10 / 1000)} ) Q

มิเตอร์น้ำชั้น 8 RO ไปฝ่ายผลิต 
ใช้น้ำไป ${ dataSendLine.WT11.toLocaleString() } ลิตร ( ${ (dataSendLine.WT11 / 1000)} ) Q

มิเตอร์น้ำชั้น 6 คุมห้องช่างแต่ง Fac 1 
ใช้น้ำไป ${ dataSendLine.WT12.toLocaleString() } ลิตร ( ${ (dataSendLine.WT12 / 1000)} ) Q 

มิเตอร์น้ำชั้น 1 รอบอาคาร 
ใช้น้ำไป ${ dataSendLine.WT13.toLocaleString() } ลิตร ( ${ (dataSendLine.WT13 / 1000)} ) Q 

มิเตอร์น้ำชั้น 8 น้ำทิ้ง RO
ใช้น้ำไป ${ dataSendLine.WT14.toLocaleString() } ลิตร ( ${ (dataSendLine.WT14 / 1000)} ) Q 
`, });
                // dataSendLine.forEach(async(loopdata) =>{
                //     await lineNotify.notify({
                //         message: `${ loopdata.deviceCode } ใช้น้ำไป ${ loopdata.DataCount * loopdata.exrate }`,
                //     });
                // })
            }
         }   catch {}
    }
    if(timeCheck.getHours() === 8 && timeCheck.getMinutes() >= 20 && timeCheck.getMinutes() <= 20 && !checkSendLine) {
        checkSendLine = true
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT deviceCode, position, rateLimit FROM (
          SELECT deviceCode, 
              CASE	
                WHEN WL.deviceCode = 'WT-13' THEN	(SELECT WT05 - WT06 - WT07 
                                  FROM (
                                  SELECT COUNT(*)AS WT05, 
                                  (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-06')AS WT06,
                                  (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-07')AS WT07
                                FROM waterLog 
                                WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-05')AS A)
          
                WHEN WL.deviceCode = 'WT-14' THEN 	(SELECT ((WT09 + WT10) - WT11)
                                  FROM (
                                  SELECT COUNT(*)AS WT11, 
                                  (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-09')AS WT09,
                                  (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-10')AS WT10
                                FROM waterLog 
                                WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-11')AS A)
                ELSE (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode = WL.deviceCode)
              END AS DataCount, WL.exrate, WL.rateLimit, WL.LastUpdateLine, WL.position
          FROM waterLimit WL)AS A
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
                                message: `มิเตอร์ตำแหน่ง ${ loop.position } ใช้น้ำเกิน ${loop.rateLimit} ลิตร`,
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
<<<<<<< HEAD
        Declare @year int = ${year}, @month int = ${month};
        WITH numbers
        as  
        (
            Select 1 as value
            UNion ALL
            Select value + 1 from numbers
            where value + 1 <= Day(EOMONTH(datefromparts(@year,@month,1)))
        )
        SELECT dayNum, v01, v02, v03, v04, v05, v06, v07, v08, v09, v10, v11, v12,
                IIF(( v05 - v07 - v06 ) < 0, 0 , ( v05 - v07 - v06 ))AS v13,
                IIF(((v09 + v10) - v11) < 0, 0, ((v09 + v10) - v11))AS v14
        FROM 
        (
        SELECT day(datefromparts(@year,@month,numbers.value)) dayNum, 
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-01')AS v01,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-02')AS v02,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-03')AS v03,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-04')AS v04,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-05')AS v05,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-06')AS v06,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-07')AS v07,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-08')AS v08,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-09')AS v09,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-10')AS v10,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-11')AS v11,
        (SELECT (exrate * (SELECT COUNT(*) FROM waterLog WHERE waterLimit.deviceCode = waterLog.deviceCode AND year(transDate)=@year and month(transDate)=@month and day(transDate)=day(datefromparts(@year,@month,numbers.value)))) FROM waterLimit WHERE deviceCode = 'WT-12')AS v12
        FROM numbers)AS water
=======
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
>>>>>>> 2690250108aee348395402b707cc4cea8a40a3e2
            `);
      res.json(result.recordset);
      await pool.close;
    } catch (error) {
      res.json({ err_message: error.message });
    }
  });


  // Get sum ToDay
<<<<<<< HEAD
// router.get("/getDay/:dayString/:year/:month", async (req, res) => {
//     const day = req.params.dayString;  
//     const year = Number(req.params.year);  
//     const month = Number(req.params.month);
//     try {
//       const pool = await poolPromise;
//       const result = await pool.request().query(`
//               select A.deviceCode, A.daySum, B.monthSum from 
//               (
//               select deviceCode, (count(*)) daySum 
//               from waterLog 
//               where cast(transDate as date) = '${day}'
//               group by deviceCode
//               ) A left join (
//               select deviceCode, (count(*)) monthSum 
//               from waterLog 
//               where year(transDate) = ${year} and month(transDate) = ${month}
//               group by deviceCode) B on A.deviceCode = B.deviceCode    
//             `);
//       res.json(result.recordset);
//       await pool.close;
//     } catch (error) {
//       res.json({ err_message: error.message });
//     }
//   });

    // Get sum ToDay
router.get("/getwaterlogofday", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
    SELECT  deviceCode, exrate, rateLimit, position, (TotalMonth * exrate)AS TotalMonth, (TotalDay * exrate)AS TotalDay,
    CONVERT(DATE,ISNULL((SELECT MAX(transDate) FROM waterLog WHERE deviceCode = waterCal.deviceCode), '20210101'))AS Lastcount ,
      ('')AS ifShowmore, ('')AS ifRevised
      FROM    (SELECT	WL.deviceCode,WL.exrate, WL.rateLimit, WL.position,
          CASE	
      WHEN WL.deviceCode = 'WT-13' THEN	(SELECT WT05 - WT06 - WT07 FROM 
                          (SELECT COUNT(*)AS WT05, 
                          (SELECT COUNT(*) FROM waterLog WHERE Month(transDate) = Month(GETDATE()) AND deviceCode ='WT-06')AS WT06,
                          (SELECT COUNT(*) FROM waterLog WHERE Month(transDate) = Month(GETDATE()) AND deviceCode ='WT-07')AS WT07
                        FROM waterLog WHERE Month(transDate) = Month(GETDATE()) AND deviceCode ='WT-05')AS A)
      WHEN WL.deviceCode = 'WT-14' THEN 	(SELECT ((WT09 + WT10) - WT11) FROM 
                          (SELECT COUNT(*)AS WT11, 
                          (SELECT COUNT(*) FROM waterLog WHERE Month(transDate) = Month(GETDATE()) AND deviceCode ='WT-09')AS WT09,
                          (SELECT COUNT(*) FROM waterLog WHERE Month(transDate) = Month(GETDATE()) AND deviceCode ='WT-10')AS WT10
                        FROM waterLog WHERE Month(transDate) = Month(GETDATE()) AND deviceCode ='WT-11')AS A)
      ELSE (SELECT COUNT(*) FROM waterLog WHERE Month(transDate) = Month(GETDATE()) AND deviceCode = WL.deviceCode)
      END AS TotalMonth,
      CASE	
      WHEN WL.deviceCode = 'WT-13' THEN	(SELECT WT05 - WT06 - WT07 FROM 
                          (SELECT COUNT(*)AS WT05, 
                          (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-06')AS WT06,
                          (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-07')AS WT07
                        FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-05')AS A)
      WHEN WL.deviceCode = 'WT-14' THEN 	(SELECT ((WT09 + WT10) - WT11) FROM 
                          (SELECT COUNT(*)AS WT11, 
                          (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-09')AS WT09,
                          (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-10')AS WT10
                        FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode ='WT-11')AS A)
      ELSE (SELECT COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode = WL.deviceCode)
      END AS TotalDay
          FROM	waterLimit WL)AS waterCal 
      ORDER BY deviceCode 
          `);
    res.json(result.recordset);
    await pool.close;
  } catch (error) {
    res.json({ err_message: error.message });
  }
});


    // Get sum ToDay
// router.get("/getwaterlogofday", async (req, res) => {
//   try {
//     const pool = await poolPromise;
//     const result = await pool.request().query(`
//           // SELECT  deviceCode, exrate, rateLimit, position, (TotalMonth * exrate)AS TotalMonth, (TotalDay * exrate)AS TotalDay,
//           //     CONVERT(DATE,ISNULL((SELECT MAX(transDate) FROM waterLog WHERE deviceCode = waterCal.deviceCode), '20210101'))AS Lastcount ,
//           // ('')AS ifShowmore, ('')AS ifRevised
//           // FROM    (SELECT	WL.deviceCode,WL.exrate, WL.rateLimit, WL.position,
//           //     (SELECT	COUNT(*) FROM waterLog WHERE Month(transDate) = Month(GETDATE()) AND deviceCode = WL.deviceCode)AS TotalMonth,
//           //     (SELECT	COUNT(*) FROM waterLog WHERE DATEPART(DAYOFYEAR,transDate) = DATEPART(DAYOFYEAR, GETDATE()) AND deviceCode = WL.deviceCode)AS TotalDay
//           //     FROM	waterLimit WL)AS waterCal 
//           `);
//     res.json(result.recordset);
//     await pool.close;
//   } catch (error) {
//     res.json({ err_message: error.message });
//   }
// });


router.post("/updatewaterLimit/:deviceCode", async (req, res) => {
    const { deviceCode } = req.params;
    const { exrate, rateLimit, position } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        UPDATE waterLimit SET 
              exrate = ${ exrate },
              rateLimit = ${ rateLimit },
              LastUpdateLine = Null,
              position = '${ position }'
              FROM waterLimit
        WHERE deviceCode = '${ deviceCode }'
          `);
    res.json({ resule: result , message: constants.kResultOk });
    await pool.close;
  } catch (error) {
    res.json({ err_message: error.message });
  }
});


router.get("/getcolorweekend", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            Declare @year int = YEAR(GETDATE()), @month int = MONTH(GETDATE());
            WITH numbers
            as  
            (
                Select 1 as value
                UNion ALL
                Select value + 1 from numbers
                where value + 1 <= Day(EOMONTH(datefromparts(@year,@month,1)))
            )SELECT *, DATEPART(DW, DateShow)dwDateShow,
            CASE 
            WHEN DATEPART(DW, DateShow) != 7 AND DATEPART(DW, DateShow) != 1 THEN  '#A7FFEB'
            WHEN DATEPART(DW, DateShow) = 7 OR DATEPART(DW, DateShow) = 1 THEN  '#FFCDD2'
            END CssColor
            FROM (
            SELECT dayNum, CONVERT(DATE, CONCAT(@year, '-',@month,'-', dayNum))AS DateShow
            FROM (SELECT day(datefromparts(@year,@month,numbers.value)) dayNum  
            FROM numbers)AS A)AS B
          `);
    res.json(result.recordset);
    await pool.close;
  } catch (error) {
    res.json({ err_message: error.message });
  }
});








  



=======
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


  
>>>>>>> 2690250108aee348395402b707cc4cea8a40a3e2
