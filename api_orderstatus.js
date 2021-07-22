const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");

module.exports = router;

router.get("/getorderstatus", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT  * , ISNULL((TotalQa * 100) / TotalQty, 0)AS perQa,
        CASE 
            WHEN dateLate >= 5	AND ISNULL((TotalQa * 100) / TotalQty, 0) >= 50	THEN 'ดีมาก' 
            WHEN dateLate < 5	AND ISNULL((TotalQa * 100) / TotalQty, 0) <= 50	THEN 'เร่งการผลิต'
            WHEN dateLate < 0	THEN 'เลยกำหนดส่ง'
        ELSE 'ปกติ'
        END Status
        FROM 
            (
            SELECT	OM.OrderNumber, OM.DueDate, OM.CusCode, OM.ProductionTeam,
                (DATEDIFF(DAY, DueDate, GETDATE()) * -1) dateLate,
                ISNULL((SELECT SUM(Qty) FROM qaBillDetail WHERE OrderNumber = OM.OrderNumber), 0)AS TotalQa,
                ISNULL((SELECT SUM(JobQty) FROM JobOrder WHERE JobOrder.OrderNumber = STB.OrderNumber), 0) TotalQty,
                CASE
                    WHEN Customer.Status = '1' THEN 'K.KLAR'
                    WHEN Customer.Status = '2' THEN 'K.NOOT'
                    WHEN Customer.Status = '3' THEN 'K.NAN'
                    ELSE 'ไม่มีข้อมูล'
                END	SalesManager,
                CASE	
                    WHEN ProductionTeam = '1' THEN 'FAC1'
                    WHEN ProductionTeam = '2' THEN 'FAC2'
                    WHEN ProductionTeam = '3' THEN 'FAC3'
                    WHEN ProductionTeam = '4' THEN 'FAC4'
                    ELSE 'ไม่ระบุ'
                END ProductionTeamName,
                CASE DATEPART(WEEKDAY, DueDate)
                    WHEN 1 THEN 'อา'
                    WHEN 2 THEN 'จ'
                    WHEN 3 THEN 'อ'
                    WHEN 4 THEN 'พ'
                    WHEN 5 THEN 'พฤ'
                    WHEN 6 THEN 'ศ'
                    WHEN 7 THEN 'ส'
                    ELSE 'ไม่มีข้อมูล'
                END thaiDate,
                P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22
        FROM
        (SELECT	SUMTABLE.OrderNumber,
                SUM([01]) AS P1, SUM([02]) AS P2, SUM([03]) AS P3, SUM([04]) AS P4, SUM([05]) AS P5,
                SUM([06]) AS P6, SUM([07]) AS P7, SUM([08]) AS P8, SUM([09]) AS P9, SUM([10]) AS P10,
                SUM([11]) AS P11, SUM([12]) AS P12, SUM([13]) AS P13, SUM([14]) AS P14, SUM([15]) AS P15,
                SUM([16]) AS P16, SUM([17]) AS P17, SUM([18]) AS P18, SUM([19]) AS P19, SUM([20]) AS P20,
                SUM([21]) AS P21, SUM([22]) AS P22
        FROM
        (
        SELECT	OrderNumber, 
                ISNULL([01], 0) [01], ISNULL([02], 0) [02], ISNULL([03], 0) [03], ISNULL([04], 0) [04], ISNULL([05], 0) [05],
                ISNULL([06], 0) [06], ISNULL([07], 0) [07], ISNULL([08], 0) [08], ISNULL([09], 0) [09], ISNULL([10], 0) [10],
                ISNULL([11], 0) [11], ISNULL([12], 0) [12], ISNULL([13], 0) [13], ISNULL([14], 0) [14],	ISNULL([15], 0) [15],
                ISNULL([16], 0) [16], ISNULL([17], 0) [17], ISNULL([18], 0) [18], ISNULL([19], 0) [19],	ISNULL([20], 0) [20],
                ISNULL([21], 0) [21], ISNULL([22], 0) [22]
        FROM 
        (
        Select	OrderNumber ,JO.JobNumber, PDProcessCode, (JS.In_Q + JS.Out_Q + JS.Receive_Q + JS.Send_Q) TotalDP
        FROM	JobOrder JO LEFT join JobStatus JS ON JO.JobNumber = JS.JobNumber
        )AS PIVOTTABLE PIVOT ( SUM(TotalDP) FOR PDProcessCode IN ([01],[02],[03],[04],[05],[06],[07],[08],[09],[10],[11],[12],[13],[14],[15],[16],[17],[18],[19],[20],[21],[22]) ) AS PIVOTTEST
        )AS SUMTABLE
        GROUP BY SUMTABLE.OrderNumber
        )AS		STB JOIN OrderMaster OM ON STB.OrderNumber = OM.OrderNumber
                JOIN Customer ON OM.CusCode = Customer.CusCode
        WHERE	OM.Status = '2' AND LEFT(OM.OrderNumber,5) != 'CH-M-' AND LEFT(OM.OrderNumber,3) = 'CH-' AND YEAR(OrderDate) = 2021
        )AS AA
        ORDER BY DueDate      
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.post("/getorderstatusbetween", async(req, res) => {
    const {start, to} = req.body
    console.log(start, to)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT  * , ISNULL((TotalQa * 100) / TotalQty, 0)AS perQa,
        CASE 
            WHEN dateLate >= 5	AND ISNULL((TotalQa * 100) / TotalQty, 0) >= 50	THEN 'ดีมาก' 
            WHEN dateLate < 5	AND ISNULL((TotalQa * 100) / TotalQty, 0) <= 50	THEN 'เร่งการผลิต'
            WHEN dateLate < 0	THEN 'เลยกำหนดส่ง'
        ELSE 'ปกติ'
        END Status
        FROM 
            (
            SELECT	OM.OrderNumber, OM.DueDate, OM.CusCode, OM.ProductionTeam,
                (DATEDIFF(DAY, DueDate, GETDATE()) * -1) dateLate,
                ISNULL((SELECT SUM(Qty) FROM qaBillDetail WHERE OrderNumber = OM.OrderNumber), 0)AS TotalQa,
                ISNULL((SELECT SUM(JobQty) FROM JobOrder WHERE JobOrder.OrderNumber = STB.OrderNumber), 0) TotalQty,
                CASE
                    WHEN Customer.Status = '1' THEN 'K.KLAR'
                    WHEN Customer.Status = '2' THEN 'K.NOOT'
                    WHEN Customer.Status = '3' THEN 'K.NAN'
                    ELSE 'ไม่มีข้อมูล'
                END	SalesManager,
                CASE	
                    WHEN ProductionTeam = '1' THEN 'FAC1'
                    WHEN ProductionTeam = '2' THEN 'FAC2'
                    WHEN ProductionTeam = '3' THEN 'FAC3'
                    WHEN ProductionTeam = '4' THEN 'FAC4'
                    ELSE 'ไม่ระบุ'
                END ProductionTeamName,
                CASE DATEPART(WEEKDAY, DueDate)
                    WHEN 1 THEN 'อา'
                    WHEN 2 THEN 'จ'
                    WHEN 3 THEN 'อ'
                    WHEN 4 THEN 'พ'
                    WHEN 5 THEN 'พฤ'
                    WHEN 6 THEN 'ศ'
                    WHEN 7 THEN 'ส'
                    ELSE 'ไม่มีข้อมูล'
                END thaiDate,
                P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22
        FROM
        (SELECT	SUMTABLE.OrderNumber,
                SUM([01]) AS P1, SUM([02]) AS P2, SUM([03]) AS P3, SUM([04]) AS P4, SUM([05]) AS P5,
                SUM([06]) AS P6, SUM([07]) AS P7, SUM([08]) AS P8, SUM([09]) AS P9, SUM([10]) AS P10,
                SUM([11]) AS P11, SUM([12]) AS P12, SUM([13]) AS P13, SUM([14]) AS P14, SUM([15]) AS P15,
                SUM([16]) AS P16, SUM([17]) AS P17, SUM([18]) AS P18, SUM([19]) AS P19, SUM([20]) AS P20,
                SUM([21]) AS P21, SUM([22]) AS P22
        FROM
        (
        SELECT	OrderNumber, 
                ISNULL([01], 0) [01], ISNULL([02], 0) [02], ISNULL([03], 0) [03], ISNULL([04], 0) [04], ISNULL([05], 0) [05],
                ISNULL([06], 0) [06], ISNULL([07], 0) [07], ISNULL([08], 0) [08], ISNULL([09], 0) [09], ISNULL([10], 0) [10],
                ISNULL([11], 0) [11], ISNULL([12], 0) [12], ISNULL([13], 0) [13], ISNULL([14], 0) [14],	ISNULL([15], 0) [15],
                ISNULL([16], 0) [16], ISNULL([17], 0) [17], ISNULL([18], 0) [18], ISNULL([19], 0) [19],	ISNULL([20], 0) [20],
                ISNULL([21], 0) [21], ISNULL([22], 0) [22]
        FROM 
        (
        Select	OrderNumber ,JO.JobNumber, PDProcessCode, (JS.In_Q + JS.Out_Q + JS.Receive_Q + JS.Send_Q) TotalDP
        FROM	JobOrder JO LEFT join JobStatus JS ON JO.JobNumber = JS.JobNumber
        )AS PIVOTTABLE PIVOT ( SUM(TotalDP) FOR PDProcessCode IN ([01],[02],[03],[04],[05],[06],[07],[08],[09],[10],[11],[12],[13],[14],[15],[16],[17],[18],[19],[20],[21],[22]) ) AS PIVOTTEST
        )AS SUMTABLE
        GROUP BY SUMTABLE.OrderNumber
        )AS		STB JOIN OrderMaster OM ON STB.OrderNumber = OM.OrderNumber
                JOIN Customer ON OM.CusCode = Customer.CusCode
        WHERE	OM.Status = '2' AND LEFT(OM.OrderNumber,5) != 'CH-M-' AND LEFT(OM.OrderNumber,3) = 'CH-' AND YEAR(OrderDate) = 2021
        )AS AA 
        WHERE DueDate BETWEEN '${start}' AND '${to}'
        ORDER BY DueDate
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.post("/getstonebyorder", async(req, res) => {
    const { OrderNumber } = req.body
    // console.log(start, to)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                SELECT InvCode, QtyReq
                FROM MaterialPlan
                WHERE OrderNumber = '${ OrderNumber }'
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.post("/getproductbyorder", async(req, res) => {
    const { OrderNumber } = req.body
    // console.log(start, to)
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 'http://172.16.0.15/aeweb/picture/'+REPLACE(SUBSTRING(PM.NewPict,4,200),'\','/') NewPict, PM.ProductID, PM.ProductCode, Qty
            FROM	OrderDetail OD JOIN ProductMaster PM ON OD.ProductID = PM.ProductID
            WHERE   OrderNumber = '${ OrderNumber }'
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.post("/getstoneproduct", async(req, res) => {
    const { OrderNumber } = req.body
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT  PM.ProductID, InvMaster.InvCode, OD.Qty * PD.Qty AS TotalStone,
                CASE
                    WHEN LEN(InvMaster.InvCode) >= 9  THEN 0
                    WHEN LEN(InvMaster.InvCode) < 9  THEN 1
                ELSE 0
                END Random
        FROM	OrderDetail OD JOIN ProductMaster PM ON OD.ProductID = PM.ProductID
                LEFT JOIN ProductDetail PD ON PM.ProductID = PD.ProductID
                LEFT JOIN InvMaster ON PD.InvCode = InvMaster.InvCode
        WHERE	OrderNumber = '${ OrderNumber }' AND InvMaster.InvGroupCode IN('02','03','04','05','06')
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})

router.post("/getorderdetailstatus", async(req, res) => {
    const { OrderNumber } = req.body
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	OrderNumber, NewPict, JobNumber, ProductID, ProductCode, OrderItemNo, JobQty, TotalQA,
        ((TotalQA *100)/ JobQty) AS perTotalQa,
        ISNULL([01], 0)AS [P1], ISNULL([02], 0)AS [P2], ISNULL([03], 0)AS [P3], ISNULL([04], 0)AS [P4], ISNULL([05], 0)AS [P5],
        ISNULL([06], 0)AS [P6], ISNULL([07], 0)AS [P7], ISNULL([08], 0)AS [P8], ISNULL([09], 0)AS [P9], ISNULL([10], 0)AS [P10],
        ISNULL([11], 0)AS [P11], ISNULL([12], 0)AS [P12], ISNULL([13], 0)AS [P13], ISNULL([14], 0)AS [P14],	ISNULL([15], 0)AS [P15],
        ISNULL([16], 0)AS [P16], ISNULL([17], 0)AS [P17], ISNULL([18], 0)AS [P18], ISNULL([19], 0)AS [P19],	ISNULL([20], 0)AS [P21],
        ISNULL([21], 0)AS [P21], ISNULL([22], 0)AS [P22]
FROM (
        Select	OrderNumber ,JO.JobNumber, JO.ProductID, OrderItemNo, JobQty, JO.ProductCode, PDProcessCode, (JS.In_Q + JS.Out_Q + JS.Receive_Q + JS.Send_Q) TotalDP,
                'http://172.16.0.15/aeweb/picture/'+REPLACE(SUBSTRING(NewPict,4,200),'\','/') NewPict,
                ISNULL(( SELECT SUM(qBD.Qty) FROM qaBillDetail qBD
                WHERE qBD.OrderNumber = JO.OrderNumber AND qBD.OrderItemNo = JO.OrderItemNo), 0)AS TotalQA
        FROM	JobOrder JO LEFT join JobStatus JS ON JO.JobNumber = JS.JobNumber
                LEFT JOIN ProductMaster PM ON JO.ProductID = PM.ProductID 
        WHERE	OrderNumber = '${ OrderNumber }'
        )AS PIVOTTABLE PIVOT ( SUM(TotalDP) FOR PDProcessCode IN ([01],[02],[03],[04],[05],[06],[07],[08],[09],[10],[11],[12],[13],[14],[15],[16],[17],[18],[19],[20],[21],[22]) ) AS PIVOTTEST
            `);
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.get("/reportworkerweightgold", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT  *, (((SendTotalWeight + MatTotalWeight) - ReturnWeight) / ReturnWeight * 100)AS perDiff
            FROM (
                    SELECT	WM.Bill_ID, BillNumber, BillDate, EmpFullName,ISNULL(WBM.InvCode, '-')AS InvCode, ISNULL(MatTotalWeight, 0)AS MatTotalWeight,
                            WD.ItemNo, WD.JobNumber, WD.SendQty, PM.ProductID, PM.ProductCode, PM.NewPict, JO.OrderNumber,
                            (WD.SendWeight)AS SendTotalWeight, IIF(WD.SendWeight = 0, 0, (WD.SendQty / WD.SendWeight))AS [SendWeightPerItem],
                            (SELECT SUM(RvTotalWeight) FROM WorkerBillDetailRv WHERE WorkerBillDetailRv.Bill_ID = WD.Bill_ID AND WorkerBillDetailRv.ItemNo = WD.ItemNo)AS ReturnWeight
                    FROM	WorkerBillMaster WM LEFT JOIN WorkerBillMaterial WBM ON WM.Bill_ID =  WBM.Bill_ID
                            JOIN WorkerBillDetail WD ON WM.Bill_ID = WD.Bill_ID
                            LEFT JOIN JobOrder JO ON JO.JobNumber = WD.JobNumber
                            LEFT JOIN ProductMaster PM ON JO.ProductID = PM.ProductID
                            LEFT JOIN Employee ON Receiver = EmpCode
                    WHERE	WM.Receiver IN ('1598', '2314', '1303', '2183', '1328', '1945', '2181', '1991')
                            AND WM.BillDate BETWEEN '20210526' AND '20210625'
            ) AS AA
            ORDER BY  InvCode DESC, BillDate, Bill_ID, ItemNo
        `)
        res.json(result.recordset)
    } catch (error) {
        res.json({ result: error })
    }
})






