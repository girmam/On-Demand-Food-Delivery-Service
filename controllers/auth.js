const mysql = require("mysql");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
var distance = require("google-distance-matrix");
//creat a google-geolocation
const geolocation = require("google-geolocation")({
  key: "AIzaSyDNGXcohjpGB_cXoALG1L0bghk64rYiCf4",
});
// const getmac = require('getmac')
// const callMac = () =>{
//     return getmac.default()
// }
// Configure API parameters for google-geolocation
var driver_id = [];
var driver_id2;
const params = {
  wifiAccessPoints: [
    {
      macAddress: "01:23:45:67:89:AB",
      signalStrength: -65,
      signalToNoiseRatio: 40,
    },
  ],
};

var db = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.DATABASE_USER,
  password: process.env.PASSWORED,
  database: process.env.DATABASE,
});

/**
 * add order into database
 * @param {*} req contain a data related to the order from fron end html form
 * @param {*} res  send data and status to the fron end
 */
exports.restorder = (req, res) => {
  console.log(req.body);
  var { name, id, orderaddress, restaurantaddress } = req.body;

  //route distance and time calculation
  var origins = [restaurantaddress];
  var destinations = [orderaddress];
  distance.key("AIzaSyDNGXcohjpGB_cXoALG1L0bghk64rYiCf4");
  distance.units("imperial");
  distance.matrix(origins, destinations, function (err, distances) {
    if (err) {
      return console.log(err);
    }
    if (!distances) {
      return console.log("no distances");
    }
    if (distances.status == "OK") {
      for (var i = 0; i < origins.length; i++) {
        for (var j = 0; j < destinations.length; j++) {
          var origin = distances.origin_addresses[i];
          var destination = distances.destination_addresses[j];
          if (distances.rows[0].elements[j].status == "OK") {
            var distance = distances.rows[i].elements[j].distance.text;
            var duration = distances.rows[i].elements[j].duration.text;
            console.log(
              "Distance from " +
                origin +
                " to " +
                destination +
                " is " +
                distance +
                "takes " +
                duration
            );

            var orderPrice = parseFloat(parseFloat(distance) - 1 * 2);
            var minPrice = parseFloat(5);
            console.log(orderPrice);
            if (orderPrice < minPrice) {
              name = null;
              orderaddress = null;
            }
            //add distance to the database
            db.query(
              "INSERT INTO orders SET ? ",
              {
                name: name,
                id: id,
                orderaddress: orderaddress,
                restaurantaddress: restaurantaddress,
                distance: distance,
              },
              (error, result) => {
                if (error) {
                  console.log(error);
                  return res.render("restaurantHome", {
                    Omessage: "The minimum order cost must be $5.00, so the distance is too small.",
                  });
                } else {
                  console.log(result);
                  return res.render("restaurantHome", {
                    Omessage: "order saved",
                  });
                }
              }
            );
          } else {
            console.log(
              destination + " is not reachable by land from " + origin
            );
            return res.render("restaurantHome", {
              Omessage: "invalid address",
            });
          }
        }
      }
    }
  });
};

