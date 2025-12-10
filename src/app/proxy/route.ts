import { NextResponse } from "next/server";

export async function GET() {
  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Paceline Chat</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://YOUR-NEXT-APP-DOMAIN.com/paceline-chat.js" defer></script>
  </head>
  <body>
    <div id="paceline-chat-root"></div>
  </body>
</html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" }
  });
}