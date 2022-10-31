const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");

const QR = require('qrcode-base64');
// const barcode = require('barcode');


router.post("/mpp-getbarcode", (req, res) => {
  const { data } = req.body;
  // console.log(data);
  var imgData = QR.drawImg(data, {
    typeNumber: 4,
    errorCorrectLevel: 'M',
    size: 150
  })
  // console.log(buf);
  res.json(imgData);
});



//GET รายการสินค้าและสถานะ
router.post("/mpp-getstatus", async (req, res) => {
  const { orderNumber } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT	MS.*, ISNULL(Mold.StatusName, '')AS MoldStatusName,PM.ProductCode, 'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(PM.NewPict,4,200),'\','/') NewPict
        FROM	MT_MppStatus MS JOIN ProductMaster PM ON MS.ProductID = PM.ProductID
				LEFT JOIN MT_MoldStatus Mold ON MS.MoldStatus = Mold.StatusCode
        WHERE	OrderNumber = '${orderNumber}'
            `);
    res.json(result.recordset);
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});

//GET รายการพลอยของแต่ละ Item
router.post("/mpp-getstonebyitem", async (req, res) => {
  const { orderNumber } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT	OrderItemNo, ProductID, InvCode, QtyStone, QtyReceive, QtyFacReceive, FactDueDateMin, FactDueDateMax, SupDueDate , QtyPurchase, LateDay,  SupName, IsWaxSet,       
        CASE DATEPART(WEEKDAY,FactDueDateMin)
                WHEN 1 THEN 'อา'
                WHEN 2 THEN 'จ'
                WHEN 3 THEN 'อ'
                WHEN 4 THEN 'พ'
                WHEN 5 THEN 'พฤ'
                WHEN 6 THEN 'ศ'
                WHEN 7 THEN 'ส'
                ELSE ''
            END DowDueFacMin,
      CASE DATEPART(WEEKDAY,FactDueDateMax)
                WHEN 1 THEN 'อา'
                WHEN 2 THEN 'จ'
                WHEN 3 THEN 'อ'
                WHEN 4 THEN 'พ'
                WHEN 5 THEN 'พฤ'
                WHEN 6 THEN 'ศ'
                WHEN 7 THEN 'ส'
                ELSE ''
            END DowDueFacMax,
            CASE	
                WHEN QtyFacReceive >= QtyStone THEN 'ครบแล้ว'
                WHEN QtyPurchase <= 0 AND SupDueDate < '2015-01-01' THEN  'ยังไม่ได้สั่งซื้อ'
                WHEN QtyPurchase > 0 AND SupDueDate < '2015-01-01' THEN  'สั่งซื้อแล้ว'
                WHEN QtyPurchase > 0 AND SupDueDate > '2020-01-01' AND LateDay >= 0 AND QtyFacReceive < QtyStone  THEN 'ปกติ'
                WHEN QtyPurchase > 0 AND SupDueDate > '2020-01-01' AND LateDay < 0 AND QtyFacReceive < QtyStone  THEN  'ล่าช้า'
            ELSE ''
            END StoneStatus, IsDefer, MaxBill
        FROM		(SELECT	ProductID, MP.InvCode, MP.QtyReceive, MP.QtyFacReceive, MP.OrderItemNo, IsWaxSet, MaxBill, 
              ISNULL(((SELECT SUM(OD.Qty) FROM OrderDetail OD WHERE OD.OrderNumber = MP.OrderNumber AND OD.ItemNo = MP.OrderItemNo) * (MP.QtyReq)), 0)AS QtyStone,
                        ISNULL((SELECT TOP(1)SupplierName FROM PurchaseStatus JOIN Supplier ON PurchaseStatus.SupplierCode = Supplier.SupplierCode
                                WHERE OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode ), 0)AS SupName	,
                        ISNULL((SELECT MAX(FactDueDate) FROM PurchaseStatus WHERE OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode), '2000-01-01')AS FactDueDateMax,
          ISNULL((SELECT MIN(FacFromDate) FROM PurchaseStatusHistory WHERE HistoryTypeCode = '03' AND OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode), (SELECT MIN(FactDueDate) FROM PurchaseStatus WHERE OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode))AS FactDueDateMin,
          ISNULL((SELECT TOP(1) 1 FROM PurchaseStatusHistory WHERE HistoryTypeCode = '03' AND OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode),0)AS IsDefer,
                        ISNULL((SELECT MAX(SupDueDate) FROM PurchaseStatus WHERE OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode), '2000-01-01')AS SupDueDate,
                        ISNULL((SELECT SUM(QtyPurchase) FROM PurchaseStatus WHERE OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode),0)AS QtyPurchase,
                        DATEDIFF(DAY, IIF(1 = 1 ,GETDATE(), ''), ISNULL((SELECT MAX(FactDueDate) FROM PurchaseStatus WHERE OrderNumber = MP.OrderNumber AND InvCode = InvMaster.InvCode), '2000-01-01'))AS LateDay
                FROM	MT_MppStatusProduct MP JOIN InvMaster ON MP.InvCode = InvMaster.InvCode 
              JOIN 	(SELECT BM.OrderNumber, OrderItemNo, InvCode, MAX(BillDate)AS MaxBill 
                  FROM	MT_BillMaster BM 
                      JOIN MT_BillDetail BD ON BM.Bill_ID = BM.Bill_ID JOIN MT_BillDetailMaterial BDM ON BM.Bill_ID = BDM.Bill_ID AND BD.ItemNo = BDM.ItemNo
                      JOIN JobOrder ON BM.OrderNumber = JobOrder.OrderNumber AND BD.JobNumber = JobOrder.JobNumber
                  GROUP BY BM.OrderNumber, OrderItemNo, InvCode)AS findMaxBill ON MP.OrderNumber = findMaxBill.OrderNumber AND MP.OrderItemNo = findMaxBill.OrderItemNo AND MP.InvCode = findMaxBill.InvCode
                WHERE	MP.OrderNumber = '${orderNumber}' AND InvMaster.InvGroupCode IN('02','03','04','05','06')) AS A
        ORDER BY OrderItemNo, InvCode
               `);
    res.json(result.recordset);
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});

