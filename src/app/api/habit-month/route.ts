import { NextResponse } from "next/server";
import { getHabitMonth } from "@/lib/habits";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const y = parseInt(url.searchParams.get("y") ?? "", 10);
  const m = parseInt(url.searchParams.get("m") ?? "", 10);
  if (!id || Number.isNaN(y) || Number.isNaN(m)) {
    return NextResponse.json([], { status: 400 });
  }
  const days = await getHabitMonth(id, y, m);
  return NextResponse.json(days);
}
