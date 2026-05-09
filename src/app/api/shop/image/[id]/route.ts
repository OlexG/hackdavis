import { openShopImageStream } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const image = await openShopImageStream(id);

  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  // Convert Node.js Readable into a Web ReadableStream the Response can consume.
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      image.stream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      image.stream.on("end", () => controller.close());
      image.stream.on("error", (error) => controller.error(error));
    },
    cancel() {
      const stream = image.stream as NodeJS.ReadableStream & { destroy?: () => void };
      stream.destroy?.();
    },
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": image.contentLength.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
