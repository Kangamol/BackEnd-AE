const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");

module.exports = router;

router.get("/getFilterDeviceNo", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT		JobTypeCode, CategoryCode, FloorCode, RoomCode, DeviceNo
        FROM		MA.DevicesMaster
        WHERE		Status1 = '0'
        Order BY	JobTypeCode, CategoryCode, FloorCode, RoomCode, DeviceNo
            `);
        res.json({ result: result.recordset, message: constants.kResultOk });
    } catch (error) {
        res.json({ message: constants.kResultNok });
    }
});

router.post("/insertrepairdoc", async (req, res) => {
    // console.log(req.body)
    try {
        const {
            BrokenDes,
            CategoryCode,
            ContactPerson,
            DeviceNo,
            DueDate,
            FloorCode,
            JobTypeCode,
            RoomCode,
            Status,
            Tel,
            ApprovStatus,
            // เพิ่ม
            RepairBillNo
        } = req.body;
        // console.log('>', RepairBillNo.toUpperCase())
        const pool = await poolPromise;
        const result = await pool.request().query(`
                INSERT INTO MA.RepairDocument ([BillDoc], [JobTypeCode], [CategoryCode], [FloorCode], [RoomCode], [DeviceNo], [ContactPerson], [Tel], [JobDate], 
                            [DueDate], [BrokenDes], [RepairDes], [RepairPrice], [PartPrice], [Status], [ApprovStatus], [RepairBillNo])
                VALUES
                             (  (SELECT	((SELECT 'RD'+ FORMAT(GETDATE(), 'yy') + FORMAT(GETDATE(), 'MM'))
                                + ISNULL(RIGHT('0000' + CAST(CAST(RIGHT(MAX(RD.BillDoc),5) AS INT)+1 AS VARCHAR),5),'00001'))AS maxDoc 
                                FROM	MA.RepairDocument RD
                                WHERE	LEFT(RD.BillDoc,6) = (SELECT 'RD'+ FORMAT(GETDATE(), 'yy') + FORMAT(GETDATE(), 'MM'))),
                                '${JobTypeCode}',
                                '${CategoryCode}',
                                '${FloorCode}',
                                '${RoomCode}',
                                '${DeviceNo}',
                                '${ContactPerson}',
                                '${Tel}',
                                GETDATE(),
                                '${DueDate}',
                                '${BrokenDes}',
                                '',
                                0,
                                0,
                                '${Status}',
                                '${ApprovStatus}',
                                '${RepairBillNo === undefined ? '' : RepairBillNo.toUpperCase()}')
        `);
        res.json({ message: constants.kResultOk, result: result.recordset });
    } catch {
        res.json({ message: constants.kResultNok });
    }
});

router.post("/getbillrepairdoc", async (req, res) => {
    const { jobDate, JobTypeCode, Status } = req.body
    console.log(req.body)
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
            SELECT	BillID, BillDoc, JT.JobTypeName, CategoryName, RA.RoomName, IIF(DeviceNo = 'null', '', DeviceNo)AS DeviceNo,
                ContactPerson, (EM.EmpFName + ' ( ' + EM.NickName + ' )')AS ContactPersonName, 
                BrokenDes + IIF(RepairBillNo = '', '', ' (บิลแผนก : ' +(SELECT PDProcessName FROM PDProcess WHERE PDProcessCode = (SUBSTRING(RepairBillNo,2,2))) + ')')AS BrokenDes, RepairBillNo, 
                RD.Status, FloorName, RD.PartPrice, RD.RepairPrice, RD.RepairDes, Approver, ApprovStatus, 
                (EA.EmpFullName)AS  ApprovName, Tel, DATEADD(HH, -7, JobDate)AS JobDate, RD.DueDate, DATEADD(HH, -7, FinishDate)AS FinishDate, Notifier, 
                (EN.EmpFName + ' ( ' + EN.NickName +' ) ')AS NotifierName,
                ('http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EM.EmpPict,4,200),'\','/'))AS ContactPersonPict,
                ('http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EN.EmpPict,4,200),'\','/'))AS NotifierPict,
                ('http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EA.EmpPict,4,200),'\','/'))AS ApproverPict,
                DATEDIFF(DAY, CAST(GETDATE() AS date), IIF(YEAR(DueDate) >= 2564 , DATEADD(YEAR, -543, DueDate), DueDate))AS DateWIP,
                DATEDIFF(DAY, CAST(JobDate AS date), CAST(FinishDate AS date))AS WorkinTime
                FROM	MA.RepairDocument RD
                        JOIN MA.JobType JT ON RD.JobTypeCode = JT.JobTypeCode
                        JOIN MA.Category CG ON RD.JobTypeCode = CG.JobTypeCode AND RD.CategoryCode = CG.CategoryCode
                        LEFT JOIN MA.FloorAE FA ON RD.FloorCode = FA.FloorCode
                        LEFT JOIN MA.RoomAE RA ON RD.FloorCode = RA.FloorCode AND RD.RoomCode = RA.RoomCode
                        LEFT JOIN Employee EM ON RD.ContactPerson = EM.EmpCode
                        LEFT JOIN Employee EA ON RD.Approver = EA.EmpCode
                        LEFT JOIN Employee EN ON RD.Notifier = EN.EmpCode 
                WHERE   (CAST(JobDate AS DATE) BETWEEN '${jobDate[0]}' AND '${jobDate[1]}' OR RD.Status IN ('0', '1', '2'))
                        AND RD.JobTypeCode IN ('${JobTypeCode[0]}', '${JobTypeCode[1]}', '${JobTypeCode[2]}') 
                        AND RD.Status IN ('${Status[0]}', '${Status[1]}', '${Status[2]}', '${Status[3]}', '${Status[4]}')
                ORDER BY  RD.Status , RD.JobDate
        `);
        // console.log(recordset)
        res.json({ result: recordset, message: constants.kResultOk });
    } catch {
        res.json({ message: constants.kResultNok });
    }
});

