
const AppException = require('../eccezioni/app_eccezioni');

const eventoRepository = require('../repository/evento_repository');
const calendarioRepository = require('../repository/calendario_repository');
const tagRepository = require('../repository/tag_repository');
const utenteRepository = require('../repository/utente_repository');

const calendarioService = require('./calendario_service');

// Valori ammessi dall'enum TipoFrequenzaEstesa
const RICORRENZE_VALIDE = ['giornaliera', 'settimanale', 'mensile', 'annuale'];

const LUNGHEZZA_MASSIMA_TITOLO = 100;
const LUNGHEZZA_MASSIMA_DESCRIZIONE = 1000;

// Data nel formato AAAA-MM-GG, con l'orario facoltativo
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

// Colore nel formato #RRGGBB
const FORMATO_COLORE = /^#[0-9A-Fa-f]{6}$/;

// Un giorno in millisecondi
const UN_GIORNO = 24 * 60 * 60 * 1000;

// Fuso orario dell'Italia: serve per tenere lo stesso orario italiano anche quando cambia l'ora legale
const FUSO_ORARIO = 'Europe/Rome';

// Controlla i dati di un evento e restituisce solo i campi ammessi.
// In creazione si controllano anche ricorrenza e fine_ricorrenza (parziale = false)
// in modifica (parziale = true) si possono cambiare solo titolo, descrizione, date, tutto il giorno, colore e avviso.
function validaEvento(dati, parziale = false) {
    const risultato = {};

    // In creazione titolo e date sono obbligatori
    if (!parziale && (!dati.titolo || !dati.data_inizio || !dati.data_fine)) {
        throw new AppException('Titolo, date e almeno un calendario sono obbligatori', 400);
    }

    // Vincoli sul titolo
    if (dati.titolo !== undefined) {
        if (typeof dati.titolo !== 'string' || dati.titolo.trim().length === 0) {
            throw new AppException('Il titolo non può essere vuoto', 400);
        }

        const titolo = dati.titolo.trim();

        if (titolo.length > LUNGHEZZA_MASSIMA_TITOLO) {
            throw new AppException(`Il titolo può avere al massimo ${LUNGHEZZA_MASSIMA_TITOLO} caratteri`, 400);
        }

        risultato.titolo = titolo;
    }

    // Vincoli sulla descrizione: è facoltativa, se è vuota non viene salvata
    // in modifica null la toglie
    if (dati.descrizione !== undefined) {
        if (dati.descrizione === null) {
            if (parziale) {
                risultato.descrizione = null;
            }
        } else {
            if (typeof dati.descrizione !== 'string') {
                throw new AppException('La descrizione deve essere un testo', 400);
            }

            const descrizione = dati.descrizione.trim();

            if (descrizione.length > LUNGHEZZA_MASSIMA_DESCRIZIONE) {
                throw new AppException(`La descrizione può avere al massimo ${LUNGHEZZA_MASSIMA_DESCRIZIONE} caratteri`, 400);
            }

            if (descrizione.length > 0) {
                risultato.descrizione = descrizione;
            } else if (parziale) {
                risultato.descrizione = null;
            }
        }
    }

    // Vincoli sulle date: prima il formato, poi che esista davvero (es. il 31 febbraio viene rifiutato)
    // fine_ricorrenza si controlla solo in creazione.
    const campiData = parziale ? ['data_inizio', 'data_fine'] : ['data_inizio', 'data_fine', 'fine_ricorrenza'];

    for (const campo of campiData) {
        if (dati[campo] === undefined || dati[campo] === null) {
            continue;
        }

        if (typeof dati[campo] !== 'string' || !FORMATO_DATA.test(dati[campo])) {
            throw new AppException('Data non valida: usa il formato AAAA-MM-GG', 400);
        }

        const data = new Date(dati[campo]);

        if (isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dati[campo].slice(0, 10)) {
            throw new AppException('La data non esiste', 400);
        }

        risultato[campo] = data;
    }

    // La fine non può venire prima dell'inizio
    if (risultato.data_inizio && risultato.data_fine && risultato.data_fine < risultato.data_inizio) {
        throw new AppException('La data di fine non può essere prima della data di inizio', 400);
    }

    // Vincoli su tutto il giorno
    if (dati.tutto_il_giorno !== undefined) {
        if (typeof dati.tutto_il_giorno !== 'boolean') {
            throw new AppException('tutto_il_giorno deve essere true o false', 400);
        }

        risultato.tutto_il_giorno = dati.tutto_il_giorno;
    }

    // Vincoli sulla ricorrenza (solo in creazione)
    if (!parziale && dati.ricorrenza !== undefined && dati.ricorrenza !== null) {
        if (!RICORRENZE_VALIDE.includes(dati.ricorrenza)) {
            throw new AppException('Ricorrenza non valida: usa giornaliera, settimanale, mensile o annuale', 400);
        }

        risultato.ricorrenza = dati.ricorrenza;
    }

    // Vincoli sulla fine della ricorrenza (solo in creazione)
    if (risultato.fine_ricorrenza) {
        if (!risultato.ricorrenza) {
            throw new AppException('La fine della ricorrenza richiede una ricorrenza', 400);
        }

        if (risultato.fine_ricorrenza < risultato.data_inizio) {
            throw new AppException('La fine della ricorrenza non può essere prima della data di inizio', 400);
        }
    }

    // Vincoli sul colore: è facoltativo
    // in modifica null lo toglie (e si torna al colore del calendario)
    if (dati.colore !== undefined) {
        if (dati.colore === null) {
            if (parziale) {
                risultato.colore = null;
            }
        } else if (typeof dati.colore !== 'string' || !FORMATO_COLORE.test(dati.colore)) {
            throw new AppException('Colore non valido: usa il formato #RRGGBB', 400);
        } else {
            risultato.colore = dati.colore;
        }
    }

    // Vincoli sull'avviso (minuti prima dell'evento): è facoltativo
    // in modifica null lo toglie
    if (dati.avviso !== undefined) {
        if (dati.avviso === null) {
            if (parziale) {
                risultato.avviso = null;
            }
        } else if (!Number.isInteger(dati.avviso) || dati.avviso < 0) {
            throw new AppException('L\'avviso deve essere un numero intero maggiore o uguale a 0', 400);
        } else {
            risultato.avviso = dati.avviso;
        }
    }

    return risultato;
}

