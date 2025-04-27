const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Initialize app
const app = express();
const server = http.createServer(app);

// Allow CORS for all origins (frontend can connect)
app.use(cors());

// Create socket.io instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 5000;
const path = require("path");

// Serve static files (for React app or other frontend assets)
app.use(express.static(path.join(__dirname, "frontend/build")));

// Catch-all route to send the index.html (useful for single-page apps)
// Correct way to define route with parameter
app.get("/chat/:username", (req, res) => {
  const { username } = req.params;
  res.send(`Chat with ${username}`);
});

// Store online users
let users = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("new user", (username) => {
    // Check if username is already present among users
    const isExistingUser = Object.values(users).includes(username);

    users[socket.id] = username; // Now save it AFTER checking

    if (!isExistingUser) {
      // New user
      const welcomeMessage = {
        username: "System",
        text: `Welcome ${username} to the chat! 🎉`,
        time: new Date().toLocaleTimeString(),
      };
      io.emit("chat message", welcomeMessage);
    } else {
      // Returning user (reconnect)
      const joinMessage = {
        username: "System",
        text: `${username} has joined the chat.`,
        time: new Date().toLocaleTimeString(),
      };
      io.emit("chat message", joinMessage);
    }
  });

  // Listen for normal chat messages
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });

  // Typing event (broadcast to others)
  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  // Stop typing event (broadcast to others)
  socket.on("stop typing", () => {
    socket.broadcast.emit("stop typing");
  });

  // User leaving event
  socket.on("user left", (username) => {
    const leaveMessage = {
      username: "System",
      text: `${username} has left the chat.`,
      time: new Date().toLocaleTimeString(),
    };

    io.emit("chat message", leaveMessage);
    delete users[socket.id]; // Clean up
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    const username = users[socket.id];
    if (username) {
      const leaveMessage = {
        username: "System",
        text: `${username} has disconnected.`,
        time: new Date().toLocaleTimeString(),
      };

      io.emit("chat message", leaveMessage);
      delete users[socket.id]; // Remove user from users list
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
