const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");


module.exports = router;


router.get("/getFilterDeviceNo", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	JobTypeCode, CategoryCode, FloorCode, RoomCode, DeviceNo
        FROM	MA.DevicesMaster
        WHERE	Status1 = '0'
            `);
        res.json({ result: result.recordset, message: constants.kResultOk });
    } catch (error) {
        res.json({ message: constants.kResultNok });
    }
});

router.post("/insertrepairdoc", async(req, res) => {
    // console.log(req.body)
    try {
        const { BrokenDes, CategoryCode, ContactPerson, DeviceNo, DueDate, FloorCode, JobTypeCode, RoomCode, Status, Tel } = req.body
        const pool = await poolPromise;
        const result = await pool.request().query(`
                INSERT INTO MA.RepairDocument ([JobTypeCode], [CategoryCode], [FloorCode], [RoomCode], [DeviceNo], [ContactPerson], [Tel], [JobDate], 
                            [DueDate], [BrokenDes], [RepairDes], [RepairPrice], [PartPrice], [Status])
                VALUES
                            ('${JobTypeCode}', '${CategoryCode}', '${FloorCode}', '${RoomCode}', '${DeviceNo}', '${ContactPerson}',
                             '${Tel}', GETDATE(), '${DueDate}', '${BrokenDes}', '', 0, 0, '${Status}')
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
            SELECT	BillID, JT.JobTypeCode, JT.JobTypeName, CategoryName, RA.RoomName, DeviceNo, ContactPerson, JobDate, BrokenDes, Status,
                    RD.PartPrice, RD.RepairPrice, RD.RepairDes, RD.DueDate
            FROM	MA.RepairDocument RD
                    JOIN MA.JobType JT ON RD.JobTypeCode = JT.JobTypeCode
                    JOIN MA.Category CG ON RD.JobTypeCode = CG.JobTypeCode AND RD.CategoryCode = CG.CategoryCode
                    JOIN MA.FloorAE FA ON RD.FloorCode = FA.FloorCode
                    JOIN MA.RoomAE RA ON RD.FloorCode = RA.FloorCode AND RD.RoomCode = RA.RoomCode
            ORDER BY RD.JobDate DESC , Status 
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
        SELECT  JobTypeCode, CategoryCode, FloorCode, RoomCode, DeviceNo, ContactPerson, Tel, DueDate, BrokenDes, RepairDes, RepairPrice, PartPrice, Status
        FROM	MA.RepairDocument
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
                Tel= '',
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
    const { BillID, status, repairCost, partsCost, description } = req.body
        // console.log(BillID, status, repairCost, partsCost, description)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            UPDATE	MA.RepairDocument SET
                        Status = '${status}',
                        PartPrice = ${partsCost},
                        RepairPrice = ${repairCost},
                        RepairDes = '${description}'
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
            UPDATE MA.RepairDocument SET FinishDate = '${finishDate}'
            WHERE	BillID = ${ID}
        `)
        res.json({ result: constants.kResultOk })
    } catch {
        res.json({ result: constants.kResultNok })
    }
})