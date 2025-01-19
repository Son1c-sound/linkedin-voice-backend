import { editSchema } from '@/lib/validation'
import { MongoClient, ObjectId } from "mongodb"  
import { NextResponse } from "next/server"

const uri: string = process.env.MONGO_URI!
const dbName: string = process.env.AUTH_DB_NAME!

export async function PATCH(req: Request) {
    try {
      const body = await req.json();
      const validData = await editSchema.validate(body);
      
      const client = new MongoClient(uri)
      await client.connect()
      const db = client.db(dbName)
  
      const _id = new ObjectId(validData.transcriptionId)
  
      const result = await db.collection("transcriptions").updateOne(
        { _id },
        { 
          $set: { 
            optimizedText: validData.updatedText,
            status: "edited",
            editedAt: new Date()
          }
        }
      )
  
      await client.close()
  
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Transcription not found" }, { status: 404 })
      }
  
      return NextResponse.json({ 
        success: true, 
        message: "Text updated successfully" 
      })
  
    } catch (error) {
      console.error("Patch error:", error)
      return NextResponse.json({ error: "Failed to update text" }, { status: 500 })
    }
  }