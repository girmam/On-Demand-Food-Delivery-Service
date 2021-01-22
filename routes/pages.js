const express = require('express');
const router = express.Router();

router.get("/", (req, res) => {
    res.render("index");
  });
  
  router.get("/restaurantSignup", (req, res) => {
    res.render("restaurantSignup");
  });
  
  router.get("/driverSignup", (req, res) => {
    res.render("driverSignup");
  });
  
  router.get("/restaurantHome", (req, res) => {
    res.render("restaurantHome");
  });
  
  router.get("/driverHome", (req, res) => {
    res.render("driverHome");
  });
  
  router.get("/login", (req, res) => {
    res.render("login");
  });

  router.get("/map", (req, res) => {
    res.render("map");
  });

  router.get("/map2", (req, res) => {
    res.render("map2");
  });


  router.get("/ordreInfo", (req, res) => {
    res.render("ordreInfo");
  });

  
  
  module.exports = router;