require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true,
})
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let waitingQueue = [];
const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("find-stranger", ({ userId }) => {
    socket.userId = userId;
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);

    if (waitingQueue.length > 0) {
      const partner = waitingQueue.shift();
      const roomId = uuidv4();
      rooms[roomId] = [socket.id, partner.id];
      socket.join(roomId);
      partner.join(roomId);
      socket.roomId = roomId;
      partner.roomId = roomId;
      io.to(roomId).emit("chat-start");
    } else {
      waitingQueue.push(socket);
      socket.emit("waiting");
    }
  });

  socket.on("message", (text) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("message", { text, fromSelf: false });
    }
  });

  socket.on("typing", () => {
    if (socket.roomId) socket.to(socket.roomId).emit("partner-typing");
  });

  socket.on("stop-typing", () => {
    if (socket.roomId) socket.to(socket.roomId).emit("partner-stop-typing");
  });

  socket.on("leave-chat", async () => {
    handleDisconnect(socket);
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket);
  });
});

async function handleDisconnect(socket) {
  waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
  if (socket.roomId) {
    socket.to(socket.roomId).emit("partner-left");
    // Increment chat count for both users
    if (socket.userId) {
      await User.findByIdAndUpdate(socket.userId, { $inc: { totalChats: 1 } });
    }
    delete rooms[socket.roomId];
    socket.roomId = null;
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));