import { NextResponse } from "next/server";

// Serverless: never cache route output (DB-backed responses)
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}