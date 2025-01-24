import { MongoClient, ObjectId } from "mongodb"
import OpenAI from "openai"
import { NextResponse } from "next/server"
import { optimizeSchema } from "@/lib/validation"

const uri: string = process.env.MONGO_URI!
const dbName: string = process.env.AUTH_DB_NAME!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })


const corsHeaders = {
 'Access-Control-Allow-Credentials': 'true',
 'Access-Control-Allow-Origin': '*', 
 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
}

export async function OPTIONS() {
 return new NextResponse(null, {
   status: 204,
   headers: corsHeaders
 })
}

export async function POST(req: Request) {
 try {
   const body = await req.json();
   const { transcriptionId } = await optimizeSchema.validate(body);
   
   const client = new MongoClient(uri)
   await client.connect()
   const db = client.db(dbName)

   const _id = new ObjectId(transcriptionId);

   const transcription = await db.collection("transcriptions").findOne({ _id });

   if (!transcription) {
     await client.close();
     return NextResponse.json(
       { error: "Transcription not found" }, 
       { 
         status: 404,
         headers: corsHeaders 
       }
     );
   }

   const completion = await openai.chat.completions.create({
     model: "gpt-4",
     messages: [
      {
        role: "system",
        content: `You MUST return a JSON response in exactly this format, with no other text:
{
"optimizedContent": "The enhanced LinkedIn post text",
"hashtags": ["relevant", "hashtags"],
"tone": "Professional yet conversational",
"targetAudience": "Primary audience"
}

Transform the input into an engaging LinkedIn post while:
- Maintaining authentic voice
- Adding hooks and calls-to-action
- Using natural tone
- Including strategic line breaks
- Suggesting relevant hashtags`
      },
      {
        role: "user",
        content: transcription.text ?? ''
      }
    ],
   })

   const response = JSON.parse(completion.choices[0].message.content || '')

   await db.collection("transcriptions").updateOne(
    { _id },
    {
      $set: {
        optimizedText: response.optimizedContent,
        hashtags: response.hashtags,
        tone: response.tone,
        targetAudience: response.targetAudience,
        status: "optimized",
        updatedAt: new Date()
      }
    }
  );

   await client.close()

   return NextResponse.json({
    success: true,
    ...response
   }, {
     headers: corsHeaders
   })

 } catch (error) {
   console.error("Optimization error:", error)
   return NextResponse.json(
     { error: "Failed to optimize text" }, 
     { 
       status: 500,
       headers: corsHeaders
     }
   )
 }
}