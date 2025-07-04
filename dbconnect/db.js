

// adeptshaharia
// C9DWzWZzkBwSpU80
// const mongoose = require("mongoose");
// const connectDB = async () => {
//   try {
//     await mongoose.connect("mongodb://127.0.0.1:27017/testProductDb");
//     console.log("MongoDB connected successfully");

//     const collections = await mongoose.connection.db.listCollections().toArray();
//     const hasProductsCollection = collections.some(col => col.name === 'products');

//     if (hasProductsCollection) {
//       const indexes = await mongoose.connection.collection('products').indexes();
//       const hasNameIndex = indexes.find(index => index.name === 'name_1');

//       if (hasNameIndex) {
//         await mongoose.connection.collection('products').dropIndex('name_1');
//         console.log("Dropped index: name_1");
//       } else {
//         console.log("No index named 'name_1' found.");
//       }
//     } else {
//       console.log("Collection 'products' does not exist.");
//     }

//   } catch (err) {
//     console.error("MongoDB connection failed:", err.message);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;
const mongoose = require("mongoose");

// Replace <db_password> with your actual MongoDB Atlas password.
// Ensure your IP address is whitelisted in MongoDB Atlas.
const uri = "mongodb+srv://adeptshaharia:C9DWzWZzkBwSpU80@cluster0.g0iqbcg.mongodb.net/testProductDb?retryWrites=true&w=majority&appName=Cluster0";

const connectDB = async () => {
  try {
    // Connect to MongoDB Atlas using Mongoose
    await mongoose.connect(uri, {
      // Mongoose 6.x and later automatically handle these options,
      // but they are kept for clarity and compatibility with older versions.
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Keep trying to send operations for 30 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });
    console.log("MongoDB Atlas connected successfully!");

    // Access the database name from the connection string or specify it
    const dbName = mongoose.connection.name;
    console.log(`Connected to database: ${dbName}`);

    // Check if the 'products' collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const hasProductsCollection = collections.some(col => col.name === 'products');

    if (hasProductsCollection) {
      console.log("Collection 'products' exists. Checking for index...");
      // Get indexes for the 'products' collection
      const indexes = await mongoose.connection.collection('products').indexes();
      const hasNameIndex = indexes.find(index => index.name === 'name_1');

      if (hasNameIndex) {
        // If 'name_1' index exists, drop it
        await mongoose.connection.collection('products').dropIndex('name_1');
        console.log("Dropped index: name_1 from 'products' collection.");
      } else {
        console.log("No index named 'name_1' found on 'products' collection.");
      }
    } else {
      console.log("Collection 'products' does not exist. Skipping index check.");
    }

  } catch (err) {
    console.error("MongoDB Atlas connection failed:", err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;

// Example of how to use the connectDB function (you would typically call this in your main app file)
// connectDB();

