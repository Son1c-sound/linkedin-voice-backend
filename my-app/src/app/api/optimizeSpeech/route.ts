import { MongoClient, ObjectId } from "mongodb"
import OpenAI from "openai"
import { NextResponse } from "next/server"
import { optimizeSchema } from "@/lib/validation"

export const config = {
  maxDuration: 60,
};

type Platform = 'linkedin' | 'twitter' | 'reddit'

interface Transcription {
  _id: ObjectId
  text: string
  optimizations: Record<Platform, string>
  status: 'pending' | 'optimized' | 'failed'
  createdAt: Date
  updatedAt: Date
}

interface OptimizeRequest {
  transcriptionId: string
  platforms?: Platform[]
}

interface ValidatedRequest {
  transcriptionId: string
}

interface OptimizeResponse {
  success: boolean
  optimizations?: Record<Platform, string>
  error?: string
}

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
}

const PLATFORM_PROMPTS: Record<Platform, string> = {
  linkedin: "You are a professional content optimizer for LinkedIn posts. Maintain the core message while making it more engaging and professional.",
  twitter: "You are a Twitter/X post optimizer. Make the message concise and engaging while keeping it under 280 characters.",
  reddit: "You are a Reddit post optimizer. Make the message clear, informative, and engaging while maintaining authenticity and encouraging discussion."
}

// Create a cached connection to MongoDB
let cachedClient: MongoClient | null = null;
async function connectToDatabase(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }
  
  const client = new MongoClient(process.env.MONGO_URI!);
  await client.connect();
  cachedClient = client;
  return client;
}

// Initialize OpenAI client once
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Batch process optimizations with retry logic
async function optimizeWithRetry(text: string, platform: Platform, retries = 3): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using a faster model
      messages: [
        {
          role: "system",
          content: PLATFORM_PROMPTS[platform]
        },
        {
          role: "user",
          content: text
        }
      ],
    })
    return completion.choices[0].message.content || ''
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      return optimizeWithRetry(text, platform, retries - 1);
    }
    throw error;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as OptimizeRequest;
    const validatedBody = await optimizeSchema.validate(body) as ValidatedRequest;
    const { transcriptionId } = validatedBody;
    const platforms = body.platforms || ['linkedin', 'twitter', 'reddit'] as Platform[];
    
    // Use cached connection
    const client = await connectToDatabase();
    const db = client.db(process.env.AUTH_DB_NAME!);
    
    const _id = new ObjectId(transcriptionId);
    const transcription = await db.collection<Transcription>("transcriptions").findOne(
      { _id },
      { projection: { text: 1 } } // Only fetch the text field
    );
    
    if (!transcription) {
      return NextResponse.json<OptimizeResponse>(
        { success: false, error: "Transcription not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Process optimizations in parallel with timeout and retry logic
    const optimizationPromises = platforms.map(platform => 
      optimizeWithRetry(transcription.text, platform)
        .then(result => ({ platform, result }))
    );

    const results = await Promise.allSettled(optimizationPromises);
    const optimizations: Record<Platform, string> = {} as Record<Platform, string>;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        optimizations[result.value.platform] = result.value.result;
      } else {
        console.error(`Failed to optimize for ${platforms[index]}:`, result.reason);
        optimizations[platforms[index]] = transcription.text; // Fallback to original text
      }
    });

    // Update database in background
    db.collection<Transcription>("transcriptions").updateOne(
      { _id },
      {
        $set: {
          optimizations,
          status: "optimized",
          updatedAt: new Date()
        }
      }
    ).catch(error => console.error('Failed to update database:', error));

    return NextResponse.json<OptimizeResponse>(
      {
        success: true,
        optimizations
      },
      { headers: corsHeaders }
    )
    
  } catch (error) {
    console.error("Optimization error:", error)
    return NextResponse.json<OptimizeResponse>(
      { success: false, error: "Failed to optimize text" },
      { status: 500, headers: corsHeaders }
    )
  }
}