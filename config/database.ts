import mongoose from "mongoose";

export const connect = async (): Promise<void> => {
    try {
        if (!process.env.MONGO_URL) {
            throw new Error("MONGO_URL is not defined");
        }

        await mongoose.connect(process.env.MONGO_URL);
        console.log("KẾT NỐI THÀNH CÔNG!");
    } catch (error) {
        console.error("KẾT NỐI THẤT BẠI:", error);
    }
}