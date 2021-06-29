const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");

module.exports = router;


router.get("/getmouldbill", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	MM.ID, MM.DocID, MM.BillDate, MM.Owner, (EO.EmpFullName)AS OwnerFullName, 
                MM.OrderNumber, MM.ModelNo, MM.Qty, MM.JobType, JN.JobTypeName,
                MM.Receiver, (ER.EmpFullName)AS ReceiverFullName, ReceiveDate,
                MM.ReturnPerson, (ET.EmpFullName)AS ReturnPersonFullName,MM.ReturnDate, 
                MM.RepairModelDesc, MM.Status, DATEDIFF(DAY, MM.BillDate, IIF(MM.ReturnDate IS NULL, GETDATE(), MM.ReturnDate))AS TotalDate,
                MM.PrepareDate, MM.PreparePerson, (EP.EmpFullName)AS PrepareFullName,
                CASE DATEPART(WEEKDAY,MM.BillDate)
                    WHEN 1 THEN 'อา'
                    WHEN 2 THEN 'จ'
                    WHEN 3 THEN 'อ'
                    WHEN 4 THEN 'พ'
                    WHEN 5 THEN 'พฤ'
                    WHEN 6 THEN 'ศ'
                    WHEN 7 THEN 'ส'
                    ELSE ''
                END dowBillDate,
                CASE DATEPART(WEEKDAY,MM.PrepareDate)
                    WHEN 1 THEN 'อา'
                    WHEN 2 THEN 'จ'
                    WHEN 3 THEN 'อ'
                    WHEN 4 THEN 'พ'
                    WHEN 5 THEN 'พฤ'
                    WHEN 6 THEN 'ศ'
                    WHEN 7 THEN 'ส'
                    ELSE ''
                END dowPrepareDate,
                CASE DATEPART(WEEKDAY,MM.DueDate)
                    WHEN 1 THEN 'อา'
                    WHEN 2 THEN 'จ'
                    WHEN 3 THEN 'อ'
                    WHEN 4 THEN 'พ'
                    WHEN 5 THEN 'พฤ'
                    WHEN 6 THEN 'ศ'
                    WHEN 7 THEN 'ส'
                    ELSE ''
                END dowDueDate,
                CASE DATEPART(WEEKDAY,MM.ReceiveDate)
                    WHEN 1 THEN 'อา'
                    WHEN 2 THEN 'จ'
                    WHEN 3 THEN 'อ'
                    WHEN 4 THEN 'พ'
                    WHEN 5 THEN 'พฤ'
                    WHEN 6 THEN 'ศ'
                    WHEN 7 THEN 'ส'
                    ELSE ''
                END dowReceiveDate,
                CASE DATEPART(WEEKDAY,MM.ReturnDate)
                    WHEN 1 THEN 'อา'
                    WHEN 2 THEN 'จ'
                    WHEN 3 THEN 'อ'
                    WHEN 4 THEN 'พ'
                    WHEN 5 THEN 'พฤ'
                    WHEN 6 THEN 'ศ'
                    WHEN 7 THEN 'ส'
                    ELSE ''
                END dowReturnDate,
                MM.DepartCode, AM.DepartName, DueDate,
                (ISNULL(DATEDIFF(DAY, IIF(MM.ReturnDate IS NULL, GETDATE(), MM.ReturnDate), MM.DueDate), 0))AS LateDate, remark,
                'http://172.16.0.15/aeweb/picture/'+REPLACE(SUBSTRING((SELECT TOP(1)NewPict FROM ProductMaster WHERE CastingNo = MM.ModelNo),4,200),'\','/') NewPict
        FROM	Mould.MouldLentMaster MM 
                LEFT JOIN Employee EO ON MM.Owner = EO.EmpCode
                LEFT JOIN Mould.JobTypeName JN ON MM.JobType = JN.JobType
                LEFT JOIN Employee ER ON MM.Receiver = ER.EmpCode
                LEFT JOIN Employee ET ON MM.ReturnPerson = ET.EmpCode
                LEFT JOIN Employee EP ON MM.PreparePerson = EP.EmpCode
                LEFT JOIN Mould.AEDepartment AM ON MM.DepartCode = AM.DepartCode
                ORDER BY  MM.Status, MM.BillDate DESC
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.get("/getmouldbillDetail/:ModelNo", async(req, res) => {
    const { ModelNo } = req.params
    // console.log(ModelNo);
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	MM.ID, MM.DocID, MM.BillDate, MM.Owner, (EO.EmpFullName)AS OwnerFullName, 
                MM.OrderNumber, MM.ModelNo, MM.Qty, MM.JobType, JN.JobTypeName, MM.Receiver, 
                (ER.EmpFullName)AS ReceiverFullName, MM.ReturnPerson, (ET.EmpFullName)AS ReturnPersonFullName,
                MM.ReturnDate, MM.RepairModelDesc, MM.Status, DATEDIFF(DAY, MM.BillDate, IIF(MM.ReturnDate IS NULL, GETDATE(), MM.ReturnDate))AS Datelate
        FROM	Mould.MouldLentMaster MM 
                LEFT JOIN Employee EO ON MM.Owner = EO.EmpCode
                LEFT JOIN Mould.JobTypeName JN ON MM.JobType = JN.JobType
                LEFT JOIN Employee ER ON MM.Receiver = ER.EmpCode
                LEFT JOIN Employee ET ON MM.ReturnPerson = ET.EmpCode
        WHERE	MM.ModelNo = '${ModelNo}' AND MM.Status = '04'
                ORDER BY MM.BillDate DESC
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})

//ดึง Orderมา เพื่อเลือก
router.get("/getmouldordernumberwip", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	OrderNumber FROM OrderMaster
        WHERE	YEAR(OrderDate) >= 2021 AND LEFT(OrderNumber, 3) = 'CH-' AND LEFT(OrderNumber, 5) != 'CH-M-' AND Status = '2'  
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.get("/getmouldordernumber-ex", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	OrderNumber FROM OrderMaster
        WHERE	YEAR(OrderDate) >= 2021 AND LEFT(OrderNumber, 5) != 'CH-M-' AND Status = '2'    
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})

//ส่ง OrderNumber มาเพื่อไปดึง แม่พิมพ์มา
router.post("/getmodelmould", async(req, res) => {
    const { OrderNumber } = req.body
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT	NULL AS checkBox, (CastingNo)AS ModelNo, 'http://172.16.0.15/aeweb/picture/'+REPLACE(SUBSTRING(NewPict,4,200),'\','/') NewPict,
            (0) AS Qty, ('') AS JobType, ('') AS remark
            FROM
            (SELECT	DISTINCT(PM.CastingNo), 
                    (SELECT TOP(1)NewPict FROM ProductMaster WHERE CastingNo = PM.CastingNo)AS NewPict
            FROM	OrderDetail OD JOIN ProductMaster PM ON OD.ProductID = PM.ProductID
            WHERE	OD.OrderNumber = '${OrderNumber}')AS A
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})
// SELECT DISTINCT(PM.CastingNo)AS ModelNo FROM OrderDetail OD JOIN ProductMaster PM ON OD.ProductID = PM.ProductID
// WHERE OrderNumber = '' 

//ดึงแม่พิมพ์มาแบบทั้งหมด
router.get("/getmodelmouldall", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                SELECT ModelNo, 'http://172.16.0.15/aeweb/picture/'+REPLACE(SUBSTRING(NewPict,4,200),'\','/') NewPict FROM 
                (
                    SELECT	(CastingNo)AS ModelNo, 
                            (SELECT TOP(1) NewPict FROM ProductMaster WHERE CastingNo = PM.CastingNo)AS NewPict 
                    FROM ProductMaster PM
                    WHERE	CastingNo != ''
                    GROUP BY CastingNo)AS ModelNo
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})



//ส่ง OrderNumber มาเพื่อไปดึง แม่พิมพ์มา
router.get("/getjobmould", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                SELECT JobType, JobTypeName FROM Mould.JobTypeName
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})

//ดึงข้อมูลแบบส่ง ID ไป เพื่อนำมาแก้ไขข้อมูล
router.get("/getmodifymouldbill/:id", async(req, res) => {
    const { id } = req.params
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                SELECT MM.* , EY.EmpFullName  FROM  Mould.MouldLentMaster MM LEFT JOIN Employee EY ON MM.Owner = EY.EmpCode 
                WHERE ID = ${ id }
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})






router.post("/insertbillmould", async(req, res) => {
    const { Owner, OrderNumber, ModelNo, Qty, JobType, DepartCode, DueDate, RepairModelDesc, Status , remark } = req.body
    // console.log(Owner, OrderNumber, ModelNo, Qty, JobType, Receiver, RepairModelDesc, Status)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            INSERT INTO Mould.MouldLentMaster (DocID, Owner, OrderNumber, ModelNo, Qty, JobType, DepartCode,DueDate, RepairModelDesc, Status, remark)
            VALUES	(	(SELECT	((SELECT 'MO'+ FORMAT(GETDATE(), 'yy') + FORMAT(GETDATE(), 'MM')) + ISNULL(RIGHT('0000' + CAST(CAST(RIGHT(MAX(MM.DocID),5) AS INT)+1 AS VARCHAR),5),'00001'))AS maxDoc 
                        FROM	Mould.MouldLentMaster MM
                        WHERE	LEFT(MM.DocID,6) = (SELECT 'MO'+ FORMAT(GETDATE(), 'yy') + FORMAT(GETDATE(), 'MM'))),
                        '${Owner}',
                        '${OrderNumber}',
                        '${ModelNo}',
                        ${Qty},
                        '${JobType}',
                        '${DepartCode}',
                        '${DueDate}',
                        '${RepairModelDesc}',
                        '${Status}',
                        '${remark}'
            );
        `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});


router.delete("/deletebillmould/:id", async(req, res) => {
    const { id } = req.params
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            DELETE	MM 
            FROM	Mould.MouldLentMaster MM
            WHERE	ID = ${id}
            `);
        res.json({ result: constants.kResultOk })
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})




router.post("/updatestatusmould", async(req, res) => {
    const { billID, ReturnPerson, ReturnDate, RepairModelDesc, StatusID} = req.body
    // console.log(billID, ReturnPerson, ReturnDate, RepairModelDesc, StatusID)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                UPDATE Mould.MouldLentMaster 
                SET ReturnPerson = '${ReturnPerson}', 
                    ReturnDate = ${ReturnDate}, 
                    RepairModelDesc = '${RepairModelDesc}',
                    Status = '${StatusID}'
                WHERE	ID = ${ billID }
        `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});


router.post("/updatestatusmould02", async(req, res) => {
    const { billID, PreparePerson, PrepareDate, RepairModelDesc, StatusID} = req.body
    // console.log(billID, ReturnPerson, ReturnDate, RepairModelDesc, StatusID)
    try {
        const pool = await poolPromise;
                const result = await pool.request().query(`
                UPDATE Mould.MouldLentMaster 
                SET PreparePerson = '${PreparePerson}', 
                    PrepareDate = GETDATE(), 
                    RepairModelDesc = '${RepairModelDesc}',
                    Status = '${StatusID}'
                WHERE	ID = ${ billID }
        `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});


router.post("/updatestatusmould03", async(req, res) => {
    const { billID, Receiver, ReceiveDate, RepairModelDesc, StatusID} = req.body
    // console.log(billID, ReturnPerson, ReturnDate, RepairModelDesc, StatusID)
    try {
        const pool = await poolPromise;
                const result = await pool.request().query(`
				UPDATE Mould.MouldLentMaster 
                SET Receiver = '${Receiver}', 
                    ReceiveDate = GETDATE(), 
                    RepairModelDesc = '${RepairModelDesc}',
                    Status = '${StatusID}'
                WHERE	ID = ${ billID }
        `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});


router.post("/updatestatusmould04", async(req, res) => {
    const { billID, ReturnPerson, ReturnDate, RepairModelDesc, StatusID} = req.body
    // console.log(billID, ReturnPerson, ReturnDate, RepairModelDesc, StatusID)
    try {
        const pool = await poolPromise;
            const result = await pool.request().query(`
                UPDATE Mould.MouldLentMaster 
                SET ReturnPerson = '${ReturnPerson}', 
                    ReturnDate = GETDATE(), 
                    RepairModelDesc = '${RepairModelDesc}',
                    Status = '${StatusID}'
                WHERE	ID = ${ billID }
        `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});



//ดึงข้อมูลแบบส่ง ID ไป เพื่อนำมาแก้ไขข้อมูล
router.get("/moulddepart", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT DepartCode, DepartName FROM Mould.AEDepartment
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})

router.post("/ModifyBillMould", async(req, res) => {
    const { ID, DepartCode, DueDate, OrderNumber, ModelNo, Qty, JobType, Status, remark} = req.body
    console.log(DueDate)
    try {
        const pool = await poolPromise;
            const result = await pool.request().query(`
                UPDATE Mould.MouldLentMaster SET
                        DepartCode = '${DepartCode}',
                        DueDate = '${DueDate}',
                        OrderNumber = '${OrderNumber}',
                        ModelNo = '${ModelNo}',
                        Qty = '${Qty}',
                        JobType = '${JobType}',
                        Status = '${Status}',
                        remark = '${remark}'
                WHERE	ID = ${ID}
        `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});


