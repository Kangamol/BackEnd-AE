const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");


router.post("/getProcessChoice", async (req, res) => {
    const { EmpCode } = req.body
    // console.log(ModelNo);
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT PDProcess.PDProcessCode, PDProcess.PDProcessName
            FROM EmployeeProcess JOIN PDProcess ON 
            EmployeeProcess.PDProcessCode = PDProcess.PDProcessCode
            WHERE EmpCode = '${EmpCode}'
            Order BY SortOrder
            `);
        res.status(200).json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
});


router.post("/getItemforProcress", async (req, res) => {
    const { OrderNumber } = req.body
    // console.log(ModelNo);
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`

        SELECT	JO.OrderItemNo, JO.ProductID, JO.ProductCode, 
                'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(NewPict,4,200),'\','/')AS NewPict, 
                JO.JobQty, JS.*, (0)AS SELECTED, (0)AS QtySend, (0)AS WeightSend
        FROM	JobOrder JO JOIN JobStatus JS ON JO.JobNumber = JS.JobNumber LEFT JOIN ProductMaster ON JO.ProductID = ProductMaster.ProductID
        WHERE	OrderNumber = '${OrderNumber}'
        ORDER BY JO.JobNumber, PDProcessCode

        `);
        res.status(200).json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
});

router.get("/getorderforprocess", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT OrderNumber FROM OrderMaster OM
		WHERE OM.Status = '2' AND LEFT(OM.OrderNumber, 5) != 'CH-M-' AND LEFT(OM.OrderNumber, 3) = 'CH-'
		ORDER BY OrderNumber
        `);

        res.status(200).json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
});






module.exports = router;