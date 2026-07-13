import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

/**
 * PNG → TIFF transcode for print shops that require TIFF delivery. The
 * client renders the DPI-exact PNG (same pipeline as every other export)
 * and this route re-encodes it losslessly with LZW compression and the
 * correct physical density. A pure byte transform: no auth needed (works
 * in local demo mode); the size cap is the abuse guard.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const dpiRaw = request.nextUrl.searchParams.get("dpi");
  const dpi = dpiRaw ? Number(dpiRaw) : 300;
  if (!Number.isFinite(dpi) || dpi < 72 || dpi > 1200) {
    return NextResponse.json({ error: "dpi must be between 72 and 1200." }, { status: 400 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "PNG exceeds the 64 MB limit." }, { status: 413 });
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: body.byteLength === 0 ? "Empty body." : "PNG exceeds the 64 MB limit." },
      { status: body.byteLength === 0 ? 400 : 413 },
    );
  }
  if (!PNG_MAGIC.every((byte, i) => body[i] === byte)) {
    return NextResponse.json({ error: "Body must be a PNG image." }, { status: 400 });
  }

  try {
    const tiff = await sharp(Buffer.from(body))
      .withMetadata({ density: dpi })
      .tiff({ compression: "lzw" })
      .toBuffer();
    return new NextResponse(new Uint8Array(tiff), {
      status: 200,
      headers: {
        "Content-Type": "image/tiff",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TIFF conversion failed." },
      { status: 422 },
    );
  }
}
