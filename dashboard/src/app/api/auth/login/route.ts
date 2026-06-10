import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

/**
 * Minimal credential check against env vars. For a production deployment,
 * swap this for Supabase Auth or your own user store. Never hard-code real
 * secrets — values come from env.
 */
export async function POST(request: Request) {
  const { username, password } = await request.json().catch(() => ({}));

  const expectedUser = process.env.DASHBOARD_USER || "admin";
  const expectedPass = process.env.DASHBOARD_PASSWORD || "admin";
  const secret = process.env.JWT_SECRET || "dev-insecure-secret";

  if (username !== expectedUser || password !== expectedPass) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const token = jwt.sign({ sub: username, role: "user" }, secret, {
    expiresIn: "7d",
  });

  return NextResponse.json({ token });
}