// Verifica se un utente può modificare un evento: serve il permesso su tutti i calendari collegati
async function puoModificareEvento(evento, utente_id) {
    let calendariTrovati = 0;

    for (const calendario_id of evento.calendario_ids) {
        const calendario = await calendarioRepository.getCalendarioById(calendario_id);
        if (!calendario) {
            continue;
        }

        calendariTrovati++;

        const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);
        if (!puoModificare) {
            return false;
        }
    }

    // Un evento senza calendari esistenti non può essere modificato da nessuno
    return calendariTrovati > 0;
}

// Restituisce di quanti minuti l'ora italiana è avanti rispetto a UTC in un certo momento (120 d'estate con l'ora legale, 60 d'inverno)
function minutiAvantiUtc(data) {
    // Leggo che ore sono in quel momento in Italia e in UTC (come due orologi) e faccio la differenza.
    // 'en-US' serve solo perché new Date sa rileggere le date scritte in quel formato.
    // La differenza è in millisecondi: diviso 60000 diventa in minuti
    const oraItaliana = new Date(data.toLocaleString('en-US', { timeZone: FUSO_ORARIO }));
    const oraUtc = new Date(data.toLocaleString('en-US', { timeZone: 'UTC' }));
    return (oraItaliana - oraUtc) / 60000;
}

