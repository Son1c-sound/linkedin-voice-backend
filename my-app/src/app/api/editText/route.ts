import { editSchema } from '@/lib/validation'
import { MongoClient, ObjectId } from "mongodb"
import { NextResponse } from "next/server"

const uri: string = process.env.MONGO_URI!
const dbName: string = process.env.AUTH_DB_NAME!

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  })
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const validData = await editSchema.validate(body);
    
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)

    const _id = new ObjectId(validData.transcriptionId)

    const result = await db.collection("transcriptions").updateOne(
      { _id, userId: validData.userId },
      {
        $set: {
          optimizations: validData.updatedOptimizations,
          status: "edited",
          editedAt: new Date()
        }
      }
    )

    await client.close()

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Transcription not found" },
        { 
          status: 404,
          headers: corsHeaders 
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Optimizations updated successfully"
    }, {
      headers: corsHeaders
    })
  } catch (error) {
    console.error("Patch error:", error)
    return NextResponse.json(
      { error: "Failed to update optimizations" },
      { 
        status: 500,
        headers: corsHeaders 
      }
    )
  }
}