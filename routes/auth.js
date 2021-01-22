const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');

router.post("/driverSignup", authController.driverSignup);
router.post("/restaurantSignup", authController.restaurantSignup);
router.post("/login", authController.login);
router.post("/restorder", authController.restorder);
router.post("/orderinfo", authController.orderinfo);
router.post("/Driverorderinfo", authController.Driverorderinfo);
router.post("/driverAceptingRequest", authController.driverAceptingRequest);
router.post("/orderinfoInMap", authController.orderinfoInMap);
router.post("/changeOrderStatus", authController.changeOrderStatus);
router.post("/orderLocationData", authController.orderLocationData);


  module.exports = router;
