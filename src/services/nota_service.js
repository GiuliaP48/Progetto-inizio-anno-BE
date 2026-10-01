
const AppException = require('../eccezioni/app_eccezioni');

const notaRepository = require('../repository/nota_repository');
const calendarioRepository = require('../repository/calendario_repository');
const utenteRepository = require('../repository/utente_repository');

const calendarioService = require('./calendario_service');

// Valori ammessi dall'enum TipoFrequenza
const TIPI_VALIDI = ['giornaliera', 'settimanale', 'mensile'];

const LUNGHEZZA_MASSIMA_TESTO = 1000;

// Data nel formato AAAA-MM-GG, con l'orario facoltativo (es. 2026-09-28 oppure 2026-09-28T10:00:00.000Z)
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

// Controlla i dati di una nota e restituisce solo i campi ammessi
function validaNota(dati, parziale = false) {
    const risultato = {};

    // In creazione testo, data e tipo sono obbligatori
    if (!parziale && (!dati.testo || !dati.data || !dati.tipo)) {
        throw new AppException('Testo, data e tipo sono obbligatori', 400);
    }

    // Vincoli sul testo
    if (dati.testo !== undefined) {
        if (typeof dati.testo !== 'string' || dati.testo.trim().length === 0) {
            throw new AppException('Il testo non può essere vuoto', 400);
        }

        const testo = dati.testo.trim();

        if (testo.length > LUNGHEZZA_MASSIMA_TESTO) {
            throw new AppException(`Il testo può avere al massimo ${LUNGHEZZA_MASSIMA_TESTO} caratteri`, 400);
        }

        risultato.testo = testo;
    }

    // Vincoli sulla data: prima il formato, poi che esista davvero (es. il 31 febbraio viene rifiutato)
    if (dati.data !== undefined) {
        if (typeof dati.data !== 'string' || !FORMATO_DATA.test(dati.data)) {
            throw new AppException('Data non valida: usa il formato AAAA-MM-GG', 400);
        }

        const data = new Date(dati.data);

        if (isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dati.data.slice(0, 10)) {
            throw new AppException('La data non esiste', 400);
        }

        risultato.data = data;
    }

    // Vincoli sul tipo
    if (dati.tipo !== undefined) {
        if (!TIPI_VALIDI.includes(dati.tipo)) {
            throw new AppException('Tipo non valido: usa giornaliera, settimanale o mensile', 400);
        }

        risultato.tipo = dati.tipo;
    }

    return risultato;
}

// Porta la data all'inizio del periodo a cui si riferisce la nota:
// giornaliera --> quel giorno, settimanale --> il lunedì della settimana, mensile --> il giorno 1 del mese.
// Il momento in cui la nota è stata scritta resta comunque salvato in creato_il.
function inizioPeriodo(data, tipo) {
    const anno = data.getUTCFullYear();
    const mese = data.getUTCMonth();
    const giorno = data.getUTCDate();

    if (tipo === 'mensile') {
        return new Date(Date.UTC(anno, mese, 1));
    }

    if (tipo === 'settimanale') {
        // getUTCDay() conta i giorni partendo dalla domenica con la convenzione americana (0 = domenica, 1 = lunedì, ..., 6 = sabato)
        // Trasformo in "giorni passati dal lunedì" (lunedì = 0, ..., domenica = 6): la domenica diventa 6, gli altri giorni scalano di 1
        // Tornando indietro di quei giorni si arriva al lunedì della settimana, anche se cade nel mese precedente (Date.UTC cambia mese da solo)
        const giornoSettimana = data.getUTCDay();
        const giorniDaLunedi = giornoSettimana === 0 ? 6 : giornoSettimana - 1;
        return new Date(Date.UTC(anno, mese, giorno - giorniDaLunedi));
    }

    // giornaliera
    return new Date(Date.UTC(anno, mese, giorno));
}

// Prepara le note per la risposta: nome e cognome di chi le ha create e modificate.
async function aggiungiDatiNote(note) {
    const ids = new Set();
    note.forEach(nota => {
        if (nota.creato_da) ids.add(nota.creato_da);
        if (nota.modificato_da) ids.add(nota.modificato_da);
    });

    const utenti = await utenteRepository.getUtentiByIds([...ids]);
    const utentiPerId = new Map(utenti.map(utente => [utente.id, utente]));

    // Da un id restituisce utente_id, nome e cognome, oppure null se l'id non c'è
    function datiPersona(id) {
        if (!id) return null;
        const utente = utentiPerId.get(id);
        return {
            utente_id: id,
            nome: utente ? utente.nome : null,
            cognome: utente ? utente.cognome : null,
        };
    }

    return note.map(nota => {
        const { creato_da, creato_il, modificato_da, modificato_il, ...dati } = nota;
        return {
            ...dati,
            creato_da: datiPersona(creato_da),
            creato_il,
            modificato_da: datiPersona(modificato_da),
            modificato_il,
        };
    });
}

// Creazione di una nuova nota in un calendario, verificando i permessi
async function createNota(calendario_id, testo, data, tipo, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a creare note in questo calendario', 403);
    }

    const dati = validaNota({ testo, data, tipo });

    const nuovaNota = await notaRepository.createNota({
        testo: dati.testo,
        data: inizioPeriodo(dati.data, dati.tipo),
        tipo: dati.tipo,
        calendario_id,
        creato_da: utente_id,
    });

    const [notaCompleta] = await aggiungiDatiNote([nuovaNota]);
    return notaCompleta;
}

// Ricerca di tutte le note di un calendario, in ordine di data (solo amministratore e membri che hanno accettato)
async function getNoteByCalendario(calendario_id, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    const note = await notaRepository.getNoteByCalendario(calendario_id);

    note.sort((a, b) => a.data - b.data);

    return aggiungiDatiNote(note);
}

// Modifica di una nota, verificando i permessi: si possono cambiare solo testo, data e tipo
async function updateNota(id, dati, utente_id) {
    const nota = await notaRepository.getNotaById(id);

    if (!nota) {
        throw new AppException('Nota non trovata', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(nota.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questa nota', 403);
    }

    const datiValidati = validaNota(dati, true);

    if (Object.keys(datiValidati).length === 0) {
        throw new AppException('Nessun campo valido da modificare', 400);
    }

    // Se in modifica cambiano la data o il tipo, la data va ricalcolata.
    // Per il calcolo servono tutti e due: se ne è stato mandato solo uno, per l'altro si usa il valore che la nota ha già.
    if (datiValidati.data || datiValidati.tipo) {
        const data = datiValidati.data || nota.data;
        const tipo = datiValidati.tipo || nota.tipo;
        datiValidati.data = inizioPeriodo(data, tipo);
    }

    const notaAggiornata = await notaRepository.updateNota(id, {
        ...datiValidati,
        modificato_da: utente_id,
    });

    const [notaCompleta] = await aggiungiDatiNote([notaAggiornata]);
    return notaCompleta;
}

// Eliminazione di una nota, verificando i permessi
async function deleteNota(id, utente_id) {
    const nota = await notaRepository.getNotaById(id);

    if (!nota) {
        throw new AppException('Nota non trovata', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(nota.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a eliminare questa nota', 403);
    }

    return notaRepository.deleteNota(id);
}

module.exports = {
    createNota,
    getNoteByCalendario,
    updateNota,
    deleteNota,
};