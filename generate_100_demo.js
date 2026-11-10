const fs = require('fs');

const clubsAndCities = [
  // Piemonte
  { club: 'Vespa Club Asti', city: 'Asti' },
  { club: 'Vespa Club Alfieri Asti', city: 'Asti' },
  { club: 'Vespa Club Canelli', city: 'Canelli' },
  { club: 'Vespa Club Alba', city: 'Alba' },
  { club: 'Vespa Club Alessandria', city: 'Alessandria' },
  { club: 'Vespa Club Bra', city: 'Bra' },
  { club: 'Vespa Club Carmagnola', city: 'Carmagnola' },
  { club: 'Vespa Club Chieri', city: 'Chieri' },
  { club: 'Vespa Club Casale Monferrato', city: 'Casale Monferrato' },
  { club: 'Vespa Club Moncalieri', city: 'Moncalieri' },
  { club: 'Vespa Club Torino', city: 'Torino' },
  { club: 'Vespa Club Acqui Terme', city: 'Acqui Terme' },
  { club: 'Vespa Club Settimo Torinese', city: 'Settimo Torinese' },
  { club: 'Vespa Club Rivoli', city: 'Rivoli' },
  { club: 'Vespa Club Pinerolo', city: 'Pinerolo' },
  { club: 'Vespa Club Vercelli', city: 'Vercelli' },
  { club: 'Vespa Club Cuneo', city: 'Cuneo' },
  { club: 'Vespa Club Novara', city: 'Novara' },
  { club: 'Vespa Club Ivrea', city: 'Ivrea' },
  { club: 'Vespa Club Biella', city: 'Biella' },
  { club: 'Vespa Club Verbania', city: 'Verbania' },

  // Liguria
  { club: 'Vespa Club Savona', city: 'Savona' },
  { club: 'Vespa Club Genova', city: 'Genova' },
  { club: 'Vespa Club Imperia', city: 'Imperia' },
  { club: 'Vespa Club Sanremo', city: 'Sanremo' },
  { club: 'Vespa Club La Spezia', city: 'La Spezia' },

  // Valle d'Aosta
  { club: 'Vespa Club Aosta', city: 'Aosta' },

  // Lombardia
  { club: 'Vespa Club Pavia', city: 'Pavia' },
  { club: 'Vespa Club Vigevano', city: 'Vigevano' },
  { club: 'Vespa Club Milano', city: 'Milano' },
  { club: 'Vespa Club Lodi', city: 'Lodi' },
  { club: 'Vespa Club Monza', city: 'Monza' },
  { club: 'Vespa Club Varese', city: 'Varese' },
  { club: 'Vespa Club Cremona', city: 'Cremona' },
  { club: 'Vespa Club Como', city: 'Como' },
  { club: 'Vespa Club Bergamo', city: 'Bergamo' },
  { club: 'Vespa Club Lecco', city: 'Lecco' },
  { club: 'Vespa Club Brescia', city: 'Brescia' },
  { club: 'Vespa Club Mantova', city: 'Mantova' },

  // Emilia-Romagna
  { club: 'Vespa Club Piacenza', city: 'Piacenza' },
  { club: 'Vespa Club Parma', city: 'Parma' },
  { club: 'Vespa Club Reggio Emilia', city: 'Reggio Emilia' },
  { club: 'Vespa Club Modena', city: 'Modena' },
  { club: 'Vespa Club Bologna', city: 'Bologna' },
  { club: 'Vespa Club Ferrara', city: 'Ferrara' },
  { club: 'Vespa Club Ravenna', city: 'Ravenna' },
  { club: 'Vespa Club Rimini', city: 'Rimini' },

  // Veneto & Friuli & Trentino
  { club: 'Vespa Club Verona', city: 'Verona' },
  { club: 'Vespa Club Vicenza', city: 'Vicenza' },
  { club: 'Vespa Club Padova', city: 'Padova' },
  { club: 'Vespa Club Venezia', city: 'Venezia' },
  { club: 'Vespa Club Treviso', city: 'Treviso' },
  { club: 'Vespa Club Trento', city: 'Trento' },
  { club: 'Vespa Club Bolzano', city: 'Bolzano' },
  { club: 'Vespa Club Trieste', city: 'Trieste' },

  // Toscana & Centro
  { club: 'Vespa Club Pisa', city: 'Pisa' },
  { club: 'Vespa Club Livorno', city: 'Livorno' },
  { club: 'Vespa Club Firenze', city: 'Firenze' },
  { club: 'Vespa Club Lucca', city: 'Lucca' },
  { club: 'Vespa Club Siena', city: 'Siena' },
  { club: 'Vespa Club Arezzo', city: 'Arezzo' },
  { club: 'Vespa Club Grosseto', city: 'Grosseto' },
  { club: 'Vespa Club Perugia', city: 'Perugia' },
  { club: 'Vespa Club Terni', city: 'Terni' },
  { club: 'Vespa Club Ancona', city: 'Ancona' },
  { club: 'Vespa Club Pesaro', city: 'Pesaro' },
  { club: 'Vespa Club Ascoli Piceno', city: 'Ascoli Piceno' },
  { club: 'Vespa Club Roma', city: 'Roma' },
  { club: 'Vespa Club Viterbo', city: 'Viterbo' },
  { club: 'Vespa Club Latina', city: 'Latina' },
  { club: 'Vespa Club L\'Aquila', city: 'L\'Aquila' },
  { club: 'Vespa Club Pescara', city: 'Pescara' },
  { club: 'Vespa Club Campobasso', city: 'Campobasso' },

  // Sud & Isole
  { club: 'Vespa Club Napoli', city: 'Napoli' },
  { club: 'Vespa Club Salerno', city: 'Salerno' },
  { club: 'Vespa Club Caserta', city: 'Caserta' },
  { club: 'Vespa Club Avellino', city: 'Avellino' },
  { club: 'Vespa Club Bari', city: 'Bari' },
  { club: 'Vespa Club Foggia', city: 'Foggia' },
  { club: 'Vespa Club Taranto', city: 'Taranto' },
  { club: 'Vespa Club Brindisi', city: 'Brindisi' },
  { club: 'Vespa Club Lecce', city: 'Lecce' },
  { club: 'Vespa Club Potenza', city: 'Potenza' },
  { club: 'Vespa Club Matera', city: 'Matera' },
  { club: 'Vespa Club Cosenza', city: 'Cosenza' },
  { club: 'Vespa Club Catanzaro', city: 'Catanzaro' },
  { club: 'Vespa Club Reggio Calabria', city: 'Reggio Calabria' },
  { club: 'Vespa Club Palermo', city: 'Palermo' },
  { club: 'Vespa Club Catania', city: 'Catania' },
  { club: 'Vespa Club Messina', city: 'Messina' },
  { club: 'Vespa Club Siracusa', city: 'Siracusa' },
  { club: 'Vespa Club Trapani', city: 'Trapani' },
  { club: 'Vespa Club Agrigento', city: 'Agrigento' },
  { club: 'Vespa Club Cagliari', city: 'Cagliari' },
  { club: 'Vespa Club Sassari', city: 'Sassari' },
  { club: 'Vespa Club Olbia', city: 'Olbia' },

  // Estero (14 partecipanti internazionali)
  { club: 'Vespa Club Nice Côte d\'Azur', city: 'Nizza (Francia)' },
  { club: 'Vespa Club Lyon', city: 'Lione (Francia)' },
  { club: 'Vespa Club Paris', city: 'Parigi (Francia)' },
  { club: 'Vespa Club Marseille', city: 'Marsiglia (Francia)' },
  { club: 'Vespa Club Genève', city: 'Ginevra (Svizzera)' },
  { club: 'Vespa Club Zürich', city: 'Zurigo (Svizzera)' },
  { club: 'Vespa Club Lugano', city: 'Lugano (Svizzera)' },
  { club: 'Vespa Club München', city: 'Monaco di Baviera (Germania)' },
  { club: 'Vespa Club Stuttgart', city: 'Stoccarda (Germania)' },
  { club: 'Vespa Club Wien', city: 'Vienna (Austria)' },
  { club: 'Vespa Club Innsbruck', city: 'Innsbruck (Austria)' },
  { club: 'Vespa Club Bruxelles', city: 'Bruxelles (Belgio)' },
  { club: 'Vespa Club Barcelona', city: 'Barcellona (Spagna)' },
  { club: 'Vespa Club London', city: 'Londra (UK)' }
];

