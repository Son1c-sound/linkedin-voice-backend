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
  linkedin: `As a LinkedIn post optimizer, transform this content while following these strict guidelines:
- Keep the core message and key facts exactly as provided
- Structure with professional formatting (use line breaks strategically)
- Add 3-4 relevant hashtags maximum at the end
- Include a clear call-to-action at the end
- Maintain first-person perspective
- Stay under 1300 characters
- Never add or embellish details not present in the original
- Never add statistics or quotes that weren't in the original
- Remove casual language but keep it authentic`,

  twitter: `As a Twitter/X post optimizer, transform this content while following these strict guidelines:
- Keep only the most essential points from the original message
- Maximum 280 characters including spaces and hashtags
- Use maximum 2 relevant hashtags at the end
- Keep pronouns and personal perspective as in original
- Never add facts or details not present in original
- Focus on one key highlight/achievement/announcement
- Can use emojis sparingly (maximum 2)
- Remove unnecessary words but keep main message intact`,

  reddit: `As a Reddit post optimizer, transform this content while following these strict guidelines:
- Create a clear, descriptive title in [brackets] if achievement/announcement related
- Keep all original facts and details intact
- Maintain casual but clear tone
- Structure in readable paragraphs
- Include all relevant details from original
- Never add or modify any technical details or claims
- End with a question to encourage discussion
- Don't use hashtags or emojis
- Keep first-person perspective
- Focus on authenticity over promotion`
}

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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function optimizeWithRetry(text: string, platform: Platform, retries = 3): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
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
      await new Promise(resolve => setTimeout(resolve, 1000)); 
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
    
    const client = await connectToDatabase();
    const db = client.db(process.env.AUTH_DB_NAME!);
    
    const _id = new ObjectId(transcriptionId);
    const transcription = await db.collection<Transcription>("transcriptions").findOne(
      { _id },
      { projection: { text: 1 } }
    );
    
    if (!transcription) {
      return NextResponse.json<OptimizeResponse>(
        { success: false, error: "Transcription not found" },
        { status: 404, headers: corsHeaders }
      );
    }

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
        optimizations[platforms[index]] = transcription.text; 
      }
    });

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