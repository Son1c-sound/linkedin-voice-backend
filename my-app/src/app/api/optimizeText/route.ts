import { MongoClient } from "mongodb";
import OpenAI from "openai";
import { NextResponse } from "next/server"

const uri: string = process.env.MONGO_URI!;
const dbName: string = process.env.AUTH_DB_NAME!;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


export async function POST(req: Request) {
    try {
      const { transcriptionId } = await req.json();
  
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db(dbName);
  
      // Get the original transcription
      const transcription = await db.collection("transcriptions").findOne({
        _id: transcriptionId
      });
  
      if (!transcription) {
        await client.close();
        return NextResponse.json({ error: "Transcription not found" }, { status: 404 });
      }
  
      // Optimize the text for LinkedIn using OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional content optimizer for LinkedIn posts. Maintain the core message while making it more engaging and professional."
          },
          {
            role: "user",
            content: transcription.text
          }
        ]
      });
  
      const optimizedText = completion.choices[0].message.content;
  
      // Save the optimized version
      await db.collection("transcriptions").updateOne(
        { _id: transcriptionId },
        { 
          $set: { 
            optimizedText,
            status: "optimized",
            updatedAt: new Date()
          }
        }
      );
  
      await client.close();
  
      return NextResponse.json({ 
        success: true, 
        optimizedText 
      });
  
    } catch (error) {
      console.error("Optimization error:", error);
      return NextResponse.json({ error: "Failed to optimize text" }, { status: 500 });
    }
}