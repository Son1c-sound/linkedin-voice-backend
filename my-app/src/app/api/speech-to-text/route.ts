import { audioSchema } from './../../../lib/validation'
import { MongoClient } from "mongodb"
import OpenAI from "openai"
import { NextResponse } from "next/server"

const uri: string = process.env.MONGO_URI!
const dbName: string = process.env.AUTH_DB_NAME!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    console.log("Received request to process audio")
    const formData = await req.formData()
    console.log("Form data received")

    // Validate audio file
    await audioSchema.validate({ audioData: formData.get('audioData') })
    const audioFile = formData.get('audioData')

    if (!audioFile || !(audioFile instanceof File)) {
      console.error("No valid audio file provided")
      return NextResponse.json({ error: "No valid audio file provided" }, { status: 400 })
    }

    console.log("Audio file validated")

    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const file = new File([buffer], 'audio.wav', { type: 'audio/wav' })
    console.log("Audio file processed into buffer")

    // Transcribe audio
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    })
    console.log("Audio transcription completed")

    // MongoDB connection
    const client = new MongoClient(uri)
    await client.connect()
    console.log("Connected to MongoDB")

    const db = client.db(dbName)

    // Insert transcription into database
    const result = await db.collection("transcriptions").insertOne({
      text: transcription.text,
      createdAt: new Date(),
      status: "raw"
    })
    console.log("Transcription saved to MongoDB")

    // Close MongoDB client
    await client.close()

    console.log("MongoDB connection closed")

    return NextResponse.json({ 
      success: true, 
      transcriptionId: result.insertedId,
      text: transcription.text 
    })

  } catch (error: any) {
    console.error("Speech to text error:", error.message || error)
    console.error("Stack trace:", error.stack)
    return NextResponse.json({ error: "Failed to process audio" }, { status: 500 })
  }
}
