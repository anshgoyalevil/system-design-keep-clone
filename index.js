require("dotenv").config();
const uniqid = require('uniqid');
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret: "My little secret",
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://127.0.0.1:27017/notesDB');

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    notes: [{
        id: String,
        title: String,
        body: String,
    }],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/keepclone",
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    passReqToCallback: true
},
    function (request, accessToken, refreshToken, profile, done) {
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return done(err, user);
        });
    }
));

////////////////////////////////App.* Requests//////////////////////////////

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/notes", function (req, res) {
    if (req.isAuthenticated()) {

        const notes = req.user.notes;

        res.render("notespage", {notes: notes});
    }
    else {
        res.redirect("/login");
    }
});

app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) {
            console.log(err);
        }
        else {
            res.redirect("/");
        }
    });

});

app.post("/register", function (req, res) {

    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/notes");
            });
        }
    });

});

app.post("/login", function (req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password,
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/notes");
            });
        }
    });

});

app.post("/submit", function (req, res) {

    if (req.isAuthenticated()) {

        const submittedTitle = req.body.title;
        const submittedBody = req.body.body;
        const newObj = {
            id: uniqid(),
            title: submittedTitle,
            body: submittedBody,
        };

        User.findOneAndUpdate({_id: req.user.id}, {$push: {notes: newObj}}, function (err) { 
            if(!err){
                res.redirect("/notes");
            }
         });
    }
    else {
        res.redirect("/login");
    }

});

app.post("/delete", function (req, res) {

    if (req.isAuthenticated()) {

        const deleteId = req.body.delete;

        User.findOneAndUpdate({_id: req.user.id}, {$pull: {notes: {id: deleteId}}}, function (err, results) { 
            if(!err){
              res.redirect("/notes");
            }
           });
    }
    else {
        res.redirect("/login");
    }

});

app.listen(3000, function () {
    console.log("App successfully spinned up on port 3000");
});