const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Initialize app
const app = express();
const server = http.createServer(app);

// Allow CORS for all origins
app.use(cors());

// Create socket.io instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 5000;
const activeUsers = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle new user connection
  socket.on("new user", ({ requestedUsername }) => {
    let finalUsername = requestedUsername;
    let displayUsername = requestedUsername;
    let counter = 1;

    // Ensure unique username
    while (activeUsers.has(finalUsername)) {
      finalUsername = `${requestedUsername}${counter}`;
      displayUsername = `${requestedUsername}${counter}`;
      counter++;
    }

    // Store user information
    activeUsers.set(finalUsername, socket.id);
    socket.username = finalUsername;
    socket.displayName = displayUsername;

    // Send confirmation to client
    socket.emit("username assigned", {
      actualUsername: finalUsername,
      displayUsername: displayUsername,
    });

    // Notify all users
    io.emit("chat message", {
      username: "System",
      text: `${displayUsername} has joined the chat`,
      time: new Date().toLocaleTimeString(),
    });
  });

  // Handle chat messages
  socket.on("chat message", (msg) => {
    const messageWithDisplayName = {
      ...msg,
      displayName: socket.displayName || msg.username,
    };
    io.emit("chat message", messageWithDisplayName);
  });

  // Handle typing indicators
  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", socket.displayName || username);
  });

  socket.on("stop typing", () => {
    socket.broadcast.emit("stop typing");
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    if (socket.username) {
      activeUsers.delete(socket.username);
      io.emit("chat message", {
        username: "System",
        text: `${socket.displayName || socket.username} has left the chat`,
        time: new Date().toLocaleTimeString(),
      });
    }
  });

  // Optional: Explicit leave handling
  socket.on("user left", () => {
    if (socket.username) {
      activeUsers.delete(socket.username);
      io.emit("chat message", {
        username: "System",
        text: `${socket.displayName || socket.username} has left the chat`,
        time: new Date().toLocaleTimeString(),
      });
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