router.get("/getbillrepairdocdetail/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT	BillID, BillDoc, JT.JobTypeName, CategoryName, RA.RoomName, IIF(DeviceNo = 'null', '', DeviceNo)AS DeviceNo,
                ContactPerson, (EM.EmpFName + ' ( ' + EM.NickName + ' )')AS ContactPersonName, 
                BrokenDes + IIF(RepairBillNo = '', '', ' (บิลแผนก : ' +(SELECT PDProcessName FROM PDProcess WHERE PDProcessCode = (SUBSTRING(RepairBillNo,2,2))) + ')')AS BrokenDes, RepairBillNo, 
                RD.Status, FloorName, RD.PartPrice, RD.RepairPrice, RD.RepairDes, Approver, ApprovStatus, 
                (EA.EmpFullName)AS  ApprovName, Tel, DATEADD(HH, -7, JobDate)AS JobDate, RD.DueDate, DATEADD(HH, -7, FinishDate)AS FinishDate, Notifier, 
                (EN.EmpFName + ' ( ' + EN.NickName +' ) ')AS NotifierName,
                ('http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EM.EmpPict,4,200),'\','/'))AS ContactPersonPict,
                ('http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EN.EmpPict,4,200),'\','/'))AS NotifierPict,
                ('http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EA.EmpPict,4,200),'\','/'))AS ApproverPict,
                DATEDIFF(DAY, CAST(GETDATE() AS date), IIF(YEAR(DueDate) >= 2564 , DATEADD(YEAR, -543, DueDate), DueDate))AS DateWIP,
                DATEDIFF(DAY, CAST(JobDate AS date), CAST(FinishDate AS date))AS WorkinTime
                FROM	MA.RepairDocument RD
                        JOIN MA.JobType JT ON RD.JobTypeCode = JT.JobTypeCode
                        JOIN MA.Category CG ON RD.JobTypeCode = CG.JobTypeCode AND RD.CategoryCode = CG.CategoryCode
                        LEFT JOIN MA.FloorAE FA ON RD.FloorCode = FA.FloorCode
                        LEFT JOIN MA.RoomAE RA ON RD.FloorCode = RA.FloorCode AND RD.RoomCode = RA.RoomCode
                        LEFT JOIN Employee EM ON RD.ContactPerson = EM.EmpCode
                        LEFT JOIN Employee EA ON RD.Approver = EA.EmpCode
                        LEFT JOIN Employee EN ON RD.Notifier = EN.EmpCode 
            WHERE BillID = ${id} 
        `);
        res.json({ result: result.recordset, message: constants.kResultOk });
    } catch {
        res.json({ message: constants.kResultNok });
    }
});

router.post("/gethistorybillrepair", async (req, res) => {
    const { DeviceNo } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT	BillID, BillDoc, JT.JobTypeCode, JT.JobTypeName, CategoryName, RA.RoomName, DeviceNo,
                    ContactPerson, (EM.EmpFullName)AS ContactPersonName, BrokenDes, RD.Status, FloorName,
                    RD.PartPrice, RD.RepairPrice, RD.RepairDes, Approver, ApprovStatus, (EA.EmpFullName)AS  ApprovName,
                    CASE DATEPART(WEEKDAY,RD.JobDate)
                                WHEN 1 THEN 'อา'
                                WHEN 2 THEN 'จ'
                                WHEN 3 THEN 'อ'
                                WHEN 4 THEN 'พ'
                                WHEN 5 THEN 'พฤ'
                                WHEN 6 THEN 'ศ'
                                WHEN 7 THEN 'ส'
                                ELSE ''
                    END dowJobDate, JobDate,
                    CASE DATEPART(WEEKDAY,RD.DueDate)
                                WHEN 1 THEN 'อา'
                                WHEN 2 THEN 'จ'
                                WHEN 3 THEN 'อ'
                                WHEN 4 THEN 'พ'
                                WHEN 5 THEN 'พฤ'
                                WHEN 6 THEN 'ศ'
                                WHEN 7 THEN 'ส'
                                ELSE ''
                    END dowDueDate, RD.DueDate,
                    CASE DATEPART(WEEKDAY,RD.FinishDate)
                                WHEN 1 THEN 'อา'
                                WHEN 2 THEN 'จ'
                                WHEN 3 THEN 'อ'
                                WHEN 4 THEN 'พ'
                                WHEN 5 THEN 'พฤ'
                                WHEN 6 THEN 'ศ'
                                WHEN 7 THEN 'ส'
                                ELSE ''
                    END dowFinishDate, FinishDate, Notifier, (EN.EmpFullName)AS NotifierName
            FROM	MA.RepairDocument RD
                    LEFT JOIN MA.JobType JT ON RD.JobTypeCode = JT.JobTypeCode
                    LEFT JOIN MA.Category CG ON RD.JobTypeCode = CG.JobTypeCode AND RD.CategoryCode = CG.CategoryCode
                    LEFT JOIN MA.FloorAE FA ON RD.FloorCode = FA.FloorCode
                    LEFT JOIN MA.RoomAE RA ON RD.FloorCode = RA.FloorCode AND RD.RoomCode = RA.RoomCode
                    LEFT JOIN Employee EM ON RD.ContactPerson = EM.EmpCode
                    LEFT JOIN Employee EA ON RD.Approver = EA.EmpCode
                    LEFT JOIN Employee EN ON RD.Notifier = EN.EmpCode
                    WHERE DeviceNo = '${DeviceNo}' AND RD.Status = '3'
                    ORDER BY RD.JobDate DESC 
        `);
        res.json({ result: result.recordset, message: constants.kResultOk });
    } catch {
        res.json({ message: constants.kResultNok });
    }
});

