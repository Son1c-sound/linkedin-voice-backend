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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
 
    const result = await db.collection("users").insertOne({
      userId: body.userId,
      tokens: 25, 
      isPremium: false,
      createdAt: new Date()
    });
 
    await client.close();
    return NextResponse.json({ 
      success: true,
      userId: result.insertedId,
      message: "User created"  
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("POST error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500, headers: corsHeaders });
  }
 }
