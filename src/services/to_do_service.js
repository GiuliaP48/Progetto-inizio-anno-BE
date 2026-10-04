
const AppException = require('../eccezioni/app_eccezioni');

const todoRepository = require('../repository/to_do_repository');
const calendarioRepository = require('../repository/calendario_repository');
const utenteRepository = require('../repository/utente_repository');

const calendarioService = require('./calendario_service');

// Valori ammessi dall'enum TipoFrequenza
const TIPI_VALIDI = ['giornaliera', 'settimanale', 'mensile'];

// Valori ammessi dall'enum Priorita
const PRIORITA_VALIDE = ['bassa', 'media', 'alta'];

// Ordinamenti ammessi per la lista
const ORDINI_VALIDI = ['posizione', 'alfabetico', 'data_creazione', 'priorita'];

const LUNGHEZZA_MASSIMA_TITOLO = 100;

// Titolo usato quando non ne viene indicato uno
const TITOLO_PREDEFINITO = 'To-do';

// Data nel formato AAAA-MM-GG, con l'orario facoltativo (es. 2026-09-28 oppure 2026-09-28T10:00:00.000Z)
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

// Controlla i dati di un todo e restituisce solo i campi ammessi
function validaTodo(dati, parziale = false) {
    const risultato = {};

    // In creazione data e tipo sono obbligatori
    if (!parziale && (!dati.data_originale || !dati.tipo)) {
        throw new AppException('Data e tipo sono obbligatori', 400);
    }

    // Vincoli sul titolo: è facoltativo, se manca o è vuoto diventa "To-do"
    if (dati.titolo !== undefined || !parziale) {
        if (dati.titolo !== undefined && dati.titolo !== null && typeof dati.titolo !== 'string') {
            throw new AppException('Il titolo deve essere un testo', 400);
        }

        const titolo = (dati.titolo || '').trim();

        if (titolo.length > LUNGHEZZA_MASSIMA_TITOLO) {
            throw new AppException(`Il titolo può avere al massimo ${LUNGHEZZA_MASSIMA_TITOLO} caratteri`, 400);
        }

        risultato.titolo = titolo || TITOLO_PREDEFINITO;
    }

    // Vincoli sulla data: prima il formato, poi che esista davvero (es. il 31 febbraio viene rifiutato)
    if (dati.data_originale !== undefined) {
        if (typeof dati.data_originale !== 'string' || !FORMATO_DATA.test(dati.data_originale)) {
            throw new AppException('Data non valida: usa il formato AAAA-MM-GG', 400);
        }

        const data = new Date(dati.data_originale);

        if (isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dati.data_originale.slice(0, 10)) {
            throw new AppException('La data non esiste', 400);
        }

        risultato.data_originale = data;
    }

    // Vincoli sul tipo
    if (dati.tipo !== undefined) {
        if (!TIPI_VALIDI.includes(dati.tipo)) {
            throw new AppException('Tipo non valido: usa giornaliera, settimanale o mensile', 400);
        }

        risultato.tipo = dati.tipo;
    }

    // Vincoli sulla priorità: è facoltativa, in modifica null la toglie
    if (dati.priorita !== undefined) {
        if (dati.priorita === null) {
            if (parziale) {
                risultato.priorita = null;
            }
        } else if (!PRIORITA_VALIDE.includes(dati.priorita)) {
            throw new AppException('Priorità non valida: usa bassa, media o alta', 400);
        } else {
            risultato.priorita = dati.priorita;
        }
    }

    // Vincoli sulla posizione: è facoltativa, se c'è deve essere un intero da 0 in su
    if (dati.posizione !== undefined) {
        if (!Number.isInteger(dati.posizione) || dati.posizione < 0) {
            throw new AppException('La posizione deve essere un numero intero maggiore o uguale a 0', 400);
        }

        risultato.posizione = dati.posizione;
    }

    return risultato;
}

// Porta la data all'inizio del periodo a cui si riferisce il todo:
// giornaliera --> quel giorno, settimanale --> il lunedì della settimana, mensile --> il giorno 1 del mese.
// Il momento in cui il todo è stato creato resta comunque salvato in creato_il.
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

