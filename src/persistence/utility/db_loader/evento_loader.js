
const eventoService = require('../../../services/evento_service');

// Funzione per inserire gli eventi in date diverse
function aggiungiGiorni(data, giorni) {
    const nuovaData = new Date(data);
    nuovaData.setDate(nuovaData.getDate() + giorni);
    return nuovaData;
}

function impostaOra(data, ore, minuti = 0) {
    const nuovaData = new Date(data);
    nuovaData.setHours(ore, minuti, 0, 0);
    return nuovaData;
}

// Trasformo una data nel formato AAAA-MM-GG richiesto dal service, usando il giorno italiano (non quello UTC)
function formatoData(data) {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// - calendarioIndex posizione dell'array calendariCreati, mi serve perchè ogni evento deve "sapere" a quale calendario appartiene
// - altriCalendariIndici (opzionale): altri calendari in cui compare lo stesso evento
// - tagIndici (opzionale): posizioni, nella lista tagCreati restituita da tag_loader, dei tag da collegare all'evento (es. [0, 2] --> primo e terzo tag)
// - offsetGiorni: giorni di distanza da oggi (ossia dal momento in cui lancio popola_db) per distanziare la creazione dei vari eventi (negativo = passato, positivo = futuro)
// - oraInizio/oraFine: solo l'orario, in ore (24h) - ignorati se tuttoIlGiorno è true
// - avviso: minuti prima dell'inizio in cui avvisare (opzionale)
// - tuttoIlGiorno: se true, l'evento copre l'intera giornata

const eventiData = [
    {
        titolo: 'Riunione settimanale team',
        descrizione: 'Allineamento sprint corrente',
        calendarioIndex: 0,
        tagIndici: [1], // Riunioni
        creatoDaEmail: 'giulia.romano@gmail.com',
        offsetGiorni: 2,
        oraInizio: 10,
        oraFine: 11,
        colore: '#3498DB',
        avviso: 15,
        ricorrenza: 'settimanale',
        fineRicorrenzaOffsetGiorni: 60,
    },
    {
        titolo: 'Cena di famiglia',
        descrizione: 'Cena della domenica',
        calendarioIndex: 1,
        tagIndici: [2], // Compleanni
        creatoDaEmail: 'giulia.romano@gmail.com',
        offsetGiorni: 5,
        oraInizio: 20,
        oraFine: 22,
        colore: '#F1C40F',
        avviso: 60,
        ricorrenza: null,
    },
    {
        titolo: 'Lezione di Basi di Dati',
        descrizione: 'Aula 3, edificio B',
        calendarioIndex: 2,
        tagIndici: [],
        creatoDaEmail: 'andrea.bianchi@gmail.com',
        offsetGiorni: 1,
        oraInizio: 9,
        oraFine: 11,
        colore: '#9B59B6',
        avviso: 30,
        ricorrenza: null,
    },
    {
        titolo: 'Incontro relatore tesi',
        descrizione: 'Discussione capitolo 3',
        calendarioIndex: 3,
        tagIndici: [4], // Scadenze tesi
        creatoDaEmail: 'andrea.bianchi@gmail.com',
        offsetGiorni: 7,
        oraInizio: 15,
        oraFine: 16,
        colore: '#E67E22',
        avviso: 30,
        ricorrenza: null,
    },
    {
        titolo: 'Visita dentista',
        descrizione: 'Controllo periodico',
        calendarioIndex: 4,
        tagIndici: [5], // Salute
        creatoDaEmail: 'francesca.colombo@gmail.com',
        offsetGiorni: 6,
        oraInizio: 17,
        oraFine: 18,
        colore: '#1ABC9C',
        avviso: 15,
        ricorrenza: null,
    },
    {
        titolo: 'Allenamento palestra',
        descrizione: 'Gambe e schiena',
        calendarioIndex: 5,
        tagIndici: [6], // Allenamenti
        creatoDaEmail: 'riccardo.fontana@gmail.com',
        offsetGiorni: 1,
        oraInizio: 7,
        oraFine: 8,
        colore: '#2ECC71',
        avviso: 15,
        ricorrenza: 'settimanale',
        fineRicorrenzaOffsetGiorni: 30,
        modificatoDaEmail: 'riccardo.fontana@gmail.com',
        modificaTipo: 'serie',
        descrizioneModificata: 'Gambe e schiena (cambiata la sala: ora piano -1)',
    },
    {
        titolo: 'Pulizie condivise appartamento',
        descrizione: 'Turno pulizie cucina e bagno',
        calendarioIndex: 6,
        tagIndici: [7], // Casa
        creatoDaEmail: 'valentina.santoro@gmail.com',
        offsetGiorni: 4,
        oraInizio: 18,
        oraFine: 19,
        colore: '#34495E',
        avviso: null,
        ricorrenza: null,
    },
    {
        titolo: 'Colloquio candidato',
        descrizione: 'Colloquio tecnico secondo round',
        calendarioIndex: 7,
        tagIndici: [8], // Colloqui
        creatoDaEmail: 'lorenzo.gatti@gmail.com',
        offsetGiorni: 3,
        oraInizio: 14,
        oraFine: 15,
        colore: '#D35400',
        avviso: 30,
        ricorrenza: null,
        modificatoDaEmail: 'lorenzo.gatti@gmail.com',
        modificaTipo: 'singola',
        descrizioneModificata: 'Colloquio tecnico secondo round (aggiunto membro del team)',
    },
    {
        titolo: 'Volo per Lisbona',
        descrizione: 'Partenza aeroporto Malpensa',
        calendarioIndex: 8,
        tagIndici: [9], // Viaggi
        creatoDaEmail: 'martina.villa@gmail.com',
        offsetGiorni: 20,
        oraInizio: 6,
        oraFine: 9,
        colore: '#16A085',
        avviso: 120,
        tuttoIlGiorno: false,
        ricorrenza: null,
    },
    {
        titolo: 'Scadenza bolletta',
        descrizione: 'Promemoria pagamento',
        calendarioIndex: 9,
        tagIndici: [10], // Bollette
        creatoDaEmail: 'simone.barbieri@gmail.com',
        offsetGiorni: -1,
        oraInizio: 0,
        oraFine: 23,
        colore: '#C0392B',
        avviso: null,
        tuttoIlGiorno: true,
        ricorrenza: null,
    },
    {
        titolo: 'Giorno di ferie: gita al lago',
        descrizione: 'Preso un giorno di ferie per la gita in famiglia',
        calendarioIndex: 1,
        altriCalendariIndici: [0], // anche nel calendario Lavoro di Giulia
        tagIndici: [],
        creatoDaEmail: 'giulia.romano@gmail.com',
        offsetGiorni: 12,
        oraInizio: 9,
        oraFine: 18,
        avviso: 60,
        ricorrenza: null,
    },
];

// Inserimento degli eventi (ricevo calendariCreati, utentiCreati e tagCreati con gli ID veri)
async function inserisciEventi(calendariCreati, utentiCreati, tagCreati) {
    const eventiCreati = [];
    const oggi = new Date();

    for (const dato of eventiData) {
        const calendario = calendariCreati[dato.calendarioIndex];
        const creatore = utentiCreati.find(utente => utente.email === dato.creatoDaEmail);
        const tagIds = (dato.tagIndici || []).map(indice => tagCreati[indice].id);

        if (!calendario) {
            throw new Error(`Calendario non trovato all'indice: ${dato.calendarioIndex}`);
        }
        if (!creatore) {
            throw new Error(`Utente non trovato per email: ${dato.creatoDaEmail}`);
        }

        // Calendari in cui va l'evento: di solito uno solo (calendarioIndex),
        // ma la gita al lago va in due, quindi aggiungo anche quelli di altriCalendariIndici
        const calendarioIds = [calendario.id, ...(dato.altriCalendariIndici || []).map(indice => calendariCreati[indice].id)];

        const giornoBase = aggiungiGiorni(oggi, dato.offsetGiorni);

        // Gli eventi di tutto il giorno hanno solo la data (AAAA-MM-GG), gli altri data e ora (in formato ISO, per scrivere data e ora insieme)
        const dataInizio = dato.tuttoIlGiorno ? formatoData(giornoBase) : impostaOra(giornoBase, dato.oraInizio).toISOString();
        const dataFine = dato.tuttoIlGiorno ? formatoData(giornoBase) : impostaOra(giornoBase, dato.oraFine).toISOString();

        const fineRicorrenza = dato.fineRicorrenzaOffsetGiorni ? formatoData(aggiungiGiorni(oggi, dato.fineRicorrenzaOffsetGiorni)) : null;

        let evento = await eventoService.createEvento(
            dato.titolo,
            dato.descrizione,
            dataInizio,
            dataFine,
            !!dato.tuttoIlGiorno,
            dato.ricorrenza,
            fineRicorrenza,
            dato.colore,
            dato.avviso,
            calendarioIds,
            creatore.id
        );

        // I tag si collegano dopo la creazione, uno alla volta (come dalla rotta /aggiungi-tag)
        for (const tag_id of tagIds) {
            evento = await eventoService.addTag(evento.id, tag_id, creatore.id);
        }

        let eventoFinale = evento;

        // Alcuni eventi, dopo essere stati creati, vengono anche modificati (hanno modificatoDaEmail nei dati sopra):
        // - modificaTipo "singola": cambio solo quell'evento (es. "Colloquio candidato")
        // - modificaTipo "serie": cambio tutte le occorrenze di un evento che si ripete (es. "Allenamento palestra", ogni settimana)
        // così viene salvato anche modificato_da, altrimenti resterebbe sempre vuoto
        if (dato.modificatoDaEmail) {
            // Cerco chi fa la modifica tra gli utenti appena creati, tramite la sua email
            const modificatore = utentiCreati.find(utente => utente.email === dato.modificatoDaEmail);

            // Se l'email è scritta male non lo trovo: mi fermo con un errore chiaro
            if (!modificatore) {
                throw new Error(`Utente non trovato per email: ${dato.modificatoDaEmail}`);
            }

            // Cambio la descrizione: solo di questo evento oppure di tutta la serie, in base a modificaTipo
            const nuoviDati = { descrizione: dato.descrizioneModificata };

            if (dato.modificaTipo === 'serie') {
                eventoFinale = await eventoService.updateSerieCompleta(evento.id, nuoviDati, modificatore.id);
            } else {
                eventoFinale = await eventoService.updateSingolaOccorrenza(evento.id, nuoviDati, modificatore.id);
            }
        }

        console.log(`Evento creato: ${eventoFinale.titolo} (${giornoBase.toLocaleDateString('it-IT')})`);
        eventiCreati.push(eventoFinale);
    }

    return eventiCreati;
}

module.exports = { inserisciEventi, eventiData };