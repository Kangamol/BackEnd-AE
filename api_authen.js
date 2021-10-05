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
            SELECT  EM.EmpCode, EM.Password, EM.EmpFullName, EM.TokenSQL, EM.PolicyCode, PN.PolicyName, Appove, 
            'http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EmpPict ,4,200),'\','/') AS EmpPict, (ProductionTeam) AS Factory
            FROM
            (SELECT	EM.EmpCode, Password, EM.EmpFullName, ((1234 * 151))AS TokenSQL, ISNULL(EP.PolicyCode, '01')AS PolicyCode, EM.EmpPict, 
					EM.ProductionTeam, ISNULL(EP.Appove, 0)AS Appove
            FROM	Employee EM LEFT JOIN MA.EmpPolicy EP ON EM.EmpCode = EP.EmpCode
            WHERE	EM.EmpCode = '${ username }'
            )AS		EM LEFT JOIN MA.PolicyName PN ON EM.PolicyCode = PN.PolicyCode

        `);
        // เอาค่า result มาแยก
        const { EmpCode, Password, EmpFullName, TokenSQL, PolicyCode, PolicyName, EmpPict, Factory, Appove } = result.recordset[0];
        // เช็คUsername และ password
        if (EmpCode) {
            if (Password == password) {
                res.json({ 
                    result: constants.kResultOk, 
                    fullName: EmpFullName, 
                    token: TokenSQL, 
                    PolicyCode: PolicyCode, 
                    PolicyName: PolicyName, 
                    EmpPict: EmpPict, 
                    Factory: Factory,
                    Appove: Appove
                 });
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


// router.post("/register", async(req, res) => {
//     try {
//         // console.log("register: " + JSON.stringify(req.body));
//         req.body.password = await bcrypt.hash(req.body.password, 8);
//         const result = await user.create(req.body)
//         res.json({ result: constants.kResultOk, message: JSON.stringify(result) });
//     } catch (error) {
//         res.json({ result: constants.kResultNok, message: JSON.stringify(error) });
//     }
// })



router.get("/getemp-detail/:EmpCode", async(req, res) => {
    const { EmpCode } = req.params
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT	EmpCode, EmpFullName, NickName AS EmpNickname,
		CASE
			WHEN Gender = 'M' THEN 'ชาย'
			WHEN Gender = 'F' THEN 'หญิง'
		END EmpSex, DepartmentName AS EmpDepartment,
		PositionName AS EmpPosition,
		Employee.DateStart AS EmpWork_start,
		'http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EmpPict,4,200),'\','/')AS EmpPhoto
        FROM	Employee LEFT JOIN Department ON Employee.DepartmentCode = Department.DepartmentCode
                LEFT JOIN Position ON Employee.PositionCode = Position.PositionCode
        WHERE	EmpCode = '${ EmpCode }'
            `);
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});


router.post("/emp-create", async(req, res) => {
    const { EmpCode, EmpFName, EmpLName, Password, EmpPict, Gender, DateStart, NickName, DepartCode, PositionCode, StatusCode } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        INSERT INTO MA.EmpNew (EmpCode, EmpFName, EmpLName, Password, EmpPict, Gender, DateStart, NickName, DepartCode, PositionCode, StatusCode)
        VALUES (
                '${EmpCode}',
                '${EmpFName}',
                '${EmpLName}',
                '${Password}',
                '${EmpPict}',
                '${Gender}',
                '${DateStart}',
                '${NickName}',
                '${DepartCode}',
                '${PositionCode}',
                '${StatusCode}'
        )
        `)
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})


router.get("/depart-new", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
             SELECT * FROM MA.DepartmentNew
            `);
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});

router.get("/position-new", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT * FROM MA.PositionNew
        `)
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})


router.get("/emp-findAll", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT	EmpCode, EmpFName, EmpLName, Password, Gender, DateStart, NickName, DN.DepartCode, DN.DepartName,PN.PositionCode, PN.PositionName, StatusCode
                FROM MA.EmpNew EN LEFT JOIN MA.DepartmentNew DN ON EN.DepartCode = DN.DepartCode
                LEFT JOIN MA.PositionNew PN ON EN.DepartCode = PN.DepartCode AND EN.PositionCode = PN.PositionCode
        `)
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})


router.delete("/emp-delete/:EmpCode", async(req, res) => {
    const { EmpCode } = req.params
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                DELETE FROM MA.EmpNew
                WHERE EmpCode = '${ EmpCode }'
        `)
        res.json({ result: constants.kResultOk , message: result});
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})


router.post("/emp-update/:id", async(req, res) => {
    const { id } = req.params;
    const { EmpCode , EmpFName ,EmpLName , Password, EmpPict ,Gender ,DateStart , NickName , DepartCode , PositionCode, StatusCode } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                UPDATE MA.EmpNew SET 
                    EmpCode = '${EmpCode}',
                    EmpFName = '${EmpFName}',
                    EmpLName = '${EmpLName}',
                    Password = '${Password}',
                    EmpPict = '${EmpPict}',
                    Gender = '${Gender}',
                    DateStart = '${DateStart}',
                    NickName = '${NickName}',
                    DepartCode = '${DepartCode}',
                    PositionCode = '${PositionCode}',
                    StatusCode = '${StatusCode}'
                WHERE EmpCode = '${id}'
        `)
        res.json({ result: constants.kResultOk , message: result});
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})



// SET POLICY EMP

router.get("/emppolicy-findAll", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT  EP.*, EE.EmpFullName, EE.NickName,
		        'http://172.16.0.5:3000/picture/'+REPLACE(SUBSTRING(EE.EmpPict,4,200),'\','/') EmpPict
        FROM    MA.EmpPolicy EP JOIN Employee EE ON EP.EmpCode = EE.EmpCode
        `)
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})

router.get("/emppolicy-policyname", async(req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                SELECT * FROM MA.PolicyName
        `)
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})

router.post("/emppolicy-create", async(req, res) => {
    const { EmpCode, PolicyCode, Appove } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            INSERT INTO MA.EmpPolicy VALUES ('${EmpCode}', '${PolicyCode}', '${Appove}', NULL );
        `)
        res.json({ result: constants.kResultOk , message: result});
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})


router.patch("/emppolicy-update/:id", async(req, res) => {
    const { id } = req.params;
    const { EmpCode, PolicyCode, Appove } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
		UPDATE MA.EmpPolicy SET EmpCode = '${EmpCode}', PolicyCode = '${PolicyCode}', Appove = '${Appove}'
		WHERE EmpCode = '${ id }'
        `)
        res.json({ result: constants.kResultOk , message: result});
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})


module.exports = router;





