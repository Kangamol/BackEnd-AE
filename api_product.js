const express = require("express");
const router = express.Router();
const constants = require("./constant");
const poolPromise = require("./connect_mssql");

module.exports = router;



router.post("/productCalprice", async (req, res) => {
  const { SilverPrice, Silver_TopUp, Material_TopUp, Labor_TopUp, PriceType, ExchangeRate, TotalTopup, ProductID_Input } = req.body;
//   console.log(req.body)
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        DECLARE @SilverPrice FLOAT = ${SilverPrice}
        DECLARE @Silver_TopUp FLOAT = ${Silver_TopUp}
        DECLARE @Material_TopUp FLOAT = ${Material_TopUp}
        DECLARE @Labor_TopUp FLOAT = ${Labor_TopUp}
        DECLARE @PriceType CHAR = '${PriceType}'
        DECLARE @ExchangeRate FLOAT = ${ExchangeRate}
        DECLARE @TotalTopup FLOAT = ${TotalTopup}
        DECLARE @ProductID_Input VARCHAR(30) = '${ProductID_Input}'
        
        SELECT	ProductID, ProductCode, ProductDesc, 
                ('http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(NewPict,4,200),'\','/'))AS NewPict,
                NetWeightCal,
                (SilverPrice * @Silver_TopUp)AS TotalSilverPrice,
                (MatPrice * @Material_TopUp)AS TotalMatPrice,
                (LaborCost * @Labor_TopUp)AS TotalLabor,
                (((SilverPrice * @Silver_TopUp) + (MatPrice * @Material_TopUp) + (LaborCost * @Labor_TopUp))* @TotalTopup)AS TotalPrice
        FROM	(SELECT	PM.*, ISNULL((SELECT SUM(TotalMatPrice) FROM (
                        SELECT IIF(@PriceType = '1', 
                                    CASE --ราคา 1
                                        WHEN InvMaster.PriceType = 'Q' THEN PD.Qty * StdPrice
                                        WHEN InvMaster.PriceType = 'W' THEN (PD.Qty * WgUnit) * StdPrice
                                    END ,
                                    CASE --ราคา 2
                                        WHEN InvMaster.PriceType = 'Q' THEN PD.Qty * StdPrice2
                                        WHEN InvMaster.PriceType = 'W' THEN (PD.Qty * WgUnit) * StdPrice2
                                    END
                                    )AS TotalMatPrice
                        FROM	ProductDetail PD JOIN InvMaster ON PD.InvCode = InvMaster.InvCode
                                LEFT JOIN InvCostCal ON InvMaster.InvCode = InvCostCal.InvCode
                        WHERE	PD.ProductID = @ProductID_Input)AS A), 0)AS MatPrice, 
                        (NetWeightCal * @SilverPrice)AS SilverPrice,
                        (CastingCost + PolishingCost + PlattingCost + SandCost + RhodiumCost + OtherCost
                        + PackingCost + QcCost + AdminCost
                        + ISNULL((SELECT SUM(PD.Qty * SC.Cost)AS Total
                                FROM ProductDetail PD JOIN InvMaster IM ON PD.InvCode = IM.InvCode
                                        JOIN StoneSettingCost SC ON IM.StoneShapeCode = SC.StoneShapeCode AND IM.StoneSizeCode = SC.StoneSizeCode AND PD.SettingTypeCode = SC.SettingTypeCode
                                WHERE ProductID = @ProductID_Input AND PD.InvGroupCode IN ('02', '03', '04', '05', '06')
                                ),0)) LaborCost 
                FROM	ProductMaster PM
                WHERE	PM.ProductID = @ProductID_Input) AS AA
            `);
    res.json(result.recordset);
  } catch (error) {
    res.json({ result: constants.kResultNok });
  }
});
