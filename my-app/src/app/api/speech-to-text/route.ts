import { audioSchema } from './../../../lib/validation'
import { MongoClient } from "mongodb"
import OpenAI from "openai"
import { NextResponse } from "next/server"

const uri: string = process.env.MONGO_URI!
const dbName: string = process.env.AUTH_DB_NAME!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    await audioSchema.validate({ audioData: formData.get('audioData') })
    const audioFile = formData.get('audioData')

    if (!audioFile || !(audioFile instanceof File)) {
      const errorMessage = "No valid audio file provided"
      console.error(errorMessage)
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create a Blob to simulate the File-like object
    const blob = new Blob([buffer], { type: 'audio/wav' })
    const file = new File([blob], 'audio.wav', { type: 'audio/wav' })

    const transcription = await openai.audio.transcriptions.create({
      file: file, // Use the simulated File object
      model: "whisper-1",
    })

    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)

    const result = await db.collection("transcriptions").insertOne({
      text: transcription.text,
      createdAt: new Date(),
      status: "raw"
    })

    await client.close()

    return NextResponse.json({ 
      success: true, 
      transcriptionId: result.insertedId,
      text: transcription.text 
    })

  } catch (error: any) {
    // Detailed error logging
    console.error("Speech to text error:", error.message)
    
    // If the error contains a stack trace, log it
    if (error.stack) {
      console.error("Stack trace:", error.stack)
    }

    // Optionally log the specific API failure (OpenAI, MongoDB, etc.)
    if (error.response) {
      console.error("API response error:", error.response)
    }

    return NextResponse.json({ error: "Failed to process audio" }, { status: 500 })
  }
}
