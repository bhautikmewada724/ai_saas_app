import mongoose, { Mongoose } from 'mongoose'

const MONGODB_URL = process.env.MONGO_URL;

interface MongooseConnection {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
}

// Ensure the global object has a mongoose property
declare global {
    var mongoose: MongooseConnection | undefined;
}

let cached: MongooseConnection = global.mongoose || { conn: null, promise: null };

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export const connectToDatabase = async () => {
    if (cached.conn) {
        console.log("Already connected to the database");
        return cached.conn;
    };

    if (!MONGODB_URL) throw new Error("Missing MONGODB URL");

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URL, {
            dbName: "imaginify",
            bufferCommands: false
        }).then((mongoose) => {
            console.log("Connected to the database");
            return mongoose;
        }).catch((err) => {
            console.error("Failed to connect to the database", err);
            throw err;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null; // reset promise in case of error
        throw err;
    }

    return cached.conn;
};
