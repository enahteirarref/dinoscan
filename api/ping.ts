export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return res.status(204).end();
  return res.status(200).send("pong");
}
