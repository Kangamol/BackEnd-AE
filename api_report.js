const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");


module.exports = router;

router.get("/reportChartBill", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	NameMonth, 
				ISNULL((SELECT COUNT(BillID)	
				FROM	MA.RepairDocument RD
				WHERE	YEAR(RD.JobDate) = YEAR(GETDATE()) AND MONTH(JobDate) = MM.ID AND RD.JobTypeCode = '01'
				GROUP BY MONTH(JobDate)), 0) AS ItQty,
				ISNULL((SELECT COUNT(BillID)	
				FROM	MA.RepairDocument RD
				WHERE	YEAR(RD.JobDate) = YEAR(GETDATE()) AND MONTH(JobDate) = MM.ID AND RD.JobTypeCode = '02'
				GROUP BY MONTH(JobDate)), 0) AS MaQty
        FROM	MA.MyMonth MM
            `);
        res.json({ result: result.recordset, message: constants.kResultOk });
    } catch (error) {
        res.json({ message: constants.kResultNok });
    }
});

router.get("/getpostnews", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT	ID, postHeader, postDes, postDate, postStatus, EmpFullName
            FROM	MA.postNews LEFT JOIN Employee ON postOwner = EmpCode
            WHERE	postDate  > DATEADD(DAY,-30, GETDATE()) AND postStatus = '0'
            ORDER BY postStatus, postDate DESC, ID DESC
        `)
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})

router.post("/createpost", async (req, res) => {
    const { postHeader, postDes, postDate, postOwner, postStatus } = req.body
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            INSERT INTO MA.postNews (postHeader, postDes, postDate, postOwner, postStatus)
            VALUES(	'${postHeader}',
                    '${postDes}',
                    GETDATE(),
                    '${postOwner}',
                    '${postStatus}')
        `)
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})

router.delete("/deletepost/:ID", async (req, res) => {
    const { ID } = req.params
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                DELETE MA.postNews
                WHERE	ID = ${ID}
        `)
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.put("/disablepost/:ID", async (req, res) => {
    const { ID } = req.params
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                UPDATE MA.postNews SET postStatus = '1'
                WHERE  ID = ${ID}
        `)
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})






