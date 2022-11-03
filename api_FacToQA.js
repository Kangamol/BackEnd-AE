const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");
const moment = require("moment")

moment.locale("th");
module.exports = router;



router.post("/getStatusMaster", async (req, res) => {
    const { orderFilter, Factory, dateBetween, salesTeam } = req.body
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
			SELECT ${orderFilter === '' ? 'TOP 100' : ''} OrderNumber, CusDueDate, CusDueDateDiff, SalesDueDate, SalesDueDateDiff, ProductionTeam, TotalOrderQty, TotalBillQA, TotalQaFinish, InRepair, CountBill,
					CASE
						WHEN	TotalOrderQty > TotalBillQA THEN 'กำลังผลิต'
						WHEN	TotalOrderQty <= TotalBillQA THEN  'ส่งQAครบ'
					END AS Status
			FROM (
			SELECT	OM.OrderNumber, OM.CusDueDate, OM.CusDueDateDiff, OM.SalesDueDate, OM.SalesDueDateDiff, OM.ProductionTeam, SUM(OD.Qty)AS TotalOrderQty,
                    ISNULL((SELECT SUM(Qty) FROM qaBillDetail WHERE OrderNumber = OM.OrderNumber), 0)AS  TotalBillQA,
                    ISNULL((SELECT	SUM(QFD.Qty) FROM qaFinishMaster QFM JOIN qaFinishDetail QFD ON QFM.qaFinish_ID = QFD.qaFinish_ID WHERE QFM.OrderNumber = OM.OrderNumber), 0)AS TotalQaFinish,
                    ISNULL((SELECT SUM(QRD.Qty) FROM qaRepairMaster QRM JOIN qaRepairDetail QRD ON QRM.qaRepair_ID = QRD.qaRepair_ID WHERE QRM.OrderNumber = OM.OrderNumber AND QRM.qaRepairStatus != '3'), 0)AS InRepair,
					ISNULL((SELECT COUNT(*) FROM qaBillMaster QM WHERE QM.OrderNumber = OM.OrderNumber AND QM.qaBillStatus != '3'), 0 )AS CountBill
            FROM	(SELECT	OM.OrderNumber, DATEDIFF(DAY, CAST(GETDATE() AS DATE), FactoryDue)AS CusDueDateDiff ,FactoryDue AS CusDueDate, CusCode,
                            DATEDIFF(DAY, CAST(GETDATE() AS DATE), DueDate)AS SalesDueDateDiff, DueDate AS SalesDueDate, ProductionTeam
                    FROM	OrderMaster OM 
                    WHERE	YEAR(DueDate) >= YEAR(GETDATE()) AND OM.Status = '2' AND LEFT(OM.OrderNumber,5) != 'CH-M-' AND LEFT(OM.OrderNumber,3) = 'CH-' 
                            AND LEFT(OM.OrderNumber,7) != 'CH-TEST')AS OM
                    JOIN OrderDetail OD ON OD.OrderNumber = OM.OrderNumber JOIN Customer ON Customer.CusCode = OM.CusCode
            WHERE OM.OrderNumber LIKE '%${orderFilter.toUpperCase()}%' AND OM.SalesDueDate BETWEEN '${dateBetween[0]}' AND '${dateBetween[1]}'
                    AND OM.ProductionTeam IN ('${Factory[0]}', '${Factory[1]}', '${Factory[2]}' ,'${Factory[3]}') AND Customer.Status IN (${salesTeam[0] ? salesTeam[0] : 0}, ${salesTeam[1] ? salesTeam[1] : 0} , ${salesTeam[2] ? salesTeam[2] : 0})
            GROUP BY OM.OrderNumber, OM.CusDueDate, OM.CusDueDateDiff, OM.SalesDueDate, OM.SalesDueDateDiff, OM.ProductionTeam, OM.CusCode, Customer.Status)AS A
            ORDER BY SalesDueDateDiff

            --หากำหนดส่ง QA FAC
            SELECT	B.OrderNumber, B.DueDate, B.Qty, 
                    ISNULL((SELECT SUM(Qty) FROM qaBillMaster QM JOIN qaBillDetail QD ON QM.qaBill_ID = QD.qaBill_ID
                            WHERE QM.OrderNumber = B.OrderNumber AND CAST(QM.billDate AS DATE) <= B.DueDate), 0)AS QtyBill,
                    (SELECT SUM(Qty) FROM DueFacToQa WHERE OrderNumber = B.OrderNumber AND CAST(DueDate AS DATE) <= B.DueDate AND HistoryNo = HisNo)AS CurrentQty
            FROM	(SELECT	OrderNumber, MAX(HistoryNo)AS HisNo
                    FROM DueFacToQa GROUP BY OrderNumber)AS A JOIN DueFacToQa AS B ON A.OrderNumber = B.OrderNumber AND A.HisNo = B.HistoryNo
            WHERE	B.Qty > 0
            Order BY B.OrderNumber, B.DueDate
            `);
        // let data = recordsets[0].filter(({ ProductionTeam }) => Factory.includes(ProductionTeam))
        let data = recordsets[0]
        data.forEach((obj, index) => {
            data[index].dueFacToQa = recordsets[1].filter(({ OrderNumber }) => obj.OrderNumber === OrderNumber).map(objMap => {
                return {
                    DueDate: objMap.DueDate,
                    Qty: objMap.Qty,
                    QtyBill: objMap.QtyBill,
                    CurrentQty: objMap.CurrentQty
                }
            }).sort((a, b) =>
                a.DueDate > b.DueDate ? 1 : b.DueDate > a.DueDate ? -1 : 0
            );
        });


        res.status(200).json(data);
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});


router.post("/getStatusDetail", async (req, res) => {
    const { orderNumber } = req.body
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
				SELECT	ROW_NUMBER() OVER (ORDER by ForSort, ItemNo)AS ItemNoForFac, ItemNo, OD.ProductCode, OD.ProductID,(Qty)TotalQty, 'http://192.168.3.5:3000/picture/'+REPLACE(REPLACE(SUBSTRING(NewPict,4,200),'\','/'),'#','%23') NewPict, JobNumber,
						ISNULL((SELECT SUM(Qty) FROM qaBillDetail WHERE qaBillDetail.OrderNumber = OD.OrderNumber AND qaBillDetail.OrderItemNo = OD.ItemNo), 0)TotalQA,
						ISNULL((SELECT SUM(qaFinishDetail.Qty) FROM	qaFinishMaster JOIN qaFinishDetail ON qaFinishMaster.qaFinish_ID = qaFinishDetail.qaFinish_ID
								JOIN qaBillDetail ON qaFinishMaster.qaBill_ID = qaBillDetail.qaBill_ID AND qaFinishDetail.bill_Item = qaBillDetail.bill_Item
								WHERE qaBillDetail.OrderNumber = OD.OrderNumber AND qaBillDetail.OrderItemNo = OD.ItemNo), 0)TotalFinish,
						ISNULL((SELECT SUM(qaRepairDetail.Qty) FROM	qaRepairMaster JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
								LEFT JOIN qaBillDetail ON qaRepairMaster.qaBill_ID = qaBillDetail.qaBill_ID AND qaRepairDetail.bill_Item = qaBillDetail.bill_Item
								WHERE qaBillDetail.OrderNumber = OD.OrderNumber AND qaBillDetail.OrderItemNo = OD.ItemNo AND qaRepairDetail.RepairFinish < qaRepairDetail.Qty), 0)TotalRepair,
						ISNULL((SELECT SUM(qaRepairDetail.Qty) FROM qaRepairMaster JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
                        JOIN qaBillDetail ON qaRepairMaster.qaBill_ID = qaBillDetail.qaBill_ID AND qaRepairDetail.bill_Item = qaBillDetail.bill_Item
						WHERE qaBillDetail.OrderNumber = OD.OrderNumber AND qaBillDetail.OrderItemNo = OD.ItemNo), 0)SumRepair,
						(0)AS Selected, (0)AS SendQty
				FROM	OrderDetail OD LEFT JOIN ProductMaster PM ON OD.ProductID = PM.ProductID
						JOIN JobOrder ON OD.OrderNumber = JobOrder.OrderNumber AND OD.ItemNo = JobOrder.OrderItemNo
				WHERE	OD.OrderNumber = '${orderNumber}'
				ORDER BY ForSort, ItemNo
            `);
        res.status(200).json(recordset);
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});