const nomiCognomi = [
  { cognome: 'ROSSI', nome: 'Marco' },
  { cognome: 'BIANCHI', nome: 'Giulia' },
  { cognome: 'FERRARI', nome: 'Martino' },
  { cognome: 'RUSSO', nome: 'Alessandro' },
  { cognome: 'ESPOSITO', nome: 'Chiara' },
  { cognome: 'COLOMBO', nome: 'Roberto' },
  { cognome: 'ROMANO', nome: 'Elena' },
  { cognome: 'RICCI', nome: 'Davide' },
  { cognome: 'GALLO', nome: 'Sara' },
  { cognome: 'GRECO', nome: 'Valentina' },
  { cognome: 'CONTI', nome: 'Fabio' },
  { cognome: 'DE LUCA', nome: 'Antonio' },
  { cognome: 'MANCINI', nome: 'Matteo' },
  { cognome: 'COSTA', nome: 'Martina' },
  { cognome: 'GIORDANO', nome: 'Lorenzo' },
  { cognome: 'RIZZO', nome: 'Francesca' },
  { cognome: 'LOMBARDI', nome: 'Pietro' },
  { cognome: 'MORETTI', nome: 'Silvia' },
  { cognome: 'BARBIERI', nome: 'Christian' },
  { cognome: 'BRUNO', nome: 'Gabriele' },
  { cognome: 'FONTANA', nome: 'Lucia' },
  { cognome: 'SANTORO', nome: 'Michele' },
  { cognome: 'MARINI', nome: 'Federica' },
  { cognome: 'RINALDI', nome: 'Simone' },
  { cognome: 'CARUSO', nome: 'Giacomo' },
  { cognome: 'FERRARA', nome: 'Alessia' },
  { cognome: 'GALLI', nome: 'Andrea' },
  { cognome: 'MARTINI', nome: 'Camilla' },
  { cognome: 'LEONE', nome: 'Federico' },
  { cognome: 'LONGO', nome: 'Beatrice' },
  { cognome: 'GENTILE', nome: 'Luca' },
  { cognome: 'MARTINELLI', nome: 'Sofia' },
  { cognome: 'VITALE', nome: 'Daniele' },
  { cognome: 'SERRA', nome: 'Irene' },
  { cognome: 'COPPOLA', nome: 'Massimo' },
  { cognome: 'DE ANGELIS', nome: 'Monica' },
  { cognome: 'PARISI', nome: 'Stefano' },
  { cognome: 'VILLA', nome: 'Serena' },
  { cognome: 'CONTE', nome: 'Claudio' },
  { cognome: 'FERRARO', nome: 'Giorgia' },
  { cognome: 'MARCHETTI', nome: 'Alberto' },
  { cognome: 'PELLEGRINI', nome: 'Carlotta' },
  { cognome: 'VALENTINI', nome: 'Valerio' },
  { cognome: 'CARBONE', nome: 'Elisa' },
  { cognome: 'FABBRI', nome: 'Paolo' },
  { cognome: 'MAZZA', nome: 'Michela' },
  { cognome: 'SILVESTRI', nome: 'Emanuele' },
  { cognome: 'GIULIANI', nome: 'Noemi' },
  { cognome: 'BASILE', nome: 'Maurizio' },
  { cognome: 'D\'ANGELO', nome: 'Daniela' },
  { cognome: 'DUMONT', nome: 'Jean-Pierre' },
  { cognome: 'BERNARD', nome: 'Céline' },
  { cognome: 'LEFEVRE', nome: 'Laurent' },
  { cognome: 'DUBOIS', nome: 'Sophie' },
  { cognome: 'MÜLLER', nome: 'Hans' },
  { cognome: 'SCHNEIDER', nome: 'Klaus' },
  { cognome: 'WEBER', nome: 'Urs' },
  { cognome: 'FISCHER', nome: 'Beat' },
  { cognome: 'HUBER', nome: 'Markus' },
  { cognome: 'GRUBER', nome: 'Franz' },
  { cognome: 'WAGNER', nome: 'Stefan' },
  { cognome: 'PEETERS', nome: 'Luc' },
  { cognome: 'GARCIA', nome: 'Javier' },
  { cognome: 'RODRIGUEZ', nome: 'Manuel' },
  { cognome: 'SMITH', nome: 'Oliver' },
  { cognome: 'BROWN', nome: 'James' },
  { cognome: 'TESTA', nome: 'Enrico' },
  { cognome: 'GRASSO', nome: 'Vincenzo' },
  { cognome: 'FALCONE', nome: 'Domenico' },
  { cognome: 'SALA', nome: 'Guido' },
  { cognome: 'MONTI', nome: 'Corrado' },
  { cognome: 'ORLANDO', nome: 'Fabrizio' },
  { cognome: 'BORGHI', nome: 'Gianluca' },
  { cognome: 'GATTI', nome: 'Cesare' },
  { cognome: 'NEGRI', nome: 'Edoardo' },
  { cognome: 'BARONE', nome: 'Tiziano' },
  { cognome: 'SORRENTINO', nome: 'Gennaro' },
  { cognome: 'DAMICO', nome: 'Fabrizio' },
  { cognome: 'RUGGIERO', nome: 'Giuseppe' },
  { cognome: 'PALUMBO', nome: 'Carmine' },
  { cognome: 'SARTORI', nome: 'Mario' },
  { cognome: 'ROSSETTI', nome: 'Angelo' },
  { cognome: 'CASINI', nome: 'Riccardo' },
  { cognome: 'PIRAS', nome: 'Gavino' },
  { cognome: 'MELIS', nome: 'Efisio' },
  { cognome: 'SANNA', nome: 'Nicola' },
  { cognome: 'LIPPI', nome: 'Marcello' },
  { cognome: 'BONETTI', nome: 'Pierluigi' },
  { cognome: 'BERTI', nome: 'Renato' },
  { cognome: 'FARINA', nome: 'Massimiliano' },
  { cognome: 'VALLI', nome: 'Silvio' },
  { cognome: 'BRAMBILLA', nome: 'Ambrogio' },
  { cognome: 'FUMAGALLI', nome: 'Carlo' },
  { cognome: 'PAGANI', nome: 'Giulio' },
  { cognome: 'BERETTA', nome: 'Sergio' },
  { cognome: 'CASTIGLIONI', nome: 'Walter' },
  { cognome: 'PIROVANO', nome: 'Franco' },
  { cognome: 'ZANETTI', nome: 'Tarcisio' },
  { cognome: 'BENETTON', nome: 'Luciano' },
  { cognome: 'CREPALDI', nome: 'Attilio' }
];

