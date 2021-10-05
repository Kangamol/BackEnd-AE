const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");


module.exports = router;


router.get("/getFilterDeviceNo", async(req, res) => {
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

router.post("/insertrepairdoc", async(req, res) => {
    // console.log(req.body)
    try {
        const { BrokenDes, CategoryCode, ContactPerson, DeviceNo, DueDate, FloorCode, JobTypeCode, RoomCode, Status, Tel, ApprovStatus } = req.body
        const pool = await poolPromise;
        const result = await pool.request().query(`
                INSERT INTO MA.RepairDocument ([BillDoc], [JobTypeCode], [CategoryCode], [FloorCode], [RoomCode], [DeviceNo], [ContactPerson], [Tel], [JobDate], 
                            [DueDate], [BrokenDes], [RepairDes], [RepairPrice], [PartPrice], [Status], [ApprovStatus])
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
                                '${ApprovStatus}')
        `)
        res.json({ message: constants.kResultOk, result: result.recordset })
    } catch {
        res.json({ message: constants.kResultNok });
    }
})

router.get("/getbillrepairdoc", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	BillID, BillDoc, JT.JobTypeCode, JT.JobTypeName, CategoryName, RA.RoomName, DeviceNo,
        ContactPerson, (EM.EmpFullName)AS ContactPersonName, BrokenDes, RD.Status, FloorName,
        RD.PartPrice, RD.RepairPrice, RD.RepairDes, Approver, ApprovStatus, (EA.EmpFullName)AS  ApprovName, Tel,
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
        END dowFinishDate, FinishDate, Notifier, (EN.EmpFullName)AS NotifierName,
        ('http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EM.EmpPict,4,200),'\','/'))AS ContactPersonPict,
        ('http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EN.EmpPict,4,200),'\','/'))AS NotifierPict,
        ('http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EA.EmpPict,4,200),'\','/'))AS ApproverPict,
		SUBSTRING((SELECT CONVERT(VARCHAR, RD.JobDate, 108)),1,5)AS JobDateTime,
		SUBSTRING((SELECT CONVERT(VARCHAR, RD.FinishDate, 108)),1,5)AS FinishDateTime,
        CONVERT(VARCHAR, RD.JobDate, 103)AS JobDateShow,
		CONVERT(VARCHAR, RD.FinishDate, 103)AS FinishDateShow
        FROM	MA.RepairDocument RD
                LEFT JOIN MA.JobType JT ON RD.JobTypeCode = JT.JobTypeCode
                LEFT JOIN MA.Category CG ON RD.JobTypeCode = CG.JobTypeCode AND RD.CategoryCode = CG.CategoryCode
                LEFT JOIN MA.FloorAE FA ON RD.FloorCode = FA.FloorCode
                LEFT JOIN MA.RoomAE RA ON RD.FloorCode = RA.FloorCode AND RD.RoomCode = RA.RoomCode
                LEFT JOIN Employee EM ON RD.ContactPerson = EM.EmpCode
                LEFT JOIN Employee EA ON RD.Approver = EA.EmpCode
                LEFT JOIN Employee EN ON RD.Notifier = EN.EmpCode 
        ORDER BY  RD.Status , RD.JobDate
        `)
        res.json({ result: result.recordset, message: constants.kResultOk });
    } catch {
        res.json({ message: constants.kResultNok });
    }
})

router.get("/getbillrepairdocdetail/:id", async(req, res) => {
    const { id } = req.params
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
                    END dowFinishDate, FinishDate, Notifier, (EN.EmpFullName)AS NotifierName,
                    ('http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EM.EmpPict,4,200),'\','/'))AS ContactPersonPict,
					('http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EN.EmpPict,4,200),'\','/'))AS NotifierPict,
					('http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EA.EmpPict,4,200),'\','/'))AS ApproverPict,
                    SUBSTRING((SELECT CONVERT(VARCHAR, RD.JobDate, 108)),1,5)AS JobDateTime,
                    SUBSTRING((SELECT CONVERT(VARCHAR, RD.FinishDate, 108)),1,5)AS FinishDateTime
            FROM	MA.RepairDocument RD
                    LEFT JOIN MA.JobType JT ON RD.JobTypeCode = JT.JobTypeCode
                    LEFT JOIN MA.Category CG ON RD.JobTypeCode = CG.JobTypeCode AND RD.CategoryCode = CG.CategoryCode
                    LEFT JOIN MA.FloorAE FA ON RD.FloorCode = FA.FloorCode
                    LEFT JOIN MA.RoomAE RA ON RD.FloorCode = RA.FloorCode AND RD.RoomCode = RA.RoomCode
                    LEFT JOIN Employee EM ON RD.ContactPerson = EM.EmpCode
                    LEFT JOIN Employee EA ON RD.Approver = EA.EmpCode
                    LEFT JOIN Employee EN ON RD.Notifier = EN.EmpCode
            WHERE BillID = ${ id }
            ORDER BY RD.Status, RD.JobDate DESC  
        `)
        res.json({ result: result.recordset, message: constants.kResultOk });
    } catch {
        res.json({ message: constants.kResultNok });
    }
})

router.post("/gethistorybillrepair", async(req, res) => {
    const { DeviceNo } = req.body
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
                    WHERE DeviceNo = '${ DeviceNo }' AND RD.Status = '3'
                    ORDER BY RD.JobDate DESC 
        `)
        res.json({ result: result.recordset, message: constants.kResultOk });
    } catch {
        res.json({ message: constants.kResultNok });
    }
})


router.delete("/getbillrepairdoc/:id", async(req, res) => {
    try {
        const { id } = req.params
        const pool = await poolPromise;
        const result = await pool.request().query(`
            DELETE  MA.RepairDocument
            WHERE	MA.RepairDocument.BillID = ${ id }  
            `);
        res.json({ result: constants.kResultOk })
    } catch (error) {
        res.json({ result: "ERROR /deleteBillRepairmaster" })
    }
})


router.get("/getrepairdocmodify/:id", async(req, res) => {
    try {
        const { id } = req.params
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT  JobTypeCode, CategoryCode, FloorCode, RoomCode,
				DeviceNo, ContactPerson, Tel, DueDate, BrokenDes,
				RepairDes, RepairPrice, PartPrice, RD.Status, (EN.EmpFullName)AS ContactPersonName
        FROM	MA.RepairDocument RD LEFT JOIN Employee EN 
				ON RD.ContactPerson = EN.EmpCode
        WHERE	BillID = ${ id }  
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: "ERROR /getrepairdocmodify" })
    }
})


// แก้ไข device 
router.post("/edit-repairdoc/:id", async(req, res) => {
    const { id } = req.params
    const { JobTypeCode, CategoryCode, FloorCode, RoomCode, DeviceNo, ContactPerson, Tel, DueDate, BrokenDes } = req.body
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
                BrokenDes = '${BrokenDes}'
        WHERE	BillID = ${id}
              `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});

router.post("/updatestatus", async(req, res) => {
    const { BillID, status, repairCost, partsCost, description, Notifier } = req.body
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
        `)
        res.json({ result: constants.kResultOk });
    } catch {
        res.json({ result: constants.kResultNok });
    }
})



router.post("/getSumBill", async(req, res) => {
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
        `)
        res.json(result.recordset)
    } catch {
        res.json({ result: constants.kResultNok })
    }
})

router.post("/updatefinishdate", async(req, res) => {
    //ส่ง finishDate มาแต่ยังม่ได้ใช้ 26-4-2564
    const { finishDate, ID } = req.body;
    console.log(finishDate, ID)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            UPDATE MA.RepairDocument SET FinishDate = GETDATE()
            WHERE	BillID = ${ID}
        `)
        res.json({ result: constants.kResultOk })
    } catch {
        res.json({ result: constants.kResultNok })
    }
})

router.post("/updateapprove", async(req, res) => {
    const { ID, Approver} = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            UPDATE MA.RepairDocument SET ApprovStatus = '1', Approver = '${ Approver }'
            WHERE BillID = ${ ID }
        `)
        res.json({ result: constants.kResultOk })
    } catch {
        res.json({ result: constants.kResultNok })
    }
})