//UPDATE คิว
router.post("/mpp-update-piority", async (req, res) => {
  const pool = await poolPromise;
  const { orderNumber, Piority } = req.body;
  // console.log(orderNumber);
  // console.log(Piority);
  let count = 0;
  try {
    Piority.forEach(async (data, index) => {
      const result = await pool.request().query(`
                UPDATE MT_MppStatus SET Piority = ${data.Piority}
                WHERE OrderNumber = '${orderNumber}' AND OrderItemNo = ${data.OrderItemNo}
                `);
      // console.log(result);
      count++;
      if (count >= Piority.length) {
        res.json({ result: constants.kResultOk });
      }
    });
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});

//GET รายการสถานะพิมพ์
router.get("/mpp-getmoldstatus", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
                SELECT * FROM MT_MoldStatus
                ORDER BY SortBy
               `);
    res.json(result.recordset);
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});

//GET FilterDate
router.post("/mpp-getFilterDate", async (req, res) => {
  const { orderNumber, maxDate, minDate } = req.body;
  //   console.log(orderNumber, maxDate, minDate);
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT	OrderItemNo
            FROM	MT_MppStatusProduct MP 
                    JOIN InvMaster ON MP.InvCode = InvMaster.InvCode
                    LEFT JOIN PurchaseStatus ON MP.OrderNumber = PurchaseStatus.OrderNumber AND InvMaster.InvCode = PurchaseStatus.InvCode
            WHERE	MP.OrderNumber = '${orderNumber}' AND InvMaster.InvGroupCode IN('02','03','04','05','06') AND FactDueDate BETWEEN  '${minDate}' AND '${maxDate}'
            GROUP BY OrderItemNo
            ORDER BY OrderItemNo
            `);
    const dataConvert = result.recordset.map((obj) => obj.OrderItemNo);
    // console.log(dataConvert);
    res.json(dataConvert);
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});

