const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");
const moment = require("moment")

moment.locale("th");
module.exports = router;


router.post("/getOrderStatusNew", async (req, res) => {
    const { orderFilter, factory, dateBetween } = req.body
    // console.log(orderFilter);
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
        --STEP 1 resultMaster
		DECLARE @GetDate DATE = CAST(GETDATE()AS DATE)
		SELECT	A.OrderNumber, ProductionTeam, DueDate, TotalDay, ISNULL(IIF(TotalDay >= 0, TotalDay - WorkingDay, ((TotalDay * -1)  - WorkingDay )*-1), 0)AS WorkingDay,TotalQty,
				ISNULL(OrderRemarkDes.PlanDes, '')AS PlanDes, ISNULL(OrderRemarkDes.QaDes, '')AS QaDes, CustomerDueDate, ISNULL(OrderFinishForFact.isFinish, 0)AS isFinish
		FROM ( SELECT	OM.OrderNumber, DueDate,  DATEDIFF(DAY,@GetDate, DueDate)AS TotalDay, SUM(OD.Qty)AS TotalQty,
                CASE
                    WHEN DueDate > @GetDate THEN  ( SELECT COUNT(*) FROM CompanyHoliday WHERE HolidayDate BETWEEN @GetDate AND DueDate)
                    WHEN DueDate < @GetDate THEN  ( SELECT COUNT(*) FROM CompanyHoliday WHERE HolidayDate BETWEEN DueDate AND @GetDate)
                END AS WorkingDay, ProductionTeam, FactoryDue AS CustomerDueDate -- คุณหนึ่งให้ใช้ช่อง ของFac เฉพาะ CH เพราะกำหนด Fac ถูกเอาไปใส่ที่ DueDate
        FROM	OrderMaster OM JOIN OrderDetail OD ON OM.OrderNumber = OD.OrderNumber
        WHERE	 YEAR(DueDate) > 2021 AND OM.Status = '2' AND LEFT(OM.OrderNumber,5) != 'CH-M-' AND LEFT(OM.OrderNumber,3) = 'CH-' AND LEFT(OM.OrderNumber,7) != 'CH-TEST'
        AND OM.DueDate BETWEEN '${dateBetween[0]}' AND '${dateBetween[1]}' AND OM.OrderNumber LIKE '%${orderFilter}%'
        GROUP BY OM.OrderNumber, ProductionTeam, DueDate, FactoryDue)AS A
		LEFT JOIN OrderRemarkDes ON A.OrderNumber = OrderRemarkDes.OrderNumber LEFT JOIN OrderFinishForFact ON A.OrderNumber = OrderFinishForFact.OrderNumber
		WHERE DATEADD(DAY, 7,ISNULL(OrderFinishForFact.FinishDate, GETDATE())) >= GETDATE()

	    --STEP 2
		SELECT	QaOrderDayList.OrderNumber, DayWip, Dow,
				ISNULL(ToQa, 0)AS ToQa, ISNULL(FirstTarget.QtyFirstTarget, 0)AS FirstTarget, ISNULL(LastTaget.QtyLastTarget, 0)AS LastTarget
		FROM	QaOrderDayList
        LEFT JOIN
            (SELECT CAST(billDate AS DATE)billDate, qaBillMaster.OrderNumber, SUM(Qty)AS ToQa
            FROM qaBillMaster JOIN qaBillDetail ON qaBillMaster.qaBill_ID = qaBillDetail.qaBill_ID
            GROUP BY CAST(billDate AS DATE), qaBillMaster.OrderNumber)AS SumBillQa
        ON QaOrderDayList.OrderNumber = SumBillQa.OrderNumber AND QaOrderDayList.DayWip = SumBillQa.billDate
        LEFT JOIN (SELECT OrderNumber, DueDate, SUM(Qty)AS QtyFirstTarget
					FROM	DueFacToQa
					WHERE OrderNumber  LIKE '%${orderFilter}%' AND HistoryNo = 1
					GROUP BY OrderNumber, DueDate)AS FirstTarget ON QaOrderDayList.OrderNumber = FirstTarget.OrderNumber AND CAST(DayWip AS DATE) = FirstTarget.DueDate
		LEFT JOIN (SELECT	OrderNumber, DueDate, SUM(Qty)AS QtyLastTarget
					FROM	DueFacToQa  AA
					WHERE	OrderNumber  LIKE '%${orderFilter}%' AND HistoryNo != 1 AND HistoryNo = (SELECT MAX(HistoryNo) FROM DueFacToQa WHERE OrderNumber = AA.OrderNumber)
					GROUP BY OrderNumber, DueDate)AS LastTaget ON QaOrderDayList.OrderNumber = LastTaget.OrderNumber AND CAST(DayWip AS DATE) = LastTaget.DueDate
        WHERE QaOrderDayList.OrderNumber LIKE '%${orderFilter}%'
		ORDER BY DayWip

		--STEP 3 resultDueDateQa
		SELECT	OrderNumber,
				(COUNT(HistoryNo) - 1)AS SumLateQa,
				CAST((SELECT MAX(HistoryDate) FROM DueFacToQa WHERE OrderNumber = DFQ.OrderNumber AND HistoryNo = 1)AS DATE)AS FirstTarget,
				CAST((SELECT MAX(HistoryDate) FROM DueFacToQa WHERE OrderNumber = DFQ.OrderNumber AND HistoryNo != 1)AS DATE)AS LastTarget
		FROM (
		SELECT OrderNumber, HistoryNo FROM DueFacToQa
		WHERE OrderNumber LIKE '%${orderFilter}%'  AND Qty > 0
		GROUP BY OrderNumber, HistoryNo)AS DFQ GROUP BY OrderNumber

		--STEP 4 resultCountMonth
		SELECT	OrderNumber, 
				CASE   MONTH(DayWip)     
					WHEN 1 THEN 'มกราคม'                                  
					WHEN 2 THEN 'กุมภาพันธ์'                                  
					WHEN 3 THEN 'มีนาคม'                                  
					WHEN 4 THEN 'เมษายน'                                  
					WHEN 5 THEN 'พฤษภาคม'                                  
					WHEN 6 THEN 'มิถุนายน'                                  
					WHEN 7 THEN 'กรกฎาคม'                                  
					WHEN 8 THEN 'สิงหาคม'                                  
					WHEN 9 THEN 'กันยายน'                                   
					WHEN 10 THEN 'ตุลาคม'                                  
					WHEN 11 THEN 'พฤศจิกายน'                                  
					WHEN 12 THEN 'ธันวาคม'                                 
					END AS month, COUNT(*)AS count
		FROM	QaOrderDayList
        WHERE OrderNumber LIKE '%${orderFilter}%'
		GROUP BY OrderNumber, MONTH(DayWip)
        Order BY OrderNumber, MONTH(DayWip)


		--STEP 5 resultPDProcess
		        SELECT	OrderWIP.OrderNumber, OrderWIP.PDProcessCode, OrderWIP.PDProcessName, ISNULL(Job.TotalInProcess, 0)AS TotalInProcess
        FROM	(SELECT	OM.OrderNumber, PDProcess.PDProcessCode, PDProcessName
                FROM	OrderMaster OM CROSS JOIN PDProcess
                WHERE	YEAR(DueDate) > 2021 AND OM.Status = '2' AND LEFT(OM.OrderNumber,5) != 'CH-M-' AND LEFT(OM.OrderNumber,3) = 'CH-'
                        AND LEFT(OM.OrderNumber,7) != 'CH-TEST' AND PDProcess.PDProcessCode NOT IN ('01', '17', '18', '20', '21', '22', '15', '19' ))AS OrderWIP
				LEFT JOIN
				(SELECT OrderNumber, PDProcessCode, SUM(JS.In_Q + JS.Send_Q + JS.Out_Q)AS TotalInProcess
				FROM JobOrder JO JOIN JobStatus JS ON JO.JobNumber = JS.JobNumber
				GROUP BY OrderNumber, PDProcessCode)AS Job ON OrderWIP.OrderNumber = Job.OrderNumber AND OrderWIP.PDProcessCode = Job.PDProcessCode
                WHERE OrderWIP.OrderNumber LIKE '%${orderFilter}%'

        -- STEP 6
		SELECT	OrderNumber, FinalBill, FactDueDate, QtyReq, QtyToFact, IsFinish, DATEDIFF(DAY, IIF(IsFinish = 1, FinalBill, GETDATE()), FactDueDate)AS LateDay
		FROM	(SELECT	OrderNumber, IIF(SUM(QtyReq) > SUM(QtyToFact), 0, 1)AS IsFinish,
				(SELECT MAX(BillDate) FROM MT_BillMaster WHERE	OrderNumber = PS.OrderNumber)AS FinalBill,
				MAX(FactDueDate)AS FactDueDate, SUM(QtyReq)AS QtyReq, SUM(QtyToFact)AS QtyToFact
		FROM	PurchaseStatus PS
		WHERE OrderNumber LIKE '%${orderFilter}%'
		GROUP BY OrderNumber)AS A
        `)
        let dataMaster = recordsets[0].filter(({ ProductionTeam }) => factory.includes(ProductionTeam))
        // let dataMaster = recordsets[0]
        // console.log(dataMaster)
        dataMaster.forEach((objMaster, IndexMaster) => {
            dataMaster[IndexMaster].qaCalender = (recordsets[1].filter(({ OrderNumber }) => objMaster.OrderNumber.trim() === OrderNumber.trim())).map((obj) => {
                return {
                    DayWip: obj.DayWip,
                    Dow: obj.Dow,
                    ToQa: obj.ToQa,
                    FirstTarget: obj.FirstTarget,
                    LastTarget: obj.LastTarget
                }
            });
            dataMaster[IndexMaster].qaTarget = recordsets[2].filter(({ OrderNumber }) => objMaster.OrderNumber.trim() === OrderNumber.trim()).map((obj) => {
                return {
                    SumLateQa: obj.SumLateQa,
                    FirstTarget: obj.FirstTarget,
                    LastTarget: obj.LastTarget
                }
            });
            dataMaster[IndexMaster].headerMonth = recordsets[3].filter(({ OrderNumber }) => objMaster.OrderNumber.trim() === OrderNumber.trim()).map((obj) => {
                return {
                    month: obj.month,
                    count: obj.count
                }
            });
            dataMaster[IndexMaster].Process = recordsets[4].filter(({ OrderNumber }) => objMaster.OrderNumber.trim() === OrderNumber.trim()).map((obj) => {
                return {
                    PDProcessCode: obj.PDProcessCode,
                    PDProcessName: obj.PDProcessName,
                    TotalInProcess: obj.TotalInProcess
                }
            });
            const InvStatus = recordsets[5].filter(({ OrderNumber }) => objMaster.OrderNumber.trim() === OrderNumber.trim()).map((obj) => {
                return {
                    FinalBill: obj.FinalBill,
                    FactDueDate: obj.FactDueDate,
                    QtyReq: obj.QtyReq,
                    QtyToFact: obj.QtyToFact,
                    IsFinish: obj.IsFinish,
                    LateDay: obj.LateDay
                }
            });
            let OrderQty = objMaster.TotalQty
            dataMaster[IndexMaster].qaCalender.forEach((obj, index) => {
                OrderQty = OrderQty - obj.ToQa;
                dataMaster[IndexMaster].qaCalender[index].BalanceQty = OrderQty;
            });
            dataMaster[IndexMaster].statusStone = {
                FinalBill: InvStatus.length > 0 ? InvStatus[0].FinalBill : '',
                FactDueDate: InvStatus.length > 0 ? InvStatus[0].FactDueDate : '',
                QtyReq: InvStatus.length > 0 ? InvStatus[0].QtyReq : 0,
                QtyToFact: InvStatus.length > 0 ? InvStatus[0].QtyToFact : 0,
                IsFinish: InvStatus.length > 0 ? InvStatus[0].IsFinish : 0,
                LateDay: InvStatus.length > 0 ? InvStatus[0].LateDay : 0
            }
            dataMaster[IndexMaster].SumTotalToQa = objMaster.qaCalender.reduce(
                (pv, cv) => pv + cv.ToQa,
                0
            );
        });
        res.json(dataMaster)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})


router.post("/insertDueQa", async (req, res) => {
    const { OrderNumber, choseTarget, DueDate, Qty, EmpCode } = req.body
    // console.log(orderFilter);
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        DECLARE @OrderNumber VARCHAR(30) = '${OrderNumber}'
        DECLARE @DueDate DATE = '${DueDate}'
        DECLARE @Qty INT = ${Qty}
        DECLARE @EmpCode VARCHAR(10) = '${EmpCode}'
        DECLARE @choseTarget VARCHAR(10) = '${choseTarget}'
                BEGIN
                DECLARE @fisrt INT = 1
                DECLARE @last INT
                    IF EXISTS (SELECT HistoryNo FROM DueFacToQa WHERE OrderNumber = @OrderNumber AND CAST(HistoryDate AS DATE) = CAST(GETDATE() AS DATE) AND HistoryNo != 1)
                        BEGIN
                        -- เอา No เดียวกัน
                        SET @last = (SELECT MAX(HistoryNo) FROM DueFacToQa WHERE OrderNumber = @OrderNumber AND CAST(HistoryDate AS DATE) = CAST(GETDATE() AS DATE))
                        END
                    ELSE
                        BEGIN
                        SET @last = (SELECT ISNULL(MAX(HistoryNo), 0) + 1
                            FROM DueFacToQa
                            WHERE OrderNumber = @OrderNumber)
                        END
                        SELECT @fisrt, @last 
                        SELECT * FROM DueFacToQa WHERE OrderNumber = @OrderNumber AND DueDate = @DueDate AND HistoryNo = IIF(@choseTarget = 'first', @fisrt, @last)
                    IF EXISTS (SELECT * FROM DueFacToQa  WHERE OrderNumber = @OrderNumber AND DueDate = @DueDate AND HistoryNo = IIF(@choseTarget = 'first', @fisrt, @last))
                    BEGIN
                            --SELECT * FROM DueFacToQa WHERE OrderNumber = @OrderNumber AND DueDate = @DueDate AND HistoryNo = IIF(@choseTarget = 'first', @fisrt, @last)
                        DELETE DueFacToQa WHERE OrderNumber = @OrderNumber AND DueDate = @DueDate AND HistoryNo = IIF(@choseTarget = 'first', @fisrt, @last)
                    END
                    INSERT INTO DueFacToQa
                    VALUES(@OrderNumber,
                            IIF(@choseTarget = 'first', @fisrt, @last),
                            @DueDate,
                            @Qty,
                            GETDATE(),
                            @EmpCode,
                            NULL
                            )
                END
        `)


        const { recordset } = await pool.request().query(`
        SELECT	(COUNT(HistoryNo) - 1)AS SumLateQa,
				CAST((SELECT MAX(HistoryDate) FROM DueFacToQa WHERE OrderNumber = DFQ.OrderNumber AND HistoryNo = 1)AS DATE)AS FirstTarget,
				CAST((SELECT MAX(HistoryDate) FROM DueFacToQa WHERE OrderNumber = DFQ.OrderNumber AND HistoryNo != 1)AS DATE)AS LastTarget
		FROM (
		SELECT OrderNumber, HistoryNo FROM DueFacToQa
		WHERE OrderNumber = '${OrderNumber}'  AND Qty > 0
		GROUP BY OrderNumber, HistoryNo)AS DFQ GROUP BY OrderNumber
        `);
        res.json({ message: constants.kResultOk, result: recordset })
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})