/**
 * change order status after the order is delivered and transfer money for the driver
 * @param {*} req contain a data related to the order from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.changeOrderStatus = (req, res) => {
  console.log(req.body);
  const { id, orderid } = req.body;
  db.query(
    "UPDATE orders SET status = ? WHERE orderid = ?",
    ["delivered", orderid],
    async (error, result) => {
      if (error) {
        console.log(error);
      } else {
        db.query(
          "SELECT * FROM orders WHERE orderid = ?",
          [orderid],
          async (error, Oresult) => {
            if (error) {
              console.log(error);
            } else {
              console.log(Oresult);

              //calculate payment for driver
              var NewpaymentAmount =
                5 + (parseFloat(Oresult[0].distance) - 1) * 2;

              db.query(
                "SELECT * FROM drivers WHERE id = ?",
                [id],
                async (error, result) => {
                  if (error) {
                    console.log(error);
                  } else {
                    console.log(result);
                    //get the amount of money olredy in the database and add the new amount to the old amount
                    var OldpaymentAmount =
                      parseInt(result[0].payment) + NewpaymentAmount;

                    //and save the  money in driver database
                    db.query(
                      "UPDATE drivers SET payment = ? WHERE id = ?",
                      [OldpaymentAmount, id],
                      async (error, result) => {
                        if (error) {
                          console.log(error);
                        } else {
                          console.log(result);
                        }
                      }
                    );
                    driverLocation(id); //update driver location in the database
                    //save delivered order in the order history table
                    db.query(
                      "INSERT INTO orderHistory SET ? ",
                      {
                        driverid: id,
                        orderid: orderid,
                        restid: Oresult[0].id,
                        payment: NewpaymentAmount,
                        orderName: Oresult[0].name,
                        orderAddress: Oresult[0].orderaddress,
                      },
                      (error, result) => {
                        if (error) {
                          console.log(error);
                        }
                      }
                    );
                  }
                }
              );
            }
          }
        );
      }
      res.status(200).render("map", {});
    }
  );
};

/**
 * send order information for restaurant
 * @param {*} req contain a data related to the order from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.orderinfo = (req, res) => {
  console.log(req.body);
  const { id } = req.body;
  db.query("SELECT * FROM orders WHERE id = ?", [id], async (error, result) => {
    if (error) {
      console.log(error);
    } else {
      console.log(result);

      var data = [];
      for (let index = 0; index < result.length; index++) {
        data.push(result[index].orderaddress);
      }
      console.log("data is" + data[0]);

      // res.status(200).render('restaurantHome', {
      //     orders: JSON.stringify(data),
      // });

      res.status(200).render("restaurantHome", {
        orders: result,
      });
    }
  });
};

/**
 * process order requests for driver based on their location
 * @param {*} req contain a data related to the order from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.Driverorderinfo = (req, res) => {
  // Get current location of the driver
  geolocation(params, (err, data) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log(data.location);
    //get order data from the database
    db.query(
      "SELECT * FROM orders WHERE status = ? AND driverid = ?",
      ["not delivered", 0],
      async (error, result) => {
        if (error) {
          console.log(error);
        } else {
          var dataForDriver = []; //will contain orders with in  <40 mile from drivers current location
          //for loop in all order data to check orders
          for (let b = 0; b < result.length; b++) {
            //route distance and time calculation
            var origins = [data.location.lat + "," + data.location.lng]; //curent location of the driver
            console.log(origins);
            var destinations = [result[b].restaurantaddress]; //restaurant location
            distance.key("AIzaSyDNGXcohjpGB_cXoALG1L0bghk64rYiCf4");
            distance.units("imperial"); //define the mesurment system
            distance.mode("driving");
            distance.matrix(origins, destinations, function (err, distances) {
              if (err) {
                return console.log(err);
              }
              if (!distances) {
                return console.log("no distances");
              }
              if (distances.status == "OK") {
                for (var i = 0; i < origins.length; i++) {
                  for (var j = 0; j < destinations.length; j++) {
                    var origin = distances.origin_addresses[i];
                    var destination = distances.destination_addresses[j];
                    if (distances.rows[0].elements[j].status == "OK") {
                      var distance =
                        distances.rows[i].elements[j].distance.text;
                      var duration =
                        distances.rows[i].elements[j].duration.value;
                      console.log(
                        "Distance from " +
                          origin +
                          " to " +
                          destination +
                          " is " +
                          distance +
                          " takes " +
                          duration
                      );
                      //a condtion to send orders for driver only far from the rsturant in <40 munit or 2400 seconds
                      if (duration < 2400) {
                        dataForDriver.push(result[b]);
                      }
                      if (b == result.length - 1) {
                        //send data for the driver dashbored
                        res.status(200).render("driverHome", {
                          ListOforders: dataForDriver,
                        });
                      }
                    } else {
                      console.log(
                        destination + " is not reachable by land from " + origin
                      );
                    }
                  }
                }
              }
            });
          }
        }
      }
    );
  });
};

/**
 * desplay accepted order requests in map page
 * @param {*} req contain a data related to the order from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.orderinfoInMap = (req, res) => {
  console.log(req.body);
  const { driverid } = req.body;
  driverLocation(driverid);
  db.query(
    "SELECT * FROM orders WHERE driverid = ? AND status = ?",
    [driverid, "not delivered"],
    async (error, result) => {
      if (error) {
        console.log(error);
      } else {
        console.log(result);
        res
          .status(200)
          .render("map", {
            orders: result,
          })
          .redirect("/map");
      }
    }
  );
};

/**
 * driver acepting order request. it counts and check if they have undelivered
 * 2 orders from the same resturant. but it allows acepting order more than two from different resturant.
 * @param {*} req contain a data related to the order from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.driverAceptingRequest = (req, res) => {
  console.log(req.body);
  const { orderid, driverid } = req.body;
  driverLocation(driverid); //add driver curent location to the database
  //sql quary in the database

  var restaurant_id = 0;
  db.query(
    "SELECT id FROM orders WHERE orderid = ? ",
    [orderid],
    async (error, result) => {
      if (error) {
        console.log(error);
      } else {
        console.log("result[0].id");
        console.log(result[0].id);
        restaurant_id = result[0].id;
        //count number of orders not delvered related to the driver and same restaurant
        db.query(
          "SELECT  COUNT(driverid) AS count FROM  orders  WHERE status = ? AND driverid = ? AND id = ? ",
          ["not delivered", driverid, restaurant_id],
          async (error, result2) => {
            //console.log(result[0].count);
            //f 2 orders are being dispatch from the same restaurant to 2 different locations,
            // the delivery cost of the 2nd order cannot be more than the cost of the original
            //distance from the restaurant to the customer address.
            var existing_Order_Rest_id = 0;
            var existing_Order_dstance = 0;
            var new_Order_Rest_id = 0;
            var new_Order_dstance = 0;
            // //get previous order related to same resturant and driver id to check the second order ditance
            db.query(
              "SELECT id, distance  FROM orders WHERE driverid = ? AND status = ?  ",
              [driverid, "not delivered"],
              async (error, result) => {
                if (error) {
                  console.log(error);
                } else {
                  if (result[0] !== undefined) {
                    existing_Order_Rest_id = result[0].id;
                    existing_Order_dstance = parseFloat(result[0].distance);
                    console.log(existing_Order_Rest_id);
                    console.log(existing_Order_dstance);
                  }
                  //get the restaurant id and driver information to deside the second order is elegbke to accept
                  db.query(
                    "SELECT id, distance FROM orders WHERE driverid = ? AND status = ? AND orderid = ?",
                    [0, "not delivered", orderid],
                    async (error, result) => {
                      if (error) {
                        console.log(error);
                      } else {
                        if (result[0] !== undefined) {
                          new_Order_Rest_id = result[0].id;
                          new_Order_dstance = parseFloat(result[0].distance);
                        }
                        console.log(new_Order_Rest_id);
                        console.log(new_Order_dstance);
                        //conditions to accept orders
                        if (
                          result2[0].count >= 2 ||
                          (new_Order_Rest_id == existing_Order_Rest_id &&
                            new_Order_dstance > existing_Order_dstance &&
                            new_Order_dstance != 0 &&
                            existing_Order_dstance != 0)
                        ) {
                          console.log("yes you can");
                          if (result2[0].count >= 2) {
                            res.status(200).render("driverHome", {
                              notProcessed:
                                "The max delivery request you can accept from the same place is 2!",
                            });
                          } else {
                            res.status(200).render("driverHome", {
                              notProcessed:
                                "Sorry! The second undelivered order can not be farther from the previous order from this restaurant.",
                            });
                          }
                        } else {
                          db.query(
                            "UPDATE orders SET driverid = ? WHERE orderid = ?",
                            [driverid, orderid],
                            async (error, result) => {
                              if (error) {
                                console.log(error);
                              } else {
                                console.log(result);

                                res.status(200).render("driverHome", {
                                  orders: result,
                                });
                              }
                            }
                          );
                          res.status(200).render("driverHome", {});
                        }
                      }
                    }
                  );
                }
              }
            );
          }
        );
      }
    }
  );
};

/**
 * process drivers regstration
 * @param {*} req contain a data related to the driver from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.driverSignup = (req, res) => {
  console.log(req.body);
  const {
    name,
    email,
    password,
    PasswordConfirm,
    license,
    phone,
    bank,
  } = req.body;
  db.query(
    "SELECT email FROM drivers WHERE email = ?",
    [email],
    async (error, result) => {
      if (error) {
        console.log(error);
      }
      if (result.length > 0) {
        return res.render("driverSignup", {
          Dmessage: "that email is already in use",
        });
      } else if (password !== PasswordConfirm) {
        return res.render("driverSignup", {
          Dmessage: "passwords do not match",
        });
      }
      let hashedPasswored = await bcrypt.hash(password, 8);
      console.log(hashedPasswored);
      db.query(
        "INSERT INTO drivers SET ? ",
        {
          name: name,
          email: email,
          password: hashedPasswored,
          license: license,
          phone: phone,
          bank: bank,
        },
        (error, result) => {
          if (error) {
            console.log(error);
          } else {
            console.log(result);
            return res.render("driverSignup", {
              Dmessage: "driver registered",
            });
          }
        }
      );
    }
  );
};

/**
 * process restaurant sregistration
 * @param {*} req contain a data related to the restaurant from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.restaurantSignup = (req, res) => {
  console.log(req.body);
  console.log(req.body);
  const {
    name,
    email,
    password,
    PasswordConfirm,
    address,
    phone,
    creditCard,
  } = req.body;

  //for addres validation
  var origins = [address];
  var destinations = ["186 Acalanes Drive, Sunnyvale, CA"];
  distance.key("AIzaSyDNGXcohjpGB_cXoALG1L0bghk64rYiCf4");
  distance.units("imperial");
  distance.matrix(origins, destinations, function (err, distances) {
    if (err) {
      return console.log(err);
    }
    if (!distances) {
      return console.log("no distances");
    }
    if (distances.status == "OK") {
      for (var i = 0; i < origins.length; i++) {
        for (var j = 0; j < destinations.length; j++) {
          var origin = distances.origin_addresses[i];
          var destination = distances.destination_addresses[j];
          if (distances.rows[0].elements[j].status == "OK") {
            var distance = distances.rows[i].elements[j].distance.text;
            var duration = distances.rows[i].elements[j].duration.text;
            console.log(
              "Distance from " +
                origin +
                " to " +
                destination +
                " is " +
                distance +
                "takes " +
                duration
            );

            db.query(
              "SELECT email FROM restaurants WHERE email = ?",
              [email],
              async (error, result) => {
                if (error) {
                  console.log(error);
                }
                if (result.length > 0) {
                  return res.render("restaurantSignup", {
                    message: "that email is already in use",
                  });
                } else if (password !== PasswordConfirm) {
                  return res.render("restaurantSignup", {
                    message: "passwords do not match",
                  });
                }

                let hashedPasswored = await bcrypt.hash(password, 8);
                console.log(hashedPasswored);
                db.query(
                  "INSERT INTO restaurants SET ? ",
                  {
                    name: name,
                    email: email,
                    password: hashedPasswored,
                    address: address,
                    phone: phone,
                    creditCard: creditCard,
                  },
                  (error, result) => {
                    if (error) {
                      console.log(error);
                    } else {
                      console.log(result);
                      return res.render("restaurantSignup", {
                        message: "restaurant registered",
                      });
                    }
                  }
                );
              }
            );
          } else {
            return res.render("restaurantSignup", {
              message: "invalid address",
            });
          }
        }
      }
    }
  });
};

/**
 * users sign in to the wabe page and setup jwt cookis
 * @param {*} req contain a data related to the login information from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).render("login", {
        message: "please provide email and password",
      });
    }
    //if the sign in information is from driver
    db.query(
      "SELECT * FROM drivers WHERE email = ?",
      [email],
      async (error, result) => {
        //console.log(result);
        if (!result || !(await bcrypt.compare(password, result[0].password))) {
          res.status(400).render("login", {
            message: "wrong email or password",
          });
        } else {
          //clear the array everytime log in and store the new loged in driver id
          while (driver_id.length > 0) {
            driver_id.pop();
          }
          driver_id2 = result[0].id;
          driver_id.push(result[0].id);
          const id = result[0].id;
          const token = jwt.sign({ id: id }, process.env.JWT_SECRET, {
            //all users have a unique token
            expiresIn: process.env.JWT_EXPIREIN, //oure cookie expire in 90 days for jwt
          });
          console.log("the token is : " + token);
          const cookieoption = {
            expires: new Date(
              Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000 //oure cookie expire in 90 days
            ),
            httponly: true,
          };
          res.cookie("jwt", token, cookieoption);

          //display order histroy for the driver home page
          var historyData = [];
          db.query(
            "SELECT * FROM orderHistory WHERE driverid = ?",
            [id],
            async (error, result) => {
              if (error) {
                console.log(error);
              } else {
                console.log(result);
                for (let k = 0; k < result.length; k++) {
                  historyData.push(result[k]);
                }
              }
            }
          );
          driverLocation(id); //add or update driver curent location to the database
          res
            .status(200)
            .render("driverHome", {
              Dname: result[0],
              ordersHistory: historyData,
            })
            .redirect("/driverHome");
        }
      }
    );
    //if the sign in from restaurants owner
    db.query(
      "SELECT * FROM restaurants WHERE email = ?",
      [email],
      async (error, result) => {
        /// console.log(result);
        if (!result || !(await bcrypt.compare(password, result[0].password))) {
          res.status(400).render("login", {
            message: "wrong email or password",
          });
        } else {
          const id = result[0].id;
          const token = jwt.sign({ id: id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIREIN,
          });
          console.log("the token is : " + token);
          const cookieoption = {
            expires: new Date(
              Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000
            ),
            httponly: true,
          };
          res.cookie("jwt", token, cookieoption);

          //display order histroy for the driver home page
          var historyData = [];
          db.query(
            "SELECT * FROM orderHistory WHERE restid = ?",
            [id],
            async (error, result) => {
              if (error) {
                console.log(error);
              } else {
                console.log(result);
                for (let k = 0; k < result.length; k++) {
                  historyData.push(result[k]);
                }
              }
            }
          );

          var orderData = [];
          db.query(
            "SELECT * FROM orders WHERE id = ?",
            [id],
            async (error, result) => {
              if (error) {
                console.log(error);
              } else {
                console.log(result);
                for (let k = 0; k < result.length; k++) {
                  orderData.push(result[k]);
                }
              }
            }
          );

          res
            .status(200)
            .render("restaurantHome", {
              Rname: result[0].name,
              Rid: result[0].id,
              Raddress: result[0].address,
              ordersHistory: historyData, // order history
              currentOrder: orderData, //order Data
            })
            .redirect("/restaurantHome");
        }
      }
    );
  } catch (error) {
    console.log(error);
  }
};

/**
 * get current location of driver for restaurant order tracking
 * @param {*} req contain a data related to the driver location from front end html form
 * @param {*} res  send data and status to the fron end
 */
