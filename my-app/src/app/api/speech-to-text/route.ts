import { audioSchema } from './../../../lib/validation'
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
    const formData = await req.formData();
    const audioData = formData.get('audioData');
    
    console.log("Received audio data type:", typeof audioData);
    console.log("Audio data properties:", Object.keys(audioData || {}));

    let audioFile;
    
    if (audioData instanceof File) {
      // Web browser upload
      console.log("Processing web browser upload");
      audioFile = audioData;
    } else if (audioData && typeof audioData === 'object') {
      // Mobile upload
      console.log("Processing mobile upload");
      const mobileData = audioData as any;
      
      try {
        // Check if we have direct binary data
        if (mobileData.arrayBuffer) {
          const buffer = await mobileData.arrayBuffer();
          audioFile = new File([buffer], 'audio.wav', { 
            type: 'audio/wav'
          });
        } 
        // Check if we have a URI (common in React Native)
        else if (mobileData.uri) {
          const response = await fetch(mobileData.uri);
          const blob = await response.blob();
          audioFile = new File([blob], 'audio.wav', {
            type: mobileData.type || 'audio/wav'
          });
        } else {
          throw new Error("Unrecognized audio data format");
        }
      } catch (error:any) {
        console.error("Error processing mobile audio:", error);
        throw new Error(`Failed to process mobile audio: ${error.message}`);
      }
    }

    if (!audioFile) {
      console.log("No valid audio file found in request");
      return NextResponse.json({ 
        success: false, 
        error: "No valid audio file provided",
        details: { 
          receivedType: typeof audioData,
          isFile: audioData instanceof File,
          properties: audioData ? Object.keys(audioData) : []
        }
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    if (audioFile.size === 0) {
      console.log("Audio file is empty");
      return NextResponse.json({ 
        success: false, 
        error: "Audio file is empty",
        details: { fileSize: audioFile.size }
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // Prepare file for OpenAI
    console.log("Preparing file for OpenAI, size:", audioFile.size);
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const file = new File([buffer], 'audio.wav', { type: 'audio/wav' });

    try {
      console.log("Sending to OpenAI transcription API");
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
      });

      console.log("Transcription received, saving to database");
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db(dbName);
      
      const result = await db.collection("transcriptions").insertOne({
        text: transcription.text,
        createdAt: new Date(),
        status: "raw"
      });

      await client.close();
      console.log("Successfully processed and saved transcription");

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