//GET PartbyItem
router.post("/mpp-getpartbyitem", async (req, res) => {
  const { orderNumber } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
    SELECT	OrderItemNo, InvMaster.InvCode,(MP.QtyReq)AS TotalQty, 
            IIF(InvMaster.PriceType = 'Q' OR InvMaster.PriceType = '', InvMaster.QtyUnit,  InvMaster.WgUnit)AS Unit
    FROM	MT_MppStatusProduct MP 
            JOIN InvMaster ON MP.InvCode = InvMaster.InvCode 
    WHERE	MP.OrderNumber = '${orderNumber}' AND InvMaster.InvGroupCode IN('07','12', '15')
            `);
    res.json(result.recordset);
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});

//GET FilterStatusStone
router.post("/mpp-filterStatusStone", async (req, res) => {
  const { orderNumber, statusStone } = req.body;
  // console.log(orderNumber);
  // console.log(statusStone);
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT OrderItemNo
        FROM (
          SELECT	OrderItemNo, ProductID, InvCode, QtyStone, QtyReceive, QtyFacReceive, SupDueDate , QtyPurchase, LateDay,       
              CASE	
                  WHEN QtyFacReceive >= QtyStone THEN 'ครบแล้ว'
                  WHEN QtyPurchase <= 0 AND SupDueDate < '2015-01-01' THEN  'ยังไม่ได้สั่งซื้อ'
                  WHEN QtyPurchase > 0 AND SupDueDate < '2015-01-01' THEN  'สั่งซื้อแล้ว'
                  WHEN QtyPurchase > 0 AND SupDueDate > '2020-01-01' AND LateDay >= 0 AND QtyFacReceive < QtyStone  THEN 'ปกติ'
                  WHEN QtyPurchase > 0 AND SupDueDate > '2020-01-01' AND LateDay < 0 AND QtyFacReceive < QtyStone  THEN  'ล่าช้า'
              ELSE ''
              END StoneStatus
          FROM		(SELECT	ProductID, MP.InvCode, MP.QtyReceive, MP.QtyFacReceive, OrderItemNo,
                ISNULL(((SELECT SUM(OD.Qty) FROM OrderDetail OD WHERE OD.OrderNumber = MP.OrderNumber AND OD.ItemNo = MP.OrderItemNo) * (MP.QtyReq)), 0)AS QtyStone,
                          ISNULL((SELECT MAX(SupDueDate) FROM PurchaseStatus WHERE OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode), '2000-01-01')AS SupDueDate,
                          ISNULL((SELECT SUM(QtyPurchase) FROM PurchaseStatus WHERE OrderNumber = MP.OrderNumber AND InvCode = MP.InvCode),0)AS QtyPurchase,
                          DATEDIFF(DAY, IIF(1 = 1 ,GETDATE(), ''), ISNULL((SELECT MAX(FactDueDate) FROM PurchaseStatus WHERE OrderNumber = MP.OrderNumber AND InvCode = InvMaster.InvCode), '2000-01-01'))AS LateDay
                  FROM	MT_MppStatusProduct MP JOIN InvMaster ON MP.InvCode = InvMaster.InvCode
                  WHERE	OrderNumber = '${orderNumber}' AND InvMaster.InvGroupCode IN('02','03','04','05','06')) AS A)AS B
        WHERE StoneStatus IN ('${statusStone[0]}', '${statusStone[1]}', '${statusStone[2]}', '${statusStone[3]}', '${statusStone[4]}')
        GROUP BY OrderItemNo
            `);
    const dataConvert = result.recordset.map((obj) => obj.OrderItemNo);
    res.json(dataConvert);
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});


