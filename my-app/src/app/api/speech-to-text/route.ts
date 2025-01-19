import { MongoClient } from "mongodb";
import OpenAI from "openai";
import { NextResponse } from "next/server";

const uri: string = process.env.MONGO_URI!;
const dbName: string = process.env.AUTH_DB_NAME!;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { audioData } = await req.json();
    
    // Convert speech to text using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioData,
      model: "whisper-1",
    });

    // Connect to MongoDB
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    
    // Save the raw transcription
    const result = await db.collection("transcriptions").insertOne({
      text: transcription.text,
      createdAt: new Date(),
      status: "raw"
    });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      transcriptionId: result.insertedId,
      text: transcription.text 
    });

  } catch (error) {
    console.error("Speech to text error:", error);
    return NextResponse.json({ error: "Failed to process audio" }, { status: 500 });
  }
}