const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_user}:${process.env.DB_pass}@cluster0.xggde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const connectDB = async () => {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB");

    //  DB and collections
    const database = client.db("task_manager");
    const usersCollection = database.collection("users_collection");

    // NOTE:  routes starts from here!!
    app.get("/", async (req, res) => {
      res.status(200).send({ message: "Hallo Bruder, wie gehts?" });
    });
    //  get a single user
    app.get("/users/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const result = await usersCollection.findOne({ email });
        if (!result) {
          return res.status(404).send({ message: "user not found" });
        }
        res.status(200).send({
          success: true,
          userDetails: result,
        });
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({
          success: false,
          message: "Something went wrong. Please try again later.",
        });
      }
    });
    //  add user to DB
    app.post("/user", async (req, res) => {
      try {
        const userData = req.body;
        await usersCollection.updateOne(
          { email: userData.email },
          {
            $set: {
              lastLogin: new Date(),
            },
            $setOnInsert: { ...userData, createdAt: new Date() },
          },
          { upsert: true }
        );
        res.status(200).send({
          success: true,
          message: "Successfully added/updated user data in DB.",
        });
      } catch (error) {
        console.error("Error adding user to DB:", error);
        res.status(500).send({
          success: false,
          message: "Your data was not saved. Please try again later.",
        });
      }
    });
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
  }
};
connectDB();

app.listen(port, () => {
  console.log(`App listening on ${port}`);
});