router.post("/mpp-viewpurchasedetail", async (req, res) => {
  const { orderNumber, InvCode } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
    SELECT  ISNULL((SELECT SupplierName FROM Supplier WHERE PS.SupplierCode = Supplier.SupplierCode),'')AS SupplierName, 
            PS.SupDueDate, PS.QtyPurchase, PS.QtyPcReceive, PS.MP_ItemNo, PS.Status, PS.PcID, PcDocNumber,  PcMaster.DocDate
    FROM    PurchaseStatus PS LEFT JOIN PcMaster ON PS.PcID = PcMaster.PcID
    WHERE	  PS.OrderNumber = '${orderNumber}' AND InvCode = '${InvCode}'
            `);
    res.json(result.recordset);
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});

// GAME
/////////////////////////////// MT_MoldStatus History ///////////////////////////////////

router.post("/createStatusHistory", async (req, res) => {
  const { OrderNo, ItemNo, Updater, StatusFrom, StatusTo } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
                  INSERT INTO MT_MoldStatusHistory(OrderNo , ItemNo, UpdateNo, Updater, StatusFrom, StatusTo, UpdateDate)
                  VALUES	( '${OrderNo}' , ${ItemNo} , ISNULL((SELECT MAX((UpdateNo)+1) FROM MT_MoldStatusHistory
                  WHERE OrderNo = '${OrderNo}' AND ItemNo = '${ItemNo}') ,1) , '${Updater}' , '${StatusFrom}' , '${StatusTo}' , GETUTCDATE())
  
              `);
    //res.json({ result: constants.kResultOk });
  } catch (error) {
    res.json({ result: "ERROR /createStatusHistory" });
  } finally {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
                UPDATE MT_MppStatus
                SET MoldStatus = '${StatusTo}'
                WHERE OrderItemNo = ${ItemNo} ; 
              `);
      res.json({ result: constants.kResultOk });
    } catch (error) {
      res.json({ result: "ERROR /updateStatusHistory" });
    }
  }
});

router.post("/gethistorystatusmold/", async (req, res) => {
  const { orderNumber, ItemNo } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                        
            SELECT MSH.ItemNo, MSH.OrderNo, MSH.UpdateNo , MS.StatusName AS 'StatusFrom', MS2.StatusName AS 'StatusTo', EP.EmpFullName, MSH.Updater,  MSH.UpdateDate
            FROM MT_MoldStatusHistory AS MSH
            JOIN MT_MoldStatus AS MS ON MSH.StatusFrom = MS.StatusCode
            JOIN MT_MoldStatus AS MS2 ON MSH.StatusTo = MS2.StatusCode
            JOIN Employee AS EP ON MSH.Updater = EP.EmpCode
            WHERE OrderNo = '${orderNumber}' AND ItemNo = ${ItemNo}
              `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

// TON 24-01-2565

//Filter วันที่ได้รับพลอยที่่เป็น WaxSet
router.post("/mpp-getfilterstonewaxset/", async (req, res) => {
  const { orderNumber } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                        
          SELECT	OrderItemNo
          FROM	MT_MppStatusProduct MP 
                  JOIN InvMaster ON MP.InvCode = InvMaster.InvCode
                  LEFT JOIN PurchaseStatus ON MP.OrderNumber = PurchaseStatus.OrderNumber AND InvMaster.InvCode = PurchaseStatus.InvCode
          WHERE	MP.OrderNumber = '${orderNumber}' AND InvMaster.InvGroupCode IN('02','03','04') AND IsWaxSet = '1'
          GROUP BY OrderItemNo
          ORDER BY OrderItemNo
              `);
    const dataConvert = result.recordset.map((obj) => obj.OrderItemNo);
    res.json(dataConvert);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});


//Filter วันที่ได้รับพลอยที่่เป็น WaxSet
router.post("/mpp-getfilterdatestonewaxset/", async (req, res) => {
  const { orderNumber, maxDate, minDate } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                        
        SELECT	OrderItemNo
        FROM	MT_MppStatusProduct MP 
                JOIN InvMaster ON MP.InvCode = InvMaster.InvCode
                LEFT JOIN PurchaseStatus ON MP.OrderNumber = PurchaseStatus.OrderNumber AND InvMaster.InvCode = PurchaseStatus.InvCode
        WHERE	MP.OrderNumber = '${orderNumber}' AND InvMaster.InvGroupCode IN('02','03','04') AND IsWaxSet = '1' AND FactDueDate BETWEEN  '${minDate}' AND '${maxDate}'
        GROUP BY OrderItemNo
        ORDER BY OrderItemNo
              `);
    const dataConvert = result.recordset.map((obj) => obj.OrderItemNo);
    res.json(dataConvert);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});


//Filter วันที่ได้รับพลอยธรรมดา
router.post("/mpp-getfilterdatestonenonwaxset/", async (req, res) => {
  const { orderNumber, maxDate, minDate } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                        
            SELECT	OrderItemNo
            FROM	MT_MppStatusProduct MP 
                    JOIN InvMaster ON MP.InvCode = InvMaster.InvCode
                    LEFT JOIN PurchaseStatus ON MP.OrderNumber = PurchaseStatus.OrderNumber AND InvMaster.InvCode = PurchaseStatus.InvCode
            WHERE	MP.OrderNumber = '${orderNumber}' AND InvMaster.InvGroupCode IN('02','03','04') AND IsWaxSet = '' AND FactDueDate BETWEEN  '${minDate}' AND '${maxDate}'
            GROUP BY OrderItemNo
            ORDER BY OrderItemNo
                  `);
    const dataConvert = result.recordset.map((obj) => obj.OrderItemNo);
    res.json(dataConvert);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

//Filter วันที่ได้รับมุก
router.post("/mpp-getfilterdatepearl/", async (req, res) => {
  const { orderNumber, maxDate, minDate } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                        
            SELECT	OrderItemNo
            FROM	MT_MppStatusProduct MP 
                    JOIN InvMaster ON MP.InvCode = InvMaster.InvCode
                    LEFT JOIN PurchaseStatus ON MP.OrderNumber = PurchaseStatus.OrderNumber AND InvMaster.InvCode = PurchaseStatus.InvCode
            WHERE	MP.OrderNumber = '${orderNumber}' AND InvMaster.InvGroupCode IN('05','06') AND FactDueDate BETWEEN  '${minDate}' AND '${maxDate}'
            GROUP BY OrderItemNo
            ORDER BY OrderItemNo
                  `);
    const dataConvert = result.recordset.map((obj) => obj.OrderItemNo);
    res.json(dataConvert);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});