router.post("/getProductStatusNew", async (req, res) => {
    const { orderNumber } = req.body
    // console.log(orderNumber);
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        DECLARE @OrderNumber VARCHAR(30) = '${orderNumber}'
        --STEP 1
        SELECT 'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(PM.NewPict,4,200),'\','/') NewPict, PM.ProductID, PM.ProductCode, JobQty, ItemNo, JobNumber,
				ISNULL(QaSpec, '')AS QaSpec
        FROM	OrderDetail OD JOIN ProductMaster PM ON OD.ProductID = PM.ProductID JOIN JobOrder JO ON OD.OrderNumber = JO.OrderNumber AND OD.ItemNo = JO.OrderItemNo
				LEFT JOIN OrderItemInProcessRemarkDes OPR ON OD.OrderNumber = OPR.OrderNumber AND OD.ItemNo = OPR.OrderItemNo
        WHERE   OD.OrderNumber = @OrderNumber

        --STEP 2
        SELECT JP.JobNumber, JP.PDProcessCode, PDProcessName, ISNULL((In_Q + Send_Q + Out_Q), 0)AS TotalInProcess
        FROM	(SELECT	JobNumber, PDProcess.*
                FROM	JobOrder CROSS JOIN 
                        (SELECT	PDProcessCode, PDProcessName
                        FROM	PDProcess
                        WHERE	PDProcessCode NOT IN ('01', '02', '17', '18', '19', '20', '21', '22'))AS PDProcess 
                WHERE	OrderNumber = @OrderNumber)AS JP 
                LEFT JOIN JobStatus JS ON JP.JobNumber = JS.JobNumber AND JP.PDProcessCode = JS.PDProcessCode
        ORDER BY JS.JobNumber, JS.PDProcessCode

        --STEP 3
        SELECT JobNumber, FactDueDate, FinalBill, DATEDIFF(DAY, IIF(IsFinish = 1, FinalBill, GETDATE()), FactDueDate)AS LateDay, IsFinish, TotalReq
        FROM (
        SELECT	JobNumber, FactDueDate, 
                (SELECT MAX(MT_BillMaster.ReceiveDate) FROM MT_BillMaster JOIN MT_BillDetail ON MT_BillMaster.Bill_ID = MT_BillDetail.Bill_ID
                    WHERE MT_BillMaster.OrderNumber = A.OrderNumber AND MT_BillDetail.JobNumber = A.JobNumber)AS FinalBill,
                    IIF(TotalReq > QtyFacReceive, 0, 1)AS IsFinish, TotalReq  
        FROM (
        SELECT	MT_MppStatus.OrderNumber, JO.JobNumber, SUM(MT_MppStatus.Qty * MT_MppStatusProduct.QtyReq)AS TotalReq, SUM(MT_MppStatusProduct.QtyFacReceive)AS QtyFacReceive, MAX(FactDueDate)AS FactDueDate
        FROM	MT_MppStatus JOIN JobOrder JO ON MT_MppStatus.OrderNumber = JO.OrderNumber AND MT_MppStatus.OrderItemNo = JO.OrderItemNo
                JOIN MT_MppStatusProduct ON MT_MppStatus.OrderNumber = MT_MppStatusProduct.OrderNumber AND MT_MppStatus.OrderItemNo = MT_MppStatusProduct.OrderItemNo
                JOIN PurchaseStatus ON MT_MppStatusProduct.OrderNumber = PurchaseStatus.OrderNumber AND MT_MppStatusProduct.InvCode = PurchaseStatus.InvCode
        WHERE	MT_MppStatus.OrderNumber = @OrderNumber AND InvGroupCode IN('02','03','04','05','06')
        GROUP BY MT_MppStatus.OrderNumber, JO.JobNumber)AS A)AS B

        `)
        let data = result.recordsets[0]
        result.recordsets[0].forEach((obj, index) => {
            data[index].PDProcess = result.recordsets[1].filter(({ JobNumber }) => obj.JobNumber === JobNumber).map((objM) => {
                return {
                    PDProcessCode: objM.PDProcessCode,
                    PDProcessName: objM.PDProcessName,
                    TotalInProcess: objM.TotalInProcess
                }
            })
            const InvStatus = result.recordsets[2].filter(({ JobNumber }) => obj.JobNumber === JobNumber).map((objM) => {
                return {
                    FactDueDate: objM.FactDueDate,
                    FinalBill: objM.FinalBill,
                    LateDay: objM.LateDay,
                    IsFinish: objM.IsFinish,
                    TotalReq: objM.TotalReq
                }
            })
            data[index].StatsInv = {
                FactDueDate: InvStatus.length > 0 ? InvStatus[0].FactDueDate : '',
                FinalBill: InvStatus.length > 0 ? InvStatus[0].FinalBill : '',
                LateDay: InvStatus.length > 0 ? InvStatus[0].LateDay : 0,
                IsFinish: InvStatus.length > 0 ? InvStatus[0].IsFinish : 0,
                TotalReq: InvStatus.length > 0 ? InvStatus[0].TotalReq : 0
            }
            data[index].PDProcess.sort((a, b) =>
                a.PDProcessCode > b.PDProcessCode ? 1 : b.PDProcessCode > a.PDProcessCode ? -1 : 0
            );
        })
        // console.log(data)
        res.status(200).json(data)
    } catch (error) {
        res.json({ result: constants.kResultNok })
    }
})

// 
router.post("/getHistoryDueQa", async (req, res) => {
    const { orderNumber } = req.body
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
            SELECT  HistoryNo,CAST(HistoryDate AS DATE)AS HistoryDate, (Employee.EmpFName + ' ( ' + NickName + ' ) ')AS EmpName, 
                    'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EmpPict,4,200),'\','/')AS EmpPict,
					SUBSTRING((SELECT CONVERT(VARCHAR, HistoryDate, 108)),1,5)AS HistoryTime
            FROM (SELECT HistoryNo, MAX(HistoryDate)AS HistoryDate, EmpCode
            FROM DueFacToQa 
            WHERE OrderNumber = '${orderNumber}' AND HistoryNo != 1 AND Qty > 0
            GROUP BY HistoryNo, DueFacToQa.EmpCode)AS A LEFT JOIN Employee ON A.EmpCode = Employee.EmpCode
            Order BY HistoryNo
            `);
        res.status(200).json(recordset);
        await pool.close
    } catch (error) {
        res.status(500).json({ result: "ERROR /getHistoryDueQa " });
    }
});

