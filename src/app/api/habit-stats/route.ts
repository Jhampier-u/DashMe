import { NextResponse } from "next/server";
import { getHabitStats } from "@/lib/stats";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json(null, { status: 400 });
  const stats = await getHabitStats(id);
  return NextResponse.json(stats);
}
