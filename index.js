const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");

// Initialize Firebase Admin
const serviceAccount = require("./coffee-store-app-a5228-firebase-adminsdk-fbsvc-20e5e6ccc6.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

console.log(process.env.DB_USER);
console.log(process.env.DB_PASS);

app.get("/", (req, res) => {
  res.send("Coffee server is getting hotter ");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// start backend

// const uri =
//   "mongodb+srv://coffeestore:HJEU1ShEHcgxLlbY@cluster0.drxhi2b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-3fq34gd-shard-00-00.drxhi2b.mongodb.net:27017,ac-3fq34gd-shard-00-01.drxhi2b.mongodb.net:27017,ac-3fq34gd-shard-00-02.drxhi2b.mongodb.net:27017/?ssl=true&replicaSet=atlas-h89j0u-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

MongoClient.connect(uri, function (err, client) {
  const collection = client.db("test").collection("devices");
  // perform actions on the collection object
  client.close();
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const coffeesCollection = client.db("coffeeDB").collection("coffees");
    const userCollection = client.db("coffeeDB").collection("users");

    // Read
    app.get("/coffees", async (req, res) => {
      const cursor = coffeesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Read  specific id-------- Find
    app.get("/coffees/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coffeesCollection.findOne(query);
      res.send(result);
    });

    // create
    app.post("/coffees", async (req, res) => {
      const newCoffee = req.body;
      console.log(newCoffee);
      const result = await coffeesCollection.insertOne(newCoffee);
      res.send(result);
    });

    // Update
    app.put("/coffees/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedCoffee = req.body;
      const updatedDoc = {
        $set: {
          updatedCoffee,
        },
      };
      const result = await coffeesCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // delete
    app.delete("/coffees/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coffeesCollection.deleteOne(query);
      res.send(result);
    });

    // User related all database APIs

    // read user FIND
    app.get("/users", async (req, res) => {
      // const result = await userCollection.find().toArray();
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // user create
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      console.log(newUser);
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // update using patch because we have to update just one........ here options hoba na karon overall data put kortachina tai
    app.patch("/users", async (req, res) => {
      console.log(req.body);
      const { email, lastSignInTime } = req.body;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          lastSignInTime: lastSignInTime,
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Delete user from db
    // app.delete("/users/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await userCollection.deleteOne(query);
    //   res.send(result);
    // });

    // Delete user from MongoDB and Firebase
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      // First get the user to get the Firebase UID
      const user = await userCollection.findOne(query);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Delete from MongoDB
      const mongoResult = await userCollection.deleteOne(query);

      if (mongoResult.deletedCount === 0) {
        return res.status(404).json({ error: "User not found in MongoDB" });
      }

      // If user has a UID (Firebase ID), delete from Firebase
      if (user.uid) {
        try {
          await admin.auth().deleteUser(user.uid);
          return res.json({
            message: "User deleted from both MongoDB and Firebase",
            deletedCount: mongoResult.deletedCount,
          });
        } catch (firebaseError) {
          console.error("Firebase deletion error:", firebaseError);
          // Even if Firebase deletion fails, we consider it a partial success
          return res.json({
            message: "User deleted from MongoDB but Firebase deletion failed",
            deletedCount: mongoResult.deletedCount,
            firebaseError: firebaseError.message,
          });
        }
      }

      return res.json({
        message: "User deleted from MongoDB (no Firebase UID found)",
        deletedCount: mongoResult.deletedCount,
      });
    });

    // Separate endpoint just for Firebase deletion (if needed)
    app.delete("/delete-user/:uid", async (req, res) => {
      const { uid } = req.params;
      try {
        await admin.auth().deleteUser(uid);
        res
          .status(200)
          .json({ message: "User deleted successfully from Firebase" });
      } catch (error) {
        console.error("Error deleting user from Firebase:", error);
        res.status(500).json({
          error: "Failed to delete user from Firebase: " + error.message,
        });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB..........!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

//  delete from firebase
// app.delete("/delete-user/:uid", verifyAdmin, async (req, res) => {
//   const { uid } = req.params;
//   try {
//     await admin.auth().deleteUser(uid);
//     res.status(200).json({ message: "User deleted successfully" });
//   } catch (error) {
//     console.error("Error deleting user:", error);
//     res.status(500).json({ error: "Failed to delete user: " + error.message });
//   }
// });

// var admin = require("firebase-admin");

// var serviceAccount = require("./coffee-store-app-a5228-firebase-adminsdk-fbsvc-20e5e6ccc6.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

run().catch(console.dir);