// Prepara i todo per la risposta: nome e cognome di chi li ha creati e modificati.
// Con conElementi = true --> mostra tutti gli elementi, con nome e cognome di chi li ha creati, completati e modificati
// con conElementi = false --> mostra solo quanti elementi ci sono e quanti sono completati (per visualizza lista todo)
async function aggiungiDatiTodo(todos, conElementi) {
    const ids = new Set();
    todos.forEach(todo => {
        if (todo.creato_da) ids.add(todo.creato_da);
        if (todo.modificato_da) ids.add(todo.modificato_da);

        if (conElementi) {
            todo.elementi.forEach(elemento => {
                if (elemento.creato_da) ids.add(elemento.creato_da);
                if (elemento.completato_da) ids.add(elemento.completato_da);
                if (elemento.modificato_da) ids.add(elemento.modificato_da);
            });
        }
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

    return todos.map(todo => {
        const { creato_da, creato_il, modificato_da, modificato_il, elementi, ...dati } = todo;

        const todoCompleto = {
            ...dati,
            creato_da: datiPersona(creato_da),
            creato_il,
            modificato_da: datiPersona(modificato_da),
            modificato_il,
        };

        if (conElementi) {
            // Preparo ogni elemento come nella lista degli elementi:
            // con nome e cognome di chi l'ha creato, completato e modificato, così il frontend lo riceve sempre nella stessa forma
            todoCompleto.elementi = elementi.map(elemento => {
                const { completato_da, creato_da, creato_il, modificato_da, modificato_il, ...datiElemento } = elemento;
                return {
                    ...datiElemento,
                    completato_da: datiPersona(completato_da),
                    creato_da: datiPersona(creato_da),
                    creato_il,
                    modificato_da: datiPersona(modificato_da),
                    modificato_il,
                };
            });
        } else {
            todoCompleto.numero_elementi = elementi.length;
            todoCompleto.numero_completati = elementi.filter(elemento => elemento.completato).length;
        }

        return todoCompleto;
    });
}

// Creazione di un nuovo todo in un calendario, verificando i permessi
async function createTodo(calendario_id, titolo, data_originale, tipo, priorita, posizione, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a creare todo in questo calendario', 403);
    }

    const dati = validaTodo({ titolo, data_originale, tipo, priorita, posizione });

    // Se la posizione non è stata inviata, il todo va in fondo alla lista
    let posizioneFinale = dati.posizione;
    if (posizioneFinale === undefined) {
        const ultimaPosizione = await todoRepository.getUltimaPosizione(calendario_id);
        posizioneFinale = ultimaPosizione === null ? 0 : ultimaPosizione + 1;
    }

    // All'inizio la data originale e quella attuale coincidono
    const data = inizioPeriodo(dati.data_originale, dati.tipo);

    const nuovoTodo = await todoRepository.createTodo({
        titolo: dati.titolo,
        data_originale: data,
        data_attuale: data,
        tipo: dati.tipo,
        priorita: dati.priorita,
        posizione: posizioneFinale,
        calendario_id,
        creato_da: utente_id,
    });

    const [todoCompleto] = await aggiungiDatiTodo([nuovoTodo], true);
    return todoCompleto;
}

// Ricerca todo tramite id, con i suoi elementi (solo amministratore e membri che hanno accettato)
async function getTodoById(id, utente_id) {
    const todo = await todoRepository.getTodoById(id);

    if (!todo) {
        throw new AppException('Todo non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    const [todoCompleto] = await aggiungiDatiTodo([todo], true);
    return todoCompleto;
}

// Ricerca di tutti i todo di un calendario, filtrati per tipo e periodo, con ordinamento opzionale
// (solo amministratore e membri che hanno accettato)
async function getTodosByCalendario(calendario_id, tipo, data, ordine, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    // Vincoli sul tipo
    if (tipo !== undefined && !TIPI_VALIDI.includes(tipo)) {
        throw new AppException('Tipo non valido: usa giornaliera, settimanale o mensile', 400);
    }

    // Vincoli sulla data: prima il formato, poi che esista davvero (es. il 31 febbraio viene rifiutato)
    let dataRiferimento = null;
    if (data !== undefined) {
        if (typeof data !== 'string' || !FORMATO_DATA.test(data)) {
            throw new AppException('Data non valida: usa il formato AAAA-MM-GG', 400);
        }

        dataRiferimento = new Date(data);

        if (isNaN(dataRiferimento.getTime()) || dataRiferimento.toISOString().slice(0, 10) !== data.slice(0, 10)) {
            throw new AppException('La data non esiste', 400);
        }
    }

    // Vincoli sull'ordinamento
    if (ordine !== undefined && !ORDINI_VALIDI.includes(ordine)) {
        throw new AppException('Ordine non valido: usa posizione, alfabetico, data_creazione o priorita', 400);
    }

    const tuttiTodos = await todoRepository.getTodosByCalendario(calendario_id);

    // Con una data si mostrano i todo che in quel periodo sono da fare (data attuale)
    const todosFiltrati = tuttiTodos.filter(todo => {
        if (tipo && todo.tipo !== tipo) {
            return false;
        }
        if (dataRiferimento
            && todo.data_attuale.getTime() !== inizioPeriodo(dataRiferimento, todo.tipo).getTime()) {
            return false;
        }
        return true;
    });

    switch (ordine) {
        case 'alfabetico':
            todosFiltrati.sort((primoTodo, secondoTodo) =>
                (primoTodo.titolo || '').localeCompare(secondoTodo.titolo || '')
            );
            break;

        case 'data_creazione':
            todosFiltrati.sort((primoTodo, secondoTodo) =>
                new Date(primoTodo.creato_il) - new Date(secondoTodo.creato_il)
            );
            break;

        case 'priorita': {
            const valorePriorita = { alta: 0, media: 1, bassa: 2 };
            todosFiltrati.sort((primoTodo, secondoTodo) => {
                const prioritaPrimoTodo = valorePriorita[primoTodo.priorita] ?? 3;
                const prioritaSecondoTodo = valorePriorita[secondoTodo.priorita] ?? 3;

                if (prioritaPrimoTodo !== prioritaSecondoTodo) {
                    return prioritaPrimoTodo - prioritaSecondoTodo;
                }

                return new Date(primoTodo.creato_il) - new Date(secondoTodo.creato_il);
            });
            break;
        }

        case 'posizione':
        default:
            todosFiltrati.sort((primoTodo, secondoTodo) =>
                primoTodo.posizione - secondoTodo.posizione
            );
    }

    return aggiungiDatiTodo(todosFiltrati, false);
}

// Modifica di un todo, verificando i permessi: si possono cambiare solo titolo, data, tipo, priorità e posizione
async function updateTodo(id, dati, utente_id) {
    const todo = await todoRepository.getTodoById(id);

    if (!todo) {
        throw new AppException('Todo non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a modificare questo todo', 403);
    }

    const datiValidati = validaTodo(dati, true);

    if (Object.keys(datiValidati).length === 0) {
        throw new AppException('Nessun campo valido da modificare', 400);
    }

    // Se in modifica cambiano la data o il tipo, la data va ricalcolata.
    // Per il calcolo servono tutti e due: se ne è stato mandato solo uno, per l'altro si usa il valore che il todo ha già.
    // Si può fare solo se il todo non è mai stato rimandato; la data attuale segue quella originale.
    if (datiValidati.data_originale || datiValidati.tipo) {
        if (todo.volte_rimandato > 0) {
            throw new AppException('Non si possono cambiare tipo e data di un todo già rimandato', 400);
        }

        const data = datiValidati.data_originale || todo.data_originale;
        const tipo = datiValidati.tipo || todo.tipo;
        datiValidati.data_originale = inizioPeriodo(data, tipo);
        datiValidati.data_attuale = datiValidati.data_originale;
    }

    const todoAggiornato = await todoRepository.updateTodo(id, {
        ...datiValidati,
        modificato_da: utente_id,
    });

    const [todoCompleto] = await aggiungiDatiTodo([todoAggiornato], true);
    return todoCompleto;
}

// Eliminazione di un todo insieme ai suoi elementi, verificando i permessi
async function deleteTodo(id, utente_id) {
    const todo = await todoRepository.getTodoById(id);

    if (!todo) {
        throw new AppException('Todo non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a eliminare questo todo', 403);
    }

    return todoRepository.deleteTodo(id);
}

// Rimanda l'intero todo al periodo successivo, incrementando il contatore volte_rimandato
async function postponeTodo(id, utente_id) {
    const todo = await todoRepository.getTodoById(id);

    if (!todo) {
        throw new AppException('Todo non trovato', 404);
    }

    const calendario = await calendarioRepository.getCalendarioById(todo.calendario_id);

    const puoModificare = await calendarioService.puoModificareCalendario(calendario, utente_id);

    if (!puoModificare) {
        throw new AppException('Non autorizzato a rimandare questo todo', 403);
    }

    if (todo.data_completamento) {
        throw new AppException('Non si può rimandare un todo già completato', 400);
    }

    // Il todo passa al periodo dopo:
    // giornaliera --> il giorno dopo, settimanale --> il lunedì dopo, mensile --> il giorno 1 del mese dopo
    const anno = todo.data_attuale.getUTCFullYear();
    const mese = todo.data_attuale.getUTCMonth();
    const giorno = todo.data_attuale.getUTCDate();

    let nuovaData = new Date(Date.UTC(anno, mese, giorno + 1));

    if (todo.tipo === 'settimanale') {
        nuovaData = new Date(Date.UTC(anno, mese, giorno + 7));
    }

    if (todo.tipo === 'mensile') {
        nuovaData = new Date(Date.UTC(anno, mese + 1, 1));
    }

    const todoAggiornato = await todoRepository.updateTodo(id, {
        data_attuale: nuovaData,
        volte_rimandato: todo.volte_rimandato + 1,
        modificato_da: utente_id,
    });

    const [todoCompleto] = await aggiungiDatiTodo([todoAggiornato], true);
    return todoCompleto;
}

// Calcola il resoconto di un periodo (giornaliero, settimanale, mensile):
// i todo rimandati da quel periodo contano come rimandati, quelli ancora lì come completati o da fare
// (solo amministratore e membri che hanno accettato)
async function getResoconto(calendario_id, periodo, data, utente_id) {
    const calendario = await calendarioRepository.getCalendarioById(calendario_id);

    if (!calendario) {
        throw new AppException('Calendario non trovato', 404);
    }

    if (!calendarioService.utentePuoVedereCalendario(calendario, utente_id)) {
        throw new AppException('Non hai accesso a questo calendario', 403);
    }

    // Vincoli sul periodo
    if (!periodo) {
        throw new AppException('Il periodo è obbligatorio: usa giornaliera, settimanale o mensile', 400);
    }

    if (!TIPI_VALIDI.includes(periodo)) {
        throw new AppException('Periodo non valido: usa giornaliera, settimanale o mensile', 400);
    }

    // Vincoli sulla data: prima il formato, poi che esista davvero (es. il 31 febbraio viene rifiutato).
    // Se non viene indicata si usa oggi, senza l'ora.
    const adesso = new Date();
    let dataRiferimento = new Date(Date.UTC(adesso.getFullYear(), adesso.getMonth(), adesso.getDate()));

    if (data !== undefined) {
        if (typeof data !== 'string' || !FORMATO_DATA.test(data)) {
            throw new AppException('Data non valida: usa il formato AAAA-MM-GG', 400);
        }

        dataRiferimento = new Date(data);

        if (isNaN(dataRiferimento.getTime()) || dataRiferimento.toISOString().slice(0, 10) !== data.slice(0, 10)) {
            throw new AppException('La data non esiste', 400);
        }
    }

    const inizio = inizioPeriodo(dataRiferimento, periodo);

    // Ultimo giorno del periodo:
    // giornaliera --> lo stesso giorno, settimanale --> la domenica, mensile --> l'ultimo giorno del mese
    // (il giorno 0 del mese dopo è l'ultimo giorno di questo mese)
    const anno = inizio.getUTCFullYear();
    const mese = inizio.getUTCMonth();
    const giorno = inizio.getUTCDate();

    let fine = new Date(Date.UTC(anno, mese, giorno));

    if (periodo === 'settimanale') {
        fine = new Date(Date.UTC(anno, mese, giorno + 6));
    }

    if (periodo === 'mensile') {
        fine = new Date(Date.UTC(anno, mese + 1, 0));
    }

    const tuttiTodos = await todoRepository.getTodosByCalendario(calendario_id);

    // Scelgo i todo che sono passati da questo periodo, cioè quelli che:
    // - sono dello stesso tipo del resoconto (es. solo i settimanali per il resoconto settimanale)
    // - sono nati in questo periodo o prima (data_originale <= inizio)
    // - adesso si trovano in questo periodo o dopo (data_attuale >= inizio), perché magari sono stati rimandati
    const todosDelPeriodo = tuttiTodos.filter(todo =>
        todo.tipo === periodo && todo.data_originale.getTime() <= inizio.getTime() && todo.data_attuale.getTime() >= inizio.getTime()
    );

    let completati = 0;
    let rimandati = 0;
    let daFare = 0;

    for (const todo of todosDelPeriodo) {
        if (todo.data_attuale.getTime() > inizio.getTime()) {
            rimandati++;
        } else if (todo.data_completamento) {
            completati++;
        } else {
            daFare++;
        }
    }

    const totale = todosDelPeriodo.length;
    const percentuale = (numero) => (totale > 0 ? Math.round((numero / totale) * 100) : 0);

    return {
        periodo,
        data_inizio: inizio,
        data_fine: fine,
        totale,
        completati,
        rimandati,
        da_fare: daFare,
        percentuale_completati: percentuale(completati),
        percentuale_rimandati: percentuale(rimandati),
    };
}

// Todo ancora da fare per oggi, in tutti i calendari dell'utente (calendario_ids), per il riepilogo di oggi:
// giornalieri di oggi, settimanali di questa settimana, mensili di questo mese, in ordine di posizione
async function getTodosOggi(calendario_ids, oggi) {
    const todos = await todoRepository.getTodosByCalendariEPeriodi(calendario_ids, {
        giornaliera: inizioPeriodo(oggi, 'giornaliera'),
        settimanale: inizioPeriodo(oggi, 'settimanale'),
        mensile: inizioPeriodo(oggi, 'mensile'),
    });

    const daFare = todos.filter(todo => !todo.data_completamento);

    daFare.sort((primoTodo, secondoTodo) => primoTodo.posizione - secondoTodo.posizione);

    return aggiungiDatiTodo(daFare, false);
}

module.exports = {
    createTodo,
    getTodoById,
    getTodosByCalendario,
    updateTodo,
    deleteTodo,
    postponeTodo,
    getResoconto,
    getTodosOggi
}