exports.orderLocationData = (req, res) => {
  console.log(req.body);
  const { driverid } = req.body;
  driverLocation(driverid);
  db.query(
    "SELECT * FROM driverlocation WHERE driverid = ? ",
    [driverid],
    async (error, result) => {
      if (error) {
        console.log(error);
      } else {
        console.log(result);
        res
          .status(200)
          .render("driverHome", {
            driverLocation: result,
          })
          .redirect("/driverHome");
      }
    }
  );
};
//---------------------------------------------------------------------------------------------
//timer to update driver location every 1.5 seconed
setInterval(driverLocation, 1500);
//--------------------------------------------------------------------------------------------
/**
 * function to update driver location and order location in the database
 * @param {*} driverid driver id need to track
 */
function driverLocation(driverid) {
  if (driverid == undefined) {
    driverid = driver_id2;
  }
  //get current driver location
  geolocation(params, (err, data) => {
    if (err) {
      console.log(err);
      return;
    }
    var origins = ['"' + data.location.lat + "," + data.location.lng + '"'];
    if (driverid > 0) {
      db.query(
        "UPDATE driverlocation SET orderLat = ? , orderLong = ? WHERE driverid = ?",
        [origins, data.location.lng, driverid],
        async (error, result) => {
          if (result.affectedRows == 0) {
            db.query(
              "INSERT INTO driverlocation SET ? ",
              {
                driverid: driverid,
                orderLat: origins,
                orderLong: data.location.lng,
              },
              async (error, result) => {
                if (error) {
                  console.log(error);
                } else {
                  //  console.log(result);
                }
              }
            );
          } else {
          }
        }
      );
    }
    //update all  order location with the  based on the driver they are accepted
    db.query(
      "UPDATE orders SET orderLocation = ?  WHERE driverid = ?",
      [origins, driverid],
      async (error, result) => {}
    );
  });
}
