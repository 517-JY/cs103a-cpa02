/*
  app.js -- This creates an Express webserver with login/register/logout authentication
*/

// *********************************************************** //
//  Loading packages to support the server
// *********************************************************** //
// First we load in all of the packages we need for the server...
const createError = require("http-errors"); // to handle the server errors
const express = require("express");
const path = require("path"); // to refer to local paths
const cookieParser = require("cookie-parser"); // to handle cookies
const session = require("express-session"); // to handle sessions using cookies
const debug = require("debug")("personalapp:server");
const layouts = require("express-ejs-layouts");
const axios = require("axios");
var MongoDBStore = require("connect-mongodb-session")(session);

// *********************************************************** //
//  Loading models
// *********************************************************** //
const ToDoItem = require("./models/ToDoItem");
const Course = require("./models/Course");
const Schedule = require("./models/Schedule");
const Prize = require("./models/Prize");

// *********************************************************** //
//  Loading JSON datasets
// *********************************************************** //
const courses = require("./public/data/courses20-21.json");

// *********************************************************** //
//  Connecting to the database
// *********************************************************** //

const mongoose = require("mongoose");

const mongodb_URI = process.env.mongodb_URI;
//const mongodb_URI = 'mongodb://localhost:27017/cs103a_todo'
//const mongodb_URI = 'mongodb+srv://cs_sj:BrandeisSpr22@cluster0.kgugl.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'
// const mongodb_URI =
//   "mongodb+srv://jiayinli007:12345@cluster0.hcayx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

mongoose.connect(mongodb_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// fix deprecation warnings
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("we are connected!!!");
});

// *********************************************************** //
// Initializing the Express server
// This code is run once when the app is started and it creates
// a server that respond to requests by sending responses
// *********************************************************** //
const app = express();

var store = new MongoDBStore({
  uri: mongodb_URI,
  collection: "mySessions",
});

// Catch errors
store.on("error", function (error) {
  console.log(error);
});

app.use(
  require("express-session")({
    secret: "This is a secret",
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
    store: store,
    // Boilerplate options, see:
    // * https://www.npmjs.com/package/express-session#resave
    // * https://www.npmjs.com/package/express-session#saveuninitialized
    resave: true,
    saveUninitialized: true,
  })
);

// Here we specify that we will be using EJS as our view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// this allows us to use page layout for the views
// so we don't have to repeat the headers and footers on every page ...
// the layout is in views/layout.ejs
app.use(layouts);

// Here we process the requests so they are easy to handle
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Here we specify that static files will be in the public folder
app.use(express.static(path.join(__dirname, "public")));

// Here we enable session handling using cookies
app.use(
  session({
    secret: "zzzbbyanana789sdfa8f9ds8f90ds87f8d9s789fds", // this ought to be hidden in process.env.SECRET
    resave: false,
    saveUninitialized: false,
  })
);

// *********************************************************** //
//  Defining the routes the Express server will respond to
// *********************************************************** //

// here is the code which handles all /login /signin /logout routes
const auth = require("./routes/auth");
const { deflateSync } = require("zlib");
app.use(auth);

// middleware to test is the user is logged in, and if not, send them to the login page
const isLoggedIn = (req, res, next) => {
  if (res.locals.loggedIn) {
    next();
  } else res.redirect("/login");
};

// let nobelprizes =[];
// let getNobelPrizes= async () => {
//   response = await axios.get('https://api.nobelprize.org/v1/prize.json');
//   nobelprizes = response.data
// }
// getNobelPrizes();

const nobelprizes = require("./public/data/nobelprize.json");

/* ************************
  Loading (or reloading) the prize data into a collection
   ************************ */
// this route loads in the nobelprizes into the Prize collection
// or updates the courses if it is not a new collection

app.get("/upsertDB", async (req, res, next) => {
  for (nobelprize of nobelprizes) {
    const { year, category, laureates } = nobelprize;

    await Prize.findOneAndUpdate({ year, category, laureates }, nobelprize, {
      upsert: true,
    });
  }
  const num = await Prize.find({}).count();
  res.send("prize data uploaded: " + num); // which get 658 nobel prize records in total
});

