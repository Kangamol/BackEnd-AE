const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");

// --------------------------------------------------------------------------------------------------------------------
// SELECT  TYPE_ID, ITEM_ID, ITEM_NAME, UNIT_ID
//         FROM    ph.Inventory
// router.get("/getInventory", async (req, res) => {
//   try {
//     const pool = await poolPromise;
//     const result = await pool.request()
//       .query(`                                                                   
//       SELECT  INV_TYPE_ID, ITEM_ID, ITEM_NAME, UNIT_ID 
//       FROM    ph.Inventory
//       Order by INV_TYPE_ID
//             `);
//     res.json(result.recordset);
//     // res.json({ result: result.recordset, message: constants.kResultOk });
//   } catch (error) {
//     res.json({ message: constants.kResultNok });
//   }
// });

router.get("/getBillMasterByBillId/:bill_id", async (req, res) => {
  try {
    const { bill_id } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                        
            SELECT Purchase_Bill_ID, Purchase_Bill_Doc, Request_ID, Section_Code, Position_Code, Inspactor_ID, Approver_ID, Bill_Date, Status_Code, position_name
            FROM ph.PurchaseBillMaster
            JOIN ph.Position ON Section_Code=section_code AND Position_Code=position_code
            WHERE Purchase_Bill_ID = '${bill_id}' 
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

router.get("/getInventoryFull", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
        SELECT  ph.Inventory.INV_TYPE_ID, ph.ITEM_TYPE.INV_TYPE_NAME, ph.Inventory.ITEM_ID, ph.Inventory.ITEM_NAME, ph.ITEM_UNIT.UNIT_NAME, ph.Inventory.UNIT_ID, ph.Inventory.ITEM_PICT
        FROM    (ph.Inventory
        JOIN    ph.ITEM_TYPE
        ON      ph.Inventory.INV_TYPE_ID = ph.ITEM_TYPE.INV_TYPE_ID)
        INNER   JOIN ph.ITEM_UNIT ON ph.Inventory.UNIT_ID = ph.ITEM_UNIT.UNIT_ID
        Order by INV_TYPE_ID
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

// SELECT * FROM ph.ITEM_TYPE

router.get("/getItemType", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
        SELECT * FROM ph.ITEM_TYPE
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});
//SELECT * FROM ph.PurchaseBillMaster
router.get("/getPurchaseBillMaster", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
            SELECT Purchase_Bill_ID, Purchase_Bill_Doc, Request_ID, EP.EmpFullName, Section_Code, SectionName, Inspactor_ID, Approver_ID, Bill_Date, Status_Code
            FROM ph.PurchaseBillMaster
            INNER JOIN dbo.Section ON ph.PurchaseBillMaster.Section_Code=dbo.Section.SectionCode
            INNER JOIN ph.Status ON ph.PurchaseBillMaster.Status_Code=ph.Status.status_code
            INNER JOIN Employee EP ON Request_ID=EmpCode
            ORDER BY Status_Code , Bill_Date
       
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});
//SELECT * FROM ph.PurchaseBillDetail
router.get("/getPurchaseBillDetail", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
        SELECT * FROM ph.PurchaseBillDetail
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

router.get("/getSection", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
        SELECT * FROM dbo.Section WHERE SectionCode BETWEEN 4 AND 20;
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

router.get("/getPurchasePosition", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
              SELECT * FROM ph.Position
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

router.get("/getBillOrder/:bill_id", async (req, res) => {
  const { bill_id } = req.params;

  // console.log("req ", bill_id);
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
              SELECT Purchase_Bill_ID, ITEM_NO, ITEM_NAME, PH.ITEM_ID, ITEM_Qty, PH.ITEM_UNIT_ID, UNIT_NAME, PRICE, PIC_ID, Remark
              FROM ph.PurchaseBillDetail PH
			        JOIN ph.Inventory ON PH.ITEM_ID=ph.Inventory.ITEM_ID
              JOIN ph.ITEM_UNIT ON PH.ITEM_UNIT_ID=ph.ITEM_UNIT.UNIT_ID
              WHERE Purchase_Bill_ID = '${bill_id}' 
              ORDER BY ITEM_NO
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

router.get("/getItemStatus1and2", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
            SELECT * FROM ph.Inventory
            WHERE INV_TYPE_ID IN ('1' , '2')
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

////////////////////////////////Filter////////////////////////////////////////////
router.get("/getItemStatus1", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
            SELECT * FROM ph.Inventory
            WHERE INV_TYPE_ID = '1'
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

router.get("/getItemStatus2", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
            SELECT * FROM ph.Inventory
            WHERE INV_TYPE_ID = 2
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

///////////////////////////////////////////////////////////////////////////////////
router.post("/createPurchaseBill", async (req, res) => {
  let dataMaster = null;
  const { Request_ID, Section_Code, Position_Code, DataDetail } = req.body;
  // console.log("req.body : " , req.body)
  // console.log("Request_ID : " , Request_ID)
  // console.log("Section_Code : " , Section_Code)
  //console.log("Position_Code : " , Position_Code)
  //console.log("DataDetail : " , DataDetail)


  if (Request_ID !== null && Request_ID !== undefined ) {
    try {
      
      const pool = await poolPromise;
      const result = await pool.request().query(`
                INSERT INTO ph.PurchaseBillMaster (Purchase_Bill_Doc, Request_ID, Section_Code, Position_Code, Bill_Date, Status_Code)
                OUTPUT Inserted.Purchase_Bill_ID
                VALUES ((SELECT RIGHT(YEAR(GETDATE()) + 543, 2) + FORMAT(GETDATE(), 'MM') + ISNULL(RIGHT('000' + CAST(CAST(MAX(RIGHT(PH.Purchase_Bill_Doc, 3)) + 1 AS INT)AS VARCHAR) , 3), '001')
                FROM ph.PurchaseBillMaster AS PH
                WHERE LEFT(PH.Purchase_Bill_Doc , 4) = (RIGHT(YEAR(GETDATE()) + 543, 2 ) + FORMAT(GETDATE() , 'MM'))), '${Request_ID}', '${Section_Code}', '${Position_Code}', GETUTCDATE(), '0')
                  `);
      // console.log("Inserted.Purchase_Bill_ID : " , Inserted.Purchase_Bill_ID)
      // console.log(result.recordset[0])
      dataMaster = result.recordset;
      //console.log("dataMaster : " , dataMaster)
      // res.json({ result: constants.kResultOk });
    } catch (error) {
      res.json({ result: "ERROR /create-purchase_bill_master" });
    } finally {
      //console.log(dataMaster)
      if (dataMaster.length !== null && dataMaster.length > 0) {
        //console.log("DataDetail : " , DataDetail)
        const DataMaster = dataMaster[0].Purchase_Bill_ID;
        //console.log("DataMaster : " , DataMaster)
        DataDetail.forEach(async (data, index) => {
          try {
            // console.log("dataMasterxx : " , DataMaster)
            // console.log("index : " , index)
            // console.log("data : ", data);
            if (data.remark == null) {
              data.remark = "";
            }
            

            const pool = await poolPromise;
            const result = await pool.request()
              .query(`                                                                   
                        INSERT INTO ph.PurchaseBillDetail (Purchase_Bill_ID, ITEM_NO, ITEM_ID, ITEM_Qty, ITEM_UNIT_ID, PIC_ID, Remark)
                        VALUES ( '${DataMaster}' , '${index + 1}',  '${data.ITEM_ID}', '${data.Qty}' ,'${data.UNIT_ID}', ${data.ITEM_PICT}, '${data.remark}'
                        )`);
          } catch (error) {
            res.json({ result: constants.kResultNok });
          }
        });
        res.json({ result: constants.kResultOk });
      }
    }
  } else {
    res.json({ result: "ข้อมูลพนักงานผิดพลาด" });
  }
});

router.post("/updateNewItem/:Bill_ID/:index", async (req, res) => {
  const { Bill_ID, index } = req.params;
  datalist = req.body;
  // console.log("Bill_ID : ", Bill_ID);
  // console.log("index : ", index);
  // console.log("datalist : " , datalist)
  // console.log("datalist.ITEM_ID : ", datalist.ITEM_ID);
  // console.log("datalist.datalist.ITEM_Qty : ", datalist.ITEM_Qty);
  // console.log("datalist.ITEM_UNIT_ID : ", datalist.UNIT_ID);
  // console.log("datalist.PIC_ID : ", datalist.ITEM_PICT);
  // console.log("datalist.Remark : ", datalist.Remark);
  // console.log("datalist.ITEM_ID : ", datalist.ITEM_ID);

  if (datalist.Remark == null || datalist.Remark == undefined) {
    datalist.Remark = "";
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
                INSERT INTO ph.PurchaseBillDetail (Purchase_Bill_ID, ITEM_NO, ITEM_ID, ITEM_NAME, ITEM_Qty, ITEM_UNIT_ID, UNIT_NAME, PIC_ID, Remark)
                VALUES ( '${Bill_ID}' , '${index}', '${datalist.ITEM_ID}', '${datalist.ITEM_NAME}', ${datalist.ITEM_Qty} ,${datalist.UNIT_ID} ,${datalist.UNIT_NAME}, ${datalist.ITEM_PICT}, '${datalist.Remark}')

            `);
    res.json({ result: constants.kResultOk });
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
  // console.log("จบครั้งที่x : ", index);
});

router.post("/updateStatus/:status_code/:Bill_ID", async (req, res) => {
  const { status_code, Bill_ID } = req.params;
  // console.log("status_code : ", status_code);
  // console.log("Bill_ID : ", Bill_ID);
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            UPDATE ph.PurchaseBillMaster
            SET Status_Code = '${status_code}'
            WHERE Purchase_Bill_ID = '${Bill_ID}';
            `);
    res.json({ result: constants.kResultOk });
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});

router.post("/updateInspactor/:Emp_Code/:Bill_ID", async (req, res) => {
  const { Emp_Code, Bill_ID } = req.params;
  // console.log("Emp_Code : ", Emp_Code);
  // console.log("Bill_ID : ", Bill_ID);
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            UPDATE ph.PurchaseBillMaster
            SET Inspactor_ID = '${Emp_Code}'
            WHERE Purchase_Bill_ID = '${Bill_ID}';
            `);
    res.json({ result: constants.kResultOk });
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});


router.post("/updateBill_Detail/:Bill_ID", async (req, res) => {
  const { Bill_ID } = req.params;
  const  dataList  = req.body
  
  // console.log("datalist : ", dataList);
 
  //   console.log("--------------------")
    try {
      dataList.forEach(async (data, index) => {
        if (dataList[index].Remark == null || dataList[index].Remark == undefined) {
          dataList[index].Remark = "";
        }
        if(dataList[index].Price == undefined) {
          dataList[index].Price = null
        }
        //ปวดหัวอยู่ 2 วัน
        if(dataList[index].ITEM_UNIT_ID == undefined) {
          dataList[index].ITEM_UNIT_ID = dataList[index].UNIT_ID
        }
        if(dataList[index].UNIT_ID == undefined) {
          dataList[index].UNIT_ID = dataList[index].ITEM_UNIT_ID
        }
        

        // console.log("--------------------")
        // console.log("Bill_ID : " , Bill_ID)
        // console.log("ITEM_NO : " , index + 1)
        // console.log("ITEM_ID : " , dataList[index].ITEM_ID)
        // console.log("ITEM_Qty : ", dataList[index].ITEM_Qty)
        // console.log("ITEM_UNIT_ID : ", dataList[index].ITEM_UNIT_ID)
        // console.log("Price : " , dataList[index].Price)
        // console.log("PRICE : " , dataList[index].PRICE)
        // console.log("PIC_ID : ", dataList[index].PIC_ID)
        // console.log("--------------------")
    
      const pool = await poolPromise;
      const result = await pool.request().query(`
                INSERT INTO ph.PurchaseBillDetail (Purchase_Bill_ID, ITEM_NO, ITEM_ID, ITEM_Qty, ITEM_UNIT_ID, PRICE, PIC_ID, Remark)
                VALUES ( ${Bill_ID} , ${index + 1}, '${dataList[index].ITEM_ID}' , ${dataList[index].ITEM_Qty} , ${dataList[index].ITEM_UNIT_ID} , ${dataList[index].PRICE} , null , '${dataList[index].Remark}')
              `);
      })
      res.json({ result: constants.kResultOk });
    } catch (error) {
      res.json({ result: constants.kResultNok });
    } 
});

//DELETE FROM ph.PurchaseBillDetail WHERE Purchase_Bill_ID = '17' AND ITEM_NO = '2'
router.delete("/deleteFromEdit/:Bill_ID/:ITEM_NO", async (req, res) => {
  try {
    const { Bill_ID, ITEM_NO } = req.params;
    // console.log("Bill_ID หน้า BackEnd : ", Bill_ID);
    // console.log("ITEM_NO หน้า BackEnd : ", ITEM_NO);

    const pool = await poolPromise;
    const result = await pool.request().query(`
            DELETE FROM ph.PurchaseBillDetail 
            WHERE Purchase_Bill_ID = ${Bill_ID} AND ITEM_NO = ${ITEM_NO}
          `);
    res.json({ result: constants.kResultOk });
  } catch (error) {
    res.json({ result: "ERROR /deleteBillPurchase" });
  }
});

router.delete("/deleteBillPurchase/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // console.log("id : ", id);
    const pool = await poolPromise;
    const result = await pool.request().query(`
      DELETE ph.PurchaseBillMaster
      WHERE ph.PurchaseBillMaster.Purchase_Bill_ID = ${id}
          `);
    //res.json({ result: constants.kResultOk })
  } catch (error) {
    res.json({ result: "ERROR /deleteBillPurchase" });
  } finally {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      const result = await pool.request().query(`
      DELETE ph.PurchaseBillDetail
      WHERE ph.PurchaseBillDetail.Purchase_Bill_ID = ${id}
          `);
      res.json({ result: constants.kResultOk });
    } catch (error) {
      res.json({ result: "ERROR /deleteBillPurchase" });
    }
  }
});

//Delete All BillDetail
router.delete("/deleteBillDetail/:Bill_ID", async (req, res) => {
  try {
    const { Bill_ID } = req.params;
    // console.log("Bill_ID หน้า BackEnd : ", Bill_ID);
    

    const pool = await poolPromise;
    const result = await pool.request().query(`
              DELETE FROM ph.PurchaseBillDetail 
              WHERE Purchase_Bill_ID = ${Bill_ID}
          `);
    res.json({ result: constants.kResultOk });
  } catch (error) {
    res.json({ result: "ERROR /deleteBillDetail" });
  }
});


/////////////////////////////////// Employee ////////////////////////////////////////////////
router.get("/getEmployee/:request_id", async (req, res) => {
  const { request_id } = req.params;

  // console.log("request_id ", request_id);
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`                                                                   
              SELECT EmpCode, EmpFullName, DepartmentCode, 'http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EmpPict ,4,200),'\','/') AS EmpPict,
              SectionCode, PositionCode, NickName
              FROM dbo.Employee
              WHERE EmpCode = '${request_id}'
            `);
    res.json(result.recordset);
    // res.json({ result: result.recordset, message: constants.kResultOk });
  } catch (error) {
    res.json({ message: constants.kResultNok });
  }
});

// //ดึงข้อมูลแบบส่ง ID ไป เพื่อนำมาแก้ไขข้อมูล
// router.get("/getmodifymouldbill/:id", async(req, res) => {
//   const { id } = req.params
//   try {
//       const pool = await poolPromise;
//       const result = await pool.request().query(`
//               SELECT MM.* , EY.EmpFullName  FROM  Mould.MouldLentMaster MM LEFT JOIN Employee EY ON MM.Owner = EY.EmpCode
//               WHERE ID = ${ id }
//           `);
//       res.json(result.recordset)
//   } catch (error) {
//       res.json({ result: constants.kResultNok })
//   }
// })

module.exports = router;
