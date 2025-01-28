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
  status: 'pending' | 'in_progress' | 'optimized' | 'failed' 
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

const uri: string = process.env.MONGO_URI!
const dbName: string = process.env.AUTH_DB_NAME!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

async function optimizeForPlatform(text: string, platform: Platform): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: PLATFORM_PROMPTS[platform]
      },
      {
        role: "user",
        content: text
      }
    ]
  })
  return completion.choices[0].message.content || ''
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  })
}

export async function POST(req: Request) {
  const client = new MongoClient(uri);
  try {
    const body = await req.json() as OptimizeRequest;
    const validatedBody = await optimizeSchema.validate(body) as ValidatedRequest;
    const { transcriptionId } = validatedBody;
    
    await client.connect();
    const db = client.db(dbName);
    
    const _id = new ObjectId(transcriptionId);
    const transcription = await db.collection<Transcription>("transcriptions").findOne({ _id });
    
    if (!transcription) {
      return NextResponse.json<OptimizeResponse>(
        { success: false, error: "Transcription not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Start all optimizations in parallel
    const platforms: Platform[] = ['linkedin', 'twitter', 'reddit'];
    const optimizationPromises = platforms.map(platform => 
      optimizeForPlatform(transcription.text, platform)
    );

    // Get LinkedIn result first
    const [linkedinResult, ...otherResults] = await Promise.all(optimizationPromises);
    
    // Initial optimizations with LinkedIn
    const optimizations = {
      linkedin: linkedinResult
    } as Record<Platform, string>;

    // Save initial state
    await db.collection<Transcription>("transcriptions").updateOne(
      { _id },
      {
        $set: {
          optimizations,
          status: "in_progress",
          updatedAt: new Date()
        }
      }
    );

    // Continue processing others in background
    Promise.all(otherResults).then(async ([twitterResult, redditResult]) => {
      await db.collection<Transcription>("transcriptions").updateOne(
        { _id },
        {
          $set: {
            'optimizations.twitter': twitterResult,
            'optimizations.reddit': redditResult,
            status: "optimized",
            updatedAt: new Date()
          }
        }
      );
    });

    return NextResponse.json<OptimizeResponse>(
      {
        success: true,
        optimizations
      },
      { headers: corsHeaders }
    );
    
  } catch (error) {
    console.error("Optimization error:", error);
    return NextResponse.json<OptimizeResponse>(
      { success: false, error: "Failed to optimize text" },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await client.close();
  }
}