// specify that the server should render the views/index.ejs page for the root path
// and the index.ejs code will be wrapped in the views/layouts.ejs code which provides
// the headers and footers for all webpages generated by this app
app.get("/", (req, res, next) => {
  try {
    res.locals.categories = [];
    res.locals.category = "none";
    const categoriesOriginal = nobelprizes.map((x) => x["category"]);
    res.locals.categories = Array.from(new Set(categoriesOriginal));
    // console.log(categoriesOriginal);
    res.render("index");
  } catch (error) {
    next(error);
  }

  res.render("index");
  // res.json(nobleprizes);
  // res.json(nobelprizes.length);
});

app.post(
  "/prizes/byYear",
  // show list of prizes within a given year
  async (req, res, next) => {
    const { year } = req.body;
    const prizes = await Prize.find({
      year: year,
    });

    res.locals.prizes = prizes;

    // res.json(prizes);
    // res.json(prizes.length);
    res.render("prizelist");
  }
);

app.post(
  "/prizes/byCategory",
  // show list of courses in a given subject
  async (req, res, next) => {
    const { category } = req.body;
    const prizes = await Prize.find({
      category: category,
    });

    res.locals.prizes = prizes;

    // res.json(prizes);
    // res.json(prizes.length);
    res.render("prizelist");
  }
);

app.get("/about", (req, res, next) => {
  res.render("about");
});

/* ************************
  Functions needed for the course finder routes
   ************************ */

function getNum(laureates) {
  // get how many laureates in one Prize Object
  if (laureates) {
    return laureates.length;
  } else {
    return 0;
  }
}

function times2str(times) {
  // convert a course.times object into a list of strings
  // e.g ["Lecture:Mon,Wed 10:00-10:50","Recitation: Thu 5:00-6:30"]
  if (!times || times.length == 0) {
    return ["not scheduled"];
  } else {
    return times.map((x) => time2str(x));
  }
}
function min2HourMin(m) {
  // converts minutes since midnight into a time string, e.g.
  // 605 ==> "10:05"  as 10:00 is 60*10=600 minutes after midnight
  const hour = Math.floor(m / 60);
  const min = m % 60;
  if (min < 10) {
    return `${hour}:0${min}`;
  } else {
    return `${hour}:${min}`;
  }
}

function time2str(time) {
  // creates a Times string for a lecture or recitation, e.g.
  //     "Recitation: Thu 5:00-6:30"
  const start = time.start;
  const end = time.end;
  const days = time.days;
  const meetingType = time["type"] || "Lecture";
  const location = time["building"] || "";

  return `${meetingType}: ${days.join(",")}: ${min2HourMin(
    start
  )}-${min2HourMin(end)} ${location}`;
}

app.use(isLoggedIn);

app.get(
  "/schedule/show",
  // show the current user's schedule
  async (req, res, next) => {
    try {
      const userId = res.locals.user._id;
      const courseIds = (await Schedule.find({ userId }))
        .sort((x) => x.term)
        .map((x) => x.courseId);
      res.locals.courses = await Course.find({ _id: { $in: courseIds } });
      res.render("schedule");
    } catch (e) {
      next(e);
    }
  }
);

app.get(
  "/schedule/remove/:courseId",
  // remove a course from the user's schedule
  async (req, res, next) => {
    try {
      await Schedule.remove({
        userId: res.locals.user._id,
        courseId: req.params.courseId,
      });
      res.redirect("/schedule/show");
    } catch (e) {
      next(e);
    }
  }
);

// here we catch 404 errors and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// this processes any errors generated by the previous routes
// notice that the function has four parameters which is how Express indicates it is an error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// *********************************************************** //
//  Starting up the server!
// *********************************************************** //
//Here we set the port to use between 1024 and 65535  (2^16-1)
const port = process.env.PORT || "5000";
console.log("connecting on port " + port);

app.set("port", port);

// and now we startup the server listening on that port
const http = require("http");
const { reset } = require("nodemon");
const server = http.createServer(app);

server.listen(port);

function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

server.on("error", onError);

server.on("listening", onListening);

module.exports = app;
