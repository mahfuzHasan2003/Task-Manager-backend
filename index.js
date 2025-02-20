const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xggde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let usersCollection, tasksCollection;

async function connectDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB");
    const database = client.db("task_manager");
    usersCollection = database.collection("users_collection");
    tasksCollection = database.collection("user_tasks_collection");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
}

async function emitUpdatedTasks(email) {
  const tasks = await tasksCollection
    .find({ email })
    .sort({ order: 1 })
    .toArray();
  const groupedTasks = {
    todo: tasks.filter((task) => task.status === "todo"),
    "in-progress": tasks.filter((task) => task.status === "in-progress"),
    finished: tasks.filter((task) => task.status === "finished"),
  };
  io.emit("tasksUpdated", groupedTasks);
}

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("getTasks", async (email) => {
    try {
      await emitUpdatedTasks(email);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  });

  socket.on("updateTaskStatus", async ({ taskId, newStatus, email }) => {
    try {
      await tasksCollection.updateOne(
        { _id: new ObjectId(taskId) },
        { $set: { status: newStatus } }
      );
      await emitUpdatedTasks(email);
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  });

  socket.on("addTask", async (newTask) => {
    try {
      const { email, ...taskData } = newTask;
      await tasksCollection.insertOne({
        ...taskData,
        email,
        timestamp: new Date(),
        order: await getNextOrder(email, taskData.status),
      });
      await emitUpdatedTasks(email);
    } catch (error) {
      console.error("Error adding task:", error);
    }
  });

  socket.on("updateTask", async (updatedTask) => {
    try {
      const { _id, email, ...taskData } = updatedTask;
      await tasksCollection.updateOne(
        { _id: new ObjectId(_id) },
        { $set: taskData }
      );
      await emitUpdatedTasks(email);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  });

  socket.on("deleteTask", async ({ taskId, email }) => {
    try {
      await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });
      await emitUpdatedTasks(email);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  });

  socket.on("reorderTasks", async ({ tasks, email }) => {
    try {
      const bulkOps = tasks.map((task, index) => ({
        updateOne: {
          filter: { _id: new ObjectId(task._id) },
          update: { $set: { order: index } },
        },
      }));
      await tasksCollection.bulkWrite(bulkOps);
      await emitUpdatedTasks(email);
    } catch (error) {
      console.error("Error reordering tasks:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

async function getNextOrder(email, status) {
  const lastTask = await tasksCollection.findOne(
    { email, status },
    { sort: { order: -1 } }
  );
  return lastTask ? lastTask.order + 1 : 0;
}

app.get("/", async (req, res) => {
  res.status(200).send({ message: "Server is running" });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

connectDB();
