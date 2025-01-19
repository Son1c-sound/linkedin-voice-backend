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
      return NextResponse.json({ error: "No valid audio file provided" }, { status: 400 })
    }

    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const file = new File([buffer], 'audio.wav', { type: 'audio/wav' })

    const transcription = await openai.audio.transcriptions.create({
      file: file,
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

  } catch (error) {
    console.error("Speech to text error:", error)
    return NextResponse.json({ error: "Failed to process audio" }, { status: 500 })
  }
}
