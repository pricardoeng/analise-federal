// Vercel Function: busca o resultado da Loteria Federal na Caixa.
//   GET /api/federal               -> último concurso
//   GET /api/federal?data=2026-11-11 -> concurso sorteado nessa data
//   GET /api/federal?concurso=6117 -> concurso específico
// Resposta: { concurso, data: "dd/mm/aaaa", premios: ["47376", ...] }

const CAIXA = "https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/";
const ALT = "https://loteriascaixa-api.herokuapp.com/api/federal/";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
  Accept: "application/json",
};

function parseData(txt) {
  const [d, m, y] = txt.slice(0, 10).split("/").map(Number);
  return Date.UTC(y, m - 1, d);
}
const fmt = (t) => new Date(t).toISOString().slice(0, 10).split("-").reverse().join("/");
const DIA = 86400000;

function extrairPremios(j) {
  for (const k of ["listaDezenas", "dezenasSorteadasOrdemSorteio", "dezenas"]) {
    if (Array.isArray(j[k]) && j[k].length >= 5)
      return j[k].slice(0, 5).map((x) => String(x).replace(/\D/g, "").slice(-5).padStart(5, "0"));
  }
  throw new Error("Resposta sem os 5 prêmios");
}

async function getJson(url) {
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

const cache = new Map();
async function buscarConcurso(num) {
  const chave = String(num || "ultimo");
  if (num && cache.has(chave)) return cache.get(chave);
  let j, data;
  try {
    j = await getJson(CAIXA + (num || ""));
    data = parseData(j.dataApuracao);
  } catch (e) {
    j = await getJson(ALT + (num || "latest"));
    data = parseData(j.data);
  }
  const out = { concurso: j.numero || j.concurso, data, premios: extrairPremios(j) };
  if (num) cache.set(chave, out);
  return out;
}

// quartas (3) e sábados (6) em (d1, d2]
function sorteiosEntre(d1, d2) {
  let n = 0;
  for (let t = d1 + DIA; t <= d2; t += DIA) {
    const w = new Date(t).getUTCDay();
    if (w === 3 || w === 6) n++;
  }
  return n;
}

async function buscarPorData(alvo) {
  const ult = await buscarConcurso("");
  if (alvo > ult.data) {
    const e = new Error(`Ainda não há resultado para ${fmt(alvo)}. Último sorteio: ${fmt(ult.data)} (concurso ${ult.concurso}).`);
    e.status = 404;
    throw e;
  }
  let num = ult.concurso - sorteiosEntre(alvo, ult.data);
  const vistos = new Map();
  for (let i = 0; i < 20; i++) {
    if (vistos.has(num) || num > ult.concurso || num < 1) break;
    const r = num === ult.concurso ? ult : await buscarConcurso(num);
    vistos.set(num, r.data);
    if (r.data === alvo) return r;
    const dir = r.data < alvo ? 1 : -1;
    const viz = vistos.get(num + dir);
    if (viz !== undefined && (dir === 1 ? viz > alvo : viz < alvo)) break;
    num += dir * Math.max(1, sorteiosEntre(Math.min(r.data, alvo), Math.max(r.data, alvo)));
  }
  const e = new Error(`Não houve sorteio da Federal em ${fmt(alvo)}. A Federal sorteia às quartas e aos sábados.`);
  e.status = 404;
  throw e;
}

export default async function handler(req, res) {
  try {
    const { data, concurso } = req.query || {};
    let r;
    if (data) {
      const m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return res.status(400).json({ erro: "Use data=AAAA-MM-DD" });
      r = await buscarPorData(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    } else {
      r = await buscarConcurso(concurso ? parseInt(concurso, 10) : "");
    }
    // resultados passados não mudam: cache longo na CDN da Vercel
    res.setHeader("Cache-Control", data || concurso ? "s-maxage=86400, stale-while-revalidate" : "s-maxage=300");
    return res.status(200).json({ concurso: r.concurso, data: fmt(r.data), premios: r.premios });
  } catch (e) {
    return res.status(e.status || 502).json({ erro: e.status ? e.message : `Não foi possível consultar a Caixa agora (${e.message}).` });
  }
}

export { buscarPorData, buscarConcurso, sorteiosEntre };
