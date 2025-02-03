import { MongoClient } from "mongodb"
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
    const { userId, status } = body;
    
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)

    const updateValues = status === 'active' 
      ? { isPremium: true, tokens: 2000 }
      : { isPremium: false, tokens: 0 };

    const result = await db.collection("users").updateOne(
      {  userId: userId },
      {
        $set: updateValues
      }
    )

    await client.close()

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { 
          status: 404,
          headers: corsHeaders 
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`
    }, {
      headers: corsHeaders
    })
  } catch (error) {
    console.error("Patch error:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { 
        status: 500,
        headers: corsHeaders 
      }
    )
  }
}