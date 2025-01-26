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

    const users = await db.collection("users")
      .find({})
      .toArray()

    await client.close()

    return NextResponse.json({ 
      success: true,
      data: users 
    }, {
      headers: corsHeaders
    })

  } catch (error) {
    console.error("Get error:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" }, 
      { 
        status: 500,
        headers: corsHeaders 
      }
    )
  }
}

