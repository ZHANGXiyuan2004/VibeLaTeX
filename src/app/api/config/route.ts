import { NextResponse } from "next/server";

import { getConfig, toPublicConfig } from "@/server/config-store";

export async function GET() {
  const config = await getConfig();
  return NextResponse.json(toPublicConfig(config));
}
