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

export async function GET() {
  try {
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)

    const transcriptions = await db.collection("transcriptions")
      .find({})
      .toArray()

    await client.close()

    return NextResponse.json({ 
      success: true,
      data: transcriptions 
    }, {
      headers: corsHeaders
    })

  } catch (error) {
    console.error("Get error:", error)
    return NextResponse.json(
      { error: "Failed to fetch transcriptions" }, 
      { 
        status: 500,
        headers: corsHeaders 
      }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { 
          status: 400,
          headers: corsHeaders 
        }
      )
    }

    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)

    const result = await db.collection("transcriptions").deleteOne({
      _id: new ObjectId(id)
    })

    await client.close()

    if (result.deletedCount === 0) {
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
      message: "Transcription deleted successfully" 
    }, {
      headers: corsHeaders
    })

  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete transcription" },
      { 
        status: 500,
        headers: corsHeaders 
      }
    )
  }
}