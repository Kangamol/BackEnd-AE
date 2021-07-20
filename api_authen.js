const express = require("express");
const router = express.Router();
const user = require("./models/user");
const bcrypt = require("bcryptjs");
const constants = require("./constant");
const poolPromise = require("./connect_mssql");



router.post("/login", async(req, res) => {
    try {
        const { username, password } = req.body;
        // console.log(username, password);
        const pool = await poolPromise
        const result = await pool.request()
            .query(`
            SELECT  EM.EmpCode, EM.Password, EM.EmpFullName, EM.TokenSQL, EM.PolicyCode, PN.PolicyName, 
            'http://172.16.0.15/aeweb/picture/'+REPLACE(SUBSTRING(EmpPict ,4,200),'\','/') AS EmpPict, (ProductionTeam) AS Factory
            FROM
            (SELECT	EM.EmpCode, Password, EM.EmpFullName, ((CONVERT(float, EM.EmpCode)*151)/4)AS TokenSQL, ISNULL(EP.PolicyCode, '01')AS PolicyCode, EM.EmpPict, EM.ProductionTeam
            FROM	Employee EM LEFT JOIN MA.EmpPolicy EP ON EM.EmpCode = EP.EmpCode
            WHERE	EM.EmpCode = '${username}'
            )AS		EM LEFT JOIN MA.PolicyName PN ON EM.PolicyCode = PN.PolicyCode

        `);


        // เอาค่า result มาแยก
        const { EmpCode, Password, EmpFullName, TokenSQL, PolicyCode, PolicyName, EmpPict, Factory } = result.recordset[0];
        // เช็คUsername และ password
        if (EmpCode) {
            if (Password == password) {
                res.json({ result: constants.kResultOk, fullName: EmpFullName, token: TokenSQL, PolicyCode: PolicyCode, PolicyName: PolicyName, EmpPict: EmpPict, Factory: Factory });
            } else {
                res.json({ result: "Incorrect Password" });
            }
        } else {
            res.json({ result: constants.kResultNok });
        }
    } catch (error) {
        res.json({ result: "Username invalid" })
            // console.log(error);
    }
})


router.post("/register", async(req, res) => {
    try {
        // console.log("register: " + JSON.stringify(req.body));
        req.body.password = await bcrypt.hash(req.body.password, 8);
        const result = await user.create(req.body)
        res.json({ result: constants.kResultOk, message: JSON.stringify(result) });
    } catch (error) {
        res.json({ result: constants.kResultNok, message: JSON.stringify(error) });
    }
})




module.exports = router;