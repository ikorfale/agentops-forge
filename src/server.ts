import http from "node:http";

const port = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400).end("bad request");
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "agentops-forge", ts: new Date().toISOString() }));
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      name: "AgentOps Forge",
      version: "0.1.0",
      endpoints: ["/health"]
    }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => {
  console.log(`agentops-forge server listening on :${port}`);
});
