import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);
    
    // Check key files specifically
    const keyFiles = ['gmail_token.json', 'token.json', 'credentials.json', 'service-key.json', 'next.config.ts'];
    const fileStatus = keyFiles.reduce((acc, file) => {
      acc[file] = fs.existsSync(path.join(cwd, file));
      return acc;
    }, {} as Record<string, boolean>);

    // Also look in parent dir just in case
    const parentDir = path.resolve(cwd, '..');
    let parentFiles: string[] = [];
    try {
        parentFiles = fs.readdirSync(parentDir);
    } catch {
        parentFiles = ["(Cannot access parent dir)"];
    }

    return NextResponse.json({
      env: process.env.NODE_ENV,
      cwd: cwd,
      filesInCwd: files,
      keyFilesCheck: fileStatus,
      parentDir: parentDir,
      parentFiles: parentFiles
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
