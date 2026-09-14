const SUPABASE_URL = 'https://rtxhtrkgdcqshbownhft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0eGh0cmtnZGNxc2hib3duaGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5ODM4MzYsImV4cCI6MjEwNDU1OTgzNn0.mMfo-AE675zg8n2rfEJq5nDyg6XcHYc7N4BgdditAlA';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function leggiIdDallUrl() {
  const parti = window.location.pathname.split('/').filter(Boolean);
  const ultimaparte = parti[parti.length - 1];
  const paramId = new URLSearchParams(window.location.search).get('id');
  return paramId || ultimaparte;
}

async function caricaGrattino() {
  const id = leggiIdDallUrl();
  if (!id) {
    mostraErrore();
    return;
  }

  const { data, error } = await supabaseClient
    .from('grattini')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    mostraErrore();
    return;
  }

  mostraGrattino(data);
}

function mostraErrore() {
  document.getElementById('stato-caricamento').classList.add('nascosto');
  document.getElementById('stato-errore').classList.remove('nascosto');
}

let contenutoCorrente = null;

function mostraGrattino(grattino) {
  document.getElementById('stato-caricamento').classList.add('nascosto');
  document.getElementById('stato-grattino').classList.remove('nascosto');

  contenutoCorrente = { tipo: grattino.tipo_contenuto, valore: grattino.valore_contenuto };

  const contenutoSotto = document.getElementById('contenuto-sotto');
  if (grattino.tipo_contenuto === 'emoji') {
    contenutoSotto.textContent = grattino.valore_contenuto;
  } else {
    const img = document.createElement('img');
    img.src = grattino.valore_contenuto;
    contenutoSotto.appendChild(img);
  }

  if (grattino.grattato) {
    document.getElementById('canvas-scratch').classList.add('nascosto');
    document.getElementById('istruzioni').classList.add('nascosto');
    document.getElementById('cta-download').classList.remove('nascosto');
    document.getElementById('cta-download').style.opacity = '1';
    return;
  }

  avviaScratch(grattino.colore_stile || '#D4AF37', grattino.id);
}

function avviaScratch(coloreOverlay, grattinoId) {
  const canvas = document.getElementById('canvas-scratch');
  const ctx = canvas.getContext('2d');
  const contenitore = document.getElementById('contenitore-canvas');

  function ridimensiona() {
    canvas.width = contenitore.clientWidth;
    canvas.height = contenitore.clientHeight;
    disegnaOverlay();
  }

  function disegnaOverlay() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = coloreOverlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 5;
    const spaziatura = 14;
    for (let offset = -canvas.height; offset < canvas.width + canvas.height; offset += spaziatura) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + canvas.height, canvas.height);
      ctx.stroke();
    }
  }

  requestAnimationFrame(ridimensiona);
  window.addEventListener('resize', ridimensiona);

  const dimensioneCella = 45;
  let colonne, righe, celleTotali;
  const celleVisitate = new Set();
  let rivelato = false;

  function aggiornaGriglia() {
    colonne = Math.ceil(canvas.width / dimensioneCella);
    righe = Math.ceil(canvas.height / dimensioneCella);
    celleTotali = colonne * righe;
  }
  aggiornaGriglia();
  window.addEventListener('resize', aggiornaGriglia);

  let disegnando = false;
  let ultimoPunto = null;

  function segnaCelleLungoSegmento(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distanza = Math.sqrt(dx * dx + dy * dy);
    const passi = Math.max(1, Math.ceil(distanza / (dimensioneCella / 2)));

    for (let i = 0; i <= passi; i++) {
      const t = i / passi;
      const x = x1 + dx * t;
      const y = y1 + dy * t;
      const colonna = Math.floor(x / dimensioneCella);
      const riga = Math.floor(y / dimensioneCella);
      if (colonna >= 0 && colonna < colonne && riga >= 0 && riga < righe) {
        celleVisitate.add(`${colonna},${riga}`);
      }
    }
  }

  function cancellaTratto(x1, y1, x2, y2) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 45;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function posizioneEvento(evento) {
    const rect = canvas.getBoundingClientRect();
    const puntoTattile = evento.touches ? evento.touches[0] : evento;
    return {
      x: puntoTattile.clientX - rect.left,
      y: puntoTattile.clientY - rect.top,
    };
  }

  function iniziaDisegno(evento) {
    disegnando = true;
    const { x, y } = posizioneEvento(evento);
    ultimoPunto = { x, y };
    segnaCelleLungoSegmento(x, y, x, y);
    cancellaTratto(x, y, x, y);
  }

  function continuaDisegno(evento) {
    if (!disegnando) return;
    evento.preventDefault();
    const { x, y } = posizioneEvento(evento);
    if (ultimoPunto) {
      cancellaTratto(ultimoPunto.x, ultimoPunto.y, x, y);
      segnaCelleLungoSegmento(ultimoPunto.x, ultimoPunto.y, x, y);
    }
    ultimoPunto = { x, y };
    controllaProgresso();
  }

  function fineDisegno() {
    disegnando = false;
    ultimoPunto = null;
  }

  function controllaProgresso() {
    const percentuale = (celleVisitate.size / celleTotali) * 100;
    if (percentuale > 55 && !rivelato) {
      rivelato = true;
      document.getElementById('cta-download').classList.remove('nascosto');
    document.getElementById('cta-download').style.opacity = '1';
      supabaseClient.from('grattini').update({ grattato: true }).eq('id', grattinoId).then(({ error }) => { if (error) console.error('Errore salvataggio grattato:', error); else console.log('Salvato correttamente'); });
    }
  }

  canvas.addEventListener('mousedown', iniziaDisegno);
  window.addEventListener('mousemove', continuaDisegno);
  window.addEventListener('mouseup', fineDisegno);

  canvas.addEventListener('touchstart', iniziaDisegno);
  canvas.addEventListener('touchmove', continuaDisegno);
  canvas.addEventListener('touchend', fineDisegno);
}

async function scaricaFoto() {
  if (!contenutoCorrente) return;

  if (contenutoCorrente.tipo === 'emoji') {
    const canvasEmoji = document.createElement('canvas');
    canvasEmoji.width = 500;
    canvasEmoji.height = 500;
    const ctxEmoji = canvasEmoji.getContext('2d');
    ctxEmoji.fillStyle = '#2FBFAE';
    ctxEmoji.fillRect(0, 0, 500, 500);
    ctxEmoji.font = '260px sans-serif';
    ctxEmoji.textAlign = 'center';
    ctxEmoji.textBaseline = 'middle';
    ctxEmoji.fillText(contenutoCorrente.valore, 250, 270);

    const link = document.createElement('a');
    link.download = 'scratchy.png';
    link.href = canvasEmoji.toDataURL('image/png');
    link.click();
  } else {
    const risposta = await fetch(contenutoCorrente.valore);
    const blob = await risposta.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'scratchy.jpg';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
}

document.getElementById('btn-salva-foto').addEventListener('click', scaricaFoto);

async function inizializza() {
  await supabaseClient.auth.signInAnonymously();
  caricaGrattino();
}

inizializza();