router.delete("/getbillrepairdoc/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request().query(`
            DELETE  MA.RepairDocument
            WHERE	MA.RepairDocument.BillID = ${id}  
            `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: "ERROR /deleteBillRepairmaster" });
    }
});


// เพิ่มการดึง RepairBillNo
router.get("/getrepairdocmodify/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;
        const result = await pool.request().query(` 
        SELECT  JobTypeCode, CategoryCode, FloorCode, RoomCode,
				DeviceNo, ContactPerson, Tel, DueDate, BrokenDes, RepairBillNo, 
				RepairDes, RepairPrice, PartPrice, RD.Status, (EN.EmpFullName)AS ContactPersonName
        FROM	MA.RepairDocument RD LEFT JOIN Employee EN 
				ON RD.ContactPerson = EN.EmpCode
        WHERE	BillID = ${id}  
            `);
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: "ERROR /getrepairdocmodify" });
    }
});

// เพิ่ม  RepairBillNo = '${RepairBillNo}'
// แก้ไข device
router.post("/edit-repairdoc/:id", async (req, res) => {
    const { id } = req.params;
    const {
        JobTypeCode,
        CategoryCode,
        FloorCode,
        RoomCode,
        DeviceNo,
        ContactPerson,
        Tel,
        DueDate,
        BrokenDes,
        RepairBillNo
    } = req.body;
    // console.log('req.body : ', req.body)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                UPDATE	MA.RepairDocument SET
                JobTypeCode= '${JobTypeCode}',
                CategoryCode =  '${CategoryCode}',
                FloorCode =  '${FloorCode}',
                RoomCode = '${RoomCode}',
                DeviceNo =  '${DeviceNo}',
                ContactPerson =  '${ContactPerson}',
                Tel= '${Tel}',
                DueDate= '${DueDate}',
                BrokenDes = '${BrokenDes}',
                RepairBillNo = '${RepairBillNo === undefined ? '' : RepairBillNo.toUpperCase()}'
        WHERE	BillID = ${id}
              `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});

