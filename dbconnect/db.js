
const mongoose = require("mongoose");
const uri = process.env.MONGO_URI;
const connectDB = async () => {
  try {
    await mongoose.connect(uri, {
 
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


