import { audioSchema } from './../../../lib/validation'
import { MongoClient } from "mongodb"
import OpenAI from "openai"
import { NextResponse } from "next/server"

const uri: string = process.env.MONGO_URI!
const dbName: string = process.env.AUTH_DB_NAME!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Add OPTIONS handler for CORS preflight
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
    // Add CORS headers to the response
  
    const formData = await req.formData();
    await audioSchema.validate({ audioData: formData.get('audioData') });
    const audioFile = formData.get('audioData');
    
    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json({ 
        success: false, 
        error: "No valid audio file provided",
        details: { 
          receivedType: audioFile ? typeof audioFile : 'null',
          isFile: audioFile 
        }
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    if (audioFile.size === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Audio file is empty",
        details: { fileSize: audioFile.size }
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const file = new File([buffer], 'audio.wav', { type: 'audio/wav' });

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
      });

      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db(dbName);
      
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
      }, {
        headers: corsHeaders
      });

    } catch (openAiError: any) {
      console.error("OpenAI API error:", {
        message: openAiError.message,
        details: openAiError.response?.data || openAiError
      });
      
      return NextResponse.json({ 
        success: false, 
        error: "Failed to process audio with OpenAI",
        details: {
          message: openAiError.message,
          type: openAiError.type,
          statusCode: openAiError.status
        }
      }, { 
        status: 500,
        headers: corsHeaders
      });
    }

  } catch (error: any) {
    console.error("Speech to text error:", {
      message: error.message,
      stack: error.stack,
      details: error
    });
    
    return NextResponse.json({ 
      success: false, 
      error: "Failed to process audio",
      details: {
        message: error.message,
        type: error.name,
        validation: error.errors
      }
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}