// Calcola le date delle occorrenze successive alla prima, in base al tipo di ricorrenza
// fine_ricorrenza vale per tutto quel giorno
// senza fine_ricorrenza si generano occorrenze per un numero massimo di anni
// per mensile e annuale, se il giorno non esiste in quel mese (es. il 31 a febbraio) si usa l'ultimo giorno del mese
// l'orario resta uguale in ora italiana anche quando cambia l'ora legale (tranne negli eventi di tutto il giorno, che non hanno orario)
function calcolaDateOccorrenze(dataInizio, ricorrenza, fineRicorrenza, tuttoIlGiorno) {
    const limitiAnni = {
        giornaliera: 1,
        settimanale: 2,
        mensile: 3,
        annuale: 5,
    };

    let dataLimite;
    if (fineRicorrenza) {
        dataLimite = new Date(Date.UTC(fineRicorrenza.getUTCFullYear(), fineRicorrenza.getUTCMonth(), fineRicorrenza.getUTCDate()) + UN_GIORNO - 1);
    } else {
        dataLimite = new Date(dataInizio);
        dataLimite.setUTCFullYear(dataLimite.getUTCFullYear() + limitiAnni[ricorrenza]);
    }

    const anno = dataInizio.getUTCFullYear();
    const mese = dataInizio.getUTCMonth();
    const giorno = dataInizio.getUTCDate();

    // Ora del giorno dell'evento (in millisecondi dalla mezzanotte), uguale per tutte le occorrenze
    const orario = dataInizio.getTime() - Date.UTC(anno, mese, giorno);

    const date = [];

    for (let numero = 1; ; numero++) {
        let dataCorrente;

        switch (ricorrenza) {
            case 'giornaliera':
                dataCorrente = new Date(Date.UTC(anno, mese, giorno + numero) + orario);
                break;

            case 'settimanale':
                dataCorrente = new Date(Date.UTC(anno, mese, giorno + 7 * numero) + orario);
                break;

            case 'mensile': {
                // Giorni del mese (il giorno 0 del mese dopo è l'ultimo giorno di questo: 0 marzo = 28 febbraio)
                const ultimoGiorno = new Date(Date.UTC(anno, mese + numero + 1, 0)).getUTCDate();
                // Stesso giorno dell'evento, oppure l'ultimo del mese se è più corto (es. 31 --> 28 febbraio)
                dataCorrente = new Date(Date.UTC(anno, mese + numero, Math.min(giorno, ultimoGiorno)) + orario);
                break;
            }

            case 'annuale': {
                const ultimoGiorno = new Date(Date.UTC(anno + numero, mese + 1, 0)).getUTCDate();
                dataCorrente = new Date(Date.UTC(anno + numero, mese, Math.min(giorno, ultimoGiorno)) + orario);
                break;
            }
        }

        // Se tra la prima occorrenza e questa cambia l'ora legale, correggo l'orario
        if (!tuttoIlGiorno) {
            dataCorrente = new Date(dataCorrente.getTime() + (minutiAvantiUtc(dataInizio) - minutiAvantiUtc(dataCorrente)) * 60000);
        }

        if (dataCorrente > dataLimite) {
            break;
        }

        date.push(dataCorrente);
    }

    return date;
}