router.post("/insertOrderDes", async (req, res) => {
    const { orderNumber, PlanDes, QaDes, EmpCode } = req.body
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
            DECLARE @OrderNumber VARCHAR(30) = '${orderNumber}'
            BEGIN
                IF EXISTS (SELECT 1 FROM OrderRemarkDes WHERE OrderNumber = @OrderNumber)
                    BEGIN
                    DELETE ORD FROM OrderRemarkDes ORD WHERE OrderNumber = @OrderNumber
                    END
                INSERT INTO OrderRemarkDes VALUES(@OrderNumber, '${PlanDes}', '${QaDes}', NULL, NULL, '${EmpCode}');
            END
            `);
        res.status(200).json({ result: constants.kResultOk });
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});



router.post("/insertOrderItemDes", async (req, res) => {
    // console.log(req.body)
    const { orderNumber, orderItemNo, QaSpec, EmpCode } = req.body
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
            DECLARE @OrderNumber VARCHAR(30) = '${orderNumber}'
            DECLARE @OrderItemNo INT = ${orderItemNo}
            BEGIN
                IF EXISTS (SELECT 1 FROM OrderItemInProcessRemarkDes WHERE OrderNumber = @OrderNumber AND OrderItemNo = @OrderItemNo)
                    BEGIN
                    DELETE OPR FROM OrderItemInProcessRemarkDes OPR WHERE OrderNumber = @OrderNumber AND OrderItemNo = @OrderItemNo
                    END
                INSERT INTO OrderItemInProcessRemarkDes VALUES (@OrderNumber, @OrderItemNo, '${QaSpec}', '', '${EmpCode}')
            END
            `);
        res.status(200).json({ result: constants.kResultOk });
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/reduceQaCalendar", async (req, res) => {
    // console.log(req.body)
    const { orderNumber } = req.body
    try {
        const pool = await poolPromise;
        const result1 = await pool.request().query(`
            EXEC GetQaCalendar '${orderNumber}'
            `);
        const { recordset } = await pool.request().query(`
        SELECT	DayWip, Dow, 
				ISNULL(ToQa, 0)AS ToQa, ISNULL(FirstTarget.QtyFirstTarget, 0)AS FirstTarget, ISNULL(LastTaget.QtyLastTarget, 0)AS LastTarget
		FROM	QaOrderDayList 
        LEFT JOIN 
            (SELECT CAST(billDate AS DATE)billDate, qaBillMaster.OrderNumber, SUM(Qty)AS ToQa
            FROM qaBillMaster JOIN qaBillDetail ON qaBillMaster.qaBill_ID = qaBillDetail.qaBill_ID
            GROUP BY CAST(billDate AS DATE), qaBillMaster.OrderNumber)AS SumBillQa 
        ON QaOrderDayList.OrderNumber = SumBillQa.OrderNumber AND QaOrderDayList.DayWip = SumBillQa.billDate
        LEFT JOIN (SELECT OrderNumber, DueDate, SUM(Qty)AS QtyFirstTarget
					FROM	DueFacToQa 
					WHERE OrderNumber  = '${orderNumber}' AND HistoryNo = 1
					GROUP BY OrderNumber, DueDate)AS FirstTarget ON QaOrderDayList.OrderNumber = FirstTarget.OrderNumber AND CAST(DayWip AS DATE) = FirstTarget.DueDate
		LEFT JOIN (SELECT	OrderNumber, DueDate, SUM(Qty)AS QtyLastTarget
					FROM	DueFacToQa  AA
					WHERE	OrderNumber  = '${orderNumber}' AND HistoryNo != 1 AND HistoryNo = (SELECT MAX(HistoryNo) FROM DueFacToQa WHERE OrderNumber = AA.OrderNumber)
					GROUP BY OrderNumber, DueDate)AS LastTaget ON QaOrderDayList.OrderNumber = LastTaget.OrderNumber AND CAST(DayWip AS DATE) = LastTaget.DueDate
        WHERE QaOrderDayList.OrderNumber = '${orderNumber}'
		ORDER BY DayWip
            `);

        const resultCountMonth = await pool.request().query(`
            SELECT	    CASE   MONTH(DayWip)     
                        WHEN 1 THEN 'มกราคม'                                  
                        WHEN 2 THEN 'กุมภาพันธ์'                                  
                        WHEN 3 THEN 'มีนาคม'                                  
                        WHEN 4 THEN 'เมษายน'                                  
                        WHEN 5 THEN 'พฤษภาคม'                                  
                        WHEN 6 THEN 'มิถุนายน'                                  
                        WHEN 7 THEN 'กรกฎาคม'                                  
                        WHEN 8 THEN 'สิงหาคม'                                  
                        WHEN 9 THEN 'กันยายน'                                   
                        WHEN 10 THEN 'ตุลาคม'                                  
                        WHEN 11 THEN 'พฤศจิกายน'                                  
                        WHEN 12 THEN 'ธันวาคม'                                 
                        END AS month, COUNT(*)AS count
            FROM	QaOrderDayList
            WHERE OrderNumber = '${orderNumber}'
            GROUP BY OrderNumber, MONTH(DayWip)
            Order BY OrderNumber, MONTH(DayWip)
            `);
        res.status(200).json({ message: constants.kResultOk, result: recordset, headerMonth: resultCountMonth.recordset });
        await pool.close
    } catch (error) {
        res.status(500).json({ message: constants.kResultNok });
    }
});



router.post("/isfinishOrderFact", async (req, res) => {
    // console.log(req.body)
    const { orderNumber, EmpCode } = req.body
    console.log(orderNumber, EmpCode)
    try {
        const pool = await poolPromise;
        await pool.request().query(`
            INSERT INTO OrderFinishForFact VALUES ('${orderNumber}', 1, GETDATE(), '${EmpCode}')
            `);
        res.status(200).json({ message: constants.kResultOk });
        await pool.close
    } catch (error) {
        res.status(500).json({ message: constants.kResultNok });
    }
});
