import { MongoClient } from "mongodb"
import OpenAI from "openai"
import { NextResponse } from "next/server"

const uri: string = process.env.MONGO_URI!
const dbName: string = process.env.AUTH_DB_NAME!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
    },
  })
}

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { audioData, fileName, fileType } = body;
    
    if (!audioData) {
      return NextResponse.json({
        success: false,
        error: "No audio data provided"
      }, {
        status: 400,
        headers: corsHeaders
      });
    }

    const buffer = Buffer.from(audioData, 'base64');
    const audioFile = new File([buffer], fileName, { type: fileType });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    const result = await db.collection("transcriptions").insertOne({
      text: transcription.text,
      createdAt: new Date(),
      status: "raw",
      userId: body.userId
    });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      transcriptionId: result.insertedId,
      text: transcription.text 
    }, {
      headers: corsHeaders
    });

  } catch (error: any) {
    console.error("Processing error:", {
      message: error.message,
      stack: error.stack,
      details: error
    });
    
    return NextResponse.json({
      success: false,
      error: "Failed to process audio",
      details: {
        message: error.message,
        type: error.name
      }
    }, {
      status: 500,
      headers: corsHeaders
    });
  }
}