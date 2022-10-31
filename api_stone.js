const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");

module.exports = router;

router.get("/stonepurchase", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT	OM.OrderNumber, MP.InvCode, InvMaster.InvDescE, MP.QtyReq,
                    Supplier.SupplierName, OM.ProductionTeam
            FROM	MaterialPlan MP Join OrderMaster OM ON MP.OrderNumber = OM.OrderNumber
                    LEFT JOIN InvMaster ON InvMaster.InvCode = MP.InvCode
                    LEFT JOIN Supplier ON Supplier.SupplierCode = MP.SupplierSelect
            WHERE	YEAR(OM.OrderDate)= 2021 AND LEFT(OM.OrderNumber, 3) = 'CH-' 
                    AND LEFT(OM.OrderNumber, 5) != 'CH-M' AND OM.Status = '2' 
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})



router.post("/stonepurchasebyorder", async(req, res) => {
    const { OrderNumber } = req.body
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	PurchaseStatus.InvCode, SUM(QtyReq) AS QtyReq
        FROM	PurchaseStatus
        WHERE	OrderNumber = '${ OrderNumber }'
        GROUP BY PurchaseStatus.InvCode
            `);
            // เก่า
            // SELECT	OM.OrderNumber, MP.InvCode, InvMaster.InvDescE, MP.QtyReq, Supplier.SupplierName, OM.ProductionTeam
            // FROM	MaterialPlan MP Join OrderMaster OM ON MP.OrderNumber = OM.OrderNumber
            //         LEFT JOIN InvMaster ON InvMaster.InvCode = MP.InvCode
            //         LEFT JOIN Supplier ON Supplier.SupplierCode = MP.SupplierSelect
            // WHERE	YEAR(OM.OrderDate)= 2021 AND OM.OrderNumber = '${ OrderNumber }'
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})












