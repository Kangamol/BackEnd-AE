const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const constants = require("./constant");
const poolPromise = require("./connect_mssql");

const jwt = require("jsonwebtoken");
const auth = require("./middleware/auth");


router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const pool = await poolPromise
        const { recordsets } = await pool.request()
            .query(`
            SELECT  EM.EmpCode, EM.Password, EM.EmpFullName, EM.PolicyCode, PN.PolicyName, Appove, EM.QueUpdate, EM.StatusUpdate, EM.reviseMoldStatus,
                'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EmpPict ,4,200),'\','/') AS EmpPict, (ProductionTeam) AS Factory
                FROM
                (SELECT	EM.EmpCode, Password, EM.EmpFullName,  ISNULL(EP.PolicyCode, '01')AS PolicyCode, EM.EmpPict, 
					EM.ProductionTeam, ISNULL(EP.Appove, 0)AS Appove, UP.QueUpdate, UP.StatusUpdate ,UP.reviseMoldStatus
                FROM	Employee EM LEFT JOIN MA.EmpPolicy EP ON EM.EmpCode = EP.EmpCode
								LEFT JOIN MT_UserPolicy UP ON UP.EmpCode = EM.EmpCode
                WHERE	EM.EmpCode = '${username}' AND IsResign != '1'
                )AS		EM LEFT JOIN MA.PolicyName PN ON EM.PolicyCode = PN.PolicyCode

                -- QA TEAM
                SELECT QATeam, isReceive, isDelete FROM qaPolicyQATeam
                WHERE EmpCode = '${username}'

                -- FAC TEAM
                SELECT FacTeam, isReceive, isDelete FROM qaPolicyFacTeam
                WHERE EmpCode = '${username}'

        `);
        // เอาค่า result มาแยก
        const { EmpCode, Password, EmpFullName, PolicyCode, PolicyName, EmpPict, Factory, Appove, QueUpdate, StatusUpdate, reviseMoldStatus } = recordsets[0][0];
        // เช็คUsername และ password
        if (EmpCode) {
            if (Password == password) {
                const token = jwt.sign(
                    { userId: EmpCode },
                    process.env.TOKEN_KEY,
                    {
                        // ถ้าต้องการเป็นหน่วยวินาที ให้ป้อนเป็น type Number
                        expiresIn: '4H',
                        //   expiresIn: 10,
                    }
                );
                res.json({
                    result: constants.kResultOk,
                    fullName: EmpFullName,
                    token: token,
                    PolicyCode: PolicyCode,
                    PolicyName: PolicyName,
                    EmpPict: EmpPict,
                    Factory: Factory,
                    Appove: Appove,
                    QueUpdate: QueUpdate,
                    StatusUpdate: StatusUpdate,
                    reviseMoldStatus: reviseMoldStatus,
                    isQATeam: recordsets[1],
                    isFacTeam: recordsets[2]
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


router.post("/checktoken", auth, async (req, res) => {
    const { token } = req.body;
    // console.log(token);
    try {
        res.status(200).json({ apiResult: true, message: "Valid Token" });
    } catch (error) {
        res.status(500).json({ error: error });
    }
});


router.get("/getemp-detail/:EmpCode", async (req, res) => {
    const { EmpCode } = req.params
    // console.log(process.env.TOKEN_KEY);
    // const token = jwt.sign(
    //     { userId: EmpCode, email : 'ttt@gmail.com' },
    //     process.env.TOKEN_KEY,
    //     {
    //       // ถ้าต้องการเป็นหน่วยวินาที ให้ป้อนเป็น type Number
    //       expiresIn: "30d",
    //     //   expiresIn: 10,
    //     }
    //   );
    //   res.status(200).json({
    //     apiResult: true,
    //     message: "Login Success",
    //     token: token,
    //   });

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
		'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EmpPict,4,200),'\','/')AS EmpPhoto
        FROM	Employee LEFT JOIN Department ON Employee.DepartmentCode = Department.DepartmentCode
                LEFT JOIN Position ON Employee.PositionCode = Position.PositionCode
        WHERE	EmpCode = '${EmpCode}'
            `);
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});


router.post("/emp-create", async (req, res) => {
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


router.get("/depart-new", async (req, res) => {
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

router.get("/position-new", async (req, res) => {
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


router.get("/emp-findAll", async (req, res) => {
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


router.delete("/emp-delete/:EmpCode", async (req, res) => {
    const { EmpCode } = req.params
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
                DELETE FROM MA.EmpNew
                WHERE EmpCode = '${EmpCode}'
        `)
        res.json({ result: constants.kResultOk, message: result });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})


router.post("/emp-update/:id", async (req, res) => {
    const { id } = req.params;
    const { EmpCode, EmpFName, EmpLName, Password, EmpPict, Gender, DateStart, NickName, DepartCode, PositionCode, StatusCode } = req.body;
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
        res.json({ result: constants.kResultOk, message: result });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})



// SET POLICY EMP

router.get("/emppolicy-findAll", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT  EP.*, EE.EmpFullName, EE.NickName,
		        'http://192.168.3.5:3000/picture/'+REPLACE(SUBSTRING(EE.EmpPict,4,200),'\','/') EmpPict
        FROM    MA.EmpPolicy EP JOIN Employee EE ON EP.EmpCode = EE.EmpCode
        `)
        res.json(result.recordset);
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})

router.get("/emppolicy-policyname", async (req, res) => {
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

router.post("/emppolicy-create", async (req, res) => {
    const { EmpCode, PolicyCode, Appove } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            INSERT INTO MA.EmpPolicy VALUES ('${EmpCode}', '${PolicyCode}', '${Appove}', NULL );
        `)
        res.json({ result: constants.kResultOk, message: result });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})


router.patch("/emppolicy-update/:id", async (req, res) => {
    const { id } = req.params;
    const { EmpCode, PolicyCode, Appove } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
		UPDATE MA.EmpPolicy SET EmpCode = '${EmpCode}', PolicyCode = '${PolicyCode}', Appove = '${Appove}'
		WHERE EmpCode = '${id}'
        `)
        res.json({ result: constants.kResultOk, message: result });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})

router.post("/checkPassword", async (req, res) => {
    const { username, password } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        SELECT Password FROM Employee
        WHERE EmpCode = '${username}'
        `)
        res.json({ result: result.recordset[0].Password === password ? true : false });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
});

router.post("/updatepassword", async (req, res) => {
    const { username, passwordOld, passwordNew } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
        UPDATE EY SET Password = '${passwordNew}'
        FROM	Employee EY
        WHERE	EY.EmpCode = '${username}'

        INSERT INTO MA.HistoryChangePassword (EmpCode, OldPassword, NewPassword)
        VALUES ('${username}', '${passwordOld}', '${passwordNew}')
        `)
        res.json({ result: constants.kResultOk });
    } catch (error) {
        res.json({ result: constants.kResultNok });
    }
})





module.exports = router;