router.post("/updatestatus", async (req, res) => {
    const { BillID, status, repairCost, partsCost, description, Notifier } =
        req.body;
    // console.log(BillID, status, repairCost, partsCost, description)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            UPDATE	MA.RepairDocument SET
                        Status = '${status}',
                        PartPrice = ${partsCost},
                        RepairPrice = ${repairCost},
                        RepairDes = '${description}',
                        Notifier = '${Notifier}'
            WHERE	BillID = ${BillID}
        `);
        res.json({ result: constants.kResultOk });
    } catch {
        res.json({ result: constants.kResultNok });
    }
});

router.post("/getSumBill", async (req, res) => {
    const { Job1, Job2 } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT ISNULL(SUM([0]), 0)AS request , ISNULL(SUM([1]), 0)AS confirm,  ISNULL(SUM([2]), 0)AS waitPart, ISNULL(SUM([3]), 0)AS finish
            FROM 
            (SELECT	*
            FROM	MA.RepairDocument RD
            WHERE	YEAR(RD.JobDate) = 2021 AND JobTypeCode IN ('${Job1}', '${Job2}')
            )AS PIVOTTABLE PIVOT (COUNT(BillID) FOR Status IN ([0], [1], [2], [3]))AS SUMBILLREPAIR
        `);
        res.json(result.recordset);
    } catch {
        res.json({ result: constants.kResultNok });
    }
});

router.post("/updatefinishdate", async (req, res) => {
    //ส่ง finishDate มาแต่ยังม่ได้ใช้ 26-4-2564
    const { finishDate, ID } = req.body;
    //console.log(finishDate, ID);
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            UPDATE MA.RepairDocument SET FinishDate = GETDATE()
            WHERE	BillID = ${ID}
        `);
        res.json({ result: constants.kResultOk });
    } catch {
        res.json({ result: constants.kResultNok });
    }
});

router.post("/updateapprove", async (req, res) => {
    const { ID, Approver } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            UPDATE MA.RepairDocument SET ApprovStatus = '1', Approver = '${Approver}'
            WHERE BillID = ${ID}
        `);
        res.json({ result: constants.kResultOk });
    } catch {
        res.json({ result: constants.kResultNok });
    }
});

router.post("/filterRepairDate", async (req, res) => {
    const { minDate, maxDate } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                SELECT BillID
                FROM  MA.RepairDocument
                WHERE JobDate BETWEEN '${minDate}' AND '${maxDate} 23:59:59.000'
        `);
        const dataConvert = result.recordset.map((obj) => obj.BillID);
        res.status(200).json(dataConvert);
    } catch {
        res.status(500).json({ result: constants.kResultNok });
    }
});

// เพิ่ม
router.get("/getPDProcess", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
    SELECT PDProcessCode, PDProcessName FROM PDProcess
        `);
        // console.log('result : ', result.recordset)
        res.json(result.recordset);
    } catch {
        res.json({ result: constants.kResultNok });
    }
});
