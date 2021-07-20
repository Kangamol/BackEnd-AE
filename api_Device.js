const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");


//แสดงหน้าหลัก
router.get("/getdevicemaster", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	ID, MA.JobType.JobTypeName, CAT.CategoryName, DM.DeviceNo, MA.FloorAE.FloorName, MA.RoomAE.RoomName, PurchaseDate, OutWarranty,
                Desciption, Status1, DM.JobTypeCode, DM.RoomCode, DM.FloorCode, Owner
        FROM	MA.DevicesMaster DM 
                JOIN MA.JobType ON DM.JobTypeCode = MA.JobType.JobTypeCode
                JOIN MA.Category CAT ON DM.JobTypeCode = CAT.JobTypeCode AND DM.CategoryCode = CAT.CategoryCode
                LEFT JOIN MA.FloorAE ON DM.FloorCode = MA.FloorAE.FloorCode
                LEFT JOIN MA.RoomAE ON DM.FloorCode = MA.RoomAE.FloorCode AND DM.RoomCode = MA.RoomAE.RoomCode
            `);
        res.json(result.recordset);
        await pool.close
    } catch (error) {
        res.json({ result: "ERROR /getdevicemaster " });
    }
});


router.get("/getdeviceedit/:id", async(req, res) => {
    try {
        const { id } = req.params
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	JobTypeCode, CategoryCode, DeviceNo, FloorCode, RoomCode, PurchaseDate,
                OutWarranty, Owner, Desciption, Status1, Status2, IPv4_1, IPv4_2
        FROM	MA.DevicesMaster
        WHERE	ID = ${ id }
            `);
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: "ERROR /getdeviceedit " });
    }
});


router.delete("/getdevicemaster/:id", async(req, res) => {
    try {
        const { id } = req.params
        const pool = await poolPromise;
        const result = await pool.request().query(`
            DELETE  MA.DevicesMaster
            WHERE	MA.DevicesMaster.ID = ${ id }
            `);
        res.json({ result: constants.kResultOk })
    } catch (error) {
        res.json({ result: "ERROR /deleteDevicemaster" })
    }
})

router.get("/getcategory", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT JobTypeCode, CategoryCode, CategoryName
        FROM MA.Category
        ORDER BY JobTypeCode, CONVERT(INT, SUBSTRING(CategoryCode, 2, 2))
            `);
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: "ERROR /getcategory " });
    }
});

router.get("/getfloor", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT FloorCode, FloorName FROM MA.FloorAE
            `);
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: "ERROR /getfloor " });
    }
});

router.get("/getroom", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      SELECT FloorCode, RoomCode, RoomName FROM MA.RoomAE
              `);
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: "ERROR /getfloor " });
    }
});

// แก้ไข device 
router.post("/edit-device/:id", async(req, res) => {
    const { id } = req.params
    const { JobTypeCode, CategoryCode, DeviceNo, FloorCode, RoomCode, PurchaseDate, OutWarranty, Owner, Desciption, Status1, IPv4_1, IPv4_2 } = req.body
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            UPDATE MA.DevicesMaster SET 
            JobTypeCode = '${ JobTypeCode }', 
            CategoryCode = '${ CategoryCode }', 
            DeviceNo = '${ DeviceNo }', 
            FloorCode = '${ FloorCode }',
            RoomCode = '${ RoomCode }',
            PurchaseDate = '${ PurchaseDate }',
            OutWarranty = '${ OutWarranty }',
            Owner = '${ Owner }',
            Desciption = '${ Desciption }',
            Status1 = '${ Status1 }',
            IPv4_1 = '${ IPv4_1 }',
            IPv4_2 = '${ IPv4_2 }'
            WHERE MA.DevicesMaster.ID = ${ id }
              `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: "ERROR /edit-device" });
    }
});


// สร้าง device ใหม่
router.post("/create-device", async(req, res) => {
    const { JobTypeCode, CategoryCode, DeviceNo, FloorCode, RoomCode, PurchaseDate, OutWarranty, Owner, Desciption, Status1, IPv4_1, IPv4_2 } = req.body
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            INSERT INTO MA.DevicesMaster (JobTypeCode, CategoryCode, DeviceNo, FloorCode, RoomCode, PurchaseDate, OutWarranty, Owner, Desciption, BuyPrice, Status1, Status2, IPv4_1, IPv4_2)
            VALUES ('${JobTypeCode}', '${CategoryCode}', '${DeviceNo}', '${FloorCode}', '${RoomCode}', '${PurchaseDate}', '${OutWarranty}', '${Owner}', '${Desciption}', 0, '${Status1}', '', '${IPv4_1}', '${IPv4_2}')
              `);
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: "ERROR /create-device" });
    }
});

router.get("/getemployee", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`SELECT EM.EmpCode, EM.EmpFullName FROM Employee EM`)
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: "ERROR /getemployee" });
    }
})

router.get("/getRepairDetail/:id", async(req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	RD.BillID, RD.DeviceNo ,JobDate, ContactPerson, EmpFullName, DueDate, BrokenDes, RepairDes, RepairPrice, PartPrice, RD.Status, StatusName
        FROM	MA.DevicesMaster DM JOIN MA.RepairDocument RD ON DM.JobTypeCode = RD.JobTypeCode AND DM.DeviceNo = RD.DeviceNo
                LEFT JOIN Employee ON ContactPerson = EmpCode
                LEFT JOIN MA.StatusRepairDoc SR ON DM.Status1 = SR.StatusCode
        WHERE	DM.ID = ${id}
        `)
        res.json(result.recordset);
    } catch {
        res.json({ result: constants.kResultNok });
    }
})

router.post("/updatestatusdevice", async(req, res) => {
    const { ID, Status1 } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        UPDATE MA.DevicesMaster SET Status1 = '${Status1}'
        WHERE	ID = ${ID}
        `)
        res.json({ result: constants.kResultOk });
    } catch {
        res.json({ result: constants.kResultNok });
    }
})






module.exports = router;