router.get("/getReasonRepair", async (req, res) => {
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
                SELECT * FROM qaRepairTypeMaster
                SELECT * FROM qaRepairTypeDetail
            `);
        let dataReturn = recordsets[0]
        dataReturn.forEach((obj, index) => {
            obj.reason = recordsets[1].filter(({ type_ID }) => obj.type_ID === type_ID)
        })
        res.status(200).json(dataReturn);
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/gettotalbillreceive", async (req, res) => {
    const { orderNumber } = req.body
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
                    SELECT COUNT(1)AS BillReceive FROM qaBillMaster
                    WHERE OrderNumber = '${orderNumber}' AND  qaBillStatus = ''

                    SELECT COUNT(1)AS BillReceive FROM qaRepairMaster
                    WHERE OrderNumber = '${orderNumber}' AND  qaRepairStatus = ''
            `);
        // res.status(200).json(recordsets[0][0].BillReceive);
        res.status(200).json({ resBillQa: recordsets[0][0].BillReceive, resBillRepair: recordsets[1][0].BillReceive });
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/receivebillFactoqa", async (req, res) => {
    const { qaBill_ID, receiver } = req.body
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
            UPDATE QM SET QM.qaBillStatus = '1', ReceiverNew = '${receiver}', receiveDate = GETDATE()
            FROM qaBillMaster QM
            WHERE QM.qaBill_ID = ${qaBill_ID}
            `);
        res.status(200).json({ result: constants.kResultOk });
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});


router.post("/deleteBillQA", async (req, res) => {
    const { qaBill_ID } = req.body
    // console.log(qaBill_ID)
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
                DECLARE @BillID INT = ${qaBill_ID}
                DELETE qaBillMaster WHERE qaBill_ID = @BillID
                DELETE qaBillDetail WHERE qaBill_ID = @BillID
            `);
        res.status(200).json({ result: constants.kResultOk });
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});


