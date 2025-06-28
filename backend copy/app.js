const ENV = process.env.NODE_ENV || 'production'
require('dotenv').config({
  path: `.env.${ENV}`
});

// External Moduleyes

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('./models/User');

// Local Module
const boardRouter = require("./routers/boardRouter");

const MONGO_DB_URL =
  `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSAWORD}@airbnb.8bduv.mongodb.net/${process.env.MONGO_DB_DATABASE}`;

const app = express();
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));


app.use(cors({
  origin: [
    process.env.FRONTEND_URL 
  ].filter(Boolean), 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));
app.options('*', cors());

app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        avatar: profile.photos[0].value
      });
    }
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {  const token = jwt.sign({ id: req.user.id, name: req.user.name, email: req.user.email, avatar: req.user.avatar }, process.env.JWT_SECRET || 'jwtsecret', { expiresIn: '7d' });
  res.redirect(`${process.env.FRONTEND_URL}/?token=${token}`);
});
app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect(process.env.FRONTEND_URL);
  });
});

app.use("/api", boardRouter);

app.get('/', (req, res) => {
    res.send('Hello World')
})



const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});
module.exports.io = io;

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('join-board', (boardId) => {
    socket.join(boardId);
    console.log(`Socket ${socket.id} joined board ${boardId}`);
  });

  socket.on('drawing', ({ boardId, data }) => {
    socket.to(boardId).emit('drawing', { socketId: socket.id, data });
  });
  socket.on('shape-removed', ({ boardId, shapeId }) => {
    socket.to(boardId).emit('shape-removed', { socketId: socket.id, shapeId });
  });
  socket.on('clear-board', (boardId) => {
    console.log(`Socket ${socket.id} clearing board ${boardId}`);
    socket.to(boardId).emit('clear-board', boardId);
    console.log(`Broadcasted clear-board event to room ${boardId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
mongoose.connect(MONGO_DB_URL).then(() => {
  server.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
  });
});