// Prepara gli eventi per la risposta: nome e cognome di chi li ha creati e modificati, i tag con nome e colore, e il colore del calendario per gli eventi che non ne hanno uno proprio
async function aggiungiDatiEventi(eventi, coloreCalendario) {
    const ids = new Set();
    eventi.forEach(evento => {
        if (evento.creato_da) ids.add(evento.creato_da);
        if (evento.modificato_da) ids.add(evento.modificato_da);
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

    return eventi.map(evento => {
        const { colore, calendario_ids, tag_ids, tags, creato_da, creato_il, modificato_da, modificato_il, ...dati } = evento;
        return {
            ...dati,
            colore: colore || coloreCalendario || null,
            calendario_ids,
            tags: tags || [],
            creato_da: datiPersona(creato_da),
            creato_il,
            modificato_da: datiPersona(modificato_da),
            modificato_il,
        };
    });
}

// Creazione di un nuovo evento, con eventuale generazione delle occorrenze ricorrenti
async function createEvento(titolo, descrizione, data_inizio, data_fine, tutto_il_giorno, ricorrenza, fine_ricorrenza, colore, avviso, calendario_ids, utente_id) {

    // La lista dei calendari si controlla per prima, per verificare esistenza e permessi
    if (!Array.isArray(calendario_ids) || calendario_ids.length === 0 || calendario_ids.some(id => typeof id !== 'string')) {
        throw new AppException('Titolo, date e almeno un calendario sono obbligatori', 400);
    }

    // Se lo stesso calendario è stato scritto due volte, lo si tiene una volta sola
    const calendariUnici = [...new Set(calendario_ids)];

    let primoCalendario = null;

    for (const calendario_id of calendariUnici) {
        const calendario = await calendarioRepository.getCalendarioById(calendario_id);
        if (!calendario) {
            throw new AppException('Uno dei calendari specificati non esiste', 404);
        }

        const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);
        if (!puoModificare) {
            throw new AppException('Non autorizzato a creare eventi in uno dei calendari specificati', 403);
        }

        if (!primoCalendario) {
            primoCalendario = calendario;
        }
    }

    const dati = validaEvento({ titolo, descrizione, data_inizio, data_fine, tutto_il_giorno, ricorrenza, fine_ricorrenza, colore, avviso });

    // Se l'evento è ricorrente, le occorrenze successive hanno gli stessi dati e la stessa durata
    let occorrenze = [];
    if (dati.ricorrenza) {
        const durata = dati.data_fine.getTime() - dati.data_inizio.getTime();

        occorrenze = calcolaDateOccorrenze(dati.data_inizio, dati.ricorrenza, dati.fine_ricorrenza, dati.tutto_il_giorno).map(nuovaDataInizio => ({
            ...dati,
            data_inizio: nuovaDataInizio,
            data_fine: new Date(nuovaDataInizio.getTime() + durata),
        }));
    }

    const nuovoEvento = await eventoRepository.createEvento(dati, occorrenze, calendariUnici, utente_id);

    const [eventoCompleto] = await aggiungiDatiEventi([nuovoEvento], primoCalendario.colore);
    return eventoCompleto;
}

// Modifica di una singola occorrenza (o di un evento non ricorrente)
async function updateSingolaOccorrenza(id, dati, utente_id) {
    const evento = await eventoRepository.getEventoById(id);

    if (!evento) {
        throw new AppException('Evento non trovato', 404);
    }

    const puoModificare = await puoModificareEvento(evento, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questo evento', 403);
    }

    const datiValidati = validaEvento(dati, true);

    if (Object.keys(datiValidati).length === 0) {
        throw new AppException('Nessun campo valido da modificare', 400);
    }

    // Per controllare che la fine non sia prima dell'inizio servono tutte e due le date, per quella non inviata si usa quella già salvata nell'evento
    const dataInizio = datiValidati.data_inizio || evento.data_inizio;
    const dataFine = datiValidati.data_fine || evento.data_fine;

    if (dataFine < dataInizio) {
        throw new AppException('La data di fine non può essere prima della data di inizio', 400);
    }

    // Se si sposta un'occorrenza di una serie, si salva la data in cui era prima (data_occorrenza_originale).
    // Si salva solo la prima volta, così resta sempre la data originale anche se l'occorrenza viene spostata di nuovo
    if (evento.ricorrenza
        && datiValidati.data_inizio
        && datiValidati.data_inizio.getTime() !== evento.data_inizio.getTime()
        && !evento.data_occorrenza_originale) {
        datiValidati.data_occorrenza_originale = evento.data_inizio;
    }

    const eventoAggiornato = await eventoRepository.updateEvento(id, {
        ...datiValidati,
        modificato_da: utente_id,
    });

    const primoCalendario = await calendarioRepository.getCalendarioById(evento.calendario_ids[0]);

    const [eventoCompleto] = await aggiungiDatiEventi([eventoAggiornato], primoCalendario ? primoCalendario.colore : null);
    return eventoCompleto;
}

// Modifica dell'intera serie ricorrente (padre + tutti i figli)
async function updateSerieCompleta(id, dati, utente_id) {
    const evento = await eventoRepository.getEventoById(id);

    if (!evento) {
        throw new AppException('Evento non trovato', 404);
    }

    const puoModificare = await puoModificareEvento(evento, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questo evento', 403);
    }

    const datiValidati = validaEvento(dati, true);

    if (Object.keys(datiValidati).length === 0) {
        throw new AppException('Nessun campo valido da modificare', 400);
    }

    // Le date non vengono copiate uguali su tutte le occorrenze: calcolo di quanto si sposta questa occorrenza 
    // e tutte le altre si spostano della stessa quantità (es. un'ora più tardi, ognuna nel suo giorno)
    const { data_inizio, data_fine, ...datiComuni } = datiValidati;

    const nuovaDataInizio = data_inizio || evento.data_inizio;
    const nuovaDataFine = data_fine || evento.data_fine;

    if (nuovaDataFine < nuovaDataInizio) {
        throw new AppException('La data di fine non può essere prima della data di inizio', 400);
    }

    const spostamentoInizio = nuovaDataInizio.getTime() - evento.data_inizio.getTime();
    const spostamentoFine = nuovaDataFine.getTime() - evento.data_fine.getTime();

    const eventoPadreId = evento.evento_padre_id || evento.id;

    await eventoRepository.updateSerie(eventoPadreId, {
        ...datiComuni,
        modificato_da: utente_id,
    }, spostamentoInizio, spostamentoFine);

    const eventoAggiornato = await eventoRepository.getEventoById(id);
    const primoCalendario = await calendarioRepository.getCalendarioById(evento.calendario_ids[0]);

    const [eventoCompleto] = await aggiungiDatiEventi([eventoAggiornato], primoCalendario ? primoCalendario.colore : null);
    return eventoCompleto;
}

// Eliminazione di una singola occorrenza (o di un evento non ricorrente)
async function deleteSingolaOccorrenza(id, utente_id) {
    const evento = await eventoRepository.getEventoById(id);

    if (!evento) {
        throw new AppException('Evento non trovato', 404);
    }

    const puoModificare = await puoModificareEvento(evento, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a eliminare questo evento', 403);
    }

    return eventoRepository.deleteEvento(id);
}

// Eliminazione dell'intera serie ricorrente (padre + tutti i figli)
async function deleteSerieCompleta(id, utente_id) {
    const evento = await eventoRepository.getEventoById(id);

    if (!evento) {
        throw new AppException('Evento non trovato', 404);
    }

    const puoModificare = await puoModificareEvento(evento, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a eliminare questo evento', 403);
    }

    const eventoPadreId = evento.evento_padre_id || evento.id;

    return eventoRepository.deleteSerieCompleta(eventoPadreId);
}

// Visualizza un evento: basta far parte di almeno uno dei calendari in cui si trova l'evento
// se l'evento non ha un colore, prende quello di quel calendario
async function getEventoById(id, utente_id) {
    const evento = await eventoRepository.getEventoById(id);

    if (!evento) {
        throw new AppException('Evento non trovato', 404);
    }

    let calendarioVisibile = null;

    for (const calendario_id of evento.calendario_ids) {
        const calendario = await calendarioRepository.getCalendarioById(calendario_id);
        if (calendario && calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
            calendarioVisibile = calendario;
            break;
        }
    }

    if (!calendarioVisibile) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    const [eventoCompleto] = await aggiungiDatiEventi([evento], calendarioVisibile.colore);
    return eventoCompleto;
}

// Visualizza gli eventi di un calendario in ordine di data, eventualmente solo quelli di un periodo (da, a) con filtro (solo amministratore e membri che hanno accettato)
async function getEventiByCalendario(calendario_id, da, a, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    // Vincoli sulle date del filtro: prima il formato, poi che esista davvero (es. il 31 febbraio viene rifiutato)
    const filtro = {};

    for (const [nome, valore] of Object.entries({ da, a })) {
        if (valore === undefined) {
            continue;
        }

        if (typeof valore !== 'string' || !FORMATO_DATA.test(valore)) {
            throw new AppException('Data non valida: usa il formato AAAA-MM-GG', 400);
        }

        const data = new Date(valore);

        if (isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valore.slice(0, 10)) {
            throw new AppException('La data non esiste', 400);
        }

        filtro[nome] = data;
    }

    if (filtro.da && filtro.a && filtro.a < filtro.da) {
        throw new AppException('Periodo non valido: la data di fine non può essere prima della data di inizio', 400);
    }

    // "a" deve comprendere tutto l'ultimo giorno: "2026-10-31" vale 31 ottobre alle 00:00,
    // quindi sposto il limite al 1° novembre alle 00:00 (+1 giorno). Se c'è già l'orario, basta +1 millisecondo
    let fino = null;
    if (filtro.a) {
        fino = new Date(filtro.a.getTime() + (a.length === 10 ? UN_GIORNO : 1));
    }

    const eventi = await eventoRepository.getEventiByCalendario(calendario_id, filtro.da || null, fino);

    return aggiungiDatiEventi(eventi, calendario.colore);
}

// Visualizza gli eventi collegati a un tag, in ordine di data (solo amministratore e membri che hanno accettato)
async function getEventiByTag(tag_id, utente_id) {
    const tag = await tagRepository.getTagById(tag_id);

    if (!tag) {
        throw new AppException('Tag non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(tag.calendario_id);

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    const eventi = await eventoRepository.getEventiByTag(tag_id);

    return aggiungiDatiEventi(eventi, calendario.colore);
}

// Aggiunge un tag a un evento, verificando i permessi
async function addTag(evento_id, tag_id, utente_id) {
    const evento = await eventoRepository.getEventoById(evento_id);

    if (!evento) {
        throw new AppException('Evento non trovato', 404);
    }

    const puoModificare = await puoModificareEvento(evento, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questo evento', 403);
    }

    if (!tag_id) {
        throw new AppException('Il tag è obbligatorio', 400);
    }

    const tag = await tagRepository.getTagById(tag_id);

    if (!tag) {
        throw new AppException('Tag non trovato', 404);
    }

    // I tag sono di un calendario: si possono usare solo sugli eventi di quel calendario
    if (!evento.calendario_ids.includes(tag.calendario_id)) {
        throw new AppException('Il tag non appartiene a nessuno dei calendari dell\'evento', 400);
    }

    if (evento.tag_ids.includes(tag_id)) {
        throw new AppException('Il tag è già collegato a questo evento', 409);
    }

    const eventoAggiornato = await eventoRepository.addTag(evento_id, tag_id, utente_id);
    const primoCalendario = await calendarioRepository.getCalendarioById(evento.calendario_ids[0]);

    const [eventoCompleto] = await aggiungiDatiEventi([eventoAggiornato], primoCalendario ? primoCalendario.colore : null);
    return eventoCompleto;
}

// Rimuove un tag da un evento, verificando i permessi
async function removeTag(evento_id, tag_id, utente_id) {
    const evento = await eventoRepository.getEventoById(evento_id);

    if (!evento) {
        throw new AppException('Evento non trovato', 404);
    }

    const puoModificare = await puoModificareEvento(evento, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questo evento', 403);
    }

    if (!tag_id) {
        throw new AppException('Il tag è obbligatorio', 400);
    }

    if (!evento.tag_ids.includes(tag_id)) {
        throw new AppException('Il tag non è collegato a questo evento', 400);
    }

    const eventoAggiornato = await eventoRepository.removeTag(evento_id, tag_id, utente_id);
    const primoCalendario = await calendarioRepository.getCalendarioById(evento.calendario_ids[0]);

    const [eventoCompleto] = await aggiungiDatiEventi([eventoAggiornato], primoCalendario ? primoCalendario.colore : null);
    return eventoCompleto;
}

module.exports = {
    createEvento,
    updateSingolaOccorrenza,
    updateSerieCompleta,
    deleteSingolaOccorrenza,
    deleteSerieCompleta,
    getEventoById,
    getEventiByCalendario,
    getEventiByTag,
    addTag,
    removeTag
};