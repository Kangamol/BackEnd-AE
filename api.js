const express = require("express");
const router = express.Router();


router.use(require("./api_authen"))
    // router.use(require("./api_stock"))
router.use(require("./api_repairdoc"))
router.use(require("./api_Device"))
router.use(require("./api_report"))
router.use(require("./api_Mould"))
router.use(require("./api_orderstatus"))
router.use(require("./api_stone"))
router.use(require("./api_PurchaseRequest"))


module.exports = router;