router.post("/insertBillFactoqa", async (req, res) => {
    const { orderNumber, docPrefix, sender, billItem } = req.body
    // console.log(dataBill)
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
            DECLARE @DocPrefix VARCHAR(6) = '${docPrefix}'
            --INSERT MASTER
            INSERT INTO qaBillMaster (qaDocNumber, billDate, OrderNumber, qaBillStatus, SenderNew)
            OUTPUT inserted.qaBill_ID, inserted.qaDocNumber
            VALUES ( (SELECT (@DocPrefix + (ISNULL(RIGHT('0000'+CAST(CAST(RIGHT(MAX(qaDocNumber),5) AS INT)+1 AS VARCHAR),5),'00001')))as maxDoc
                    FROM qaBillMaster WHERE LEFT(qaDocNumber,6) = @DocPrefix),
                    GETDATE(),
                    '${orderNumber}',
                    '',
                    '${sender}'
              );
            `);
        const { qaBill_ID, qaDocNumber } = recordset[0]
        const ItemJobPrefix = `BQ${moment(new Date()).format('YY')}`
        // console.log(qaBill_ID, ItemJobPrefix)
        let count = 0;
        billItem.forEach(async (objItem) => {
            await pool.request().query(`
            DECLARE @ItemJobPrefix VARCHAR(4) = '${ItemJobPrefix}'
            INSERT INTO qaBillDetail (qaBill_ID, bill_Item, OrderNumber, OrderItemNo, ProductID, Qty, QaFinish, ToRepair, qaJobNumber, QCPerson)
            VALUES (${qaBill_ID},
                    ${objItem.bill_item},
                    '${orderNumber}',
                    ${objItem.OrderItemNo},
                    '${objItem.ProductID}',
                    ${objItem.QtySend},
                    0,
                    0,
                    (SELECT (@ItemJobPrefix + (ISNULL(RIGHT('000000'+CAST(CAST(RIGHT(MAX(qaJobNumber),6) AS INT)+1 AS VARCHAR),6),'000001'))) FROM qaBillDetail
                    WHERE LEFT(qaJobNumber, 4) = @ItemJobPrefix),
                    '${objItem.QCPerson}');
        `)
            count++
        });
        let FirstCheckError = true
        let updateSuccess = false
        const checkCount = setInterval(async () => {
            // console.log(count)
            if (count === billItem.length) {
                updateSuccess = true
                res.status(200).json({ result: constants.kResultOk, billNumber: qaDocNumber });
                await pool.close
                clearInterval(checkCount);
            } else {
                if (FirstCheckError) {
                    FirstCheckError = false;
                    // console.log('ทำ')
                    setTimeout(async () => {
                        res.status(500).json({ result: constants.kResultNok, billNumber: qaDocNumber });
                        await pool.close
                        clearInterval(checkCount);
                    }, 5000);
                }
            }
        }, 100);
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/insertqaRepairBill", async (req, res) => {
    const { orderNumber, docPrefix, sender, qaBill_ID, repairItem } = req.body
    try {
        const pool = await poolPromise;
        //INSERT MASTER
        const { recordset } = await pool.request().query(`
            DECLARE @DocPrefix VARCHAR(6) = '${docPrefix}'
            INSERT INTO qaRepairMaster (repairDocNumber, qaBill_ID, repairDate, OrderNumber, qaRepairStatus, SenderNew)
            OUTPUT inserted.qaRepair_ID, inserted.repairDocNumber
            VALUES (
                    (SELECT (@DocPrefix + (ISNULL(RIGHT('0000'+CAST(CAST(RIGHT(MAX(repairDocNumber),5) AS INT)+1 AS VARCHAR),5),'00001')))as maxDoc FROM qaRepairMaster WHERE LEFT(repairDocNumber,6) = @DocPrefix),
                    ${qaBill_ID},
                    GETDATE(),
                    '${orderNumber}',
                    '',
                    '${sender}'
                    );
            `);
        const { qaRepair_ID, repairDocNumber } = recordset[0]
        let countDetail = 0;
        let countReason = 0;
        repairItem.forEach(async (obj) => {
            // console.log(obj)
            //INSERT DETAIL
            await pool.request().query(`
                    INSERT INTO qaRepairDetail (qaRepair_ID, repair_Item, bill_Item, Qty,ToQa, RepairFinish, qaJobNumber)
                    VALUES (
                        ${qaRepair_ID},
                        ${obj.repair_Item},
                        ${obj.bill_Item}, 
                        ${obj.QtySend},
                        0, 
                        0,
                        '${obj.qaJobNumber}'
                    )
            `);
            obj.reason.forEach(async (objReason) => {
                //INSERT REASON
                await pool.request().query(`
                    INSERT INTO qaRepairDetailReason ( qaRepair_ID, repair_Item, reason_No, type_ID, Qty )
                    VALUES (
                        ${qaRepair_ID},
                        ${obj.repair_Item},
                        ${objReason.reason_No},
                        ${objReason.type_ID},
                        ${+objReason.QtySend}
                    );
            `);
                countReason++
            })
            countDetail++
        });
        const lengthDetail = repairItem.length
        const lengthReason = repairItem.map(({ reason }) => reason.length).reduce((pv, cv) => pv + cv, 0)
        let FirstCheckError = true
        let updateSuccess = false
        // console.log(countDetail, countReason, lengthDetail, lengthReason)
        const checkCount = setInterval(async () => {
            // console.log(count)
            if (countDetail === lengthDetail && countReason === lengthReason) {
                updateSuccess = true
                res.status(200).json({ result: constants.kResultOk, billNumber: repairDocNumber });
                await pool.close
                clearInterval(checkCount);
            } else {
                if (FirstCheckError) {
                    FirstCheckError = false;
                    // console.log('ทำ')
                    setTimeout(async () => {
                        res.status(500).json({ result: constants.kResultNok, billNumber: repairDocNumber });
                        await pool.close
                        clearInterval(checkCount);
                    }, 5000);
                }
            }
        }, 100);
        //res.status(200).json({ result: constants.kResultOk, billNumber: repairDocNumber });
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/insertqaFinish", async (req, res) => {
    const { orderNumber, docPrefix, sender, qaBill_ID, finishItem } = req.body
    try {
        const pool = await poolPromise;
        //INSERT MASTER
        const { recordset } = await pool.request().query(`
            DECLARE @DocPrefix VARCHAR(6) = '${docPrefix}'
            INSERT INTO qaFinishMaster ( finishDocNumber, qaBill_ID, finishDate, OrderNumber, qaFinishStatus, SenderNew )
            OUTPUT inserted.qaFinish_ID, inserted.finishDocNumber
            VALUES (
                    (SELECT (@DocPrefix + (ISNULL(RIGHT('0000'+CAST(CAST(RIGHT(MAX(finishDocNumber),5) AS INT)+1 AS VARCHAR),5),'00001')))as maxDoc FROM qaFinishMaster WHERE LEFT(finishDocNumber,6) = @DocPrefix),
                    ${qaBill_ID},
                    GETDATE(),
                    '${orderNumber}',
                    '',
                    '${sender}'
            );
            `);
        const { qaFinish_ID, finishDocNumber } = recordset[0]
        let countDetail = 0;
        finishItem.forEach(async (obj) => {
            // console.log(obj)
            // INSERT DETAIL
            await pool.request().query(`
                INSERT INTO qaFinishDetail ( qaFinish_ID, finish_Item, bill_Item, Qty, ExportQty, qaJobNumber, QAPerson )
                VALUES ( 
                        ${qaFinish_ID},
                        ${obj.finish_Item},
                        ${obj.bill_Item},
                        ${obj.QtySend},
                        0,
                        '${obj.qaJobNumber}',
                        '${obj.QAPerson}'
                );
            `);
            countDetail++
        });
        // let FirstCheckError = true
        // let updateSuccess = false
        // // console.log(countDetail, countReason, lengthDetail, lengthReason)
        // const checkCount = setInterval(async () => {
        //     // console.log(count)
        //     if (countDetail === lengthDetail && countReason === lengthReason) {
        //         updateSuccess = true
        //         res.status(200).json({ result: constants.kResultOk, billNumber: repairDocNumber });
        //         await pool.close
        //         clearInterval(checkCount);
        //     } else {
        //         if (FirstCheckError) {
        //             FirstCheckError = false;
        //             // console.log('ทำ')
        //             setTimeout(async () => {
        //                 res.status(500).json({ result: constants.kResultNok, billNumber: repairDocNumber });
        //                 await pool.close
        //                 clearInterval(checkCount);
        //             }, 5000);
        //         }
        //     }
        // }, 100);
        res.status(200).json({ result: constants.kResultOk, billNumber: finishDocNumber });
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});


router.post("/getBillQa", async (req, res) => {
    const { filterOrder, ProductionTeam, billDate, statusBill, salesTeam } = req.body
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
            	DECLARE @tableForFilter TABLE( qaBill_ID INT)
				INSERT INTO @tableForFilter
				SELECT ${filterOrder === '' ? 'TOP 100' : ''} qaBill_ID FROM qaBillMaster QM JOIN OrderMaster OM on QM.OrderNumber = OM.OrderNumber JOIN Customer on OM.CusCode = Customer.CusCode 
				WHERE YEAR(DueDate) >= YEAR(GETDATE()) AND OM.Status = '2' AND LEFT(OM.OrderNumber,5) != 'CH-M-' AND LEFT(OM.OrderNumber,3) = 'CH-' 
                            AND LEFT(OM.OrderNumber,7) != 'CH-TEST' AND Customer.Status IN (${salesTeam[0] ? salesTeam[0] : 0}, ${salesTeam[1] ? salesTeam[1] : 0} , ${salesTeam[2] ? salesTeam[2] : 0})
							AND QM.OrderNumber LIKE '%${filterOrder.toUpperCase()}%' AND ProductionTeam IN ('${ProductionTeam[0] ? ProductionTeam[0] : ''}', 
                        '${ProductionTeam[1] ? ProductionTeam[1] : ''}', 
                        '${ProductionTeam[2] ? ProductionTeam[2] : ''}', 
                        '${ProductionTeam[3] ? ProductionTeam[3] : ''}') AND CAST(billDate AS DATE) BETWEEN '${billDate[0]}' AND '${billDate[1]}' 
                        AND qaBillStatus IN ('${statusBill[0]}', '${statusBill[1]}', '${statusBill[2]}')
                ORDER BY QM.qaBillStatus
			--MASTER
				SELECT * FROM (
				SELECT	QM.qaBill_ID, QM.qaDocNumber, DATEADD(HH, -7, billDate)AS billDate, QM.OrderNumber, (Customer.Status) AS saleManager,  DATEADD(HH, -7, receiveDate)AS receiveDate, SenderNew AS senderCode,
						ISNULL((SELECT SUM(Qty) FROM qaBillDetail WHERE qaBill_ID = QM.qaBill_ID),0) TotalQty,
						ISNULL((SELECT SUM(Qty) FROM qaFinishMaster JOIN qaFinishDetail ON qaFinishMaster.qaFinish_ID = qaFinishDetail.qaFinish_ID
								WHERE qaFinishMaster.qaBill_ID = QM.qaBill_ID),0)AS TotalFinishQty,
						ISNULL((SELECT SUM(Qty) 
                                FROM	qaRepairMaster JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID 
                                WHERE	qaBill_ID = QM.qaBill_ID AND qaRepairMaster.qaRepairStatus <> ''),0)AS TotalRepairQty,
                        ISNULL((SELECT SUM(RepairFinish) 
                                FROM	qaRepairMaster JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID 
                                WHERE	qaBill_ID = QM.qaBill_ID AND qaRepairMaster.qaRepairStatus <> ''),0)AS TotalRepairFinish,
						(SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QM.SenderNew)AS Sender,
						(SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QM.ReceiverNew)AS Receiver,
						ProductionTeam,(DATEDIFF(DAY, DueDate, GETDATE()) * -1)AS LateDueDate, QM.qaBillStatus, (FactoryDue)AS CusDueDate, (DATEDIFF(DAY, FactoryDue, GETDATE()) * -1)AS LateCusDate
				FROM	qaBillMaster QM 
                        JOIN OrderMaster OM on QM.OrderNumber = OM.OrderNumber
						LEFT JOIN Customer on OM.CusCode = Customer.CusCode
				WHERE	qaBill_ID IN (SELECT qaBill_ID FROM @tableForFilter))AS A
                WHERE	TotalQty > TotalFinishQty 
                ORDER BY qaBillStatus, billDate
 
            --DETAIL
                SELECT	QD.qaBill_ID, OD.ProductCode, QD.bill_Item, QD.OrderItemNo, QAPerson, qaJobNumber,
                    (SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QCPerson)AS QCPerson,
                    'http://192.168.3.5:3000/picture/'+REPLACE(REPLACE(SUBSTRING(NewPict,4,200),'\','/'),'#','%23') NewPict, (QD.Qty)AS QtyItem,
                    (NULL) AS SelectQaFinish, (NULL) AS SelectToRepair, (NULL) AS reason,
                    ISNULL((SELECT SUM(Qty) from qaRepairMaster 
                            JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
                            WHERE qaRepairMaster.qaBill_ID = QD.qaBill_ID AND qaRepairDetail.bill_Item = QD.bill_Item
                            AND qaRepairMaster.qaRepairStatus != ''),0)AS QtyInRepair,
                    ISNULL((SELECT SUM(RepairFinish) FROM qaRepairMaster 
                            JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
                            where qaRepairMaster.qaBill_ID = QD.qaBill_ID AND qaRepairDetail.bill_Item = QD.bill_Item
                            AND qaRepairMaster.qaRepairStatus != ''),0) QtyRepairFinish,
                    ISNULL((SELECT SUM(Qty) from qaRepairMaster 
                            JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
                            WHERE qaRepairMaster.qaBill_ID = QD.qaBill_ID AND qaRepairDetail.bill_Item = QD.bill_Item
                            AND qaRepairMaster.qaRepairStatus = ' '),0) QtyRepairWaitReceive,
                    ISNULL((SELECT SUM(Qty) FROM qaFinishMaster 
                            JOIN qaFinishDetail ON qaFinishMaster.qaFinish_ID = qaFinishDetail.qaFinish_ID
                            WHERE qaFinishMaster.qaBill_ID = QD.qaBill_ID AND qaFinishDetail.bill_Item = QD.bill_Item),0)AS QtyQAPass
                    FROM		qaBillDetail QD  INNER JOIN ProductMaster ON QD.ProductID = ProductMaster.ProductID   LEFT JOIN
                                OrderDetail OD ON QD.OrderNumber = OD.OrderNumber AND QD.OrderItemNo = OD.ItemNo
                    WHERE	qaBill_ID IN (SELECT qaBill_ID FROM @tableForFilter)




 

            `);
        let dataReturn = recordsets[0]
        const cols = 6
        dataReturn.forEach((obj, index) => {
            dataReturn[index].ItemBill = recordsets[1].filter(({ qaBill_ID }) => obj.qaBill_ID === qaBill_ID)
            // const dataItem = recordsets[1].filter(({ qaBill_ID }) => obj.qaBill_ID === qaBill_ID).sort((a, b) =>
            //     a.bill_Item > b.bill_Item ? 1 : b.bill_Item > a.bill_Item ? -1 : 0
            // );
            // const countRows = Math.ceil(dataReturn[index].ItemBill.length / cols)
            // let dataRow = [];
            // for (let i = 0; i < countRows; i++) {
            //     // INSERT TITLE LEFT
            //     dataRow.push([
            //         {
            //             OrderItemNo: 0,
            //             ProductCode: "ProductCode",
            //             TotalQty: "จำนวนเต็ม",
            //         },
            //     ]);
            // }
            // dataReturn[index].ItemBill.forEach((objItem, indexItem) => {
            //     const indexForInsertArray = Math.ceil((indexItem + 1) / cols) - 1;
            //     // console.log("count", indexForInsertArray);
            //     dataRow[indexForInsertArray].push({
            //         OrderItemNo: objItem.OrderItemNo,
            //         ProductCode: objItem.ProductCode,
            //         TotalQty: objItem.QtyItem,
            //         NewPict: objItem.NewPict,
            //     });
            // })
            // dataReturn[index].ItemBillMaster = dataRow
        })
        res.status(200).json(dataReturn);
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/getqaBillByJob", async (req, res) => {
    const { qaJobNumber, isJob } = req.body
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
				DECLARE @qaJobNumber VARCHAR(15) = '${qaJobNumber}' 
				DECLARE @isJob INT = ${isJob} 
                DECLARE @BillID INT
				IF(@isJob = 1)
				BEGIN
				SET @BillID = (SELECT TOP 1 qaBill_ID FROM qaBillDetail WHERE qaJobNumber = @qaJobNumber)
				END
				IF(@isJob = 2)
				BEGIN
					SET @BillID = (SELECT TOP 1 qaBill_ID FROM qaBillMaster WHERE qaDocNumber = @qaJobNumber)
				END
				SELECT * FROM (
				SELECT	QM.qaBill_ID, QM.qaDocNumber,  DATEADD(HH, -7, billDate)AS billDate, QM.OrderNumber, (Customer.Status) AS saleManager,  DATEADD(HH, -7, receiveDate)AS receiveDate,
						ISNULL((SELECT SUM(Qty) FROM qaBillDetail WHERE qaBill_ID = QM.qaBill_ID),0) TotalQty,
						ISNULL((SELECT SUM(Qty) FROM qaFinishMaster JOIN qaFinishDetail ON qaFinishMaster.qaFinish_ID = qaFinishDetail.qaFinish_ID
								WHERE qaFinishMaster.qaBill_ID = QM.qaBill_ID),0)AS TotalFinishQty,
						ISNULL((SELECT SUM(Qty) 
                                FROM	qaRepairMaster JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID 
                                WHERE	qaBill_ID = QM.qaBill_ID AND qaRepairMaster.qaRepairStatus <> ''),0)AS TotalRepairQty,
                        ISNULL((SELECT SUM(RepairFinish) 
                                FROM	qaRepairMaster JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID 
                                WHERE	qaBill_ID = QM.qaBill_ID AND qaRepairMaster.qaRepairStatus <> ''),0)AS TotalRepairFinish,
						(SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QM.SenderNew)AS Sender,
						(SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QM.ReceiverNew)AS Receiver,
						ProductionTeam,(DATEDIFF(DAY, DueDate, GETDATE()) * -1)AS LateDueDate, QM.qaBillStatus, (FactoryDue)AS CusDueDate, (DATEDIFF(DAY, FactoryDue, GETDATE()) * -1)AS LateCusDate
				FROM	qaBillMaster QM 
                        JOIN OrderMaster OM on QM.OrderNumber = OM.OrderNumber
						LEFT JOIN Customer on OM.CusCode = Customer.CusCode
				WHERE	QM.qaBill_ID = @BillID)AS A
 
            --DETAIL
                SELECT	QD.qaBill_ID, OD.ProductCode, QD.bill_Item, QD.OrderItemNo, QAPerson, qaJobNumber,
                    (SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QCPerson)AS QCPerson,
                    'http://192.168.3.5:3000/picture/'+REPLACE(REPLACE(SUBSTRING(NewPict,4,200),'\','/'),'#','%23') NewPict, (QD.Qty)AS QtyItem,
                    (NULL) AS SelectQaFinish, (NULL) AS SelectToRepair, (NULL) AS reason,
                    ISNULL((SELECT SUM(Qty) from qaRepairMaster 
                            JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
                            WHERE qaRepairMaster.qaBill_ID = QD.qaBill_ID AND qaRepairDetail.bill_Item = QD.bill_Item
                            AND qaRepairMaster.qaRepairStatus <> ' '),0)AS QtyInRepair,
                    ISNULL((SELECT SUM(RepairFinish) FROM qaRepairMaster 
                            JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
                            where qaRepairMaster.qaBill_ID = QD.qaBill_ID AND qaRepairDetail.bill_Item = QD.bill_Item
                            AND qaRepairMaster.qaRepairStatus <> ' '),0) QtyRepairFinish,
                    ISNULL((SELECT SUM(Qty) from qaRepairMaster 
                            JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
                            WHERE qaRepairMaster.qaBill_ID = QD.qaBill_ID AND qaRepairDetail.bill_Item = QD.bill_Item
                            AND qaRepairMaster.qaRepairStatus = ' '),0) QtyRepairWaitReceive,
                    ISNULL((SELECT SUM(Qty) FROM qaFinishMaster 
                            JOIN qaFinishDetail ON qaFinishMaster.qaFinish_ID = qaFinishDetail.qaFinish_ID
                            WHERE qaFinishMaster.qaBill_ID = QD.qaBill_ID AND qaFinishDetail.bill_Item = QD.bill_Item),0)AS QtyQAPass,
							IIF( qaJobNumber = @qaJobNumber, 1, 0 )AS FocusItem
                    FROM	    qaBillDetail QD INNER JOIN
                                ProductMaster ON QD.ProductID = ProductMaster.ProductID   LEFT JOIN
                                OrderDetail OD ON QD.OrderNumber = OD.OrderNumber AND QD.OrderItemNo = OD.ItemNo
                    WHERE	QD.qaBill_ID = @BillID

            `);
        let dataReturn = recordsets[0]
        const cols = 6
        dataReturn.forEach((obj, index) => {
            dataReturn[index].ItemBill = recordsets[1].filter(({ qaBill_ID }) => obj.qaBill_ID === qaBill_ID)
        })
        res.status(200).json({ result: constants.kResultOk, data: dataReturn[0] });
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/getOrderStatusByJob", async (req, res) => {
    const { JobNumber, isJob } = req.body
    // console.log(JobNumber, isJob)
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
			DECLARE @isCheckJob INT = ${isJob}
			DECLARE @JobNB VARCHAR(10) = '${JobNumber}'
			DECLARE @OrderNumber VARCHAR(30) = IIF( @isCheckJob = 1, (SELECT TOP 1 OrderNumber FROM JobOrder WHERE JobNumber = @JobNB), (SELECT TOP 1 OrderNumber FROM qaBillDetail WHERE qaJobNumber = @JobNB))
			SELECT	OM.OrderNumber, OM.CusDueDate, OM.CusDueDateDiff, OM.SalesDueDate, OM.SalesDueDateDiff, OM.ProductionTeam, SUM(OD.Qty)AS TotalOrderQty,
                    ISNULL((SELECT SUM(Qty) FROM qaBillDetail WHERE OrderNumber = OM.OrderNumber), 0)AS  TotalBillQA,
                    ISNULL((SELECT	SUM(QFD.Qty) FROM qaFinishMaster QFM JOIN qaFinishDetail QFD ON QFM.qaFinish_ID = QFD.qaFinish_ID WHERE QFM.OrderNumber = OM.OrderNumber), 0)AS TotalQaFinish,
                    ISNULL((SELECT SUM(QRD.Qty) FROM qaRepairMaster QRM JOIN qaRepairDetail QRD ON QRM.qaRepair_ID = QRD.qaRepair_ID WHERE QRM.OrderNumber = OM.OrderNumber AND QRM.qaRepairStatus != '3'), 0)AS InRepair,
					ISNULL((SELECT COUNT(*) FROM qaBillMaster QM WHERE QM.OrderNumber = OM.OrderNumber AND QM.qaBillStatus != '3'), 0 )AS CountBill
            FROM	(SELECT	OM.OrderNumber, DATEDIFF(DAY, CAST(GETDATE() AS DATE), FactoryDue)AS CusDueDateDiff ,FactoryDue AS CusDueDate, CusCode,
                            DATEDIFF(DAY, CAST(GETDATE() AS DATE), DueDate)AS SalesDueDateDiff, DueDate AS SalesDueDate, ProductionTeam
                    FROM	OrderMaster OM 
                    WHERE OM.OrderNumber = @OrderNumber)AS OM
                    JOIN OrderDetail OD ON OD.OrderNumber = OM.OrderNumber JOIN Customer ON Customer.CusCode = OM.CusCode
            GROUP BY OM.OrderNumber, OM.CusDueDate, OM.CusDueDateDiff, OM.SalesDueDate, OM.SalesDueDateDiff, OM.ProductionTeam, OM.CusCode, Customer.Status
            ORDER BY CusDueDateDiff DESC, SalesDueDateDiff

			--หากำหนดส่ง QA FAC
            SELECT	B.OrderNumber, B.DueDate, B.Qty, 
                    ISNULL((SELECT SUM(Qty) FROM qaBillMaster QM JOIN qaBillDetail QD ON QM.qaBill_ID = QD.qaBill_ID
                            WHERE QM.OrderNumber = B.OrderNumber AND CAST(QM.billDate AS DATE) <= B.DueDate), 0)AS QtyBill,
                    (SELECT SUM(Qty) FROM DueFacToQa WHERE OrderNumber = B.OrderNumber AND CAST(DueDate AS DATE) <= B.DueDate AND HistoryNo = HisNo)AS CurrentQty
            FROM	(SELECT	OrderNumber, MAX(HistoryNo)AS HisNo
                    FROM DueFacToQa GROUP BY OrderNumber)AS A JOIN DueFacToQa AS B ON A.OrderNumber = B.OrderNumber AND A.HisNo = B.HistoryNo
            WHERE	B.Qty > 0 AND B.OrderNumber = @OrderNumber
            Order BY B.OrderNumber, B.DueDate
            `);
        let data = recordsets[0][0]
        data.dueFacToQa = recordsets[1].filter(({ OrderNumber }) => data.OrderNumber === OrderNumber).map(objMap => {
            return {
                DueDate: objMap.DueDate,
                Qty: objMap.Qty,
                QtyBill: objMap.QtyBill,
                CurrentQty: objMap.CurrentQty
            }
        }).sort((a, b) =>
            a.DueDate > b.DueDate ? 1 : b.DueDate > a.DueDate ? -1 : 0
        );
        // console.log(data)

        res.status(200).json({ result: recordsets[0].length > 0 ? constants.kResultOk : constants.kResultNok, data: data });
        await pool.close
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

// GET-BILLREPAIR-BYJOB
router.post("/getBillRepairbyJob", async (req, res) => {
    const { DocPrefix, isJob } = req.body;
    // console.log(req.body);
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
        DECLARE @DocPrefix VARCHAR(15) = '${DocPrefix}' 
        DECLARE @isJob INT = ${isJob}
        DECLARE @table TABLE (qaRepair_ID INT)

        IF ( @isJob = 1 )
        BEGIN 
            INSERT INTO @table
            SELECT qaRepair_ID FROM qaRepairMaster 
            WHERE qaBill_ID = (SELECT TOP 1 qaBill_ID FROM qaBillDetail WHERE qaJobNumber = @DocPrefix)
        END
        IF ( @isJob = 2 )
        BEGIN 
            INSERT INTO @table
            SELECT qaRepair_ID FROM qaRepairMaster 
            WHERE qaBill_ID IN (SELECT qaBill_ID FROM qaBillMaster WHERE qaDocNumber = @DocPrefix)
        END
        IF ( @isJob = 3 )
        BEGIN 
            INSERT INTO @table
            SELECT qaRepair_ID FROM qaRepairMaster WHERE repairDocNumber = @DocPrefix
        END
        --MASTER
        SELECT * FROM  (SELECT	qaRepairMaster.qaRepair_ID, qaRepairMaster.repairDocNumber, qaBillMaster.qaDocNumber, OrderMaster.ProductionTeam, qaRepairMaster.OrderNumber, 
                        qaRepairMaster.ReceiverNew, qaRepairMaster.SenderNew,  DATEADD(HH, -7,  qaRepairMaster.receiveDate)AS receiveDate, 
                        (SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = qaRepairMaster.SenderNew)AS Sender,
                        (SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = qaRepairMaster.ReceiverNew)AS Receiver, 
                                qaRepairStatus, DATEADD(HH, -7,  qaRepairMaster.repairDate)AS repairDate,
                        CASE	
                                WHEN qaRepairStatus = '' THEN 'รอยืนยันรับ'
                                WHEN qaRepairStatus = '1' THEN 'กำลังซ่อม'
                                WHEN qaRepairStatus = '2' THEN 'ส่งซ่อมกลับ'
                                WHEN qaRepairStatus = '3' THEN 'ครบแล้ว'
                                ELSE 'ไม่มีข้อมูล'
                                END statusShow,
                        (SELECT SUM(Qty) FROM qaRepairDetail WHERE qaRepairDetail.qaRepair_ID = qaRepairMaster.qaRepair_ID)AS TotalQty,
                        (SELECT SUM(RepairFinish) FROM qaRepairDetail WHERE qaRepairDetail.qaRepair_ID = qaRepairMaster.qaRepair_ID)AS TotalFinishQty,
                        (SELECT SUM(ToQa) FROM qaRepairDetail WHERE qaRepairDetail.qaRepair_ID = qaRepairMaster.qaRepair_ID)AS ToQa,
                        (Customer.Status)AS cusStatus                               
                        FROM	qaRepairMaster                            
                                LEFT JOIN qaBillMaster ON qaRepairMaster.qaBill_ID = qaBillMaster.qaBill_ID                            
                                LEFT JOIN OrderMaster ON OrderMaster.OrderNumber = qaRepairMaster.OrderNumber                            
                                LEFT JOIN Customer ON OrderMaster.CusCode = Customer.CusCode)AS A
        WHERE	qaRepair_ID IN (SELECT qaRepair_ID FROM @table)
        ORDER BY qaRepairStatus, repairDate 

        --DETAIL
        SELECT	qaRepairMaster.qaRepair_ID, qaRepairDetail.qaJobNumber, OrderDetail.ProductCode, repair_Item, qaRepairDetail.Qty, ToQa, RepairFinish, (0)AS sentRepair,
                'http://192.168.3.5:3000/picture/'+REPLACE(REPLACE(SUBSTRING(NewPict,4,200),'\','/'),'#','%23') NewPict
        FROM	qaRepairMaster join qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
                join qaBillDetail ON qaRepairMaster.qaBill_ID = qaBillDetail.qaBill_ID and qaRepairDetail.bill_Item = qaBillDetail.bill_Item
                join OrderDetail ON qaBillDetail.OrderNumber = OrderDetail.OrderNumber and qaBillDetail.OrderItemNo = OrderDetail.ItemNo
                LEFT JOIN ProductMaster ON OrderDetail.ProductID = ProductMaster.ProductID
        WHERE	qaRepairMaster.qaRepair_ID IN (SELECT qaRepair_ID FROM @table)

        --DETAIL REASON
        SELECT	qaRepair_ID, repair_Item, repairType, reasonType, Qty
        FROM	qaRepairDetailReason QRR JOIN qaRepairTypeMaster QTM ON QRR.type_ID = QTM.type_ID 
                LEFT JOIN qaRepairTypeDetail QTD ON QRR.type_ID = QTD.type_ID AND QRR.reason_No = QTD.reason_No
        WHERE qaRepair_ID IN (SELECT qaRepair_ID FROM @table)
            `);

        let dataReturn = recordsets[0];
        dataReturn.forEach((obj, index) => {
            obj.ItemBill = recordsets[1].filter(
                ({ qaRepair_ID }) => obj.qaRepair_ID === qaRepair_ID
            );
            obj.ItemBill.forEach((objItem) => {
                objItem.reason = recordsets[2].filter(({ qaRepair_ID, repair_Item }) => obj.qaRepair_ID === qaRepair_ID && objItem.repair_Item === repair_Item)
            })
        });

        res.status(200).json(dataReturn);
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

// GET-BILLREPAIR-FORFAC +++
router.post("/getBillRepairForFac", async (req, res) => {
    const { orderFilter, salesTeam, ProductionTeam, billDate } = req.body;
    // console.log(req.body);
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
	DECLARE @tableFilter TABLE (qaRepair_ID INT) 
	INSERT INTO @tableFilter 
	SELECT ${orderFilter === '' ? 'TOP 100' : ''} qaRepair_ID FROM (
	SELECT	qaRepairMaster.qaRepair_ID, SUM(qaRepairDetail.RepairFinish)AS RepairFinish, SUM(qaRepairDetail.Qty)AS Qty, qaRepairStatus, repairDate
	FROM	qaRepairMaster JOIN OrderMaster ON OrderMaster.OrderNumber = qaRepairMaster.OrderNumber JOIN Customer ON OrderMaster.CusCode = Customer.CusCode
			JOIN qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID				
	WHERE	YEAR(DueDate) >= YEAR(GETDATE()) AND OrderMaster.Status = '2' AND LEFT(OrderMaster.OrderNumber,5) != 'CH-M-' AND LEFT(OrderMaster.OrderNumber,3) = 'CH-' 
								AND LEFT(OrderMaster.OrderNumber,7) != 'CH-TEST'
								AND qaRepairMaster.OrderNumber LIKE '%${orderFilter.toUpperCase()}%' AND ProductionTeam IN ('${ProductionTeam[0]}', '${ProductionTeam[1]}', '${ProductionTeam[2]}', '${ProductionTeam[3]}')
								AND (repairDate BETWEEN '${billDate[0]}' AND '${billDate[1]}' OR qaRepairStatus IN ('',  '2'))
                                AND Customer.Status IN (${salesTeam[0] ? salesTeam[0] : 0}, ${salesTeam[1] ? salesTeam[1] : 0} , ${salesTeam[2] ? salesTeam[2] : 0})
	GROUP BY qaRepairMaster.qaRepair_ID, qaRepairStatus, repairDate)AS A
	WHERE RepairFinish < Qty
	ORDER BY 
		CASE 
			WHEN qaRepairStatus = ''  THEN 1
			WHEN qaRepairStatus = '2' THEN 2
		ELSE 3 END, repairDate  

    --MASTER
	SELECT * FROM  (SELECT	qaRepairMaster.qaRepair_ID, qaRepairMaster.repairDocNumber, qaBillMaster.qaDocNumber, OrderMaster.ProductionTeam, qaRepairMaster.OrderNumber, 
					qaRepairMaster.ReceiverNew, qaRepairMaster.SenderNew,  DATEADD(HH, -7, qaRepairMaster.receiveDate)AS receiveDate, 
					(SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = qaRepairMaster.SenderNew)AS Sender,
					(SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = qaRepairMaster.ReceiverNew)AS Receiver, 
							qaRepairStatus, DATEADD(HH, -7, repairDate)AS repairDate ,
					CASE	
							WHEN qaRepairStatus = '' THEN 'รอยืนยันรับ'
							WHEN qaRepairStatus = '1' THEN 'กำลังซ่อม'
							WHEN qaRepairStatus = '2' THEN 'ส่งซ่อมกลับ'
							WHEN qaRepairStatus = '3' THEN 'ครบแล้ว'
							ELSE 'ไม่มีข้อมูล'
							END statusShow,
					(SELECT SUM(Qty) FROM qaRepairDetail WHERE qaRepairDetail.qaRepair_ID = qaRepairMaster.qaRepair_ID)AS TotalQty,
					(SELECT SUM(RepairFinish) FROM qaRepairDetail WHERE qaRepairDetail.qaRepair_ID = qaRepairMaster.qaRepair_ID)AS TotalFinishQty,
					(SELECT SUM(ToQa) FROM qaRepairDetail WHERE qaRepairDetail.qaRepair_ID = qaRepairMaster.qaRepair_ID)AS ToQa,
					(Customer.Status)AS cusStatus                               
					FROM	qaRepairMaster                            
							LEFT JOIN qaBillMaster ON qaRepairMaster.qaBill_ID = qaBillMaster.qaBill_ID                            
							LEFT JOIN OrderMaster ON OrderMaster.OrderNumber = qaRepairMaster.OrderNumber                            
							LEFT JOIN Customer ON OrderMaster.CusCode = Customer.CusCode
					WHERE qaRepairMaster.qaRepair_ID IN (SELECT qaRepair_ID FROM @tableFilter))AS A
    ORDER BY CASE 
		WHEN qaRepairStatus = ''  THEN 1
		WHEN qaRepairStatus = '2' THEN 2
		ELSE 3 
		END, repairDate  

	--DETAIL
	SELECT	qaRepairMaster.qaRepair_ID, qaRepairDetail.qaJobNumber, OrderDetail.ProductCode, repair_Item, qaRepairDetail.Qty, ToQa, RepairFinish, (0)AS sentRepair,
			(SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode =  qaBillDetail.QCPerson)AS QCPerson,
            'http://192.168.3.5:3000/picture/'+REPLACE(REPLACE(SUBSTRING(NewPict,4,200),'\','/'),'#','%23') NewPict
    FROM	qaRepairMaster join qaRepairDetail ON qaRepairMaster.qaRepair_ID = qaRepairDetail.qaRepair_ID
            join qaBillDetail ON qaRepairMaster.qaBill_ID = qaBillDetail.qaBill_ID and qaRepairDetail.bill_Item = qaBillDetail.bill_Item
            join OrderDetail ON qaBillDetail.OrderNumber = OrderDetail.OrderNumber and qaBillDetail.OrderItemNo = OrderDetail.ItemNo
            LEFT JOIN ProductMaster ON OrderDetail.ProductID = ProductMaster.ProductID
	WHERE	qaRepairMaster.qaRepair_ID IN (SELECT qaRepair_ID FROM @tableFilter)


	--DETAIL REASON
	SELECT	qaRepair_ID, repair_Item, repairType, reasonType, Qty
	FROM	qaRepairDetailReason QRR JOIN qaRepairTypeMaster QTM ON QRR.type_ID = QTM.type_ID 
			LEFT JOIN qaRepairTypeDetail QTD ON QRR.type_ID = QTD.type_ID AND QRR.reason_No = QTD.reason_No
	WHERE	qaRepair_ID IN (SELECT qaRepair_ID FROM @tableFilter)
            `);
        let dataReturn = recordsets[0];
        dataReturn.forEach((obj, index) => {
            obj.ItemBill = recordsets[1].filter(
                ({ qaRepair_ID }) => obj.qaRepair_ID === qaRepair_ID
            );
            obj.ItemBill.forEach((objItem) => {
                objItem.reason = recordsets[2].filter(({ qaRepair_ID, repair_Item }) => obj.qaRepair_ID === qaRepair_ID && objItem.repair_Item === repair_Item)
            })
        });

        res.status(200).json(dataReturn);
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

// Update Bill Repair
router.post("/updateBillRepair", async (req, res) => {
    const ItemBill = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
              UPDATE qaRepairMaster
              SET qaRepairStatus = '2'
              WHERE qaRepair_ID = ${ItemBill[0].qaRepair_ID}
          `);
        ItemBill.forEach(async (data, index) => {
            if (data.sentRepair > 0) {
                // console.log(data);
                const result = await pool.request().query(`
            UPDATE qaRepairDetail
            SET ToQa = ToQa + ${data.sentRepair}
            WHERE qaRepair_ID = ${data.qaRepair_ID} AND repair_Item = ${data.repair_Item}
            `);
            }
        });
        res.status(200).json({ result: constants.kResultOk });
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

// GET-BILLREPAIR-FORFAC
router.post("/getReasonRepair", async (req, res) => {
    const { qaRepair_ID, repair_Item } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      SELECT *
      FROM qaRepairDetailReason
      JOIN qaRepairTypeDetail ON qaRepairDetailReason.type_ID = qaRepairTypeDetail.type_ID AND qaRepairDetailReason.reason_No = qaRepairTypeDetail.reason_No
      WHERE qaRepair_ID = ${qaRepair_ID} AND repair_Item = ${repair_Item}
    `);
        res.status(200).json(result.recordset);
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/receiveBillRepair", async (req, res) => {
    const { qaRepair_ID, empCode } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      UPDATE qaRepairMaster
      SET qaRepairStatus = '1' , ReceiverNew = '${empCode}', receiveDate = GETDATE()
      WHERE qaRepair_ID = ${qaRepair_ID}
    `);
        res.json({ result: constants.kResultOk });
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/qaReceiveBillReapair", async (req, res) => {
    const { ItemBill } = req.body;

    try {
        ItemBill.forEach(async (data) => {
            if (data.ToQa > 0) {
                const pool = await poolPromise;
                await pool.request().query(`
            DECLARE @billRepairID INT = ${data.qaRepair_ID}
            DECLARE @itemRepair INT = ${data.repair_Item}
    	      BEGIN
                  BEGIN
                    UPDATE RD SET RepairFinish = RepairFinish + ToQa, ToQa = 0
                    FROM qaRepairDetail RD WHERE RD.qaRepair_ID = @billRepairID AND repair_Item = @itemRepair
                  END

                  IF ( (SELECT IIF(SUM(Qty) = SUM(RepairFinish), 1, 0) AS IsFinish  FROM qaRepairMaster RM JOIN qaRepairDetail RD ON RM.qaRepair_ID = RD.qaRepair_ID WHERE RD.qaRepair_ID = @billRepairID) = 1 )
                  BEGIN
                    UPDATE RM SET qaRepairStatus = '3'
                    FROM qaRepairMaster RM WHERE RM.qaRepair_ID = @billRepairID
                  END
                  ELSE
                  BEGIN
                    UPDATE RM SET qaRepairStatus = '1'
                    FROM qaRepairMaster RM WHERE RM.qaRepair_ID = @billRepairID
                  END
                END
      `);
            }
        });
        res.status(200).json({ result: constants.kResultOk });
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

// ยกเลิกบิลที่ QA ส่งซ่อม
router.delete("/cancelBillRepair", async (req, res) => {
    const { qaRepair_ID } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      DELETE FROM qaRepairMaster WHERE qaRepair_ID = ${qaRepair_ID}
      DELETE FROM qaRepairDetail WHERE qaRepair_ID = ${qaRepair_ID}
      DELETE FROM qaRepairDetailReason WHERE qaRepair_ID = ${qaRepair_ID}
    `);
        res.json({ result: constants.kResultOk });
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

// ยกเลิกบิลที่ FAC ส่งคืน QA
router.post("/cancelBillRepairFromFac", async (req, res) => {
    const { qaRepair_ID } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      UPDATE qaRepairMaster
      SET qaRepairStatus = '1'
      WHERE qaRepair_ID = ${qaRepair_ID}

      UPDATE qaRepairDetail
      SET ToQa = 0
      WHERE qaRepair_ID = ${qaRepair_ID}
    `);
        res.json({ result: constants.kResultOk });
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});


router.post("/reportRepairByOrder", async (req, res) => {
    const { orderNumber } = req.body;
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
			SELECT		QD.OrderItemNo, TM.repairType, TD.reasonType, SUM(QRR.Qty)AS Qty
			FROM		qaRepairMaster QRM JOIN qaRepairDetail QRD ON QRM.qaRepair_ID = QRD.qaRepair_ID 
						JOIN qaBillDetail QD ON QRM.qaBill_ID = QD.qaBill_ID AND QRD.bill_Item = QD.bill_Item 
						JOIN qaRepairDetailReason QRR ON QRD.qaRepair_ID = QRR.qaRepair_ID AND QRD.repair_Item = QRR.repair_Item
						JOIN qaRepairTypeMaster TM ON QRR.type_ID = TM.type_ID
						JOIN qaRepairTypeDetail TD ON QRR.type_ID = TD.type_ID AND QRR.reason_No = TD.reason_No
			WHERE		QRM.OrderNumber = '${orderNumber}'
			GROUP BY	QD.OrderItemNo, TM.repairType, TD.reasonType
			ORDER BY OrderItemNo
    `);
        res.json(recordset);
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});

router.post("/reportFactoQa", async (req, res) => {
    const { orderFilter, billDate, ProductionTeam, salesTeam } = req.body;
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
            --DATA DATE
            SELECT	A.*
            FROM	qaReportFacToQa A JOIN OrderMaster ON OrderMaster.OrderNumber = A.OrderNumber 
                    JOIN Customer ON OrderMaster.CusCode = Customer.CusCode
            WHERE	A.OrderNumber LIKE '%${orderFilter}%' AND CAST(jobDate AS DATE) BETWEEN '${billDate[0]}' AND '${billDate[1]}' 
                    AND A.ProductionTeam IN ('${ProductionTeam[0]}', '${ProductionTeam[1]}', '${ProductionTeam[2]}', '${ProductionTeam[3]}') 
                    AND Customer.Status IN (${salesTeam[0] ? salesTeam[0] : 0}, ${salesTeam[1] ? salesTeam[1] : 0} , ${salesTeam[2] ? salesTeam[2] : 0})

            --DATACHART
			SELECT A.OrderNumber, A.Qty, ProductionTeam, SUM(OrderDetail.Qty)AS TotalQty
            FROM OrderMaster JOIN (
            SELECT QM.OrderNumber, SUM(Qty)AS Qty FROM qaBillMaster QM JOIN qaBillDetail QD ON QM.qaBill_ID = QD.qaBill_ID
            WHERE QM.OrderNumber LIKE '%${orderFilter}%' AND CAST(billDate AS DATE) BETWEEN '${billDate[0]}' AND '${billDate[1]}'
            GROUP BY QM.OrderNumber)AS A ON OrderMaster.OrderNumber = A.OrderNumber JOIN OrderDetail ON A.OrderNumber = OrderDetail.OrderNumber JOIN Customer ON OrderMaster.CusCode = Customer.CusCode
            WHERE ProductionTeam IN ('${ProductionTeam[0]}', '${ProductionTeam[1]}', '${ProductionTeam[2]}', '${ProductionTeam[3]}') AND Customer.Status IN (${salesTeam[0] ? salesTeam[0] : 0}, ${salesTeam[1] ? salesTeam[1] : 0} , ${salesTeam[2] ? salesTeam[2] : 0})
            GROUP BY A.OrderNumber, A.Qty, OrderMaster.ProductionTeam

            --DATALINECHART
			SELECT A.billDate, ProductionTeam, SUM(OrderDetail.Qty)AS TotalQty
            FROM OrderMaster JOIN (
            SELECT CAST(billDate AS DATE)AS billDate, QM.OrderNumber, SUM(Qty)AS Qty FROM qaBillMaster QM JOIN qaBillDetail QD ON QM.qaBill_ID = QD.qaBill_ID
            WHERE QM.OrderNumber LIKE '%${orderFilter}%' AND CAST(billDate AS DATE) BETWEEN '${billDate[0]}' AND '${billDate[1]}'
            GROUP BY CAST(billDate AS DATE), QM.OrderNumber)AS A ON OrderMaster.OrderNumber = A.OrderNumber JOIN OrderDetail ON A.OrderNumber = OrderDetail.OrderNumber JOIN Customer ON OrderMaster.CusCode = Customer.CusCode
            WHERE ProductionTeam IN ('${ProductionTeam[0]}', '${ProductionTeam[1]}', '${ProductionTeam[2]}', '${ProductionTeam[3]}') AND Customer.Status IN (${salesTeam[0] ? salesTeam[0] : 0}, ${salesTeam[1] ? salesTeam[1] : 0} , ${salesTeam[2] ? salesTeam[2] : 0})
            GROUP BY A.billDate, OrderMaster.ProductionTeam

            --DATAQA
			SELECT finishDate, SalesTeam,  SUM(Qty)AS Qty 
			FROM (	SELECT	CAST(FM.finishDate AS DATE)AS finishDate, IIF(Customer.Status = 3, 1, Customer.Status) AS SalesTeam, Qty
					FROM	qaFinishMaster FM JOIN qaFinishDetail FD ON FM.qaFinish_ID = FD.qaFinish_ID JOIN OrderMaster ON OrderMaster.OrderNumber = FM.OrderNumber 
							JOIN Customer ON OrderMaster.CusCode = Customer.CusCode
					 WHERE	FM.OrderNumber LIKE '%%' AND CAST(FM.finishDate AS DATE) BETWEEN '2022-10-1' AND '2022-10-17' 
                    AND OrderMaster.ProductionTeam IN ('1', '2', '3', '4') 
                    AND Customer.Status IN (1, 2, 3))AS A
					GROUP BY finishDate, SalesTeam
    `);
        res.json({ dataDate: recordsets[0], dataChart: recordsets[1], dataLineChart: recordsets[2], dataQa: recordsets[3] });
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});


router.post("/getqabillbyorderitem", async (req, res) => {
    const { orderNumber, OrderItemNo } = req.body;
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(`
        SELECT	qaDocNumber, DATEADD(HH, -7, billDate)AS billDate, QD.qaJobNumber,
                (SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QD.QCPerson)AS QCPerson,
                (SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QM.SenderNew)AS Sender,Qty
        FROM qaBillMaster QM JOIN qaBillDetail QD ON QM.qaBill_ID = QD.qaBill_ID
        WHERE QM.OrderNumber = '${orderNumber}' AND OrderItemNo = ${OrderItemNo}
    `);
        res.json(recordset);
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});


router.post("/reportfactoqa-detail", async (req, res) => {
    const { orderNumber, billDate } = req.body;
    console.log(orderNumber, billDate)
    try {
        const pool = await poolPromise;
        const { recordsets } = await pool.request().query(`
            DECLARE @DATE DATE = '${billDate}'
            DECLARE @OrderNumber VARCHAR(30) = '${orderNumber}'

            SELECT ROW_NUMBER() OVER (ORDER by ForSort, ItemNo)AS ItemNoForFac, ItemNo, OD.ProductCode, 'http://192.168.3.5:3000/picture/'+REPLACE(REPLACE(SUBSTRING(NewPict,4,200),'\','/'),'#','%23') NewPict,Qty
            FROM OrderDetail OD JOIN ProductMaster PM ON OD.ProductID = PM.ProductID
            WHERE OrderNumber = @OrderNumber

            -- FAC SEND
            SELECT OrderItemNo, (SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = QCPerson)AS QCPerson, 
                    SUM(Qty)AS QtyFac FROM qaBillMaster QM JOIN qaBillDetail QD ON QM.qaBill_ID = QD.qaBill_ID
            WHERE CAST(billDate AS DATE) = @DATE AND QM.OrderNumber = @OrderNumber 
            GROUP BY OrderItemNo, QCPerson

            -- QA PASS
            SELECT	OrderItemNo, (SELECT (EM.EmpFName + ' (' + EM.NickName +')')AS EmpFullName FROM Employee EM WHERE EmpCode = FD.QAPerson)AS QAPerson, 
                    SUM(FD.Qty)AS QtyFinish 
            FROM	qaFinishMaster FM JOIN qaFinishDetail FD ON FM.qaFinish_ID = FD.qaFinish_ID 
                    JOIN qaBillDetail QD ON FM.qaBill_ID = QD.qaBill_ID AND FD.bill_Item = QD.bill_Item 
            WHERE	CAST(finishDate AS DATE) = @DATE AND FM.OrderNumber = @OrderNumber 
            GROUP BY OrderItemNo, FD.QAPerson

            -- QA REPAIR
            SELECT	OrderItemNo, RTM.repairType, RTD.reasonType, SUM(RDR.Qty)AS TotalRepair 
            FROM	qaRepairMaster RM JOIN qaRepairDetail RD ON RM.qaRepair_ID = RD.qaRepair_ID 
                    JOIN qaBillDetail QD ON RM.qaBill_ID = QD.qaBill_ID AND RD.bill_Item = QD.bill_Item 
                    JOIN qaRepairDetailReason RDR ON RM.qaRepair_ID = RDR.qaRepair_ID AND RD.repair_Item = RDR.repair_Item
                    JOIN qaRepairTypeMaster RTM ON RDR.type_ID = RTM.type_ID
                    JOIN qaRepairTypeDetail RTD ON RDR.type_ID = RTD.type_ID AND RDR.reason_No = RTD.reason_No
            WHERE CAST(repairDate AS DATE) = @DATE AND RM.OrderNumber = @OrderNumber 
            GROUP BY OrderItemNo, RTM.repairType, RTD.reasonType

    `);
        let dataReturn = recordsets[0]
        dataReturn.forEach((item, indexItem) => {
            dataReturn[indexItem].facSend = recordsets[1].filter(({ OrderItemNo }) => item.ItemNo === OrderItemNo);
            dataReturn[indexItem].qaPass = recordsets[2].filter(({ OrderItemNo }) => item.ItemNo === OrderItemNo);
            dataReturn[indexItem].qaRepair = recordsets[3].filter(({ OrderItemNo }) => item.ItemNo === OrderItemNo);
            dataReturn[indexItem].countRow =
                dataReturn[indexItem].facSend.length > 0 ||
                    dataReturn[indexItem].qaPass.length > 0 ||
                    dataReturn[indexItem].qaRepair.length > 0 ? dataReturn[indexItem].facSend.length > dataReturn[indexItem].qaPass.length ?
                    dataReturn[indexItem].facSend.length > dataReturn[indexItem].qaRepair.length ? dataReturn[indexItem].facSend.length : dataReturn[indexItem].qaRepair.length :
                    dataReturn[indexItem].qaPass.length > dataReturn[indexItem].qaRepair.length ? dataReturn[indexItem].qaPass.length : dataReturn[indexItem].qaRepair.length : 1
        })

        res.json(dataReturn);
        await pool.close;
    } catch (error) {
        res.status(500).json({ result: constants.kResultNok });
    }
});




