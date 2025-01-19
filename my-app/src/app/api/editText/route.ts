export async function PATCH(req: Request) {
    try {
      const { transcriptionId, updatedText } = await req.json();
  
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db(dbName);
  
      // Update the optimized text
      const result = await db.collection("transcriptions").updateOne(
        { _id: transcriptionId },
        { 
          $set: { 
            optimizedText: updatedText,
            status: "edited",
            editedAt: new Date()
          }
        }
      );
  
      await client.close();
  
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Transcription not found" }, { status: 404 });
      }
  
      return NextResponse.json({ 
        success: true, 
        message: "Text updated successfully" 
      });
  
    } catch (error) {
      console.error("Patch error:", error);
      return NextResponse.json({ error: "Failed to update text" }, { status: 500 });
    }
  }