//ดึงคิวใน Order เพื่อนำมา Filter
router.post("/mpp-getqueforfilter/", async (req, res) => {
  const { orderNumber } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                        
        SELECT Piority, IIF(Piority = 99, 'ยังไม่ได้จัดคิว', 'คิวที่ ' + CAST(Piority AS VARCHAR))AS title
        FROM MT_MppStatus
        WHERE OrderNumber = '${orderNumber}'
        GROUP BY Piority
        ORDER BY Piority
                  `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

// แสดงรายการวันที่เลื่อน
router.post("/mpp-PurchaseStatusHistory/", async (req, res) => {
  const { orderNumber, InvCode } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                        
      SELECT	History_ID, PH.MP_ItemNo, HistoryDate, 
              CONCAT(LEFT(HistoryTime,2), ':', SUBSTRING(HistoryTime, 3,2), ':', RIGHT(HistoryTime,2))AS HistoryTime, 
              EM.EmpFName + ' ( ' + EM.NickName + ' ) 'AS EmpName, SupFromDate, SupToDate, 
              ISNULL(SPR1.Description, '')AS ReasonSup, ISNULL(SPR2.Description, '')AS ReasonFact,
              FacFromDate, FacToDate
      FROM	  PurchaseStatusHistory  PH JOIN Employee EM ON PH.EmpCode = EM.EmpCode
              LEFT JOIN StonePlanReason SPR1 ON PH.SupReasonItemNo =  SPR1.ItemNo
              LEFT JOIN StonePlanReason SPR2 ON PH.FacReasonItemNo =  SPR2.ItemNo
      WHERE	  HistoryTypeCode = '03' AND OrderNumber = '${orderNumber}' AND InvCode = '${InvCode}'
      ORDER   BY HistoryDate, History_ID, PH.MP_ItemNo
                  `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

// แสดงบิลตอนก่อนกดรับ
router.post("/mpp-getbillreceive/", async (req, res) => {
  let { orderNumber, billID, factoryTeam } = req.body;
  // console.log(factoryTeam)
  if (+factoryTeam === 0) {
    factoryTeam = `'1', '2', '3', '4', 'W'`
  } else if (factoryTeam === 'W') {
    factoryTeam = `'W'`
  } else {
    factoryTeam = `'${factoryTeam}'`
  }
  try {
    const pool = await poolPromise;
    let resultProduct = await pool.request()
      .query(`  
        SELECT	BD.JobNumber, ItemNo,  forSort,
                'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(NewPict,4,200),'\','/') NewPict,
                ProductMaster.ProductCode, ProductMaster.ProductID, OrderItemNo
        FROM	  MT_BillDetail BD JOIN JobOrder JO ON BD.JobNumber = JO.JobNumber 
                LEFT JOIN ProductMaster ON JO.ProductID = ProductMaster.ProductID
        WHERE	  BD.Bill_ID = ${billID}                                                          
                `);
    const resultProductDetail = await pool.request()
      .query(`  
                    SELECT ItemNo, MatItemNo, InvCode, SendQty, MatStatus, forSort 
                    FROM MT_BillDetailMaterial
                    WHERE	Bill_ID = ${billID} 
                    ORDER BY  ItemNo, MatItemNo                                               
                `);
    resultProduct.recordset.forEach((product, index) => {
      resultProduct.recordset[index].inventory = resultProductDetail.recordset.filter(obj => product.ItemNo === obj.ItemNo);
    });
    const resultMaster = await pool.request()
      .query(`  
        SELECT	MT_BillMaster.Bill_ID, BillNumber, BillDate, OrderNumber, FactoryTeam, ReceiveDate,
                CONCAT(LEFT(ReceiveTime,2), ':', SUBSTRING(ReceiveTime, 3,2), ':', RIGHT(ReceiveTime,2))AS ReceiveTime,
                CONCAT(LEFT(BillTime,2), ':', SUBSTRING(BillTime, 3,2), ':', RIGHT(BillTime,2))AS BillTime, Sender, BillStatus,
                ES.EmpFullName AS EmpNameSender, 'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(ES.EmpPict,4,200),'\','/')AS EmpPictSender,
                ISNULL(ER.EmpFullName, '')AS EmpNameReceiver, ISNULL(('http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(ER.EmpPict,4,200),'\','/')), '')AS EmpPictReceiver
                FROM	MT_BillMaster 
                JOIN Employee ES ON Sender = EmpCode
                LEFT JOIN Employee ER ON ER.EmpCode = MT_BillMaster.Receiver
        WHERE	  MT_BillMaster.Bill_ID = ${billID}  AND FactoryTeam IN (${factoryTeam})                                                      
           `);
    // OrderNumber = '${ orderNumber }' AND 
    const resultSumStone = await pool.request().query(`
        SELECT	InvCode, SUM(SendQty)AS SumQty
        FROM    MT_BillDetailMaterial 
        WHERE	  Bill_ID = ${billID}  AND SendQty > 0 
        GROUP BY InvCode 
     `)
    let dataResponse = resultMaster.recordset[0];
    dataResponse.product = resultProduct.recordset;
    dataResponse.sumInv = resultSumStone.recordset;
    res.json(dataResponse);
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

// ยืนยันรับบิล
router.post("/mpp-confirmReceiveBill/", async (req, res) => {
  const { billID, receiver } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`  
          DECLARE @Time VARCHAR(20) = CONCAT(LEFT(CONVERT(VARCHAR, GETDATE(), 108),2), SUBSTRING(CONVERT(VARCHAR, GETDATE(), 108), 4,2), RIGHT(CONVERT(VARCHAR, GETDATE(), 108),2))
          -- UPDATE Bill
          UPDATE MT_BillMaster SET 
          Receiver = '${receiver}', 
          ReceiveDate = CAST(GETDATE()AS DATE), 
          ReceiveTime = @Time,
          BillStatus = '3'
          WHERE	Bill_ID = ${billID}

          --UPDATE Que
          UPDATE MSP SET QtyFacReceive = QtyFacReceive + BDM.SendQty
          FROM	MT_BillMaster BM JOIN MT_BillDetail BD ON BM.Bill_ID = BD.Bill_ID
              JOIN MT_BillDetailMaterial BDM ON BM.Bill_ID = BDM.Bill_ID AND BD.ItemNo = BDM.ItemNo
              JOIN JobOrder ON BD.JobNumber = JobOrder.JobNumber
              JOIN MT_MppStatusProduct MSP ON  MSP.OrderNumber = BM.OrderNumber AND JobOrder.OrderItemNo = MSP.OrderItemNo AND MSP.InvCode = BDM.InvCode 
          WHERE	BM.Bill_ID = ${billID}                                                  
                `);
    // console.log(result);
    const result3 = await pool.request().query(`
        SELECT  InvCode, SUM(SendQty)AS SendQty
        FROM	MT_BillMaster JOIN MT_BillDetailMaterial ON MT_BillMaster.Bill_ID = MT_BillDetailMaterial.Bill_ID
            WHERE	MT_BillMaster.Bill_ID = ${billID} AND SendQty > 0
        GROUP BY InvCode
    `);
    const result2 = await pool.request().query(`
    SELECT MP_ItemNo, InvCode, QtyReq, QtyToFact, QtyFactBalance  
    FROM PurchaseStatus
    WHERE OrderNumber = 
    (SELECT OrderNumber FROM MT_BillMaster WHERE	MT_BillMaster.Bill_ID = ${billID})`);
    const dataBill = result3.recordset;
    const dataStatus = result2.recordset;
    // console.log(dataBill);
    // console.log(dataStatus);
    dataBill.forEach((objBill, index) => {
      let SendQty = objBill.SendQty;
      const findArray = dataStatus.filter(objFind => objFind.InvCode === objBill.InvCode);
      // console.log(findArray);
      findArray.forEach(async (objStatus, indexStatus) => {
        // console.log('เข้า', SendQty);
        if (objStatus.QtyReq > objStatus.QtyToFact && SendQty > 0) {
          // console.log(objStatus);
          const QtyReq = objStatus.QtyReq - objStatus.QtyToFact;
          const QtyInsert = SendQty > QtyReq ? QtyReq : SendQty
          // console.log(QtyInsert);
          SendQty = SendQty - QtyInsert;
          // console.log(QtyInsert, objStatus.MP_ItemNo , billID);
          const updateStatus = await pool.request().query(`
          UPDATE PS SET QtyToFact = QtyToFact + ${QtyInsert}, QtyFactBalance = QtyReq - (QtyToFact +  ${QtyInsert})
          FROM PurchaseStatus PS
          WHERE OrderNumber = 
          ( SELECT OrderNumber FROM MT_BillMaster WHERE	MT_BillMaster.Bill_ID = ${billID}) 
          AND PS.MP_ItemNo = ${objStatus.MP_ItemNo}

          DECLARE @Time VARCHAR(20) = CONCAT(LEFT(CONVERT(VARCHAR, GETDATE(), 108),2), SUBSTRING(CONVERT(VARCHAR, GETDATE(), 108), 4,2), RIGHT(CONVERT(VARCHAR, GETDATE(), 108),2))
          INSERT INTO PurchaseStatusHistory   
          (OrderNumber, MP_ItemNo, HistoryTypeCode, EmpCode, HistoryDate, HistoryTime, SupplierCode, ProductionTeam, InvCode, Qty, SupReasonItemNo, SupFromDate, SupToDate
               ,FacReasonItemNo, FacFromDate, FacToDate, Status)
          OUTPUT INSERTED.History_ID
          VALUES (
          (SELECT OrderNumber FROM MT_BillMaster WHERE	MT_BillMaster.Bill_ID = ${billID}), 
          ${objStatus.MP_ItemNo}, 
          '05', 
          '${receiver}', 
          CAST(GETDATE()AS DATE), 
          @Time, 
          (SELECT SupplierCode FROM PurchaseStatus WHERE OrderNumber = (SELECT OrderNumber FROM MT_BillMaster WHERE	MT_BillMaster.Bill_ID = ${billID} ) AND MP_ItemNo = ${objStatus.MP_ItemNo}),
          (SELECT ProductionTeam FROM Employee WHERE EmpCode = '${receiver}'),
          '${objStatus.InvCode}',
          ${QtyInsert},
          '',
          '',
          '',
          '',
          '',
          '',
          ''
          );
          `);
          // console.log('Output', updateStatus);
          // if(updateStatus.recordset.length > 0 && indexStatus + 1 === findArray.length) {
          //   res.json({ message: constants.kResultOk });
          // }
        }
      });
    });
    res.json({ message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

// แสดงรายการบิล
router.post("/mpp-billmaterails/", async (req, res) => {
  let { orderNumber, factoryTeam } = req.body;
  if (+factoryTeam === 0) {
    factoryTeam = `'1', '2', '3', '4', 'W'`
  } else if (factoryTeam === 'W') {
    factoryTeam = `'W'`
  } else {
    factoryTeam = `'${factoryTeam}'`
  }
  try {
    const pool = await poolPromise;
    // console.log(factoryTeam);
    const result = await pool.request()
      .query(`  
    SELECT	Bill_ID, BillNumber, BillDate,
        CONCAT(LEFT(BillTime,2), ':', SUBSTRING(BillTime, 3,2), ':', RIGHT(BillTime,2))AS BillTime,
        EmpFullName, FactoryTeam, BillStatus, (0)AS checkbox, OrderNumber
    FROM	  MT_BillMaster JOIN Employee ON EmpCode = Sender
    WHERE BillStatus != ''  AND FactoryTeam IN(${factoryTeam}) AND DATEDIFF(DAY, IIF(YEAR(MT_BillMaster.ReceiveDate) > 2020, MT_BillMaster.ReceiveDate, GETDATE()), GETDATE()) < 7
    ORDER BY BillStatus, BillDate DESC                                             
                `);
    // console.log(result);
    res.json(result.recordset);
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

//เก็บlog Checkin
router.post("/mpp-checkinProgram/", async (req, res) => {
  let { username, route } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`  
      INSERT INTO MT_CheckinProgram (EmpCode, RouteName)
      OUTPUT INSERTED.ID
      VALUES('${username}', '${route}')
                `);
    res.json({ result: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});



// ยืนยันรับบิลเฉพาะต้น
router.post("/mpp-receiveBillOnlyDev/", async (req, res) => {
  const { billID, receiver } = req.body;
  try {
    const pool = await poolPromise;
    const dataBill = await pool.request().query(`
        SELECT  InvCode, SUM(SendQty)AS SendQty
        FROM	MT_BillMaster JOIN MT_BillDetailMaterial ON MT_BillMaster.Bill_ID = MT_BillDetailMaterial.Bill_ID
            WHERE	MT_BillMaster.Bill_ID = ${billID} AND SendQty > 0
        GROUP BY InvCode
    `);
    const dataStatus = await pool.request().query(`
    SELECT MP_ItemNo, InvCode, QtyReq, QtyToFact, QtyFactBalance  
    FROM PurchaseStatus
    WHERE OrderNumber = 
    (SELECT OrderNumber FROM MT_BillMaster WHERE	MT_BillMaster.Bill_ID = ${billID})`);
    // const dataBill = result3.recordset;
    // const dataStatus = result2.recordset;
    // console.log(dataBill);
    // console.log(dataStatus);
    dataBill.recordset.forEach((objBill, index) => {
      let SendQty = objBill.SendQty;
      const findArray = dataStatus.recordset.filter(objFind => objFind.InvCode === objBill.InvCode);
      // console.log(findArray);
      findArray.forEach(async (objStatus, indexStatus) => {
        // console.log('เข้า', SendQty);
        if (objStatus.QtyReq > objStatus.QtyToFact && SendQty > 0) {
          // console.log(objStatus);
          const QtyReq = objStatus.QtyReq - objStatus.QtyToFact;
          const QtyInsert = SendQty > QtyReq ? QtyReq : SendQty
          // console.log(QtyInsert);
          SendQty = SendQty - QtyInsert;
          // console.log(QtyInsert, objStatus.MP_ItemNo , billID);
          const updateStatus = await pool.request().query(`
          UPDATE PS SET QtyToFact = QtyToFact + ${QtyInsert}, QtyFactBalance = QtyReq - (QtyToFact +  ${QtyInsert})
          FROM PurchaseStatus PS
          WHERE OrderNumber = 
          ( SELECT OrderNumber FROM MT_BillMaster WHERE	MT_BillMaster.Bill_ID = ${billID}) 
          AND PS.MP_ItemNo = ${objStatus.MP_ItemNo}

          DECLARE @Time VARCHAR(20) = CONCAT(LEFT(CONVERT(VARCHAR, GETDATE(), 108),2), SUBSTRING(CONVERT(VARCHAR, GETDATE(), 108), 4,2), RIGHT(CONVERT(VARCHAR, GETDATE(), 108),2))
          INSERT INTO PurchaseStatusHistory   
          (OrderNumber, MP_ItemNo, HistoryTypeCode, EmpCode, HistoryDate, HistoryTime, SupplierCode, ProductionTeam, InvCode, Qty, SupReasonItemNo, SupFromDate, SupToDate
               ,FacReasonItemNo, FacFromDate, FacToDate, Status)
          OUTPUT INSERTED.History_ID
          VALUES (
          (SELECT OrderNumber FROM MT_BillMaster WHERE	MT_BillMaster.Bill_ID = ${billID}), 
          ${objStatus.MP_ItemNo}, 
          '05', 
          '${receiver}', 
          CAST(GETDATE()AS DATE), 
          @Time, 
          (SELECT SupplierCode FROM PurchaseStatus WHERE OrderNumber = (SELECT OrderNumber FROM MT_BillMaster WHERE	MT_BillMaster.Bill_ID = ${billID} ) AND MP_ItemNo = ${objStatus.MP_ItemNo}),
          (SELECT ProductionTeam FROM Employee WHERE EmpCode = '${receiver}'),
          '${objStatus.InvCode}',
          ${QtyInsert},
          '',
          '',
          '',
          '',
          '',
          '',
          ''
          );
          `);
        }
      });
    });
    res.json({ message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});


router.post("/getbatchpartsforreceive", async (req, res) => {
  const { batchNumber } = req.body;
  try {
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .query(`  
          SELECT	AM.OrderNumber, AM.InvCode, BatchNumber, AD.BatchQty, NetWeight, TotalContainerWg, AD.PackDate, Select_A, AD.BatchStatus, PurchasePerson,
          (SELECT 'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(InvPict,4,200),'\','/') FROM InvMaster WHERE InvCode = AM.InvCode)AS InvPict
          FROM	AccPurchaseStatus AM JOIN AccPurchaseStatusDetail AD ON AM.OrderNumber = AD.OrderNumber AND AM.InvCode = AD.InvCode AND AM.LotNumber = AD.LotNumber
          WHERE	BatchNumber = '${batchNumber}'
                `);
    // console.log(recordset)
    res.json(recordset);
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

router.post("/confirmReceiveParts", async (req, res) => {
  const { PurchasePerson, FactoryReceivePerson } = req.body;
  try {
    const pool = await poolPromise;
    const { recordset } = await pool.request()
      .query(`  
        UPDATE APD SET	
            BatchStatus = '2',
            Select_A = 0, 
            PurchasePerson = '${PurchasePerson}',
            FactoryRequestPerson = '${FactoryReceivePerson}',
            FactoryRequestDate = CAST(GETDATE() AS DATE),
            FactoryRequestTime = CAST(GETDATE() AS TIME)
        FROM AccPurchaseStatusDetail APD
        WHERE	BatchNumber = '22000017'
                `);
    // console.log(recordset)
    res.json({ result: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});







module.exports = router;