const vespaModels = [
  { model: 'Vespa 98', year: 1946 },
  { model: 'Vespa 125 Bacchetta', year: 1948 },
  { model: 'Vespa 125 "Vacanze Romane"', year: 1953 },
  { model: 'Vespa 150 GS (Grand Sport)', year: 1955 },
  { model: 'Vespa 150 Struzzo', year: 1956 },
  { model: 'Vespa 125 VNB', year: 1961 },
  { model: 'Vespa 50 N', year: 1963 },
  { model: 'Vespa 150 Sprint', year: 1965 },
  { model: 'Vespa 180 Super Sport', year: 1966 },
  { model: 'Vespa 125 Primavera', year: 1968 },
  { model: 'Vespa 180 Rally', year: 1968 },
  { model: 'Vespa 50 Special', year: 1970 },
  { model: 'Vespa 200 Rally Elettronica', year: 1972 },
  { model: 'Vespa 125 Primavera ET3', year: 1976 },
  { model: 'Vespa PX 125', year: 1978 },
  { model: 'Vespa PX 150 E', year: 1981 },
  { model: 'Vespa PX 200 E Arcobaleno', year: 1984 },
  { model: 'Vespa T5 Pole Position', year: 1985 },
  { model: 'Vespa Cosa 200', year: 1990 },
  { model: 'Vespa 50 Revival', year: 1991 },
  { model: 'Vespa ET4 150', year: 1998 },
  { model: 'Vespa Granturismo 200 L', year: 2003 },
  { model: 'Vespa GTS 250 i.e.', year: 2006 },
  { model: 'Vespa GTS 300 Super', year: 2012 },
  { model: 'Vespa 946', year: 2013 },
  { model: 'Vespa Primavera 125 i-get', year: 2018 },
  { model: 'Vespa GTS 300 Super Sport HPE', year: 2023 },
  { model: 'Vespa Gtv 300 Sei Giorni', year: 2024 }
];

