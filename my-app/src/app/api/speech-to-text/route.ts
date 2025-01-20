import { audioSchema } from './../../../lib/validation'
import { MongoClient } from "mongodb"
import OpenAI from "openai"
import { NextResponse } from "next/server"
import axios from "axios"  // We can use axios to send raw data to the API

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

    // Read the audio file into a buffer directly
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)  // Convert the file to buffer

    // Send the buffer directly to OpenAI API using axios
    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",  // OpenAI API endpoint for transcriptions
      buffer,
      {
        headers: {
          'Content-Type': 'audio/wav',  // Set content type to match audio format
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        maxRedirects: 0,  // Optional: Disable redirects for this request
      }
    )

    const transcription = response.data

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
