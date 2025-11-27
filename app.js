// jshint esversion:6
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
// const flash = require("flash");
const flash = require("connect-flash");
// Passport

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  secret: process.env.SESSION_SECRET || "ourLittleSecret",
  resave: false,
  saveUninitialized: false // Note: Fixed typo from 'saveUnitialised'
}));
app.use(passport.initialize());
app.use(passport.session());
// app.use(session()); // session middleware
app.use(flash());

// Use environment variable for Cloud DB, or localhost for development
const dbUrl = process.env.MONGODB_URI || "mongodb://localhost:27017/userDb";

mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);
const userSchema = new mongoose.Schema({
  name1: String,
  userName: String,
  email: String,
  designation: String,
  mobile: Number,
  company: String,
  isProfilePrivate: { type: Boolean, default: false }
});

const postSchema = new mongoose.Schema({
  usern: String,
  title: String,
  post: String
});

const eventSchema = new mongoose.Schema({
  title: String,
  description: String,
  eventDate: String, // Optional date
  imageLink: String  // Optional image URL
});


userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);
const Post = new mongoose.model("Post", postSchema);
const Event = new mongoose.model("Event", eventSchema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// GET ROUTES
app.get("/", function(req, res) {
  let i = 0;
  if(req.isAuthenticated()){
    let user = req.user.username;
    i = 1;
    res.render("home",({check:i,user}));
  }else{
  res.render("home",({check:i}));
}
});
app.get("/signup", function(req, res) {
  res.render("signup");
});
app.get("/login", function(req, res) {
  const errors = req.flash().error || [];
  res.render("login", {
    errors
  });
});
app.get("/:username", function(req, res) {
  let user = req.params.username;
  // Retrieving Data from db
  User.find({}, function(err, data) {

    for (var i = 0; i < data.length; i++) {
      if (data[i].username === user) {
        let name = data[i].name1;
        let desig = data[i].designation;
        let em = data[i].email;
        if (req.isAuthenticated()) {
          Post.find({}, function(err, pdata) {
            res.render("dashboard", ({
              username: user,
              pdata,
              name,
              desig,
              em
            }));


          });
        } else {
          res.redirect("/login");
        }
      }
    }
  });


});
// GET ROUTE FOR ADD EVENT FORM (PROFESSOR ONLY)
app.get("/:username/add-event", function(req, res) {
  if (req.isAuthenticated()) {
    // Check if user is a Professor
    if (req.user.designation === "Professor") {
      res.render("add_event", {
        username: req.user.username,
        name: req.user.name1,
        desig: req.user.designation,
        em: req.user.email
      });
    } else {
      // Not a professor, redirect
      res.redirect("/" + req.user.username);
    }
  } else {
    res.redirect("/login");
  }
});

// GET ROUTE FOR EDIT FORM
// GET ROUTE FOR EDIT FORM
app.get("/:username/edit", function(req, res) {
  if (req.isAuthenticated()) {
    // Find the user profile we want to edit
    User.findOne({ username: req.params.username }, function(err, foundUser) {
      if (err || !foundUser) {
        console.log(err);
        res.redirect("/" + req.user.username); // Redirect logged-in user
      } else {
        
        // --- THIS IS THE KEY LOGIC ---
        // Allow if: 1. You are editing your own profile OR 2. You are a Professor
        if (req.user.username === foundUser.username || req.user.designation === "Professor") {
          res.render("edit_profile", {
            user: foundUser // Pass the found user's data to the form
          });
        } else {
          // If a user (like a Student) tries to edit someone else
          res.redirect("/" + req.user.username);
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/:username/aldash", function(req, res) {
  let user = req.params.username;
  // Get search query from URL (e.g., ?search=john)
  let searchQuery = req.query.search || ""; 

  User.find({}, function(err, data) {
    for (var i = 0; i < data.length; i++) {
      if (data[i].username === user) {
        let name = data[i].name1;
        let desig = data[i].designation;
        let em = data[i].email;
        if (req.isAuthenticated()) {
          
          // --- NEW SEARCH LOGIC ---
          let searchFilter = { 
            designation: "Alumnus" 
          };
          
          if (searchQuery) {
            searchFilter.$or = [
              // 'i' makes it case-insensitive
              { name1: { $regex: searchQuery, $options: 'i' } }, 
              { company: { $regex: searchQuery, $options: 'i' } }
            ];
          }

          // Find alumni based on the filter
          User.find(searchFilter, function(err, foundAlumni){
            res.render("alumnidash", ({
              username: user,
              name,
              desig,
              em,
              data: foundAlumni, // Pass the filtered alumni
              searchQuery: searchQuery // Pass the query back to the form
            }));
          });
          // --- END NEW LOGIC ---

        } else {
          res.redirect("/login");
        }
      }
    }
  });
});



app.get("/:username/post", function(req, res) {
  let user = req.params.username;
  User.find({}, function(err, data) {

    for (var i = 0; i < data.length; i++) {
      if (data[i].username === user) {
        let name = data[i].name1;
        let desig = data[i].designation;
        let em = data[i].email;
        if (req.isAuthenticated()) {
          res.render("adpost", ({
            username: user,
            name,
            desig,
            em,
            data
          }));
        } else {
          res.redirect("/login");
        }
      }
    }
  });
});

// GET /:username/student-dashboard
app.get("/:username/student-dashboard", function(req, res) {
  let user = req.params.username;
  let searchQuery = req.query.search || ""; // Get search query

  if (req.isAuthenticated()) {
    User.findOne({ username: user }, function(err, studentData) {
      if (err || !studentData) {
        console.log(err);
        res.redirect("/login");
      } else {
        
        // --- NEW SEARCH LOGIC ---
        let searchFilter = { 
          designation: "Alumnus" 
        };
        
        if (searchQuery) {
          searchFilter.$or = [
            { name1: { $regex: searchQuery, $options: 'i' } },
            { company: { $regex: searchQuery, $options: 'i' } }
          ];
        }

        User.find(searchFilter, function(err, alumniData) {
          if (err) {
            console.log(err);
            res.redirect("/");
          } else {
            res.render("studentdash", {
              username: studentData.username,
              name: studentData.name1,
              desig: studentData.designation,
              em: studentData.email,
              alumniData: alumniData, // Pass filtered alumni
              searchQuery: searchQuery // Pass query back
            });
          }
        });
        // --- END NEW LOGIC ---
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/:username/pastev", (req, res) => {
  let user = req.params.username;
  User.find({}, function(err, data) {

    for (var i = 0; i < data.length; i++) {
      if (data[i].username === user) {
        let name = data[i].name1;
        let desig = data[i].designation;
        let em = data[i].email;
        if (req.isAuthenticated()) {
          
          // --- NEW LOGIC ---
          // Find all events and pass them to the page
          Event.find({}, function(err, allEvents){
            if(err){
              console.log(err);
            } else {
              res.render("pastev", ({
                username: user,
                name,
                desig,
                em,
                eventData: allEvents // Pass the list of events
              }));
            }
          });
          // --- END NEW LOGIC ---

        } else {
          res.redirect("/login");
        }
      }
    }
  });
});

// GET ROUTE FOR ANALYTICS (PROFESSOR ONLY)
// GET ROUTE FOR ANALYTICS (PROFESSOR ONLY) - DEBUGGING VERSION
app.get("/:username/analytics", async function(req, res) {
  if (!req.isAuthenticated() || req.user.designation !== "Professor") {
    return res.redirect("/" + req.user.username);
  }

  try {
    console.log("--- Analytics Checkpoint 1: Route Start ---");

    // 1. Get user counts
    const userCounts = await User.aggregate([
      { $group: { _id: "$designation", count: { $sum: 1 } } }
    ]);
    
    console.log("--- Analytics Checkpoint 2: Got User Counts ---");

    // 2. Get alumni count by company
    const companyCounts = await User.aggregate([
      { $match: { designation: "Alumnus", company: { $ne: null, $ne: "" } } },
      { $group: { _id: "$company", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    console.log("--- Analytics Checkpoint 3: Got Company Counts ---");

    // 3. Get total counts
    const postCount = (typeof Post !== 'undefined') ? await Post.countDocuments() : 0;
    const eventCount = (typeof Event !== 'undefined') ? await Event.countDocuments() : 0;
    const jobCount = (typeof Job !== 'undefined') ? await Job.countDocuments() : 0;

    console.log("--- Analytics Checkpoint 4: Got Platform Counts ---");

    // Prepare data for the view
    let stats = {
      alumni: 0,
      professors: 0,
      students: 0,
      posts: postCount,
      events: eventCount,
      jobs: jobCount
    };

    userCounts.forEach(group => {
      if (group._id === "Alumnus") stats.alumni = group.count;
      if (group._id === "Professor") stats.professors = group.count;
      if (group._id === "Student") stats.students = group.count;
    });

    console.log("--- Analytics Checkpoint 5: Rendering Page ---");
    
    res.render("analytics", {
      username: req.user.username,
      name: req.user.name1,
      desig: req.user.designation,
      em: req.user.email,
      stats: stats,
      companyData: companyCounts
    });

  } catch (err) {
    // If it fails, it will now print a detailed error
    console.log("--- !!! ANALYTICS FAILED !!! ---");
    console.log(err);
    res.redirect("/" + req.user.username);
  }
});

// POST ROUTES
app.post("/signup", function(req, res) {
  User.register({
    name1: req.body.name1,
    username: req.body.username,
    email: req.body.email,
    mobile: req.body.mob,
    designation: req.body.select,
    company: req.body.company,
    isProfilePrivate: false
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/signup");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/" + req.body.username);
        console.log("Data saved in DB");
      });
    }
  });
});

// POST ROUTE FOR EDIT FORM
// POST ROUTE FOR EDIT FORM
// POST ROUTE FOR EDIT FORM
app.post("/:username/edit", function(req, res) {
  if (req.isAuthenticated()) {

    // --- KEY SECURITY CHECK ---
    if (req.params.username !== req.user.username && req.user.designation !== "Professor") {
      return res.redirect("/" + req.user.username);
    }

    // --- 1. DETERMINE PRIVACY SETTING ---
    // An unchecked box sends 'undefined', which we'll treat as 'false'
    let privacySetting = req.body.isProfilePrivate === "true";

    // --- 2. PREPARE THE DATA FOR UPDATE ---
    const updatedData = {
      name1: req.body.name1,
      email: req.body.email,
      mobile: req.body.mob,
      company: req.body.company,
      isProfilePrivate: privacySetting // <-- ADD THIS LINE
    };

    // Find the user by their username (from the URL) and update them
    User.findOneAndUpdate({ username: req.params.username }, updatedData, function(err, updatedUser) {
      if (err) {
        console.log(err);
        res.redirect("/" + req.user.username);
      } else {
        console.log("Profile Updated for " + req.params.username);

        // --- KEY REDIRECT LOGIC ---
        if (req.user.designation === "Professor" && req.user.username !== req.params.username) {
          res.redirect("/" + req.user.username + "/aldash");
        } else {
          res.redirect("/" + req.params.username);
        }
      }
    });

  } else {
    res.redirect("/login");
  }
});

// POST ROUTE FOR ADD EVENT
app.post("/:username/add-event", function(req, res) {
  if (req.isAuthenticated() && req.user.designation === "Professor") {
    
    const newEvent = new Event({
      title: req.body.title,
      description: req.body.description,
      eventDate: req.body.eventDate,
      imageLink: req.body.imageLink
    });

    newEvent.save(function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log("New event saved.");
      }
      // Redirect to the past events page to see the new event
      res.redirect("/" + req.user.username + "/pastev");
    });
  } else {
    res.redirect("/login");
  }
});

// POST /login
app.post('/login',
  passport.authenticate('local', {
    faliureFlash: true,
    failureRedirect: "/login"
  }),
  function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.

    let user = req.user;

    // Check user's designation and redirect accordingly
    if (user.designation === "Student") {
      res.redirect('/' + user.username + '/student-dashboard');
    } else {
      // Alumni and Professors go to the main post dashboard
      res.redirect('/' + user.username);
    }
  });

app.post('/logout', (req, res) => {
  console.log("Logging Out...");
  req.logout();
  res.redirect('/');
});

app.post("/:username", (req, res) => {
  // res.render("dashboard",{username:req.params.user});
  let user = req.params.username;
  let title = req.body.title;
  let post = req.body.post;
  let np = new Post({
    usern: user,
    title: title,
    post: post
  });
  np.save((err) => {
    if (err)
      return handleError(err);
  });

  User.find({}, function(err, data) {
    for (var i = 0; i < data.length; i++) {
      if (data[i].username === user) {
        let name = data[i].name1;
        let desig = data[i].designation;
        let em = data[i].email;
        if (req.isAuthenticated()) {
          Post.find({}, function(err, pdata) {
            res.render("dashboard", ({
              username: user,
              pdata,
              name,
              desig,
              em
            }));
          });
        } else {
          res.redirect("/login");
        }
      }
    }
  });
});



// Only listen if not running in a serverless environment
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, function() {
    console.log("Server is running on port " + PORT);
  });
}

// Export the app for Vercel
module.exports = app;