const packagesList = [
  { val: 'COMPLETA Sabato + Domenica - € 95', price: 95 },
  { val: 'FULL Sabato - € 60', price: 60 },
  { val: 'FULL Domenica - € 50', price: 50 },
  { val: 'LIGHT Sabato - € 15', price: 15 },
  { val: 'LIGHT Domenica - € 20', price: 20 }
];

const tshirts = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

// Genera i 100 record demo completi
const demoRecords = [];
for (let i = 0; i < 100; i++) {
  const p = nomiCognomi[i];
  const dest = clubsAndCities[i % clubsAndCities.length];
  const vespa = vespaModels[i % vespaModels.length];
  const pkg = packagesList[i % packagesList.length];
  const tshirt = tshirts[i % tshirts.length];
  const idNum = 1001 + i;
  const passId = `VCA-2026-${idNum}`;

  // Distribuzione stati pagamento: 70% PAGATO, 15% DA VERIFICARE, 15% NON PAGATO
  let statoPagamento = 'PAGATO';
  if (i % 7 === 0) statoPagamento = 'NON_PAGATO';
  else if (i % 5 === 0) statoPagamento = 'RICEVUTA_DA_VERIFICARE';

  const cleanSurname = p.cognome.toLowerCase().replace(/[^a-z]/g, '');
  const cleanName = p.nome.toLowerCase().replace(/[^a-z]/g, '');
  const email = `${cleanName}.${cleanSurname}@${i % 2 === 0 ? 'gmail.com' : 'email.it'}`;
  const telNum = `3${Math.floor(20 + (i * 7) % 70)} ${Math.floor(1000000 + (i * 98765) % 9000000)}`;

  demoRecords.push({
    id: passId,
    createdAt: new Date(Date.now() - (100 - i) * 3600 * 1000 * 12).toISOString(),
    cognome: p.cognome,
    nome: p.nome,
    vespaClub: dest.club,
    cittaProvenienza: dest.city,
    tesseraVci: `VCI-${10000 + (i * 137) % 89999}`,
    tesseraMotornext: `MN-${30000 + (i * 241) % 69999}`,
    email: email,
    telefono: `+39 ${telNum}`,
    ruolo: i % 12 === 0 ? 'PASSEGGERO' : 'CONDUCENTE',
    modelloVespa: vespa.model,
    annoVespa: vespa.year,
    tagliaTshirt: tshirt,
    modalitaPartecipazione: pkg.val,
    importoDovuto: pkg.price,
    statoPagamento: statoPagamento,
    ricevutaPagamentoVerified: statoPagamento === 'PAGATO',
    ricevutaPagamento: statoPagamento !== 'NON_PAGATO' ? {
      name: `ricevuta_${cleanSurname}.svg`,
      type: 'image/svg+xml',
      data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="%23f0fdf4"/><text x="20" y="80" fill="%23166534" font-size="20" font-family="Arial">BONIFICO REGISTRATO</text></svg>'
    } : null,
    statoAccettazioneSabato: false,
    accettazioneSabatoTimestamp: null,
    statoAccettazioneDomenica: false,
    accettazioneDomenicaTimestamp: null,
    accettazioneConclusa: false,
    accettazioneTimestamp: null,
    ritiroGadget: false,
    kitGadgetConsegnato: false,
    ritiroGadgetTimestamp: null,
    merenda: false,
    merendaSabatoErogata: false,
    merendaTimestamp: null,
    merendaSabatoErogataTimestamp: null,
    aperitivo: false,
    aperitivoErogato: false,
    aperitivoTimestamp: null,
    aperitivoSabatoErogato: false,
    aperitivoSabatoErogatoTimestamp: null,
    aperitivoDomenicaErogato: false,
    aperitivoDomenicaErogatoTimestamp: null,
    cena: false,
    cenaSabatoErogato: false,
    cenaTimestamp: null,
    colazioneDomenicaErogata: false,
    colazioneDomenicaErogataTimestamp: null,
    pranzo: false,
    pranzoDomenicaErogato: false,
    pranzoTimestamp: null,
    noteOrganizzatore: dest.city.includes('Francia') || dest.city.includes('Svizzera') || dest.city.includes('Germania') || dest.city.includes('Austria') || dest.city.includes('Belgio') || dest.city.includes('Spagna') || dest.city.includes('UK')
      ? `Partecipante Internazionale proveniente da ${dest.city}. Arrivo confermato.`
      : `Iscrizione confermata da ${dest.city} (${dest.club}).`
  });
}

// Salva i 100 record demo in un file JSON
fs.writeFileSync('c:/Users/Utente/.gemini/antigravity/scratch/vespa-booking-app/dati_100_demo.json', JSON.stringify(demoRecords, null, 2), 'utf8');

// Salva anche nel file server principale dati_prenotazioni.json
fs.writeFileSync('c:/Users/Utente/.gemini/antigravity/scratch/vespa-booking-app/dati_prenotazioni.json', JSON.stringify(demoRecords, null, 2), 'utf8');

console.log('Successfully generated 100 demo records in dati_100_demo.json and updated dati_prenotazioni.json');

